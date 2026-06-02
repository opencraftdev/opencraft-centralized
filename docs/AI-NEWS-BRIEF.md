# AI News Brief — `agents/video-materials` runner + Supabase + web list

> Status: **BUILT (2026-05-31).** Migration `005_news_briefs.sql` applied to the
> shared Supabase project (`wdzmuniyqqyngzckeoph`) + public `news-thumbnails`
> bucket created; web view live as the **"AI News Brief" tab inside Record Video**
> (`/tutorial-video`, sidebar → Social Media → Record Video); Python runner under
> `agents/video-materials/`. To go live: `claude setup-token` + put the
> service-role key in the agent's `.env`, then `python run.py`.
> Direction (locked with owner):
> - **Agent** = standalone local Python runner at `agents/video-materials/`,
>   driven by the **Claude Code subscription (no paid API key)**.
> - It produces a ≤2-minute video brief (**script + caption + HTML/CSS thumbnail
>   PNG**) and **writes it to Supabase** (row + thumbnail in Storage), using the
>   **service-role key** — exactly how the **Document Agent** already pushes.
> - The **web app only displays the list of materials** (read-only) from Supabase.
>
> Supabase is the bus. The agent writes; the dashboard reads. No generation, no
> Anthropic API key, in the web app.

```
ai-news-mcp ─▶ agents/video-materials (LOCAL, claude subscription)
 (HTTP MCP)      1. news.py     fetch top picks (httpx, deterministic)
                 2. generate.py  claude -p  → script + caption + thumbnail copy
                 3. thumbnail.py Jinja HTML+CSS → Playwright → thumbnail.png
                 4. publish.py   ──────────────┐
                                               ▼
                              ┌──────────────────────────────────────┐
                              │ Supabase  (service-role write)        │
                              │  • Storage bucket `news-thumbnails`   │
                              │      thumbnail.png → public URL        │
                              │  • table  `news_briefs` (row)          │
                              └──────────────────────────────────────┘
                                               ▲  (RLS: signed-in SELECT only)
                              Next.js web app ─┘
                              read-only list of materials
```

## Roles

| Piece | Responsibility |
|---|---|
| **Python agent** (`agents/video-materials/`) | fetch news, generate via Claude subscription, render thumbnail, **write to Supabase** |
| **Supabase** | `news_briefs` table + `news-thumbnails` Storage bucket = single source of truth |
| **Web app** | **only lists** the materials (thumbnail, title, script, caption, source links). No writes, no generation |

This mirrors the established pattern (see [.env.local.example](../.env.local.example)
lines 19-27 + [admin.ts](../src/lib/supabase/admin.ts)): **external agents write
with the service-role key; the dashboard is read-only under RLS.**

## Why local + subscription (no API key)

Claude Code already authenticates against your Pro/Max subscription; the runner
reuses that **logged-in session** instead of adding per-token Anthropic API
billing:

1. One-time: run `claude` once interactively and sign in (Pro/Max). No token to
   copy — nothing Claude-related goes in the agent's `.env`.
2. The runner calls Claude headlessly (`claude -p`), reusing your session —
   billed to the **subscription**.
3. ⚠️ **Critical:** if `ANTHROPIC_API_KEY` is in the environment, Claude Code
   prefers it and you get **API-billed**. The runner spawns Claude with the paid
   auth vars (`ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN`) stripped from the child
   env, so it always uses the subscription session — paid fallback is impossible.

`ai-news-mcp` is hit directly with `httpx` (deterministic, free); Claude is used
**only** for the creative text.

## Folder layout — `agents/video-materials/`

