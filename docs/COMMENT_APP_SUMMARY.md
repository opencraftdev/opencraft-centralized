# OpenCraft Social Bot — App Summary for Integration

> This document summarizes the full architecture, data model, and workflow of the OpenCraft Social Bot. It is intended to help another agent or engineer implement this app's features inside a centralized web application.

---

## What This App Does

A **semi-automated social media reply bot** for the **OpenCraft** brand. It:

1. **Scrapes** viral posts on Threads and X/Twitter matching brand keywords (via Playwright)
2. **Drafts** brand-aware replies using Claude AI with a strict brand voice
3. **Queues** drafts for **human approval** (never auto-posts without explicit sign-off)
4. **Posts** approved replies to Threads and X via browser automation (Playwright)
5. **Logs** everything to SQLite for deduplication, audit, and daily cap enforcement

Single account per platform: `@opencraft.dev` (Threads) and `@opencraftdev` (X).

---

## Core End-to-End Flow

```
SCRAPE → DRAFT → HUMAN REVIEW → APPROVE/SKIP → POST → AUDIT
```

1. **Scrape**: Playwright searches Threads public search and authenticated X search for configured brand keywords. Posts are filtered by: engagement thresholds, language (Indonesian), anti-topics (crypto, politics, sports, AGI), spam markers (giveaway, airdrop, togel, pinjol), and max age (48h). Survivors are saved to the DB with `status='scraped'`.

2. **Draft**: A Claude AI subagent reads each `scraped` item, loads the brand profile JSON, and generates a reply in **informal Bahasa Indonesia** (gw/lo register, contractions). Reply modes are rotated: `agree_and_extend`, `polite_contrarian`, `concrete_example`, `ask_sharpening_question`, `translate_to_outcome`. Output saved as `status='ready_for_review'`.

3. **Human Review**: User runs a CLI command to inspect the queue. Reviews `draft_text` per item.

4. **Approve/Skip**: User explicitly approves (`status='approved'`) or skips (`status='skipped'`) each item.

5. **Post**: Playwright injects saved auth cookies, navigates to the parent post URL, types the reply in the web UI, submits, and verifies the reply appears in the DOM before marking success (`status='posted'`). Random 90–300s delays between posts. Hard cap: 5 replies/day per platform.

6. **Audit**: All state transitions, timestamps, errors, reply URLs, and platform IDs are stored in SQLite.

---

## Data Model

**Single SQLite table**: `replies`

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER PK | Auto-increment |
| `platform` | TEXT | `'threads'` or `'x'` |
| `account_username` | TEXT | `'opencraft.dev'` or `'opencraftdev'` |
| `parent_post_id` | TEXT | Platform-specific post ID |
| `parent_post_url` | TEXT | Permalink to the post we're replying to |
| `parent_post_text` | TEXT | Full text of the viral post |
| `parent_author` | TEXT | @username of post author |
| `parent_likes` | INTEGER | Engagement at scrape time |
| `parent_replies` | INTEGER | Engagement at scrape time |
| `parent_created_at` | TIMESTAMP | When parent post was published |
| `reply_mode` | TEXT | Which reply strategy was used |
| `draft_text` | TEXT | AI-generated reply draft |
| `final_text` | TEXT | Approved + posted text |
| `reply_platform_id` | TEXT | ID returned by Threads/X for our reply |
| `reply_url` | TEXT | Live permalink to our reply |
| `status` | TEXT | State machine (see below) |
| `error` | TEXT | Failure reason if any |
| `note` | TEXT | Scraper metadata (e.g. `keyword=claude code`) |
| `scraped_at` | TIMESTAMP | |
| `drafted_at` | TIMESTAMP | |
| `approved_at` | TIMESTAMP | |
| `posted_at` | TIMESTAMP | |

**Unique constraint**: `(platform, account_username, parent_post_id)` — prevents duplicate replies.

### Status State Machine

```
scraped → ready_for_review → approved → posted
                           ↘ skipped
                                        ↘ failed
```

| Status | Meaning |
|--------|---------|
| `scraped` | Discovered, not yet drafted |
| `ready_for_review` | AI drafted, awaiting human approval |
| `approved` | Human approved, ready to post |
| `posted` | Successfully published |
| `failed` | Post attempt failed (see `error` field) |
| `skipped` | Human rejected OR auto-filtered |

---

## CLI Commands Reference

The app is entirely driven by a unified CLI (`python -m src.cli <command>`).

| Command | What It Does |
|---------|-------------|
| `status` | Daily reply count vs cap, queue depth by status, token expiry |
| `scrape --platform [threads\|x\|all]` | Run scraper, discover + filter viral posts |
| `scrape --platform all --lax` | Relaxed filters (lower engagement threshold) |
| `scrapers` | Scraper health: last scrape time, queue stats, keyword count |
| `scrapers --probe` | Live Playwright test of X cookie validity |
| `queue --status ready_for_review` | Show items awaiting review |
| `approve --id N` | Approve a draft → `approved` |
| `skip --id N` | Reject a draft → `skipped` |
| `post --id N` | Post a single approved item |
| `post --all-approved` | Post all approved items (with delays) |
| `report [--status all]` | Table of what we replied to |
| `list-scraped [--id N] [--limit 10]` | Emit queue as JSON (for AI subagent) |
| `save-draft --id N --mode <mode>` | Save draft text from stdin (for AI subagent) |
| `x-login` | Capture X cookies via visible browser |
| `x-test` | Verify X cookies are still valid |
| `threads-login` | Capture Threads cookies via visible browser |
| `threads-test` | Verify Threads cookies are still valid |
| `brand-show` | Display loaded brand profile summary |

