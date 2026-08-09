"""
app.py
Web entry point for the website-automation pipeline.

Run:
    python app.py

Then open http://localhost:5050 — this serves the WebForge AI dashboard
(templates/index.html + static/style.css + static/script.js) and wires it
to the real multi-agent pipeline (CEO -> Frontend -> Database -> Backend ->
Testing -> Netlify deploy) over a small JSON + Server-Sent-Events API,
instead of the old CLI-only main.py.

This file does not replace main.py / orchestrator.py's CLI usage — both
still work exactly as before. It's an additional, non-interactive way to
trigger the same pipeline from a browser UI.
"""
import os
import sys
import json
import re
import uuid
import queue
import threading

from flask import Flask, request, jsonify, Response, render_template
from flask_cors import CORS
from dotenv import load_dotenv

load_dotenv()

from orchestrator import run_pipeline_web, GENERATED_DIR
from clients.mongo_client import MongoStore

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ENV_PATH = os.path.join(BASE_DIR, ".env")

# Only forward these top-level pipeline-stage lines to the web UI's log —
# everything else (NvidiaClient/GeminiClient retry chatter, the raw brief
# JSON dump, FrontendAgent/TestingAgent internal sub-steps, token-limit
# warnings, etc.) still prints to the server terminal as before, it's just
# not pushed into the browser's log stream.
MAIN_LOG_PATTERN = re.compile(
    r'^\[(CEO Agent|Frontend Agent|Database Agent|Backend Agent|Testing Agent|GitHub Agent|Netlify Agent)\]'
)

# Env keys the Settings tab is allowed to read/write. NVIDIA_API_KEY,
# GEMINI_API_KEY, UNSPLASH_ACCESS_KEY and NETLIFY_TOKEN are still read from
# .env by the pipeline as before, but are no longer editable from the
# Settings tab — only these four are exposed there:
SENSITIVE_ENV_KEYS = {"MONGO_URI", "GITHUB_TOKEN"}
PLAIN_ENV_KEYS = {"GITHUB_USERNAME", "GITHUB_REPO_NAME"}
ALLOWED_ENV_KEYS = SENSITIVE_ENV_KEYS | PLAIN_ENV_KEYS

# templates/ and static/ live inside the UI/ folder, not next to app.py
app = Flask(__name__, template_folder="UI/templates", static_folder="UI/static")
CORS(app)

# ---- in-memory run registry (single-process; fine for a local dev tool) ----
RUNS = {}
RUN_LOCK = threading.Lock()
CURRENT_RUN_ID = {"id": None}


class _TeeStream:
    """Mirrors everything written to stdout into a run's event queue too,
    so every print() already scattered through the agents (NvidiaClient
    retries, FrontendAgent stage progress, etc.) shows up live in the UI's
    terminal log without having to touch those files."""

    def __init__(self, original, q):
        self.original = original
        self.q = q
        self.buffer = ""

    def write(self, s):
        try:
            self.original.write(s)
        except Exception:
            pass
        self.buffer += s
        while "\n" in self.buffer:
            line, self.buffer = self.buffer.split("\n", 1)
            stripped = line.strip()
            if stripped and MAIN_LOG_PATTERN.match(stripped):
                self.q.put({"type": "log", "text": stripped})

    def flush(self):
        try:
            self.original.flush()
        except Exception:
            pass


def _execute(run_id: str, user_request: str, push_to_github: bool):
    run = RUNS[run_id]
    q = run["queue"]
    old_stdout = sys.stdout
    sys.stdout = _TeeStream(old_stdout, q)
    try:
        result = run_pipeline_web(
            user_request,
            emit=lambda evt: q.put(evt),
            push_to_github=push_to_github,
            deploy_netlify=True,
        )
        run["result"] = result
        run["status"] = "done"
        q.put({"type": "complete", "result": result})
    except Exception as e:
        run["status"] = "error"
        q.put({"type": "error", "text": str(e)})
    finally:
        sys.stdout = old_stdout
        q.put({"type": "eof"})
        with RUN_LOCK:
            CURRENT_RUN_ID["id"] = None


# ---------------------------- routes ----------------------------

