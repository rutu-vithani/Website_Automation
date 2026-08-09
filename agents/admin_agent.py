"""
Admin Agent.

Runs AFTER the Testing Agent's fix-loop has passed (or given up) on the
final frontend HTML. It never talks to an LLM — it's a deterministic
BeautifulSoup transform, so it can't hallucinate and costs no extra tokens
or API calls. It does four things:

1. Walks the final index.html and tags EVERY real piece of copy (headings,
   paragraphs, list items, links, buttons, captions...) and every <img>,
   anywhere on the page — including the header/nav and footer — with a
   stable `data-edit-id="..."` attribute, recording the current value in a
   content map. Nothing that shows on the live site is left un-editable.

2. Groups every one of those editable items under the on-page "section" it
   actually lives in (Header, Navigation, About, Menu, Footer, ...), so the
   Admin Panel can show one clearly labeled group per section instead of a
   single giant flat list. Each section container is tagged with a stable
   `data-section-id="..."` attribute so the Admin Panel (and the live page)
   can both address it.

3. Looks for "card" style CTAs (buttons/links whose text is something like
   "View Details", "Learn More", "Read More", "Book Now", "View Menu", ...)
   sitting inside a card that has its own image + heading + paragraph, and
   rewrites that CTA into a real link to /details/<id>. Each card becomes a
   full "detail record" (title/description/image/extra fields) that the
   generated Flask backend serves at /details/<id>, wired to the SAME
   data-edit-id used in step 1 so there is only one source of truth.

4. Produces the generic Admin Panel (login + editor UI, served at /admin)
   and the generic Details page (served at /details/<id>) that ship with
   every generated project. These are hand-written static assets (no LLM),
   business-name-templated via a simple string replace. The Admin Panel
   renders one collapsible card per section (step 2) and, under each
   section, an "+ Add field" control so a custom field can be added to that
   specific section without hunting through everything else.
"""
import os
import json
import re

from bs4 import BeautifulSoup, Tag

# Every tag whose visible text should be editable from the Admin Panel.
# (Headings/paragraphs, plus list items, links, buttons, captions, table
# cells, etc. so nav menus, footer links, badges, table content, ... are
# all reachable too — not just headings and paragraphs.)
EDITABLE_TEXT_TAGS = [
    "h1", "h2", "h3", "h4", "h5", "h6", "p", "span", "li", "a", "button",
    "blockquote", "figcaption", "dt", "dd", "td", "th", "label",
]
# Only real non-visible containers are skipped now. Header/nav/footer are
# deliberately NOT skipped anymore — every bit of on-page copy and every
# image on the live site must be editable, including the nav bar and footer.
SKIP_PARENT_TAGS = {"script", "style", "noscript"}

# Tags that group a chunk of the page into a distinct "section" for the
# Admin Panel. Anything not inside one of these falls back to its nearest
# ancestor that has an `id`, or its nearest direct-child-of-<body> ancestor.
SECTION_TAGS = {"section", "header", "footer", "nav", "main", "aside"}

DETAIL_CTA_TEXTS = {
    "view details", "view detail", "learn more", "read more", "view more",
    "see details", "view property", "view menu", "view product", "shop now",
    "book now", "view profile", "see more", "explore", "view service",
    "order now", "view listing", "view item", "book a table", "reserve now",
}


