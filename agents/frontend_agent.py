import os
import re
from clients.gemini_client import GeminiClient
from clients.unsplash_client import UnsplashClient

SKILL_PATH = os.path.join(os.path.dirname(__file__), "..", "skills", "frontend_agent_skill.md")


def _load_skill() -> str:
    with open(SKILL_PATH, "r", encoding="utf-8") as f:
        return f.read()


def _extract_single_block(text: str, lang: str) -> str:
    """
    Pulls out a single fenced code block for the given language. Prefers an
    explicitly labelled ```lang block; falls back to the first fenced block
    of any kind (in case the model forgot the language tag).
    """
    labelled = re.search(rf"```{lang}\s*\n?(.*?)```", text, re.DOTALL | re.IGNORECASE)
    if labelled:
        return labelled.group(1).strip()
    generic = re.search(r"```[a-zA-Z]*\s*\n?(.*?)```", text, re.DOTALL)
    return generic.group(1).strip() if generic else ""


def _split_fenced(text: str, lang: str):
    """
    Like _extract_single_block, but also reports whether the block was
    actually CLOSED with a trailing ``` or whether it got cut off mid-file
    (hit max_tokens). Returns (content, complete: bool).
    complete=False means `content` is a real, usable partial result that can
    be handed back to the model as a continuation seed - not a failure.
    """
    open_match = re.search(rf"```{lang}\s*\n?", text, re.IGNORECASE)
    if not open_match:
        open_match = re.search(r"```[a-zA-Z]*\s*\n?", text)
        if not open_match:
            return "", False
    rest = text[open_match.end():]
    close_idx = rest.find("```")
    if close_idx == -1:
        return rest.strip(), False
    return rest[:close_idx].strip(), True


NO_COMMENTARY_RULE = (
    "\n\nOutput RULE (important for staying within length limits): do not write "
    "explanatory comments that narrate which design-doc rule/section you're "
    "following (e.g. no '/* Section 5, 13 */' or '// per section 8' style "
    "comments). Keep comments minimal-to-none - production code only, not an "
    "annotated tutorial. This keeps the file focused on real content instead "
    "of running out of space on commentary."
)


def _looks_like_html(content: str) -> bool:
    head = content[:200].lower()
    return "<!doctype" in head or "<html" in head


