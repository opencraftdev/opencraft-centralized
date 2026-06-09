# Sosmed Agent Integration — Design Spec

**Date:** 2026-06-05  
**Branch:** feat/integrate-sosmed-agent  
**Approach:** Extend existing `/calendar` and `/posts` pages (Approach 1)

---

## Overview

The sosmed VM worker automates content creation across three post types (engage, educate, video). It polls a shared `bot_commands` Supabase table, runs generation/publish pipelines, and writes results to `content_posts`. This integration adds the web UI that drives it: a creation modal on the calendar, an interactive post detail page, and a dedicated video pipeline subpage.

---

## 1. Data Layer

### Migration — `009_sosmed_bot_commands.sql`

Widens the existing `bot_commands` table to accept sosmed values. The comment-bot worker is unaffected because it filters by platform (`threads`, `x`, `all`).

```sql
-- Widen command constraint
ALTER TABLE bot_commands DROP CONSTRAINT bot_commands_command_check;
ALTER TABLE bot_commands ADD CONSTRAINT bot_commands_command_check
  CHECK (command IN ('scrape','post_approved','draft','generate','publish','suggest','approve','reset'));

-- Widen platform constraint
ALTER TABLE bot_commands DROP CONSTRAINT bot_commands_platform_check;
ALTER TABLE bot_commands ADD CONSTRAINT bot_commands_platform_check
  CHECK (platform IN ('threads','x','all','engage','educate','video'));

-- Widen status constraint
ALTER TABLE bot_commands DROP CONSTRAINT bot_commands_status_check;
ALTER TABLE bot_commands ADD CONSTRAINT bot_commands_status_check
  CHECK (status IN ('pending','running','done','failed','processing','completed'));

-- Add user_id (nullable so existing comment-bot inserts keep working)
ALTER TABLE bot_commands ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
```

**Comment-bot dashboard fix:** `getRecentCommands` in `src/lib/comment-bot/queries.ts` gains a `.in('platform', ['threads', 'x', 'all'])` filter so sosmed commands don't appear in the comment-bot panel.

### New lib module — `src/lib/sosmed/`

**`types.ts`**
```ts
export type SosmedPlatform = 'engage' | 'educate' | 'video'
export type SosmedCommand  = 'generate' | 'publish' | 'suggest' | 'draft' | 'approve' | 'reset'
export type SosmedStatus   = 'pending' | 'processing' | 'completed' | 'failed'

export interface SosmedCommandRow {
  id: number
  command: SosmedCommand
  platform: SosmedPlatform
  status: SosmedStatus
  context: Record<string, unknown> | null
  user_id: string | null
  error: string | null
  created_at: string
  started_at: string | null
  finished_at: string | null
}

export interface VideoSuggestItem {
  videoId: string
  title: string
  channelTitle: string
  duration: string
  thumbnailUrl: string
}

export interface VideoAgentStateRow {
  suggest_list_json: VideoSuggestItem[] | null
}
```

**`queries.ts`** — read operations used by server components and API routes:
- `getCommand(supabase, id)` — fetch a single `bot_commands` row (sosmed)
- `listDraftPosts(supabase)` — fetch all `content_posts` with `status='draft'`, ordered by `date_slot`
- `getVideoAgentState(supabase)` — fetch `video_agent_state` suggest list

**`posts.ts`** — write operations (used via API routes, service-role client):
- `createPost(admin, { userId, type, dateSlot })` → inserts draft row, returns `ContentPost`
- `updatePostStatus(admin, id, status)` → PATCH status
- `updatePostFeedback(admin, id, feedback)` → PATCH user_feedback
- `updatePostScheduledAt(admin, id, scheduledAt)` → PATCH scheduled_at

### New API routes

| Route | Method | Auth | Purpose |
|---|---|---|---|
| `/api/posts` | `POST` | user | Create a `content_posts` row (status=draft) |
| `/api/posts/[id]` | `PATCH` | user | Update status / user_feedback / scheduled_at |
| `/api/sosmed/command` | `POST` | user | Insert a `bot_commands` row (sosmed worker) |
| `/api/sosmed/command/[id]` | `GET` | user | Poll a single command row |
| `/api/sosmed/video-state` | `GET` | user | Fetch `video_agent_state` suggest list |