class AdminAgent:
    def __init__(self):
        pass

    # step 1 + 2: parse & transform the final HTML

    def process(self, brief: dict, html: str) -> dict:
        """
        Returns {"html": <transformed html str>, "editable": {...}, "details": [...],
        "sections": [...], "custom_fields": {...}}
        """
        soup = BeautifulSoup(html, "html.parser")
        editable = {}
        details = []
        sections = []  # ordered, deduped [{"id":..., "label":...}, ...]
        seen_section_ids = set()
        used_slugs = set()
        section_counter = {"n": 0}
        tagged_tags = []  # already-tagged Tag objects, to skip nested duplicates

        def register_section(section_tag):
            sid = self._ensure_section_id(section_tag, section_counter, used_slugs)
            if sid not in seen_section_ids:
                seen_section_ids.add(sid)
                sections.append({"id": sid, "label": self._section_label(section_tag, sid)})
            return sid

        text_counter = 0
        for tag in soup.find_all(EDITABLE_TEXT_TAGS):
            if tag.find_parent(SKIP_PARENT_TAGS):
                continue
            if tag.get("data-edit-id"):
                continue
            # skip if an ancestor was already tagged (avoids grabbing the
            # same copy twice, e.g. a <li><a>Home</a></li> where the <li>
            # already captured the link's text)
            if any(anc in tagged_tags for anc in tag.parents):
                continue
            text = tag.get_text(strip=True)
            if not text or len(text) < 2:
                continue
            if text.strip().lower() in DETAIL_CTA_TEXTS:
                continue
            text_counter += 1
            eid = f"text-{text_counter}"
            tag["data-edit-id"] = eid
            tagged_tags.append(tag)

            section_tag = self._get_section(tag, soup)
            sid = register_section(section_tag)

            editable[eid] = {
                "type": "text",
                "value": text,
                "label": self._label_for(tag, text),
                "section_id": sid,
            }

        img_counter = 0
        for img in soup.find_all("img"):
            if img.find_parent(SKIP_PARENT_TAGS):
                continue
            if img.get("data-edit-id"):
                continue
            src = img.get("src", "")
            if not src:
                continue
            img_counter += 1
            eid = f"image-{img_counter}"
            img["data-edit-id"] = eid

            section_tag = self._get_section(img, soup)
            sid = register_section(section_tag)

            editable[eid] = {
                "type": "image",
                "value": src,
                "label": img.get("alt") or f"Image {img_counter}",
                "section_id": sid,
            }

        detail_counter = 0
        for cta in soup.find_all(["a", "button"]):
            label = cta.get_text(strip=True).lower()
            if label not in DETAIL_CTA_TEXTS:
                continue

            card = self._find_card(cta)
            if card is None or card.get("data-detail-processed"):
                continue
            card["data-detail-processed"] = "1"

            detail_counter += 1
            did = f"detail-{detail_counter}"

            title_tag = card.find(["h1", "h2", "h3", "h4"])
            desc_tag = card.find("p")
            img_tag = card.find("img")

            title = title_tag.get_text(strip=True) if title_tag else brief.get("business_name", "Details")
            desc = desc_tag.get_text(strip=True) if desc_tag else ""
            image = img_tag.get("src") if img_tag else ""

            details.append({
                "id": did,
                "title": title,
                "description": desc,
                "image": image,
                "title_edit_id": title_tag.get("data-edit-id") if title_tag else None,
                "description_edit_id": desc_tag.get("data-edit-id") if desc_tag else None,
                "image_edit_id": img_tag.get("data-edit-id") if img_tag else None,
                "extra": {},
            })

            new_tag = soup.new_tag("a", href=f"/details/{did}")
            existing_classes = cta.get("class")
            if existing_classes:
                new_tag["class"] = existing_classes
            new_tag["data-detail-id"] = did
            new_tag.string = cta.get_text(strip=True) or "View Details"
            cta.replace_with(new_tag)

        # make sure the content-loader script (see build_static_assets) runs
        # on every generated page, right before </body>
        if soup.body is not None and not soup.find("script", src="/content-loader.js"):
            loader = soup.new_tag("script", src="/content-loader.js")
            soup.body.append(loader)

        return {
            "html": str(soup),
            "editable": editable,
            "details": details,
            "sections": sections,
            "custom_fields": {},
        }

    def _label_for(self, tag: Tag, text: str) -> str:
        short = text if len(text) <= 40 else text[:37] + "..."
        return f"<{tag.name}> {short}"

    def _find_card(self, cta: Tag, max_up: int = 5):
        node = cta.parent
        depth = 0
        while node is not None and depth < max_up:
            if isinstance(node, Tag) and node.find("img") and node.find(["h1", "h2", "h3", "h4"]):
                return node
            node = node.parent
            depth += 1
        return cta.parent if isinstance(cta.parent, Tag) else None

    # section grouping helpers 

    def _get_section(self, tag: Tag, soup: BeautifulSoup) -> Tag:
        """Find the nearest ancestor that represents a distinct on-page
        'section' for this tag: a <section>/<header>/<footer>/<nav>/<main>/
        <aside>, or the nearest ancestor with an `id`, or (failing that) the
        tag's nearest ancestor that is a direct child of <body>."""
        node = tag.parent
        while node is not None and isinstance(node, Tag):
            if node.name in SECTION_TAGS:
                return node
            if node.get("id"):
                return node
            if soup.body is not None and node.parent is soup.body:
                return node
            node = node.parent
        return soup.body if soup.body is not None else soup

    def _slug(self, text: str) -> str:
        slug = re.sub(r"[^a-z0-9]+", "-", text.strip().lower()).strip("-")
        return slug or "section"

    def _ensure_section_id(self, section_tag: Tag, counter: dict, used_slugs: set) -> str:
        existing = section_tag.get("data-section-id")
        if existing:
            used_slugs.add(existing)
            return existing

        if section_tag.name == "header":
            base = "header"
        elif section_tag.name == "footer":
            base = "footer"
        elif section_tag.name == "nav":
            base = "nav"
        elif section_tag.get("id"):
            base = self._slug(section_tag.get("id"))
        else:
            counter["n"] += 1
            base = f"section-{counter['n']}"

        sid = base
        n = 2
        while sid in used_slugs:
            sid = f"{base}-{n}"
            n += 1
        used_slugs.add(sid)
        section_tag["data-section-id"] = sid
        return sid

    def _section_label(self, section_tag: Tag, sid: str) -> str:
        if section_tag.name == "header":
            return "Header"
        if section_tag.name == "footer":
            return "Footer"
        if section_tag.name == "nav":
            return "Navigation"
        heading = section_tag.find(["h1", "h2", "h3"])
        if heading:
            text = heading.get_text(strip=True)
            if text:
                return text if len(text) <= 40 else text[:37] + "..."
        if section_tag.get("id"):
            return section_tag.get("id").replace("-", " ").replace("_", " ").strip().title()
        cls = section_tag.get("class")
        if cls:
            label = " ".join(cls).replace("-", " ").replace("_", " ").strip()
            if label:
                return label[:40].title()
        return sid.replace("-", " ").title()

    # step 3: static admin panel / details page assets 

    def build_static_assets(self, brief: dict) -> dict:
        name = brief.get("business_name", "Website")
        return {
            "admin_html": ADMIN_HTML.replace("{{BUSINESS_NAME}}", name),
            "admin_css": ADMIN_CSS,
            "admin_js": ADMIN_JS,
            "details_html": DETAILS_HTML.replace("{{BUSINESS_NAME}}", name),
            "details_js": DETAILS_JS,
            "content_loader_js": CONTENT_LOADER_JS,
        }

    def write_to_disk(self, frontend_dir: str, processed: dict, assets: dict) -> dict:
        os.makedirs(frontend_dir, exist_ok=True)

        with open(os.path.join(frontend_dir, "index.html"), "w", encoding="utf-8") as f:
            f.write(processed["html"])

        with open(os.path.join(frontend_dir, "admin.html"), "w", encoding="utf-8") as f:
            f.write(assets["admin_html"])
        with open(os.path.join(frontend_dir, "admin.css"), "w", encoding="utf-8") as f:
            f.write(assets["admin_css"])
        with open(os.path.join(frontend_dir, "admin.js"), "w", encoding="utf-8") as f:
            f.write(assets["admin_js"])

        with open(os.path.join(frontend_dir, "details.html"), "w", encoding="utf-8") as f:
            f.write(assets["details_html"])
        with open(os.path.join(frontend_dir, "details.js"), "w", encoding="utf-8") as f:
            f.write(assets["details_js"])

        with open(os.path.join(frontend_dir, "content-loader.js"), "w", encoding="utf-8") as f:
            f.write(assets["content_loader_js"])

        content = {
            "editable": processed["editable"],
            "details": processed["details"],
            "sections": processed.get("sections", []),
            "custom_fields": processed.get("custom_fields", {}),
        }
        with open(os.path.join(frontend_dir, "content.json"), "w", encoding="utf-8") as f:
            json.dump(content, f, indent=2, ensure_ascii=False)

        return content

