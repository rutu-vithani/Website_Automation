"""
Playwright-based live browser checks for the Testing Agent.

Unlike the static checks (HTML/CSS/JS sanity, Python syntax), this module
actually launches the generated Flask app as a subprocess, opens it in a
real headless browser, and verifies it behaves like a real working website:
- page loads with no console/page errors
- title/content actually rendered
- nav anchor links scroll to a real section (no dead links)
- contact form can be filled and submitted without a frontend/backend error
- responsive: no horizontal overflow at mobile/tablet/desktop widths
- no broken <img> elements (naturalWidth == 0)

Run requirement (one-time): `playwright install chromium`
"""
import os
import socket
import subprocess
import sys
import time

from playwright.sync_api import sync_playwright


def _free_port() -> int:
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.bind(("", 0))
    port = s.getsockname()[1]
    s.close()
    return port


def _wait_for_server(url: str, timeout: float = 20.0) -> bool:
    import urllib.request
    start = time.time()
    while time.time() - start < timeout:
        try:
            urllib.request.urlopen(url, timeout=2)
            return True
        except Exception:
            time.sleep(0.5)
    return False


class PlaywrightChecker:
    def __init__(self, project_dir: str):
        self.project_dir = project_dir

    def run(self) -> list:
        """Returns a list of human-readable error strings. Empty list = passed."""
        errors = []
        port = _free_port()
        url = f"http://127.0.0.1:{port}"

        env = os.environ.copy()
        env["PORT"] = str(port)

        proc = subprocess.Popen(
            [sys.executable, "app.py"],
            cwd=self.project_dir,
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
        )
        try:
            if not _wait_for_server(url, timeout=20):
                out = proc.stdout.read().decode(errors="ignore") if proc.stdout else ""
                errors.append(f"[live] Backend server failed to start within 20s. Server output:\n{out[-1500:]}")
                return errors

            errors.extend(self._browser_checks(url))
        finally:
            proc.terminate()
            try:
                proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                proc.kill()

        return errors

    def _browser_checks(self, url: str) -> list:
        errors = []
        console_errors = []
        page_errors = []

        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page()
            page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
            page.on("pageerror", lambda exc: page_errors.append(str(exc)))

            try:
                response = page.goto(url, wait_until="networkidle", timeout=15000)
            except Exception as e:
                browser.close()
                errors.append(f"[live] Page failed to load: {e}")
                return errors

            if response is None or response.status >= 400:
                errors.append(f"[live] Page returned HTTP status {response.status if response else 'no response'}.")

            title = page.title()
            if not title or len(title.strip()) == 0:
                errors.append("[live] Page <title> is empty.")

            body_text = page.inner_text("body")
            if not body_text or len(body_text.strip()) < 50:
                errors.append("[live] Page body appears empty or did not render real content.")

            # broken images
            broken_images = page.eval_on_selector_all(
                "img",
                "imgs => imgs.filter(i => i.complete && i.naturalWidth === 0).map(i => i.src)"
            )
            for src in broken_images:
                errors.append(f"[live] Broken image detected in browser: {src}")

            # nav anchor links actually scroll to an existing section
            nav_hrefs = page.eval_on_selector_all(
                "a[href^='#']", "els => els.map(e => e.getAttribute('href'))"
            )
            for href in set(nav_hrefs):
                target = href.lstrip("#")
                if not target:
                    continue
                exists = page.eval_on_selector_all(
                    f"#{target}", "els => els.length"
                ) if target.replace("-", "").replace("_", "").isalnum() else 0
                if not exists:
                    errors.append(f"[live] Nav link '{href}' does not scroll to any existing element.")

            # responsive overflow check at 3 breakpoints
            for width, height, label in [(375, 812, "mobile"), (768, 1024, "tablet"), (1440, 900, "desktop")]:
                page.set_viewport_size({"width": width, "height": height})
                page.wait_for_timeout(300)
                scroll_width = page.evaluate("document.documentElement.scrollWidth")
                client_width = page.evaluate("document.documentElement.clientWidth")
                if scroll_width > client_width + 5:
                    errors.append(f"[live] Horizontal overflow detected at {label} width ({width}px): content width {scroll_width}px.")

            # contact form round-trip, if present
            if page.query_selector("form"):
                try:
                    name_input = page.query_selector("input[name='name'], input#name")
                    email_input = page.query_selector("input[name='email'], input#email, input[type='email']")
                    message_input = page.query_selector("textarea[name='message'], textarea#message")
                    if name_input and email_input and message_input:
                        name_input.fill("Testing Agent")
                        email_input.fill("testing-agent@example.com")
                        message_input.fill("Automated end-to-end test message.")
                        submit_btn = page.query_selector("form button[type='submit'], form input[type='submit'], form button")
                        if submit_btn:
                            with page.expect_response(lambda r: "/api/contact" in r.url, timeout=8000) as resp_info:
                                submit_btn.click()
                            resp = resp_info.value
                            if resp.status >= 400:
                                errors.append(f"[live] Contact form submit returned HTTP {resp.status}.")
                        else:
                            errors.append("[live] Contact form has no submit button.")
                    else:
                        errors.append("[live] Contact form is missing expected name/email/message fields.")
                except Exception as e:
                    errors.append(f"[live] Contact form interaction failed: {e}")

            browser.close()

        for err in console_errors:
            errors.append(f"[live][console] {err}")
        for err in page_errors:
            errors.append(f"[live][js-runtime] {err}")

        return errors

