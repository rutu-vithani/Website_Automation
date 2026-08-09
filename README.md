Website Automation Agents
Multi-agent system that takes one plain-English request and produces
a full, tested, professionally-designed one-page website with a Flask backend and
MongoDB storage — and optionally pushes it to GitHub.
Hierarchy
```
User
 -> CEO Agent            (understands request, makes structured brief, final GitHub y/n gate)
 -> Frontend Agent        (one-page scroll site: index.html, style.css, script.js, Unsplash images)
 -> Database Agent        (stores frontend output in MongoDB, per-project collections)
 -> Backend Agent         (Flask app: clean URLs, no .html, /api routes, contact form storage)
 -> Testing Agent         (static checks + auto fix-loop, calls Frontend/Backend back on errors)
 -> CEO Agent             (asks user y/n to push)
 -> GitHub Agent          (pushes to its own branch + folder per project, only on 'y')
```
Setup
Copy `.env.example` to `.env` and fill in your real keys:
```
   cp .env.example .env
   ```
Never commit `.env` — it's already in `.gitignore`. If any key has ever been
pasted in plaintext somewhere outside this file (chat, docs, etc.), rotate it.
Install dependencies:
```
   pip install -r requirements.txt
   playwright install chromium
   ```
Make sure MongoDB is running locally (or update `MONGO_URI` to a remote instance).
Run
```
python orchestrator.py "I want a website for a modern bakery called Sunrise Bakes"
```
This will:
Print the CEO Agent's structured brief.
Generate the frontend (HTML/CSS/JS) using the Nvidia coder model + real Unsplash images.
Store everything in MongoDB under `project_<slug>_*` collections.
Generate the Flask backend in `generated_projects/<slug>/app.py`.
Run the Testing Agent's fix-loop until all checks pass (or max iterations reached).
Ask you `y/n` to push to GitHub (only if tests passed).
Running a generated project
```
cd generated_projects/<slug>
pip install -r requirements.txt
python app.py
```
Open `http://localhost:5000` — note there is no `.html` in the URL, the Flask
route serves `index.html` at `/` directly.
Models used (Nvidia NIM)
`NVIDIA_CODE_MODEL` (default `qwen/qwen3-coder-480b-a35b-instruct`) — used for all
HTML/CSS/JS and Flask route generation.
`NVIDIA_REASONING_MODEL` (default `nvidia/llama-3.1-nemotron-70b-instruct`) — used
for the CEO Agent's brief creation and any pure reasoning/decision steps.
Both are swappable via `.env` — the Nvidia NIM endpoint is OpenAI-compatible, so any
other model id from `build.nvidia.com/models` works by changing one line.
Notes / Limitations of this scaffold
The Testing Agent runs in two stages: (1) static/structural checks (HTML/CSS/JS
sanity, Python syntax, broken-link/image sampling), and (2) once those are clean,
it writes the current version to disk, actually launches the generated Flask app
as a subprocess, and uses Playwright (headless Chromium) to open it in a real
browser — checking console/JS errors, broken `<img>` rendering, nav-anchor scrolling,
responsive overflow at mobile/tablet/desktop widths, and a real contact-form
submit round-trip against `/api/contact`. Any failure here is fed back to the
Frontend or Backend Agent the same way static errors are, and the loop continues.
The Backend Agent uses a deterministic, verified Flask template for the core routes
(static serving + contact API) and only uses the LLM for additional business-specific
routes, so the "must never crash on first run" requirement stays reliable even if the
LLM output for extra routes is imperfect (those get caught by syntax + Playwright checks).
GitHub push is strictly gated behind the explicit user `y/n` answer, never automatic.