# Generic static assets (hand-written, not LLM-generated -> reliable)

ADMIN_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow">
<title>Admin Panel - {{BUSINESS_NAME}}</title>
<link rel="stylesheet" href="/admin.css">
</head>
<body>
  <div id="login-screen" class="admin-screen">
    <form id="login-form" class="admin-card">
      <h1>{{BUSINESS_NAME}}</h1>
      <p class="admin-subtitle">Admin Panel</p>
      <label for="password">Password</label>
      <input type="password" id="password" name="password" autocomplete="current-password" required>
      <button type="submit">Log in</button>
      <p id="login-error" class="admin-error" hidden>Incorrect password.</p>
    </form>
  </div>

  <div id="dashboard" class="admin-screen" hidden>
    <header class="admin-header">
      <h1>{{BUSINESS_NAME}} <span class="admin-tag">Admin</span></h1>
      <div>
        <a href="/" target="_blank" class="admin-link-btn">View site</a>
        <button id="logout-btn" class="admin-secondary-btn">Log out</button>
      </div>
    </header>

    <nav class="admin-tabs">
      <button class="admin-tab-btn active" data-tab="content">Site Content</button>
      <button class="admin-tab-btn" data-tab="details">Detail Pages</button>
    </nav>

    <section id="tab-content" class="admin-tab-panel">
      <p class="admin-hint">Content is grouped by section — click a section to expand it. Edit any text or image used on the live site, or use "+ Add field" under a section to add a custom field there. Changes appear on the site as soon as you save.</p>
      <div id="content-list" class="admin-list"></div>
    </section>

    <section id="tab-details" class="admin-tab-panel" hidden>
      <p class="admin-hint">Each "View Details" style button on the site opens one of these pages. Add extra custom fields (price, hours, specs, anything) per item.</p>
      <div id="details-list" class="admin-list"></div>
      <button id="add-detail-btn" class="admin-secondary-btn">+ Add new detail page</button>
    </section>

    <div class="admin-save-bar">
      <span id="save-status"></span>
      <button id="save-btn" class="admin-primary-btn">Save changes</button>
    </div>
  </div>