```
agents/video-materials/
  README.md                  # setup (claude login, supabase env, playwright install) + usage
  pyproject.toml             # deps: httpx, jinja2, playwright, pydantic, python-dotenv, supabase
  .env.example               # SUPABASE_URL=, SUPABASE_SERVICE_ROLE_KEY=, CLAUDE_MODEL=,
                             #   SUPABASE_THUMBNAIL_BUCKET=news-thumbnails, AI_NEWS_MCP_URL=  (no Claude token)
  .gitignore                 # .env, out/, .venv/
  run.py                     # entrypoint CLI
  video_materials/
    __init__.py
    config.py                # load env, presenters, word-budget constants
    news.py                  # ai-news-mcp JSON-RPC client → get_top_picks(n) -> list[Pick]
    generate.py              # build prompt, call claude -p (scrubbed env), parse + validate JSON
    thumbnail.py             # render Jinja template → PNG via Playwright
    publish.py               # upload PNG to Storage + insert news_briefs row (service-role)
    models.py                # pydantic: Pick, Script, Segment, Caption, Brief
    prompts.py               # the ≤2-min script/caption/thumbnail prompt
    presenters.py            # mirror of the 3 presenters (name/handle)
  templates/
    thumbnail.html.j2        # HTML + CSS thumbnail template (full CSS, 1280×720)
  out/                       # local copies of each brief (gitignored, for debugging/hand-edit)
```

### Entry point

```bash
cd agents/video-materials
python run.py --presenter rayandika --n 5          # default n=5
```

Steps: fetch picks → generate → render PNG → **publish to Supabase** → also save
local `out/<date>-<slug>/` copies (`brief.json`, `script.md`, `caption.txt`,
`thumbnail.html`, `thumbnail.png`) for debugging. On publish failure it keeps the
local files and exits non-zero with a clear message.

## Supabase integration

### Migration — `supabase/migrations/005_news_briefs.sql` (new, additive)

Same RLS shape as [003_tutorial_videos.sql](../supabase/migrations/003_tutorial_videos.sql):
dashboard SELECT only, all writes via the service-role key (bypasses RLS).

```sql
create extension if not exists pgcrypto;
create extension if not exists moddatetime schema extensions;

create table news_briefs (
  id            uuid primary key default gen_random_uuid(),
  title         text,
  presenter_id  text not null,
  presenter_name text not null,
  picks         jsonb not null,        -- the NewsPick[] used  [{title,url,source,score,summary}]
  script        jsonb not null,        -- {hook, segments[], outro, total_words, est_seconds}
  caption       jsonb not null,        -- {text, hashtags[]}
  thumbnail     jsonb not null,        -- {headline, subtext}
  thumbnail_url text,                  -- public URL in Storage bucket
  est_seconds   numeric,
  source        text default 'video-materials',  -- which agent produced it
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index idx_news_briefs_created on news_briefs(created_at desc);

create trigger handle_updated_at_news_briefs
  before update on news_briefs
  for each row execute procedure extensions.moddatetime(updated_at);

alter table news_briefs enable row level security;
create policy "viewers read news briefs" on news_briefs
  for select using (auth.uid() is not null);
-- no insert/update/delete policies → only the service-role key (the agent) writes
```

### Storage — bucket `news-thumbnails`

Public-read bucket (created once via the Supabase dashboard or an SQL/`storage`
call documented in the README). The agent uploads `thumbnail.png` to
`news-thumbnails/<brief-id>.png` and stores the resulting public URL in
`news_briefs.thumbnail_url`. (Public read = the dashboard `<img>` works with no
signing; matches how thumbnails are meant to be shown.)

### `publish.py`

Uses the `supabase` Python client with `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`
(the agent's own `.env` — same values the dashboard uses in
[admin.ts](../src/lib/supabase/admin.ts), just named without the `NEXT_PUBLIC_`
prefix since this is a server-side tool):

1. `insert` the row (without `thumbnail_url`) → get `id`.
2. Upload `out/.../thumbnail.png` → `news-thumbnails/<id>.png` → public URL.
3. `update` the row's `thumbnail_url`.

> Alternative considered: push through a dashboard `/api/ingest/news-brief`
> endpoint with an API key (like the telemetry path) instead of giving the agent
> the service-role key. **Rejected for v1** — the Document Agent precedent already
> puts a service-role key in an external agent's `.env`, so direct write is the
> consistent, simpler choice. Easy to switch later if you prefer the API-key path.

