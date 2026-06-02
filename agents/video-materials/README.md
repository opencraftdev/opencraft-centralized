# video-materials — AI News Brief runner

A standalone **local** Python agent that produces a ≤2-minute AI-news video
brief (**script + caption + HTML/CSS thumbnail PNG**) and **writes it to
Supabase** (row + thumbnail in Storage) using the **service-role key** — exactly
how the Document Agent and the Record-Tutorial-Video pipeline already push.

It is driven by the **Claude Code subscription (no paid Anthropic API key)**.
The opencraft-centralized web app only **displays** the list of materials
(read-only) at **/news-materials**. Supabase is the bus: the agent writes, the
dashboard reads.

```
ai-news-mcp ─▶ video-materials (LOCAL, claude subscription)
 (HTTP MCP)      news.py     fetch top picks (httpx, deterministic, free)
                 generate.py claude -p (scrubbed env) → script + caption + thumb copy
                 thumbnail.py Jinja HTML+CSS → Playwright → thumbnail.png
                 publish.py  ─────────────┐
                                          ▼
                       Supabase (service-role write)
                        • Storage bucket  news-thumbnails  (<id>.png → public URL)
                        • table           news_briefs      (row)
                                          ▲  (RLS: signed-in SELECT only)
                       Next.js web app ───┘  /news-materials (read-only list)
```

## Why local + subscription (no API key)

Claude Code authenticates against your Pro/Max subscription; this runner reuses
that **logged-in session** instead of adding per-token Anthropic API billing.

1. One-time: run `claude` once interactively and sign in (Pro/Max). That's it —
   **no token to copy, nothing in `.env`.**
2. The runner calls Claude headlessly (`claude -p`), which reuses your session —
   billed to the **subscription**.
3. ⚠️ **Critical:** if `ANTHROPIC_API_KEY` is in the environment, Claude Code
   prefers it and you get **API-billed**. `generate.py` spawns Claude with the
   paid auth vars (`ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN`) **stripped from
   the child env**, so it can never silently fall back to paid usage — it always
   uses the subscription session.

`ai-news-mcp` is hit directly with `httpx` (deterministic, free); Claude is used
**only** for the creative text.

## Setup

Requires Python ≥ 3.10 and the Claude Code CLI on your PATH.

```bash
cd agents/video-materials

# 1. Python deps (a virtualenv is recommended)
python -m venv .venv
# Windows:  .venv\Scripts\Activate.ps1
# macOS/Linux:  source .venv/bin/activate
pip install -e .

# 2. One-time headless Chromium for the thumbnail renderer
playwright install chromium

# 3. One-time: sign in to Claude Code with your Pro/Max subscription
claude          # run once, log in, then exit — the runner reuses this session

# 4. Env  (no Claude token — just the Supabase service-role key)
cp .env.example .env      # Windows: copy .env.example .env
#   then edit .env:
#     SUPABASE_SERVICE_ROLE_KEY ← same key the dashboard uses (Supabase dashboard
#                                 → Project Settings → API → service_role)
```

The `news_briefs` table and the public **`news-thumbnails`** Storage bucket are
created by `supabase/migrations/005_news_briefs.sql` (already applied to the
shared project). If you spin up a fresh Supabase project, run that migration
first — it creates both the table and the bucket.

## Usage

```bash
python run.py --presenter rayandika --n 5      # defaults: rayandika, n=5
python run.py --presenter depras
python run.py --dry-run                        # generate + render locally, skip publish
```

Steps: fetch picks → generate → render PNG → **publish to Supabase** → also save
local `out/<date>-<slug>/` copies (`brief.json`, `script.md`, `caption.txt`,
`thumbnail.html`, `thumbnail.png`) for debugging / hand-editing. On publish
failure the local files are kept and the process exits non-zero with a clear
message.

Presenters (`--presenter`): `rayandika`, `depras`, `rafi` — kept in sync with
the web app's `src/features/tutorial-video/presenters.ts`.

## The 2-minute budget

140 wpm × 2 min ≈ **280 words**: hook ~25w / outro ~30w → ~225w body → ~20s/item
→ **5 items** (default `n=5`). If the first draft's `est_seconds > 120`,
`generate.py` does one automatic tightening re-prompt, then accepts and warns.

## Files

```
run.py                 entrypoint CLI
video_materials/
  config.py            env + word-budget constants
  news.py              ai-news-mcp JSON-RPC client (double-encoded payload)
  generate.py          claude -p with scrubbed env, parse + validate JSON
  thumbnail.py         Jinja template → PNG via Playwright
  publish.py           insert row + upload PNG + set thumbnail_url (service-role)
  models.py            pydantic: Pick, Segment, Script, Caption, Thumbnail, Brief
  prompts.py           the ≤2-min script/caption/thumbnail prompt
  presenters.py        mirror of the 3 web-app presenters
templates/
  thumbnail.html.j2    1280×720 HTML+CSS thumbnail template
out/                   local copies of each brief (gitignored)
```

## Troubleshooting

- **Claude asks for login / auth error** — run `claude` once interactively and
  sign in with your Pro/Max subscription, then re-run. No token goes in `.env`;
  the runner reuses your session and strips `ANTHROPIC_API_KEY` so it never bills
  the paid API.
- **`claude CLI not found`** — install Claude Code and ensure `claude` is on PATH.
- **`playwright … chromium`** — run `playwright install chromium` once.
- **Publish failed** — check `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`; your
  local files in `out/…` are intact, just re-run after fixing.