<script src="/admin.js"></script>
</body>
</html>
"""

ADMIN_CSS = """
:root {
  --admin-bg: #0f1115;
  --admin-panel: #171a21;
  --admin-border: #2a2e37;
  --admin-text: #e7e9ee;
  --admin-muted: #9aa1ad;
  --admin-accent: #4f7cff;
  --admin-danger: #ff5d5d;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--admin-bg); color: var(--admin-text); }
.admin-screen { min-height: 100vh; }
#login-screen { display: flex; align-items: center; justify-content: center; padding: 24px; }
.admin-card {
  background: var(--admin-panel); border: 1px solid var(--admin-border);
  border-radius: 14px; padding: 32px; width: 100%; max-width: 360px;
  display: flex; flex-direction: column; gap: 12px;
}
.admin-card h1 { margin: 0; font-size: 1.4rem; }
.admin-subtitle { margin: 0 0 8px; color: var(--admin-muted); }
.admin-card label { font-size: 0.85rem; color: var(--admin-muted); }
.admin-card input {
  background: #0f1115; border: 1px solid var(--admin-border); color: var(--admin-text);
  border-radius: 8px; padding: 10px 12px; font-size: 1rem;
}
.admin-card button, .admin-primary-btn {
  background: var(--admin-accent); color: #fff; border: none; border-radius: 8px;
  padding: 10px 16px; font-size: 1rem; cursor: pointer; margin-top: 8px;
}
.admin-card button:hover, .admin-primary-btn:hover { filter: brightness(1.1); }
.admin-error { color: var(--admin-danger); font-size: 0.85rem; }

.admin-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 18px 28px; border-bottom: 1px solid var(--admin-border);
}
.admin-header h1 { font-size: 1.2rem; margin: 0; }
.admin-tag { color: var(--admin-accent); font-weight: 600; font-size: 0.85rem; vertical-align: middle; border: 1px solid var(--admin-accent); padding: 2px 8px; border-radius: 999px; margin-left: 8px; }
.admin-link-btn, .admin-secondary-btn {
  background: transparent; border: 1px solid var(--admin-border); color: var(--admin-text);
  padding: 8px 14px; border-radius: 8px; text-decoration: none; cursor: pointer; font-size: 0.9rem; margin-left: 8px;
}
.admin-link-btn:hover, .admin-secondary-btn:hover { border-color: var(--admin-accent); }

.admin-tabs { display: flex; gap: 4px; padding: 16px 28px 0; }
.admin-tab-btn {
  background: transparent; border: none; color: var(--admin-muted); padding: 10px 18px;
  cursor: pointer; font-size: 0.95rem; border-bottom: 2px solid transparent;
}
.admin-tab-btn.active { color: var(--admin-text); border-bottom-color: var(--admin-accent); }

.admin-tab-panel { padding: 20px 28px 100px; }
.admin-hint { color: var(--admin-muted); font-size: 0.9rem; margin-top: 0; }

.admin-section-group {
  background: var(--admin-panel); border: 1px solid var(--admin-border); border-radius: 12px;
  margin-bottom: 14px; overflow: hidden;
}
.admin-section-head {
  width: 100%; display: flex; align-items: center; gap: 12px; text-align: left;
  background: transparent; border: none; color: var(--admin-text); cursor: pointer;
  padding: 14px 18px; font-size: 1rem; font-weight: 600;
}
.admin-section-title { flex: 1; }
.admin-section-count { color: var(--admin-muted); font-size: 0.8rem; font-weight: 400; }
.admin-section-caret { color: var(--admin-muted); transition: transform 0.15s ease; }
.admin-section-group.open .admin-section-caret { transform: rotate(180deg); }
.admin-section-body { display: none; padding: 0 18px 18px; }
.admin-section-group.open .admin-section-body { display: block; }
.admin-custom-fields-label { margin-top: 16px; padding-top: 14px; border-top: 1px solid var(--admin-border); }
.admin-add-field-btn { margin-top: 8px; }