class FrontendAgent:
    def __init__(self, llm_client: GeminiClient = None, unsplash_client: UnsplashClient = None):
        # Gemini's Flash models are the best genuinely-free option for
        # design/code generation quality (Claude has no ongoing free tier).
        self.llm = llm_client or GeminiClient()
        self.unsplash = unsplash_client or UnsplashClient()
        self.skill = _load_skill()

    # ---------- shared single-block generation w/ retry ----------

    def _generate_block(self, user_prompt: str, lang: str, max_tokens: int,
                         temperature: float = 0.7, timeout: int = 180,
                         max_continuations: int = 3) -> str:
        prompt = user_prompt + NO_COMMENTARY_RULE
        response = self.llm.code(self.skill, prompt, temperature=temperature,
                                  max_tokens=max_tokens, timeout=timeout)
        content, complete = _split_fenced(response, lang)

        # Case A: the block hit max_tokens mid-file (cut off, but what we have
        # so far is real and usable). Instead of throwing it away and asking
        # for the WHOLE file again from scratch (which tends to fail the same
        # way twice, as it did in your run), feed the model its own cut-off
        # point and ask it to continue exactly from there.
        rounds = 0
        while not complete and content and rounds < max_continuations:
            rounds += 1
            print(f"[FrontendAgent]  {lang} block hit the token limit mid-file — "
                  f"requesting continuation {rounds}/{max_continuations} instead of restarting...")
            tail = content[-1000:]
            continue_prompt = (
                f"{prompt}\n\n"
                f"You already started generating this {lang} file and were cut off. "
                f"Here is exactly where your previous output stopped (last ~1000 characters):\n"
                f"-----\n{tail}\n-----\n"
                f"Continue writing from precisely that point onward. Do NOT repeat any "
                f"content already shown above, do NOT restart the file, do NOT include a "
                f"new opening code fence - output only the raw continuation. Add a closing "
                f"``` once the file is genuinely, fully complete."
            )
            response = self.llm.code(self.skill, continue_prompt,
                                      temperature=max(0.3, temperature - 0.1),
                                      max_tokens=max_tokens, timeout=timeout)
            # the continuation may or may not wrap itself in its own fence
            more, more_complete = _split_fenced(response, lang)
            addition = more if more else response.strip().strip("`").strip()
            content = content + ("\n" if not content.endswith("\n") else "") + addition
            complete = more_complete or response.rstrip().endswith("```")

        # Case B: nothing usable came back at all (empty/garbage response,
        # not a length-limit issue) - this genuinely needs a fresh attempt.
        if not content or len(content.strip()) < 20:
            print(f"[FrontendAgent]  {lang} block missing/too short — retrying once with a stricter instruction...")
            retry_prompt = prompt + (
                f"\n\nYour previous response was incomplete or not formatted correctly. "
                f"Output ONLY one single fenced ```{lang} code block and nothing else "
                f"(no explanations before/after). Make sure it is fully complete, not cut off."
            )
            response = self.llm.code(self.skill, retry_prompt, temperature=max(0.3, temperature - 0.2),
                                      max_tokens=max_tokens, timeout=timeout)
            content, complete = _split_fenced(response, lang)
            if not content or len(content.strip()) < 20:
                raise RuntimeError(
                    f"Frontend Agent failed to generate a valid {lang} block after retry. "
                    f"Response tail: ...{response[-300:]}"
                )
        return content

    #  stage 1: HTML 

    def _build_html(self, brief: dict, sections: list, flat_image_urls: list,
                     error_feedback: str = None) -> str:
        prompt = f"""
Business brief (from CEO Agent):
{brief}

Pre-resolved Unsplash image URLs you MUST use directly in <img src="..."> tags
(pick the most relevant ones per section, do not invent other image URLs):
{flat_image_urls}

Build the full HTML (index.html) for a single-page scroll website with sections: {sections}.

Follow the skill document's guidance on structure, information architecture,
semantic HTML, accessibility, and real copywriting (no lorem ipsum) for a
business called "{brief.get('business_name')}". Use clear, specific, reusable
class names and ids (nav anchors must match real section ids) - a CSS file and
a JS file will be written against this HTML afterwards, so structure/naming
must be predictable and consistent.

The HTML must link css as "style.css" and js as "script.js" (relative paths, same folder).

Output ONLY one fenced code block, nothing else outside it:
```html
<!-- full index.html -->
```
"""
        if error_feedback:
            prompt += f"\n\nIMPORTANT - fix these issues found by the Testing Agent:\n{error_feedback}\n"
        return self._generate_block(prompt, "html", max_tokens=18000, temperature=0.7, timeout=200)

    #  stage 2: CSS 

    def _build_css(self, brief: dict, html: str, error_feedback: str = None) -> str:
        prompt = f"""
Business brief (from CEO Agent):
{brief}

Here is the FINAL index.html you must style (do not change its structure,
class names, or ids - just write CSS that targets exactly what's here):
```html
{html}
```

Write the full style.css. Make deliberate, opinionated design choices per the
skill document (distinctive palette, type pairing, layout rhythm, spacing,
responsive behavior at mobile/tablet/desktop) that fit this specific business -
never a generic templated look. Keep the CSS efficient (shared classes, no
repetition) even if the page has many sections.

Output ONLY one fenced code block, nothing else outside it:
```css
/* full style.css */
```
"""
        if error_feedback:
            prompt += f"\n\nIMPORTANT - fix these issues found by the Testing Agent:\n{error_feedback}\n"
        return self._generate_block(prompt, "css", max_tokens=18000, temperature=0.7, timeout=200)

    #  stage 3: JS 

    def _build_js(self, brief: dict, html: str, error_feedback: str = None) -> str:
        prompt = f"""
Business brief (from CEO Agent):
{brief}

Here is the FINAL index.html you must add behavior for (do not change its
structure, class names, or ids - just write JS that targets exactly what's here):
```html
{html}
```

Write the full script.js: nav anchor smooth-scrolling, IntersectionObserver-based
scroll animations, mobile menu toggle if present, contact form submit handling
(POST to /api/contact as JSON, show success/error state), and any other
interactivity called for by the skill document. Do not invent elements that
don't exist in the HTML above.

Output ONLY one fenced code block, nothing else outside it:
```js
// full script.js
```
"""
        if error_feedback:
            prompt += f"\n\nIMPORTANT - fix these issues found by the Testing Agent:\n{error_feedback}\n"
        return self._generate_block(prompt, "js", max_tokens=14000, temperature=0.6, timeout=200)

    #  public API (unchanged signature/return shape) 

    def build(self, brief: dict, error_feedback: str = None,
              existing: dict = None, target_stages: set = None) -> dict:
        """
        Returns {"html": ..., "css": ..., "js": ..., "images_used": [...]}.

        existing: a prior build_output dict (from a failed fix-loop iteration).
        target_stages: which of {"html","css","js"} to actually regenerate.
            None (default) = regenerate everything (first-time build).
            A subset = reuse `existing`'s files for anything NOT in the set.
            This is what keeps the Testing Agent's fix-loop from burning 3x
            the API calls every time only one file actually had a problem.
        """
        existing = existing or {}
        if target_stages is None:
            target_stages = {"html", "css", "js"}

        sections = brief.get("sections", ["home", "about", "services", "contact"])
        topics = brief.get("unsplash_query_topics") or [brief.get("business_type", "business")]

        need_new_images = "html" in target_stages or not existing.get("images_used")
        if need_new_images:
            image_set = {}
            for topic in topics:
                imgs = self.unsplash.search_images(topic, count=4)
                if imgs:
                    image_set[topic] = imgs
            flat_image_urls = []
            for imgs in image_set.values():
                flat_image_urls.extend([i["url"] for i in imgs if i.get("url")])
        else:
            flat_image_urls = existing["images_used"]

        if "html" in target_stages or not existing.get("html"):
            print("[FrontendAgent] Generating HTML...")
            html = self._build_html(brief, sections, flat_image_urls, error_feedback)
        else:
            print("[FrontendAgent] Reusing existing HTML (no html-related errors reported).")
            html = existing["html"]

        if "css" in target_stages or not existing.get("css"):
            print("[FrontendAgent] Generating CSS...")
            css = self._build_css(brief, html, error_feedback)
            if _looks_like_html(css):
                raise RuntimeError(
                    "Extracted css block looks like an HTML document, not CSS - "
                    "generation went wrong for this stage."
                )
        else:
            print("[FrontendAgent] Reusing existing CSS (no css-related errors reported).")
            css = existing["css"]

        if "js" in target_stages or not existing.get("js"):
            print("[FrontendAgent] Generating JS...")
            js = self._build_js(brief, html, error_feedback)
            if _looks_like_html(js):
                raise RuntimeError(
                    "Extracted js block looks like an HTML document, not JS - "
                    "generation went wrong for this stage."
                )
        else:
            print("[FrontendAgent] Reusing existing JS (no js-related errors reported).")
            js = existing["js"]

        return {"html": html, "css": css, "js": js, "images_used": flat_image_urls}

    def write_to_disk(self, project_dir: str, build_output: dict):
        os.makedirs(project_dir, exist_ok=True)
        with open(os.path.join(project_dir, "index.html"), "w", encoding="utf-8") as f:
            f.write(build_output["html"])
        with open(os.path.join(project_dir, "style.css"), "w", encoding="utf-8") as f:
            f.write(build_output["css"])
        with open(os.path.join(project_dir, "script.js"), "w", encoding="utf-8") as f:
            f.write(build_output["js"])