@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/run", methods=["POST"])
def api_run():
    data = request.get_json(force=True, silent=True) or {}
    user_request = (data.get("request") or "").strip()
    # Respect what the user chose in the UI; default to NOT pushing so a
    # build never silently pushes code to their GitHub without asking.
    push_to_github = bool(data.get("push_to_github", False))

    if not user_request:
        return jsonify({"error": "request is required"}), 400

    with RUN_LOCK:
        if CURRENT_RUN_ID["id"] is not None:
            return jsonify({"error": "A build is already running. Please wait for it to finish."}), 409
        run_id = uuid.uuid4().hex
        RUNS[run_id] = {
            "queue": queue.Queue(),
            "status": "running",
            "result": None,
            "request": user_request,
        }
        CURRENT_RUN_ID["id"] = run_id

    t = threading.Thread(target=_execute, args=(run_id, user_request, push_to_github), daemon=True)
    t.start()
    return jsonify({"run_id": run_id})


@app.route("/api/stream/<run_id>")
def api_stream(run_id):
    if run_id not in RUNS:
        return jsonify({"error": "unknown run_id"}), 404

    def gen():
        q = RUNS[run_id]["queue"]
        while True:
            item = q.get()
            yield f"data: {json.dumps(item)}\n\n"
            if item.get("type") == "eof":
                break

    return Response(
        gen(),
        mimetype="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.route("/api/history")
def api_history():
    try:
        store = MongoStore()
        slugs = store.list_projects()
        history = []
        for slug in reversed(slugs[-20:]):
            meta = store.get_section(slug, "meta") or {}
            testing = store.get_section(slug, "testing") or {}
            history.append({
                "slug": slug,
                "business_name": meta.get("business_name", slug),
                "business_type": meta.get("business_type", ""),
                "passed": bool(testing.get("passed", False)),
                "iterations": len(testing.get("iterations", []) or []),
            })
        return jsonify({"history": history})
    except Exception as e:
        return jsonify({"history": [], "error": str(e)})


@app.route("/api/settings", methods=["GET"])
def api_get_settings():
    """Returns current settings for the form. Sensitive keys only report
    whether they're configured (never their value); plain keys return the
    actual value so the form can be pre-filled."""
    result = {}
    for key in ALLOWED_ENV_KEYS:
        val = os.environ.get(key, "")
        if key in SENSITIVE_ENV_KEYS:
            result[key] = {"configured": bool(val)}
        else:
            result[key] = {"value": val}
    return jsonify(result)


def _update_env_file(updates: dict):
    lines = []
    if os.path.exists(ENV_PATH):
        with open(ENV_PATH, "r", encoding="utf-8") as f:
            lines = f.readlines()

    updated_keys = set()
    new_lines = []
    for line in lines:
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            new_lines.append(line)
            continue
        key = stripped.split("=", 1)[0].strip()
        if key in updates:
            new_lines.append(f"{key}={updates[key]}\n")
            updated_keys.add(key)
        else:
            new_lines.append(line)

    for key, value in updates.items():
        if key not in updated_keys:
            new_lines.append(f"{key}={value}\n")

    with open(ENV_PATH, "w", encoding="utf-8") as f:
        f.writelines(new_lines)

    # apply immediately to the running process too
    for key, value in updates.items():
        os.environ[key] = value


@app.route("/api/settings", methods=["POST"])
def api_post_settings():
    data = request.get_json(force=True, silent=True) or {}
    updates = {
        key: value.strip()
        for key, value in data.items()
        if key in ALLOWED_ENV_KEYS and isinstance(value, str) and value.strip()
    }
    if not updates:
        return jsonify({"error": "No changes to save."}), 400
    try:
        _update_env_file(updates)
    except Exception as e:
        return jsonify({"error": f"Could not write .env: {e}"}), 500
    return jsonify({"saved": list(updates.keys())})


@app.route("/api/push-github", methods=["POST"])
def api_push_github():
    data = request.get_json(force=True, silent=True) or {}
    slug = (data.get("slug") or "").strip()
    if not slug:
        return jsonify({"error": "slug is required"}), 400

    project_dir = os.path.join(GENERATED_DIR, slug)
    if not os.path.isdir(project_dir):
        return jsonify({"error": f"No generated project found for '{slug}'"}), 404

    try:
        from clients.github_client import GitHubPusher
        pusher = GitHubPusher()
        pushed = pusher.push_project(slug, project_dir)
        return jsonify({"pushed": pushed})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    port = int(os.environ.get("WEB_PORT", 5050))
    print("=" * 60)
    print(f" WebForge AI dashboard running at http://localhost:{port}")
    print("=" * 60)
    app.run(host="0.0.0.0", port=port, debug=False, threaded=True)