.admin-list { display: flex; flex-direction: column; gap: 14px; }
.admin-item {
  background: var(--admin-panel); border: 1px solid var(--admin-border); border-radius: 12px;
  padding: 16px; display: flex; gap: 16px; align-items: flex-start;
}
.admin-item-body { flex: 1; display: flex; flex-direction: column; gap: 8px; }
.admin-item-label { font-size: 0.8rem; color: var(--admin-muted); }
.admin-item textarea, .admin-item input[type="text"], .admin-item input[type="url"] {
  width: 100%; background: #0f1115; border: 1px solid var(--admin-border); color: var(--admin-text);
  border-radius: 8px; padding: 8px 10px; font-size: 0.95rem; font-family: inherit; resize: vertical;
}
.admin-item img.admin-preview { width: 96px; height: 72px; object-fit: cover; border-radius: 8px; border: 1px solid var(--admin-border); flex-shrink: 0; }

.admin-detail-card { flex-direction: column; }
.admin-detail-row { display: flex; gap: 16px; }
.admin-extra-fields { display: flex; flex-direction: column; gap: 6px; margin-top: 6px; }
.admin-extra-field { display: flex; gap: 8px; }
.admin-extra-field input { flex: 1; }
.admin-small-btn {
  background: transparent; border: 1px solid var(--admin-border); color: var(--admin-muted);
  border-radius: 6px; padding: 4px 10px; cursor: pointer; font-size: 0.8rem;
}
.admin-small-btn:hover { color: var(--admin-danger); border-color: var(--admin-danger); }