All routes validate auth via `createClient()` and write via `createAdminClient()`.

Add `DELETE` to `/api/posts/[id]` for hard-deleting a post (only if `status='draft'`; reject otherwise).

**Assumption:** `video_agent_state` table is owned and populated by the VM worker — it already exists in Supabase. We only read from it; no migration needed on our side.

---

## 2. Calendar Page Changes (`/calendar`)

### New Content Modal

Triggered when user clicks a day in the FullCalendar grid (`dateClick` event, already wired). Opens a MUI Dialog with three option cards:

| Code | Label | Type | Description |
|---|---|---|---|
| EG | Simple Question | engage | Text-only question for Threads + X |
| ED | Coding Tip | educate | AI/coding tip with optional code card |
| VD | AI News Video | video | Full video pipeline |

On confirm: `POST /api/posts` → navigate to `/posts/[id]`.

The modal shows a loading state while the POST is in flight. Selecting a type highlights the card; confirm is disabled until a type is selected.

### Queue Sidebar

Added to the right of the FullCalendar grid. Shows all `status='draft'` posts across all dates.

- Loads on mount via `GET /api/posts?status=draft`
- Refreshes after a new post is successfully created
- Each item: `TypeBadge` + date chip + truncated first line of content
- Clicking an item navigates to `/posts/[id]`
- Empty state: "No drafts — click a day to create a post"

**Layout change:** `280px mini-cal+legend | 1fr FullCalendar | 260px queue sidebar`  
On small screens (`xs`/`sm`) the queue sidebar is hidden (same breakpoint as the mini-calendar).

---

## 3. Post Detail Page (`/posts/[id]`)

New dynamic route: `src/app/(app)/posts/[id]/page.tsx`

Server component fetches the post by id; if not found returns 404. Passes post to a client shell component.

### Header (all types)

- `TypeBadge` + `StatusBadge` + `#id` + `date_slot`
- **Delete button** (right-aligned): hard-delete the row via `DELETE /api/posts/[id]`, then redirect to `/calendar`

### Generation section (status = draft)

**Engage**
1. On mount: if `text_content` is null → auto-fires `POST /api/sosmed/command` (platform=engage, command=generate), stores `commandId` in state
2. Polls `/api/sosmed/command/[commandId]` every 2s
3. On `completed` → re-fetches post → displays text preview
4. Char counter: `{n} chars · Threads ≤490 · X ≤275` (color turns red when over limit)
5. Feedback textarea + **Regenerate** button (fires new generate command with `{ user_feedback }` in context)
6. **Approve & Accept** button → `PATCH /api/posts/[id]` status=accepted

**Educate**
1. Source picker (only before first generation): two toggle cards — **Claude** (fresh tip) vs **GitHub Trending**. Locked to `source_json.source` after first generate.
2. **Generate** button → fires command with `{ source: "claude" | "github" }`
3. 5-step progress bar: "Warming up → Drafting tip → Writing code example → Rendering code card → Finishing up" — advances every ~5s visually while polling
4. On `completed` → re-fetches post → shows text (code blocks stripped for display) + code card image if `image_path` set (via `/api/media/<path>`)
5. Feedback textarea + **Regenerate** button
6. **Approve & Accept** button

**Video**
- "Go to Video Generator →" button navigates to `/posts/[id]/video`
- If post already has `text_content` (returned from pipeline): shows read-only `PostDetail` content instead

### Content preview (status ≠ draft)

Read-only `PostDetail` component (already exists). Shown below header when post is not in draft state.

### Captions section

Shows `captions_json.threads`, `.x`, `.instagram` if present. Read-only.

### Publish section (status = accepted | scheduled | published)

- **If published:** "✓ Published at {datetime}" + per-platform results (already in `PostDetail`)
- **If accepted or scheduled:**
  - MUI TimePicker bound to `date_slot` → saves `scheduled_at` on change via `PATCH /api/posts/[id]`
  - **Publish Now** button → `POST /api/sosmed/command` (command=publish, context={postId}), polls until completed, re-fetches post
  - Spinner + disabled state during publish

