"""
Orchestrator.
This is the entry point you run. It wires the full hierarchy together:

User -> CEO Agent -> Frontend Agent -> Database Agent -> Backend Agent
     -> Testing Agent (fix loop) -> Admin Agent (admin panel + detail pages)
     -> CEO Agent asks user y/n -> GitHub Agent

Run: python orchestrator.py "I want a website for my bakery called Sunrise Bakes"
"""
import os
import sys
import json
import uuid
from dotenv import load_dotenv

load_dotenv()

from clients.nvidia_client import NvidiaClient
from clients.gemini_client import GeminiClient
from clients.unsplash_client import UnsplashClient
from clients.mongo_client import MongoStore
from agents.ceo_agent import CEOAgent
from agents.frontend_agent import FrontendAgent
from agents.database_agent import DatabaseAgent
from agents.backend_agent import BackendAgent
from agents.testing_agent import TestingAgent
from agents.admin_agent import AdminAgent

GENERATED_DIR = os.path.join(os.path.dirname(__file__), "generated_projects")


def run_pipeline(user_request: str, ask_for_github: bool = True):
    print("\n[CEO Agent] Understanding the request...")
    nvidia = NvidiaClient()
    ceo = CEOAgent(nvidia)
    brief = ceo.create_brief(user_request)
    print(f"[CEO Agent] Brief created for project: {brief['slug']}")
    print(json.dumps(brief, indent=2, ensure_ascii=False))

    project_slug = brief["slug"]
    project_dir = os.path.join(GENERATED_DIR, project_slug)
    frontend_dir = os.path.join(project_dir, "frontend")

    print("\n[Frontend Agent] Designing the website...")
    unsplash = UnsplashClient()
    gemini = GeminiClient()  # free tier - does the actual design/code generation
    frontend = FrontendAgent(gemini, unsplash)
    frontend_output = frontend.build(brief)

    print("\n[Database Agent] Storing frontend output + preparing collections...")
    mongo = MongoStore()
    database_agent = DatabaseAgent(mongo)
    database_agent.save_meta(project_slug, brief)
    database_agent.save_frontend_output(project_slug, brief, frontend_output)
    runtime_collections = database_agent.prepare_runtime_collections(project_slug)

    print("\n[Backend Agent] Writing Flask backend...")
    backend = BackendAgent(nvidia)
    backend_code = backend.build(project_slug, brief, runtime_collections)
    database_agent.save_backend_output(project_slug, backend_code)

    print("\n[Testing Agent] Running tests and auto-fix loop...")
    tester = TestingAgent(frontend, backend)
    report = tester.run_full_test_and_fix(
        project_slug, brief, frontend_output, backend_code, runtime_collections,
        project_dir=project_dir,
    )
    database_agent.save_testing_report(project_slug, {
        "passed": report["passed"],
        "iterations": report["iterations"],
    })

    print("\n[Admin Agent] Building admin panel + 'View Details' pages...")
    admin_agent = AdminAgent()
    admin_processed = admin_agent.process(brief, report["frontend_output"]["html"])
    report["frontend_output"]["html"] = admin_processed["html"]

    # write final (possibly fixed) outputs to disk
    frontend.write_to_disk(frontend_dir, report["frontend_output"])
    backend.write_to_disk(project_dir, report["backend_code"])

    admin_assets = admin_agent.build_static_assets(brief)
    admin_content = admin_agent.write_to_disk(frontend_dir, admin_processed, admin_assets)
    database_agent.save_admin_content(project_slug, admin_content)
    print(f"[Admin Agent] {len(admin_content['editable'])} editable item(s), "
          f"{len(admin_content['details'])} detail page(s) wired up.")

    if report["passed"]:
        print(f"\n[Testing Agent] All checks passed after {report.get('final_iteration')} iteration(s).")
    else:
        print(f"\n[Testing Agent] WARNING: reached max iterations with remaining issues:")
        print(json.dumps(report["iterations"][-1]["errors"], indent=2, ensure_ascii=False))

    print(f"\nProject files are at: {project_dir}")
    print(f"Run it with: cd {project_dir} && pip install -r requirements.txt && python app.py")
    print(f"Then open http://localhost:5000")
    print(f"Admin panel: http://localhost:5000/admin "
          f"(password = ADMIN_PASSWORD in this project's .env, default 'admin123')")

    pushed = None
    if ask_for_github:
        if report["passed"]:
            ceo_question = ceo.confirm_push_prompt()
        else:
            ceo_question = (
                "The website has been generated, but some checks still have "
                "unresolved issues (see warning above). Do you want to push "
                "this project to GitHub anyway? (y/n)"
            )
        answer = input(f"\n[CEO Agent] {ceo_question} ")
        if ceo.should_push(answer):
            from clients.github_client import GitHubPusher
            print("[GitHub Agent] Pushing project to its own branch/folder...")
            pusher = GitHubPusher()
            pushed = pusher.push_project(project_slug, project_dir)
            print(f"[GitHub Agent] Pushed: {pushed['repo_url']} (branch: {pushed['branch']})")
        else:
            print("[CEO Agent] Ok, GitHub push skipped.")

    return {
        "project_slug": project_slug,
        "project_dir": project_dir,
        "passed": report["passed"],
        "pushed": pushed,
    }