.admin-save-bar {
  position: fixed; bottom: 0; left: 0; right: 0; background: var(--admin-panel);
  border-top: 1px solid var(--admin-border); padding: 14px 28px;
  display: flex; align-items: center; justify-content: flex-end; gap: 16px;
}
#save-status { color: var(--admin-muted); font-size: 0.9rem; }
"""

ADMIN_JS = """
(function () {
  var loginScreen = document.getElementById('login-screen');
  var dashboard = document.getElementById('dashboard');
  var loginForm = document.getElementById('login-form');
  var loginError = document.getElementById('login-error');
  var contentList = document.getElementById('content-list');
  var detailsList = document.getElementById('details-list');
  var saveBtn = document.getElementById('save-btn');
  var saveStatus = document.getElementById('save-status');
  var logoutBtn = document.getElementById('logout-btn');
  var addDetailBtn = document.getElementById('add-detail-btn');

  var state = { editable: {}, details: [], sections: [], custom_fields: {} };

  function showDashboard() {
    loginScreen.hidden = true;
    dashboard.hidden = false;
    loadContent();
  }

  function showLogin() {
    loginScreen.hidden = false;
    dashboard.hidden = true;
  }

  loginForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var password = document.getElementById('password').value;
    fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: password }),
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.success) {
          loginError.hidden = true;
          showDashboard();
        } else {
          loginError.hidden = false;
        }
      })
      .catch(function () { loginError.hidden = false; });
  });

  logoutBtn.addEventListener('click', function () {
    fetch('/api/admin/logout', { method: 'POST' }).finally(showLogin);
  });

  document.querySelectorAll('.admin-tab-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.admin-tab-btn').forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      var tab = btn.getAttribute('data-tab');
      document.getElementById('tab-content').hidden = tab !== 'content';
      document.getElementById('tab-details').hidden = tab !== 'details';
    });
  });

  function loadContent() {
    fetch('/api/admin/content')
      .then(function (r) {
        if (r.status === 401) { showLogin(); throw new Error('unauth'); }
        return r.json();
      })
      .then(function (data) {
        state = data;
        renderContent();
        renderDetails();
      })
      .catch(function () {});
  }

  // Renders one collapsible group per on-page section (Header, Navigation,
  // About, Footer, ...) instead of one giant flat list, so it's easy to
  // find the right place to edit. Each group also gets its own
  // "+ Add field" control to add a custom field to just that section.
  function renderContent() {
    contentList.innerHTML = '';
    state.sections = state.sections || [];
    state.custom_fields = state.custom_fields || {};

    var knownIds = {};
    state.sections.forEach(function (s) { knownIds[s.id] = true; });

    var order = state.sections.map(function (s) { return s.id; });
    var groups = {};
    order.forEach(function (id) { groups[id] = []; });

    Object.keys(state.editable || {}).forEach(function (id) {
      var item = state.editable[id];
      var sid = (item.section_id && knownIds[item.section_id]) ? item.section_id : 'other';
      if (!groups[sid]) { groups[sid] = []; order.push(sid); }
      groups[sid].push(id);
    });

    // sections that only have custom fields (no editable page items yet)
    Object.keys(state.custom_fields).forEach(function (sid) {
      if (!groups[sid]) { groups[sid] = []; order.push(sid); }
    });

    order.forEach(function (sid, idx) {
      if (!groups[sid]) return;
      var meta = state.sections.filter(function (s) { return s.id === sid; })[0];
      var label = meta ? meta.label : (sid === 'other' ? 'Other content' : sid);
      contentList.appendChild(buildSectionGroup(sid, label, groups[sid], idx === 0));
    });
  }

  function buildSectionGroup(sid, label, itemIds, openByDefault) {
    var group = document.createElement('div');
    group.className = 'admin-section-group' + (openByDefault ? ' open' : '');

    var head = document.createElement('button');
    head.type = 'button';
    head.className = 'admin-section-head';

    var titleSpan = document.createElement('span');
    titleSpan.className = 'admin-section-title';
    titleSpan.textContent = label;

    var countSpan = document.createElement('span');
    countSpan.className = 'admin-section-count';
    countSpan.textContent = itemIds.length + (itemIds.length === 1 ? ' item' : ' items');

    var caretSpan = document.createElement('span');
    caretSpan.className = 'admin-section-caret';
    caretSpan.textContent = '\u25BE';

    head.appendChild(titleSpan);
    head.appendChild(countSpan);
    head.appendChild(caretSpan);
    head.addEventListener('click', function () { group.classList.toggle('open'); });
    group.appendChild(head);

    var body = document.createElement('div');
    body.className = 'admin-section-body';

    var itemsWrap = document.createElement('div');
    itemsWrap.className = 'admin-list';
    itemIds.forEach(function (id) { itemsWrap.appendChild(buildContentItem(id)); });
    body.appendChild(itemsWrap);

    state.custom_fields[sid] = state.custom_fields[sid] || [];
    var customLabel = document.createElement('div');
    customLabel.className = 'admin-item-label admin-custom-fields-label';
    customLabel.textContent = 'Custom fields for this section';
    body.appendChild(customLabel);

    var customWrap = document.createElement('div');
    customWrap.className = 'admin-extra-fields';

    function renderCustom() {
      customWrap.innerHTML = '';
      state.custom_fields[sid].forEach(function (field) {
        customWrap.appendChild(buildCustomFieldRow(sid, field, renderCustom));
      });
    }
    renderCustom();
    body.appendChild(customWrap);

    var addFieldBtn = document.createElement('button');
    addFieldBtn.type = 'button';
    addFieldBtn.className = 'admin-small-btn admin-add-field-btn';
    addFieldBtn.textContent = '+ Add field';
    addFieldBtn.addEventListener('click', function () {
      state.custom_fields[sid].push({
        id: 'field-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
        label: 'New field',
        value: '',
      });
      renderCustom();
    });
    body.appendChild(addFieldBtn);

    group.appendChild(body);
    return group;
  }

  function buildContentItem(id) {
    var item = state.editable[id];
    var row = document.createElement('div');
    row.className = 'admin-item';

    if (item.type === 'image') {
      var img = document.createElement('img');
      img.className = 'admin-preview';
      img.src = item.value;
      row.appendChild(img);
    }

    var body = document.createElement('div');
    body.className = 'admin-item-body';
    var label = document.createElement('div');
    label.className = 'admin-item-label';
    label.textContent = item.label || id;
    body.appendChild(label);

    var input;
    if (item.type === 'image') {
      input = document.createElement('input');
      input.type = 'url';
      input.placeholder = 'Image URL';
    } else {
      input = document.createElement('textarea');
      input.rows = text_rows(item.value);
    }
    input.value = item.value;
    input.addEventListener('input', function () {
      state.editable[id].value = input.value;
      if (item.type === 'image') { row.querySelector('img').src = input.value; }
    });
    body.appendChild(input);
    row.appendChild(body);
    return row;
  }

  function buildCustomFieldRow(sid, field, rerender) {
    var row = document.createElement('div');
    row.className = 'admin-extra-field';

    var keyInput = document.createElement('input');
    keyInput.type = 'text';
    keyInput.placeholder = 'Field name';
    keyInput.value = field.label;
    keyInput.addEventListener('input', function () { field.label = keyInput.value; });

    var valInput = document.createElement('input');
    valInput.type = 'text';
    valInput.placeholder = 'Value';
    valInput.value = field.value;
    valInput.addEventListener('input', function () { field.value = valInput.value; });

    var removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'admin-small-btn';
    removeBtn.textContent = 'Remove';
    removeBtn.addEventListener('click', function () {
      var list = state.custom_fields[sid];
      var i = list.indexOf(field);
      if (i > -1) { list.splice(i, 1); }
      rerender();
    });

    row.appendChild(keyInput);
    row.appendChild(valInput);
    row.appendChild(removeBtn);
    return row;
  }

  function text_rows(value) {
    var len = (value || '').length;
    if (len > 160) return 4;
    if (len > 60) return 2;
    return 1;
  }

  function renderDetails() {
    detailsList.innerHTML = '';
    (state.details || []).forEach(function (detail, idx) {
      detailsList.appendChild(buildDetailCard(detail, idx));
    });
  }

  function buildDetailCard(detail, idx) {
    var card = document.createElement('div');
    card.className = 'admin-item admin-detail-card';

    var top = document.createElement('div');
    top.className = 'admin-detail-row';

    var img = document.createElement('img');
    img.className = 'admin-preview';
    img.src = detail.image || '';
    top.appendChild(img);

    var body = document.createElement('div');
    body.className = 'admin-item-body';

    var titleLabel = document.createElement('div');
    titleLabel.className = 'admin-item-label';
    titleLabel.textContent = 'Title \u00b7 /details/' + detail.id;
    body.appendChild(titleLabel);

    var titleInput = document.createElement('input');
    titleInput.type = 'text';
    titleInput.value = detail.title || '';
    titleInput.addEventListener('input', function () { detail.title = titleInput.value; });
    body.appendChild(titleInput);

    var imgLabel = document.createElement('div');
    imgLabel.className = 'admin-item-label';
    imgLabel.textContent = 'Image URL';
    body.appendChild(imgLabel);

    var imgInput = document.createElement('input');
    imgInput.type = 'url';
    imgInput.value = detail.image || '';
    imgInput.addEventListener('input', function () { detail.image = imgInput.value; img.src = imgInput.value; });
    body.appendChild(imgInput);

    var descLabel = document.createElement('div');
    descLabel.className = 'admin-item-label';
    descLabel.textContent = 'Description';
    body.appendChild(descLabel);

    var descInput = document.createElement('textarea');
    descInput.rows = 3;
    descInput.value = detail.description || '';
    descInput.addEventListener('input', function () { detail.description = descInput.value; });
    body.appendChild(descInput);

    var extraLabel = document.createElement('div');
    extraLabel.className = 'admin-item-label';
    extraLabel.textContent = 'Extra information (e.g. Price, Hours, Specs...)';
    body.appendChild(extraLabel);

    var extraWrap = document.createElement('div');
    extraWrap.className = 'admin-extra-fields';
    detail.extra = detail.extra || {};

    function renderExtra() {
      extraWrap.innerHTML = '';
      Object.keys(detail.extra).forEach(function (key) {
        var row = document.createElement('div');
        row.className = 'admin-extra-field';

        var keyInput = document.createElement('input');
        keyInput.type = 'text';
        keyInput.placeholder = 'Field name';
        keyInput.value = key;

        var valInput = document.createElement('input');
        valInput.type = 'text';
        valInput.placeholder = 'Value';
        valInput.value = detail.extra[key];
        valInput.addEventListener('input', function () { detail.extra[key] = valInput.value; });

        keyInput.addEventListener('change', function () {
          var newKey = keyInput.value.trim();
          if (!newKey || newKey === key) return;
          var val = detail.extra[key];
          delete detail.extra[key];
          detail.extra[newKey] = val;
          renderExtra();
        });

        var removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'admin-small-btn';
        removeBtn.textContent = 'Remove';
        removeBtn.addEventListener('click', function () {
          delete detail.extra[key];
          renderExtra();
        });

        row.appendChild(keyInput);
        row.appendChild(valInput);
        row.appendChild(removeBtn);
        extraWrap.appendChild(row);
      });
    }
    renderExtra();
    body.appendChild(extraWrap);

    var addFieldBtn = document.createElement('button');
    addFieldBtn.type = 'button';
    addFieldBtn.className = 'admin-small-btn';
    addFieldBtn.style.marginTop = '4px';
    addFieldBtn.textContent = '+ Add field';
    addFieldBtn.addEventListener('click', function () {
      var n = 1;
      var key = 'Field ' + n;
      while (detail.extra.hasOwnProperty(key)) { n++; key = 'Field ' + n; }
      detail.extra[key] = '';
      renderExtra();
    });
    body.appendChild(addFieldBtn);

    var removeDetailBtn = document.createElement('button');
    removeDetailBtn.type = 'button';
    removeDetailBtn.className = 'admin-small-btn';
    removeDetailBtn.style.marginTop = '10px';
    removeDetailBtn.textContent = 'Delete this detail page';
    removeDetailBtn.addEventListener('click', function () {
      state.details.splice(idx, 1);
      renderDetails();
    });
    body.appendChild(removeDetailBtn);

    top.appendChild(body);
    card.appendChild(top);
    return card;
  }

  addDetailBtn.addEventListener('click', function () {
    var n = (state.details || []).length + 1;
    var id = 'detail-custom-' + Date.now();
    state.details = state.details || [];
    state.details.push({ id: id, title: 'New item ' + n, description: '', image: '', extra: {} });
    renderDetails();
  });

  saveBtn.addEventListener('click', function () {
    saveStatus.textContent = 'Saving...';
    fetch('/api/admin/content', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        editable: state.editable,
        details: state.details,
        custom_fields: state.custom_fields,
      }),
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        saveStatus.textContent = data.success ? 'Saved.' : 'Save failed.';
        setTimeout(function () { saveStatus.textContent = ''; }, 2500);
      })
      .catch(function () { saveStatus.textContent = 'Save failed.'; });
  });

  // if a session cookie is already valid, skip straight to the dashboard
  loadContent();
})();
"""

DETAILS_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Details - {{BUSINESS_NAME}}</title>
<link rel="stylesheet" href="/style.css">
<style>
  .details-wrap { max-width: 860px; margin: 0 auto; padding: 48px 24px 80px; }
  .details-back { display: inline-block; margin-bottom: 24px; text-decoration: none; opacity: 0.8; }
  .details-image { width: 100%; max-height: 420px; object-fit: cover; border-radius: 14px; margin-bottom: 24px; }
  .details-extra { margin-top: 32px; border-top: 1px solid rgba(128,128,128,0.25); padding-top: 20px; }
  .details-extra dl { display: grid; grid-template-columns: max-content 1fr; gap: 8px 20px; }
  .details-extra dt { font-weight: 600; opacity: 0.8; }
  .details-notfound { text-align: center; padding: 80px 24px; }
</style>
</head>
<body>
  <div class="details-wrap">
    <a class="details-back" href="/">&larr; Back to {{BUSINESS_NAME}}</a>
    <div id="details-content"></div>
  </div>
<script src="/details.js"></script>
</body>
</html>
"""