---

## 4. Video Pipeline Subpage (`/posts/[id]/video`)

`src/app/(app)/posts/[id]/video/page.tsx`

Client page. Fetches initial post state on mount.

### Step Indicator

Horizontal stepper at top: **Suggest → Draft → Approve → Publish**  
Active step derived from post status and local state:
- No suggest list yet → Step 1
- Suggest list exists, no `text_content` → Step 2
- Has `text_content`, status=draft → Step 3
- Status=accepted → Step 4
- Status=published → all steps complete

### Step 1 — Suggest

- **Find Video Ideas** button → `POST /api/sosmed/command` (platform=video, command=suggest)
- Spinner while polling (every 2s)
- On completed → `GET /api/sosmed/video-state` → renders ranked cards:
  - Thumbnail image, video title, channel name, duration chip
  - Click to select (highlighted border); selection stored in state
- **Continue with this video →** button enabled once a card is selected

### Step 2 — Draft

- **Draft This Video** button → fires command (platform=video, command=draft, context={videoId})
- Live log panel: scrollable `<pre>` box, polls every 2s, appends new `log_text` lines
- Current step label + linear progress bar
- On completed → post re-fetches, advances to Step 3

### Step 3 — Approve

- Read-only content preview: headline, captions, hashtags from refreshed post
- **Approve** button → fires command (platform=video, command=approve) → post status → accepted
- **Reset** button → fires command=reset → clears state, returns to Step 1

### Step 4 — Publish

- Same publish section as post detail: MUI TimePicker + **Publish Now** button
- Fires command=publish, polls, re-fetches
- Per-platform results: Instagram Reels + Threads + X

### Error Recovery

**Recover from state** button always visible when `post.status === 'failed'` → fires command=reset → returns to Step 1.

---

## 5. Polling Pattern

Consistent across all interactive flows:

```ts
// 1. Fire command, get commandId
const { command_id } = await POST('/api/sosmed/command', { ... })

// 2. Poll every 2s
const poll = setInterval(async () => {
  const cmd = await GET(`/api/sosmed/command/${command_id}`)
  if (cmd.status === 'completed') {
    clearInterval(poll)
    // re-fetch content_posts row
  }
  if (cmd.status === 'failed') {
    clearInterval(poll)
    setError(cmd.error)
  }
}, 2000)

// 3. Cleanup on unmount
```

---

## 6. Component Structure

```
src/
  app/(app)/posts/[id]/
    page.tsx               ← server component, fetches post
    video/page.tsx         ← video pipeline client page
  features/sosmed/
    components/
      NewContentModal.tsx  ← day-click creation modal
      QueueSidebar.tsx     ← draft queue panel
      PostDetailShell.tsx  ← client shell for /posts/[id]
      EngageGenerator.tsx  ← engage generation + approve UI
      EducateGenerator.tsx ← educate generation + approve UI
      PublishSection.tsx   ← shared time picker + publish now
      VideoStepper.tsx     ← full video pipeline UI
      SuggestList.tsx      ← video suggestion cards
    hooks/
      useCommandPoller.ts  ← shared polling hook
    queries.ts             → re-exports from lib/sosmed/queries
    types.ts               → re-exports from lib/sosmed/types
  lib/sosmed/
    types.ts
    queries.ts
    posts.ts
  app/api/
    posts/route.ts               (POST added)
    posts/[id]/route.ts          (PATCH added)
    sosmed/command/route.ts      (POST)
    sosmed/command/[id]/route.ts (GET)
    sosmed/video-state/route.ts  (GET)
  supabase/migrations/
    009_sosmed_bot_commands.sql
```

---

## 7. Key Rules (from agent spec)

- Never offer the Publish section for `status='draft'` posts — only for accepted/scheduled/published
- Educate source picker is hidden after first generation (source locked to `source_json.source`)
- Video is the only type that goes through the multi-step pipeline; engage and educate are single-step generate → approve → publish
- Engage and educate publish to Threads + X only (no Instagram)
- Video publishes to Instagram Reels + Threads + X