---

## Brand Configuration

All brand voice, content strategy, and operational limits live in a single JSON file: `brand/brand-profile.json`.

**Key sections:**

| Section | Purpose |
|---------|---------|
| `accounts` | Platform handles, bios, scopes |
| `niche` | Primary topics, subtopics, anti_topics |
| `target_audience.audience_segments` | Two personas: `builders` (devs) and `business_owners` |
| `voice` | Tone (operator-grade, calm, anti-hype), writing rules, emoji policy |
| `promotion` | Value-first rules, soft CTA examples, URL ban |
| `viral_filters` | `monitor_keywords`, `min_engagement`, `max_post_age_hours`, `skip_if_post_contains` |
| `reply_strategy` | Language (Bahasa Indonesia), 5 reply modes, char limits |
| `operational_caps` | `replies_per_day: 5`, delay 90–300s, 8h active window |

**Rule**: All code reads brand logic from this file. Brand logic is never hardcoded.

---

## External Integrations

| Integration | Used For | Notes |
|-------------|----------|-------|
| **Playwright** | Scraping + posting on both platforms | Chromium only. Cookies injected for auth. |
| **Claude API (Anthropic)** | Drafting replies | Subagent reads brand profile, writes Bahasa Indonesia replies |
| **Threads Graph API** | Intentionally NOT used for posting | Graph API can't reply to others' posts yet (pending Meta review) |
| **twikit (X unofficial)** | Intentionally NOT used for posting | Broken against current X API. Playwright used instead. |

---

## Authentication & Secrets

| File | Contents | How Created |
|------|----------|-------------|
| `.env` | `ANTHROPIC_API_KEY`, `ZERNIO_API_KEY` | Manual, gitignored |
| `accounts/x_<username>.cookies.json` | X auth cookies: `auth_token`, `ct0`, etc. | `python -m src.cli x-login` |
| `accounts/threads_<username>.cookies.json` | Threads cookies: `sessionid`, `ig_did`, `csrftoken`, etc. | `python -m src.cli threads-login` |
| `data/bot.db` | SQLite database | Auto-created on first run |

All are gitignored. No OAuth flows — browser cookie injection only.

**Env vars for debugging posting:**
- `THREADS_POST_HEADLESS=0` — Visible browser
- `THREADS_POST_DRY_RUN=1` — Abort before final submit
- `THREADS_POST_SLOWMO=<ms>` — Slow down for debugging

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Language | Python 3.10+ |
| Database | SQLite (stdlib `sqlite3`, synchronous) |
| Browser automation | Playwright (async, Chromium) |
| AI drafting | Anthropic Claude API (`anthropic` SDK) |
| HTTP | httpx (available, not actively used) |
| Env vars | python-dotenv |
| Language detection | `langdetect` library |
| CLI | `argparse` (stdlib) |

---

## Project File Structure

```
src/
├── cli.py                        # Unified CLI entrypoint (~1100 lines)
├── brand/loader.py               # Loads brand-profile.json
├── queue/db.py                   # SQLite schema, CRUD helpers, state transitions
├── scraper/
│   ├── threads_spider.py         # Playwright: Threads public keyword search
│   ├── x_spider.py               # Playwright + cookies: X authenticated search
│   └── filters.py                # Brand filter logic (language, topics, spam, engagement)
├── poster/
│   ├── threads_poster.py         # Playwright: posts reply to Threads web UI, DOM-verified
│   └── x_poster.py               # Playwright: posts reply to X web UI, network-verified
brand/
└── brand-profile.json            # Machine-readable brand config (single source of truth)
data/bot.db                       # SQLite (gitignored)
accounts/                         # Auth cookies (gitignored)
.claude/agents/reply-drafter.md   # Claude subagent instructions for AI drafting
```

---

## Key Design Decisions to Preserve in Integration

1. **Never post without explicit per-item human approval.** No bulk auto-posting.
2. **Brand profile is the single source of truth.** Never hardcode voice, keywords, or caps in application code — always read from the JSON.
3. **Posting uses Playwright on real web UI**, not official APIs — because Threads Graph API can't reply to others' posts, and X twikit is broken.
4. **Dedup is enforced at DB level** via UNIQUE constraint. Always check before inserting.
5. **5 replies/day per platform hard cap.** Enforce via `count_today()` before posting.
6. **Random delays (90–300s) between posts.** Never burst.
7. **Replies are always in informal Bahasa Indonesia** (gw/lo register). Never formal Indonesian, never English.
8. **Auth tokens are cookie-based**, captured via a manual login flow in a visible browser. Cookies expire; the `scrapers --probe` / `x-test` / `threads-test` commands verify freshness.
9. **Verify post success via DOM** (Threads) or network response (X) before marking `status='posted'`. Do not trust the "Post" button click alone.
10. **On auth error or 429: pause that platform, notify user.** Do not retry in a loop.

---

## Implementation Status

| Component | Status |
|-----------|--------|
| CLI + all commands | ✅ Complete |
| SQLite schema + state transitions | ✅ Complete |
| Threads scraper | ✅ Complete |
| X scraper | ✅ Complete |
| Content filters | ✅ Complete |
| Threads poster (Playwright) | ✅ Complete |
| X poster (Playwright) | ✅ Complete |
| AI draft subagent | ✅ Working (Claude Code subagent) |
| Brand profile JSON | ✅ Complete |
| Brand refresh from Zernio | ❌ Not implemented (stub only) |
| Full-auto mode | ❌ Not enabled (intentional) |

---

*Generated from codebase on 2026-06-02.*
