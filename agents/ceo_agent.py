import json
import re
from clients.nvidia_client import NvidiaClient
from clients.mongo_client import slugify

CEO_SYSTEM_PROMPT = """You are the CEO Agent of a website-automation pipeline.
You receive a raw, possibly informal request from a user describing a website
they want built. Convert it into a strict JSON brief with these keys:

{
  "business_name": "short plausible business name",
  "business_type": "e.g. bakery, law firm, fitness gym, saas product",
  "tone": "one of: luxury, playful, corporate, minimal, bold, warm, modern",
  "primary_color_hint": "one short phrase, e.g. 'warm terracotta and cream'",
  "sections": ["home","about","services","gallery","testimonials","pricing","faq","contact"],
  "unsplash_query_topics": ["3-6 short image search queries relevant to this business"],
  "must_have_features": ["list of explicit features the user mentioned, if any"],
  "summary_for_frontend_agent": "2-4 sentence brief telling the frontend agent exactly what to build"
}

Only output valid JSON, nothing else, no markdown fences, no commentary.
Pick sections that make sense for the business type — do not always use the same list.

CRITICAL — READ THIS TWICE: you are the CEO Agent, not the coder. Even though
the user's request will often sound exactly like a build spec (mentions of
"hero section", specific colors, layout, CTAs, etc.), that is just raw
material for you to summarize into the JSON object above — it is NOT an
instruction for you to build anything. NEVER write HTML, CSS, JavaScript,
Python, or any other code. NEVER output file names like "index.html",
"styles.css", or "script.js". NEVER wrap anything in ``` code fences. Your
ENTIRE reply must be exactly one JSON object and nothing else — no prose
before it, no prose after it, no code of any kind. A separate Frontend Agent
handles all actual coding later in the pipeline; that is not your job.

IMPORTANT: this JSON is only a QUICK-REFERENCE SUMMARY for agents that need a
cheap high-level snapshot (naming, image search topics, etc). It is NOT the
only thing downstream agents see. The pipeline automatically appends the
user's full original request, verbatim, underneath whatever you write for
"summary_for_frontend_agent" — so keep that field SHORT (2-4 sentences of
gist only). Do not try to cram every literal detail into it yourself; the
full verbatim text is guaranteed to follow it and always wins if it conflicts
with anything you summarized anywhere in this JSON (exact image URLs, exact
fonts, exact file list, exact section list/structure, exact component
behavior, exact counts/timings, etc). Do not invent a generic default section
list ("home/about/services/gallery/testimonials/pricing/faq/contact") when
the user's request already defines its own structure; reflect what they
actually asked for instead.
"""

RAW_PROMPT_HEADER = (
    "\n\n--- FULL ORIGINAL USER REQUEST (verbatim — do not skip, drop, or "
    "paraphrase ANY of the following; this is the ground truth and takes "
    "priority over the summary above and over every other field in this "
    "brief) ---\n"
)

JSON_REPAIR_SYSTEM_PROMPT = """You will be given a piece of text that was
supposed to be a single valid JSON object but failed to parse, plus the exact
parser error. Output ONLY the corrected JSON object — valid, parseable JSON,
nothing else: no markdown fences, no commentary, no explanations. Preserve
every key and value from the original as closely as possible; only fix
syntax problems (quoting, commas, brackets, comments, etc)."""


def _strip_code_fences(text: str) -> str:
    return re.sub(r"^```json|^```|```$", "", text.strip(), flags=re.MULTILINE).strip()


def _sanitize_json_candidate(text: str) -> str:
    """Best-effort cleanup for the common ways an LLM's 'JSON' comes out
    slightly malformed: full-line // comments, /* */ comments, trailing
    commas before a closing bracket, and curly/smart quotes."""
    text = re.sub(r"^\s*//.*$", "", text, flags=re.MULTILINE)
    text = re.sub(r"/\*.*?\*/", "", text, flags=re.DOTALL)
    text = re.sub(r",(\s*[}\]])", r"\1", text)
    text = text.replace("\u201c", '"').replace("\u201d", '"')
    text = text.replace("\u2018", "'").replace("\u2019", "'")
    return text.strip()