def run_pipeline_web(user_request: str, emit=None, push_to_github: bool = True,
                      deploy_netlify: bool = True) -> dict:
    """
    Web-friendly variant of run_pipeline(). Never calls input() (no CLI
    prompts), so it's safe to call from a Flask request thread. Instead of
    asking the user y/n for GitHub, it takes `push_to_github` as a plain
    argument. After a successful build it also deploys the generated
    frontend to Netlify (unless deploy_netlify=False) and returns the live
    URL, so the UI can hand the user a direct link to view the site.

    `emit(event_dict)` — optional callback fired on agent state transitions,
    e.g. {"type": "agent_status", "agent": "ceo", "state": "active", "text": "Planning..."}
    so a web UI can drive a live pipeline visualization. All the regular
    print() calls made by the agents still happen too (a caller can tee
    stdout to capture full log detail).
    """
    def _emit(**kwargs):
        if emit:
            try:
                emit(kwargs)
            except Exception:
                pass

    _emit(type="agent_status", agent="ceo", state="active", text="Planning...")
    print("\n[CEO Agent] Understanding the request...")
    nvidia = NvidiaClient()
    ceo = CEOAgent(nvidia)
    brief = ceo.create_brief(user_request)
    print(f"[CEO Agent] Brief created for project: {brief['slug']}")
    print(json.dumps(brief, indent=2, ensure_ascii=False))
    _emit(type="agent_status", agent="ceo", state="done", text="Done")

    project_slug = brief["slug"]
    project_dir = os.path.join(GENERATED_DIR, project_slug)
    frontend_dir = os.path.join(project_dir, "frontend")

    _emit(type="agent_status", agent="fe", state="active", text="Building...")
    print("\n[Frontend Agent] Designing the website...")
    unsplash = UnsplashClient()
    gemini = GeminiClient()
    frontend = FrontendAgent(gemini, unsplash)
    frontend_output = frontend.build(brief)
    _emit(type="agent_status", agent="fe", state="done", text="Done")

    _emit(type="agent_status", agent="db", state="active", text="Designing...")
    print("\n[Database Agent] Storing frontend output + preparing collections...")
    mongo = MongoStore()
    database_agent = DatabaseAgent(mongo)
    database_agent.save_meta(project_slug, brief)
    database_agent.save_frontend_output(project_slug, brief, frontend_output)
    runtime_collections = database_agent.prepare_runtime_collections(project_slug)
    _emit(type="agent_status", agent="db", state="done", text="Done")

    _emit(type="agent_status", agent="be", state="active", text="Coding...")
    print("\n[Backend Agent] Writing Flask backend...")
    backend = BackendAgent(nvidia)
    backend_code = backend.build(project_slug, brief, runtime_collections)
    database_agent.save_backend_output(project_slug, backend_code)
    _emit(type="agent_status", agent="be", state="done", text="Done")

    _emit(type="agent_status", agent="te", state="active", text="Testing...")
    print("\n[Testing Agent] Running tests and auto-fix loop...")
    tester = TestingAgent(frontend, backend)
    report = tester.run_full_test_and_fix(
        project_slug, brief, frontend_output, backend_code, runtime_collections,
        project_dir=project_dir,
    )
    database_agent.save_testing_report(project_slug, {
        "passed": report["passed"],
        "iterations": report["iterations"],
    })

    iterations = len(report["iterations"])
    fixes = max(0, iterations - 1)

    if report["passed"]:
        print(f"\n[Testing Agent] All checks passed after {report.get('final_iteration')} iteration(s).")
        _emit(type="agent_status", agent="te", state="done", text=f"{iterations}/{iterations} Passed")
    else:
        print("\n[Testing Agent] WARNING: reached max iterations with remaining issues:")
        print(json.dumps(report["iterations"][-1]["errors"], indent=2, ensure_ascii=False))
        _emit(type="agent_status", agent="te", state="error", text="Issues found")

    _emit(type="agent_status", agent="admin", state="active", text="Wiring admin panel...")
    print("\n[Admin Agent] Building admin panel + 'View Details' pages...")
    admin_agent = AdminAgent()
    admin_processed = admin_agent.process(brief, report["frontend_output"]["html"])
    report["frontend_output"]["html"] = admin_processed["html"]

    frontend.write_to_disk(frontend_dir, report["frontend_output"])
    backend.write_to_disk(project_dir, report["backend_code"])

    admin_assets = admin_agent.build_static_assets(brief)
    admin_content = admin_agent.write_to_disk(frontend_dir, admin_processed, admin_assets)
    database_agent.save_admin_content(project_slug, admin_content)
    print(f"[Admin Agent] {len(admin_content['editable'])} editable item(s), "
          f"{len(admin_content['details'])} detail page(s) wired up.")
    _emit(type="agent_status", agent="admin", state="done", text="Ready")

    file_count = sum(len(files) for _, _, files in os.walk(project_dir))

    print(f"\nProject files are at: {project_dir}")

    result = {
        "project_slug": project_slug,
        "project_dir": project_dir,
        "frontend_dir": frontend_dir,
        "passed": report["passed"],
        "pushed": None,
        "netlify": None,
        "admin_panel_path": "/admin",
        "stats": {
            "iterations": iterations,
            "fixes": fixes,
            "files": file_count,
            "passed": report["passed"],
            "editable_items": len(admin_content["editable"]),
            "detail_pages": len(admin_content["details"]),
        },
    }

    if push_to_github:
        try:
            from clients.github_client import GitHubPusher
            print("\n[GitHub Agent] Pushing project to its own branch/folder...")
            pusher = GitHubPusher()
            pushed = pusher.push_project(project_slug, project_dir)
            print(f"[GitHub Agent] Pushed: {pushed['repo_url']} (branch: {pushed['branch']})")
            result["pushed"] = pushed
        except Exception as e:
            print(f"[GitHub Agent] Push failed: {e}")

    if deploy_netlify:
        _emit(type="agent_status", agent="deploy", state="active", text="Deploying...")
        try:
            from clients.netlify_client import NetlifyDeployer
            print("\n[Netlify Agent] Deploying static frontend to Netlify...")
            deployer = NetlifyDeployer()
            site_name = f"{project_slug}-{uuid.uuid4().hex[:6]}"
            deployed = deployer.deploy_directory(frontend_dir, site_name=site_name)
            print(f"[Netlify Agent] Live at: {deployed['url']}")
            result["netlify"] = deployed
            _emit(type="agent_status", agent="deploy", state="done", text="Live")
        except Exception as e:
            print(f"[Netlify Agent] Deploy failed: {e}")
            _emit(type="agent_status", agent="deploy", state="error", text="Failed")

    return result


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print('Usage: python orchestrator.py "describe the website you want"')
        sys.exit(1)
    request_text = " ".join(sys.argv[1:])
    run_pipeline(request_text)