## Web app — read-only materials list

Smallest possible surface; **display only**:

- `src/features/news-materials/types.ts` — `NewsBriefRow` (mirrors the table).
- `src/features/news-materials/queries.ts` — `getRecentNewsBriefs(supabase, limit)`,
  SELECT newest-first, exactly like [queries.ts](../src/features/tutorial-video/queries.ts).
- `src/app/(app)/news-materials/page.tsx` — a new page (server component) that
  reads via the authenticated client and renders a list. (A new page keeps the
  Record Tutorial Video page untouched; could instead be a tab there — minor,
  see Open questions.)
- `src/features/news-materials/components/MaterialsList.tsx` — cards: thumbnail
  image (`thumbnail_url`), title + presenter + date, the caption (copy button),
  a collapsible script (segments with seconds), and the source links from `picks`.
  Degrades gracefully if the table/migration isn't there yet (try/catch → empty
  state), like the tutorial-video page does.

No web-side generation, no Anthropic key, no Cloudinary involvement.

## External source — `ai-news-mcp` (verified)

Stateless HTTP MCP at
`https://iiwkkrvyhktnwolsfndx.supabase.co/functions/v1/mcp` (verified 2026-05-31:
no auth, no session, CORS open, JSON-RPC 2.0). `news.py` posts a `tools/call` for
`get_top_picks`; the payload is **double-encoded** (`result.content[0].text` is a
JSON string → `{ total, cached_at, picks:[{title,url,source,score,summary}] }`).
No article bodies — only the one-line `summary`. Env-overridable via
`AI_NEWS_MCP_URL`.

## Generation & 2-minute budget

`generate.py` runs `claude -p "<prompt>" --output-format json` (scrubbed env),
instructs strict-JSON output, validates with pydantic into `Brief`
(`script{hook,segments[{title,talking_points[],seconds}],outro,total_words,est_seconds}`,
`caption{text,hashtags[]}`, `thumbnail{headline,subtext}`). The ≤2-min cap is a
**word budget**: 140 wpm × 2 min ≈ **280 words** → hook ~25w / outro ~30w → ~225w
body → ~20s/item → **5 items** (default `n=5`). If `est_seconds > 120`, do one
auto tightening re-prompt, then accept + warn.

## Thumbnail

`templates/thumbnail.html.j2` = full HTML+CSS (grid, gradients, web fonts — no
Satori limits). Slots: `headline`, `subtext`, presenter `name`/`@handle`, accent
`#0B57D0`, logo. `thumbnail.py` fills it, Playwright (headless Chromium, 1280×720)
screenshots → PNG. One-time `playwright install chromium` in the README.

## Dependencies

Python: `httpx`, `jinja2`, `playwright`, `pydantic`, `python-dotenv`, `supabase`.
Tooling: Claude Code CLI (with `claude setup-token` done once). **No Anthropic API
key, no Next.js npm additions** (the web list uses existing `@supabase/*` + MUI).

## Open questions

1. **Web list placement** — new dedicated page `/news-materials` (proposed) vs a
   tab on the existing Record Tutorial Video page.
2. **Claude call style** — `claude -p` subprocess (default) vs `claude-agent-sdk`.
3. **Over-budget** — auto one-shot tighten then accept (proposed) vs just warn.
4. **Model** — subscription default vs pin `CLAUDE_MODEL=claude-sonnet-4-6`.
5. **Python tooling** — `uv` vs plain `venv` + `requirements.txt`.
6. **Storage bucket creation** — document a manual dashboard step vs script it.

## Explicitly unchanged

The recorder, Cloudinary recipe, presenters, `tutorial_videos`, and every
`/api/tutorial-video/*` route are untouched. New work is purely additive: the
Python agent, one migration + Storage bucket, and one read-only web view.