DETAILS_JS = """
(function () {
  var id = window.location.pathname.split('/').filter(Boolean).pop();
  var container = document.getElementById('details-content');

  fetch('/api/details/' + encodeURIComponent(id))
    .then(function (r) { if (!r.ok) throw new Error('not found'); return r.json(); })
    .then(function (detail) { render(detail); })
    .catch(function () { renderNotFound(); });

  function render(detail) {
    var html = '';
    if (detail.image) {
      html += '<img class="details-image" src="' + escapeAttr(detail.image) + '" alt="' + escapeAttr(detail.title || '') + '">';
    }
    html += '<h1>' + escapeHtml(detail.title || '') + '</h1>';
    if (detail.description) {
      html += '<p>' + escapeHtml(detail.description) + '</p>';
    }
    var extraKeys = Object.keys(detail.extra || {});
    if (extraKeys.length) {
      html += '<div class="details-extra"><dl>';
      extraKeys.forEach(function (key) {
        html += '<dt>' + escapeHtml(key) + '</dt><dd>' + escapeHtml(detail.extra[key]) + '</dd>';
      });
      html += '</dl></div>';
    }
    container.innerHTML = html;
  }

  function renderNotFound() {
    container.innerHTML = '<div class="details-notfound"><h1>Not found</h1><p>This item is not available.</p></div>';
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function escapeAttr(s) { return escapeHtml(s); }
})();
"""