class CEOAgent:
    def __init__(self, nvidia_client: NvidiaClient = None):
        self.nvidia = nvidia_client or NvidiaClient()

    def _try_parse(self, raw: str):
        """Tries progressively more forgiving strategies to turn `raw` into
        a dict. Returns None (never raises) if nothing worked, so the
        caller can decide what to do next."""
        candidates = [raw]
        sanitized = _sanitize_json_candidate(raw)
        if sanitized != raw:
            candidates.append(sanitized)

        match = re.search(r"\{.*\}", raw, re.DOTALL)
        if match:
            block = match.group(0)
            candidates.append(block)
            sanitized_block = _sanitize_json_candidate(block)
            if sanitized_block != block:
                candidates.append(sanitized_block)

        for candidate in candidates:
            try:
                return json.loads(candidate)
            except json.JSONDecodeError:
                continue
        return None

    def _repair_via_llm(self, raw: str):
        """Last-resort: ask the model to fix its own near-miss JSON. Only
        useful when `raw` was actually attempting to be JSON (a stray
        comment, trailing comma, etc) — not when the model went completely
        off-track, which create_brief() handles separately with a real
        corrective re-ask instead of a doomed 'repair'."""
        try:
            repaired = self.nvidia.reason(JSON_REPAIR_SYSTEM_PROMPT, raw, temperature=0)
            repaired = _strip_code_fences(repaired)
            return json.loads(repaired)
        except Exception:
            return None

    def create_brief(self, user_request: str) -> dict:
        raw = self.nvidia.reason(CEO_SYSTEM_PROMPT, user_request, temperature=0.3)
        raw = _strip_code_fences(raw)
        brief = self._try_parse(raw)

        if brief is None:
            # The model ignored its instructions entirely (e.g. wrote actual
            # HTML/CSS/JS/code instead of the JSON brief) rather than making
            # a small formatting slip. A JSON "repair" prompt can't fix text
            # that was never JSON to begin with, so re-ask for the real
            # thing once, with a sharper corrective reminder, before falling
            # back to repair.
            corrective_prompt = (
                user_request
                + "\n\n(Reminder: your entire reply must be ONLY the JSON brief "
                  "object described in your system instructions — one JSON "
                  "object, nothing else. Do not write HTML, CSS, JavaScript, "
                  "Python, or any other code, and do not use markdown code "
                  "fences. You are not building the website here, only "
                  "describing it in JSON.)"
            )
            raw_retry = self.nvidia.reason(CEO_SYSTEM_PROMPT, corrective_prompt, temperature=0.1)
            raw_retry = _strip_code_fences(raw_retry)
            retry_brief = self._try_parse(raw_retry)
            if retry_brief is not None:
                brief, raw = retry_brief, raw_retry

        if brief is None:
            brief = self._repair_via_llm(raw)

        if brief is None:
            raise RuntimeError(
                f"CEO Agent failed to produce a valid JSON brief after a retry. "
                f"Last raw model output was:\n{raw}"
            )
        if not isinstance(brief, dict):
            raise RuntimeError(
                f"CEO Agent brief parsed but was not a JSON object (got {type(brief).__name__}). "
                f"Raw model output was:\n{raw}"
            )

        brief["slug"] = slugify(brief.get("business_name") or brief.get("business_type") or "project")

        # CRITICAL: never let the lossy JSON summary above be the only thing
        # downstream agents see. This is done in CODE, not left to the LLM's
        # discretion, so it happens 100% of the time regardless of what the
        # model produced:
        #
        # 1) Append the user's ORIGINAL, UNMODIFIED request text (no LLM
        #    paraphrase, no truncation) directly onto summary_for_frontend_agent
        #    — the exact field the Frontend Agent reads for "what to build" —
        #    so it's physically impossible for the full request to be skipped
        #    on the way there.
        # 2) Also keep it as its own top-level field for any agent that wants
        #    the clean verbatim text without the short summary prefix.
        existing_summary = (brief.get("summary_for_frontend_agent") or "").strip()
        brief["summary_for_frontend_agent"] = existing_summary + RAW_PROMPT_HEADER + user_request
        brief["raw_user_prompt"] = user_request

        return brief

    def confirm_push_prompt(self) -> str:
        return (
            "The website has been generated and tested, everything is working properly. "
            "Do you want to push this project to GitHub? (y/n)"
        )

    def should_push(self, user_answer: str) -> bool:
        return user_answer.strip().lower() in ("y", "yes")