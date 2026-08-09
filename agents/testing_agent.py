import os
import re
import ast
import ssl
import urllib.request

from clients.playwright_checker import PlaywrightChecker


class TestingAgent:
    def __init__(self, frontend_agent, backend_agent, max_iterations: int = 4):
        self.frontend_agent = frontend_agent
        self.backend_agent = backend_agent
        self.max_iterations = max_iterations

    #  individual checks 

    def check_html(self, html: str) -> list:
        errors = []
        if not html or "<html" not in html.lower():
            errors.append("index.html is missing or not a valid HTML document.")
        if 'href="style.css"' not in html and "href='style.css'" not in html:
            errors.append("index.html does not link style.css correctly.")
        if 'src="script.js"' not in html and "src='script.js'" not in html:
            errors.append("index.html does not link script.js correctly.")
        if re.search(r"lorem ipsum", html, re.IGNORECASE):
            errors.append("index.html still contains lorem ipsum placeholder text.")
        if re.search(r'href="#"\s*>', html) and html.count('href="#"') > 2:
            errors.append("Multiple dead '#' nav links found instead of real section anchors.")
        # every internal anchor link should have a matching id somewhere
        anchor_targets = re.findall(r'href="#([\w-]+)"', html)
        for target in set(anchor_targets):
            if f'id="{target}"' not in html:
                errors.append(f"Nav link points to #{target} but no element with id=\"{target}\" exists.")
        if ".html\"" in html or ".html'" in html:
            errors.append("Found a .html reference inside internal links; only clean root-relative links/anchors should be used.")
        return errors

    def check_css(self, css: str) -> list:
        errors = []
        if not css or len(css.strip()) < 50:
            errors.append("style.css is empty or too minimal to be a real design.")
        if css.count("{") != css.count("}"):
            errors.append("style.css has mismatched braces ({ vs }).")
        return errors

    def check_js(self, js: str) -> list:
        errors = []
        if js is None:
            errors.append("script.js is missing.")
            return errors
        if js.count("{") != js.count("}"):
            errors.append("script.js has mismatched braces ({ vs }).")
        if js.count("(") != js.count(")"):
            errors.append("script.js has mismatched parentheses.")
        return errors

    def check_python_syntax(self, code: str) -> list:
        errors = []
        try:
            ast.parse(code)
        except SyntaxError as e:
            errors.append(f"app.py has a Python syntax error: {e}")
        if "app.run(" not in code:
            errors.append("app.py never calls app.run(), the server would not start.")
        if 'send_from_directory(FRONTEND_DIR, "index.html")' not in code:
            errors.append("app.py root route does not correctly serve index.html.")
        return errors

    def check_image_links(self, image_urls: list) -> list:
        errors = []
        for url in image_urls[:6]:  # sample-check, avoid hammering network
            if not url or not url.startswith("http"):
                errors.append(f"Invalid image URL found: {url}")
                continue
            try:
                ctx = ssl.create_default_context()
                req = urllib.request.Request(url, method="HEAD")
                urllib.request.urlopen(req, timeout=8, context=ctx)
            except Exception:
                errors.append(f"Image URL did not respond / may be broken: {url}")
        return errors

    def _categorize_frontend_errors(self, frontend_errors: list):
        """
        Splits the combined frontend error list into which file(s) each error
        actually concerns, so the fix-loop only has to ask the Frontend Agent
        to regenerate what's actually broken instead of all three files every
        time (which triples LLM calls and burns through free-tier quota fast).
        Ambiguous live-browser errors (e.g. page failed to load entirely) are
        conservatively assigned to all three stages since we can't localize them.
        """
        html_errors, css_errors, js_errors = [], [], []
        for e in frontend_errors:
            if e.startswith("[frontend/html]") or e.startswith("[images]"):
                html_errors.append(e)
            elif e.startswith("[frontend/css]"):
                css_errors.append(e)
            elif e.startswith("[frontend/js]"):
                js_errors.append(e)
            elif "[live]" in e:
                if "[live][console]" in e or "[live][js-runtime]" in e or "Contact form interaction" in e:
                    js_errors.append(e)
                elif "Horizontal overflow" in e:
                    css_errors.append(e)
                elif "Nav link" in e or "Broken image" in e or "<title>" in e or "body appears empty" in e:
                    html_errors.append(e)
                else:
                    # can't localize it - be safe and flag all three
                    html_errors.append(e)
                    css_errors.append(e)
                    js_errors.append(e)
        return html_errors, css_errors, js_errors

    # ---------- full pipeline with fix-loop ----------

    def run_full_test_and_fix(self, project_slug: str, brief: dict,
                                frontend_output: dict, backend_code: str,
                                runtime_collections: dict, project_dir: str = None,
                                run_live_browser_checks: bool = True) -> dict:
        """
        project_dir: if provided, the (frontend_dir=project_dir/frontend, app.py=project_dir/app.py)
        are written to disk on every iteration so Playwright can actually launch and test them.
        """
        report = {"iterations": [], "passed": False}
        frontend_dir = os.path.join(project_dir, "frontend") if project_dir else None

        for i in range(1, self.max_iterations + 1):
            errors = []
            errors += [f"[frontend/html] {e}" for e in self.check_html(frontend_output["html"])]
            errors += [f"[frontend/css] {e}" for e in self.check_css(frontend_output["css"])]
            errors += [f"[frontend/js] {e}" for e in self.check_js(frontend_output["js"])]
            errors += [f"[backend] {e}" for e in self.check_python_syntax(backend_code)]
            errors += [f"[images] {e}" for e in self.check_image_links(frontend_output.get("images_used", []))]

            live_errors = []
            if not errors and run_live_browser_checks and project_dir:
                # static checks clean -> write current version to disk and run a real browser test
                self.frontend_agent.write_to_disk(frontend_dir, frontend_output)
                self.backend_agent.write_to_disk(project_dir, backend_code)
                try:
                    live_errors = PlaywrightChecker(project_dir).run()
                except Exception as e:
                    live_errors = [f"[live] Playwright check could not run: {e}"]
                errors += live_errors

            report["iterations"].append({
                "iteration": i,
                "errors": errors,
                "live_browser_errors": live_errors,
            })

            if not errors:
                report["passed"] = True
                report["final_iteration"] = i
                break

            # decide who is responsible and ask them to fix it
            frontend_errors = [e for e in errors if e.startswith(("[frontend", "[images")) or "[live]" in e]
            backend_errors = [e for e in errors if e.startswith("[backend") or "[live][js-runtime]" in e
                               or "/api/contact" in e or "Backend server failed" in e]

            if frontend_errors:
                html_errs, css_errs, js_errs = self._categorize_frontend_errors(frontend_errors)
                target_stages = set()
                if html_errs:
                    target_stages.add("html")
                if css_errs:
                    target_stages.add("css")
                if js_errs:
                    target_stages.add("js")
                print(f"[TestingAgent] Frontend fix targets this iteration: {sorted(target_stages) or 'none'}")
                frontend_output = self.frontend_agent.build(
                    brief,
                    error_feedback="\n".join(frontend_errors),
                    existing=frontend_output,
                    target_stages=target_stages,
                )
            if backend_errors:
                backend_code = self.backend_agent.build(project_slug, brief, runtime_collections)

        report["frontend_output"] = frontend_output
        report["backend_code"] = backend_code
        return report