CONTENT_LOADER_JS = """
(function () {
  function applyContent(data) {
    var editable = (data && data.editable) || {};
    Object.keys(editable).forEach(function (id) {
      var el = document.querySelector('[data-edit-id="' + id + '"]');
      if (!el) return;
      var item = editable[id];
      if (item.type === 'image') {
        el.setAttribute('src', item.value);
      } else {
        el.textContent = item.value;
      }
    });
    applyCustomFields((data && data.custom_fields) || {});
  }

  // Custom fields added per-section from the Admin Panel ("+ Add field")
  // are rendered as a small key/value list appended to the bottom of that
  // section on the live page, so anything added in the admin actually
  // shows up on the site.
  function applyCustomFields(customFields) {
    Object.keys(customFields).forEach(function (sid) {
      var fields = (customFields[sid] || []).filter(function (f) {
        return f && (f.label || f.value);
      });
      var section = document.querySelector('[data-section-id="' + sid + '"]');
      if (!section) return;

      var block = section.querySelector(':scope > .admin-custom-field-block');
      if (!fields.length) {
        if (block) block.remove();
        return;
      }
      if (!block) {
        block = document.createElement('div');
        block.className = 'admin-custom-field-block';
        section.appendChild(block);
      }
      block.innerHTML = '';
      fields.forEach(function (f) {
        var row = document.createElement('div');
        row.className = 'admin-custom-field-row';
        if (f.label) {
          var label = document.createElement('span');
          label.className = 'admin-custom-field-label';
          label.textContent = f.label + ': ';
          row.appendChild(label);
        }
        var value = document.createElement('span');
        value.className = 'admin-custom-field-value';
        value.textContent = f.value || '';
        row.appendChild(value);
        block.appendChild(row);
      });
    });
  }

  fetch('/api/content')
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (data) { if (data) applyContent(data); })
    .catch(function () {});
})();
"""