# Sosmed Agent Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate the sosmed VM worker into the centralized app — calendar creation modal, draft queue sidebar, interactive post detail pages for engage/educate/video types, and a full 4-step video pipeline subpage.

**Architecture:** New `src/features/sosmed/` feature module holds all UI components and a shared `useCommandPoller` hook. New `src/lib/sosmed/` handles data access (read queries + write ops). API routes are extended for post creation/update and new sosmed command routes are added. The existing `/calendar` page gets a creation modal and draft queue. New dynamic routes `/posts/[id]` and `/posts/[id]/video` handle generation and publishing.

**Tech Stack:** Next.js 15 App Router, MUI v9, TypeScript, Supabase (supabase-js v2), date-fns v4, @mui/x-date-pickers v9, FullCalendar v6, zod

---

## File Map

**New files:**
- `supabase/migrations/009_sosmed_bot_commands.sql`
- `src/lib/sosmed/types.ts`
- `src/lib/sosmed/queries.ts`
- `src/lib/sosmed/posts.ts`
- `src/features/sosmed/hooks/useCommandPoller.ts`
- `src/features/sosmed/components/NewContentModal.tsx`
- `src/features/sosmed/components/QueueSidebar.tsx`
- `src/features/sosmed/components/EngageGenerator.tsx`
- `src/features/sosmed/components/EducateGenerator.tsx`
- `src/features/sosmed/components/PublishSection.tsx`
- `src/features/sosmed/components/PostDetailShell.tsx`
- `src/features/sosmed/components/SuggestList.tsx`
- `src/features/sosmed/components/VideoStepper.tsx`
- `src/app/api/sosmed/command/route.ts`
- `src/app/api/sosmed/command/[id]/route.ts`
- `src/app/api/sosmed/video-state/route.ts`
- `src/app/(app)/posts/[id]/page.tsx`
- `src/app/(app)/posts/[id]/video/page.tsx`

**Modified files:**
- `src/lib/comment-bot/queries.ts` — add platform filter to `getRecentCommands`
- `src/app/api/posts/route.ts` — add `POST` handler
- `src/app/api/posts/[id]/route.ts` — add `PATCH` and `DELETE` handlers
- `src/components/calendar/FullCalendarView.tsx` — add `onDateClick` prop
- `src/app/(app)/calendar/page.tsx` — wire modal, queue sidebar, "Open in Posts" link

---

## Task 1: DB Migration + Comment-Bot Fix

**Files:**
- Create: `supabase/migrations/009_sosmed_bot_commands.sql`
- Modify: `src/lib/comment-bot/queries.ts`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/009_sosmed_bot_commands.sql`:

```sql
-- Widen bot_commands table to support sosmed worker commands.
-- The comment-bot worker is unaffected: it filters by platform IN ('threads','x','all').

-- Expand command values
ALTER TABLE bot_commands DROP CONSTRAINT bot_commands_command_check;
ALTER TABLE bot_commands ADD CONSTRAINT bot_commands_command_check
  CHECK (command IN ('scrape','post_approved','draft','generate','publish','suggest','approve','reset'));

-- Expand platform values
ALTER TABLE bot_commands DROP CONSTRAINT bot_commands_platform_check;
ALTER TABLE bot_commands ADD CONSTRAINT bot_commands_platform_check
  CHECK (platform IN ('threads','x','all','engage','educate','video'));

-- Expand status values
ALTER TABLE bot_commands DROP CONSTRAINT bot_commands_status_check;
ALTER TABLE bot_commands ADD CONSTRAINT bot_commands_status_check
  CHECK (status IN ('pending','running','done','failed','processing','completed'));

-- Add user_id (nullable — existing comment-bot inserts don't set it)
ALTER TABLE bot_commands ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);

-- Add log_text for video pipeline live log
ALTER TABLE bot_commands ADD COLUMN IF NOT EXISTS log_text text;
```

- [ ] **Step 2: Apply the migration**

Run this against your Supabase project (Dashboard → SQL Editor, or `supabase db push`):
```
supabase/migrations/009_sosmed_bot_commands.sql
```

Expected: no errors. If you see "constraint does not exist", query the real names first:
```sql
SELECT conname FROM pg_constraint WHERE conrelid = 'bot_commands'::regclass AND contype = 'c';
```

- [ ] **Step 3: Fix `getRecentCommands` to exclude sosmed commands**

Open `src/lib/comment-bot/queries.ts`. Find the `getRecentCommands` function and add a platform filter:

```ts
export async function getRecentCommands(
  supabase: SupabaseClient,
  limit = 10,
): Promise<BotCommandRow[]> {
  const { data, error } = await supabase
    .from("bot_commands")
    .select("*")
    .in("platform", ["threads", "x", "all"])
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as BotCommandRow[];
}
```

- [ ] **Step 4: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/009_sosmed_bot_commands.sql src/lib/comment-bot/queries.ts
git commit -m "feat: widen bot_commands for sosmed worker, fix comment-bot query filter"
```

---

## Task 2: Sosmed Types

**Files:**
- Create: `src/lib/sosmed/types.ts`

- [ ] **Step 1: Write the types file**

Create `src/lib/sosmed/types.ts`:

```ts
export type SosmedPlatform = "engage" | "educate" | "video";
export type SosmedCommand = "generate" | "publish" | "suggest" | "draft" | "approve" | "reset";
export type SosmedCommandStatus = "pending" | "processing" | "completed" | "failed";

export interface SosmedCommandRow {
  id: number;
  command: SosmedCommand;
  platform: SosmedPlatform;
  status: SosmedCommandStatus;
  context: Record<string, unknown> | null;
  user_id: string | null;
  error: string | null;
  log_text: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
}

export interface VideoSuggestItem {
  videoId: string;
  title: string;
  channelTitle: string;
  duration: string;
  thumbnailUrl: string;
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/sosmed/types.ts
git commit -m "feat: add sosmed types"
```

---

## Task 3: Sosmed Read Queries

**Files:**
- Create: `src/lib/sosmed/queries.ts`

- [ ] **Step 1: Write the queries file**

Create `src/lib/sosmed/queries.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SosmedCommandRow, VideoSuggestItem } from "./types";

export async function getCommand(
  supabase: SupabaseClient,
  id: number,
): Promise<SosmedCommandRow | null> {
  const { data, error } = await supabase
    .from("bot_commands")
    .select("id,command,platform,status,context,user_id,error,log_text,created_at,started_at,finished_at")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as SosmedCommandRow | null) ?? null;
}

export async function getVideoAgentState(
  supabase: SupabaseClient,
  userId: string,
): Promise<VideoSuggestItem[] | null> {
  const { data, error } = await supabase
    .from("video_agent_state")
    .select("suggest_list_json")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return (data as { suggest_list_json: VideoSuggestItem[] | null } | null)?.suggest_list_json ?? null;
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/sosmed/queries.ts
git commit -m "feat: add sosmed read queries"
```

---

## Task 4: Sosmed Post Write Operations

**Files:**
- Create: `src/lib/sosmed/posts.ts`

- [ ] **Step 1: Write the posts write-ops file**

Create `src/lib/sosmed/posts.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ContentPost, ContentPostRow, PostType, PostStatus } from "@/lib/types";

function rowToPost(row: ContentPostRow): ContentPost {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    status: row.status,
    dateSlot: row.date_slot,
    scheduledAt: row.scheduled_at,
    publishedAt: row.published_at,
    textContent: row.text_content,
    imagePath: row.image_path,
    videoPath: row.video_path,
    headline: row.headline,
    captions: row.captions_json ? JSON.parse(row.captions_json) : null,
    hashtags: row.hashtags_json ? JSON.parse(row.hashtags_json) : null,
    source: row.source_json ? JSON.parse(row.source_json) : null,
    userFeedback: row.user_feedback,
    publishResults: row.publish_results_json ? JSON.parse(row.publish_results_json) : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function createPost(
  admin: SupabaseClient,
  { userId, type, dateSlot }: { userId: string; type: PostType; dateSlot: string },
): Promise<ContentPost> {
  const { data, error } = await admin
    .from("content_posts")
    .insert({ user_id: userId, type, status: "draft", date_slot: dateSlot })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return rowToPost(data as ContentPostRow);
}

export async function patchPost(
  admin: SupabaseClient,
  id: number,
  userId: string,
  patch: { status?: PostStatus; userFeedback?: string; scheduledAt?: string | null },
): Promise<ContentPost> {
  const update: Record<string, unknown> = {};
  if (patch.status !== undefined) update.status = patch.status;
  if (patch.userFeedback !== undefined) update.user_feedback = patch.userFeedback;
  if (patch.scheduledAt !== undefined) update.scheduled_at = patch.scheduledAt;

  const { data, error } = await admin
    .from("content_posts")
    .update(update)
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return rowToPost(data as ContentPostRow);
}

export async function deletePost(
  admin: SupabaseClient,
  id: number,
  userId: string,
): Promise<void> {
  const { error } = await admin
    .from("content_posts")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/sosmed/posts.ts
git commit -m "feat: add sosmed post write operations"
```

---

## Task 5: Extend Post API Routes

**Files:**
- Modify: `src/app/api/posts/route.ts`
- Modify: `src/app/api/posts/[id]/route.ts`

- [ ] **Step 1: Add POST handler to `/api/posts/route.ts`**

Open `src/app/api/posts/route.ts`. The file currently has only `GET`. Add the `POST` handler at the bottom:

```ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { listPosts } from "@/lib/posts";
import { createPost } from "@/lib/sosmed/posts";
import type { PostStatus } from "@/lib/types";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const status = req.nextUrl.searchParams.get("status") as PostStatus | null;
  const limit = Number(req.nextUrl.searchParams.get("limit") ?? 50);
  const offset = Number(req.nextUrl.searchParams.get("offset") ?? 0);

  const posts = await listPosts(supabase, { status: status ?? undefined, limit, offset });
  return NextResponse.json({ posts });
}

const createSchema = z.object({
  type: z.enum(["engage", "educate", "video"]),
  dateSlot: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const admin = createAdminClient();
  const post = await createPost(admin, { userId: user.id, type: parsed.data.type, dateSlot: parsed.data.dateSlot });
  return NextResponse.json({ post }, { status: 201 });
}
```

- [ ] **Step 2: Add PATCH and DELETE to `/api/posts/[id]/route.ts`**

Replace the full file `src/app/api/posts/[id]/route.ts` with:

```ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPost } from "@/lib/posts";
import { patchPost, deletePost } from "@/lib/sosmed/posts";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const post = await getPost(supabase, Number(id));
  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ post });
}

const patchSchema = z.object({
  status: z.enum(["draft", "accepted", "scheduled", "published", "failed"]).optional(),
  userFeedback: z.string().optional(),
  scheduledAt: z.string().nullable().optional(),
});

export async function PATCH(req: NextRequest, { params }: Params) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const admin = createAdminClient();
  try {
    const post = await patchPost(admin, Number(id), user.id, parsed.data);
    return NextResponse.json({ post });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const admin = createAdminClient();
  try {
    await deletePost(admin, Number(id), user.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/posts/route.ts src/app/api/posts/[id]/route.ts
git commit -m "feat: add POST /api/posts and PATCH/DELETE /api/posts/[id]"
```

---

## Task 6: Sosmed Command API Routes

**Files:**
- Create: `src/app/api/sosmed/command/route.ts`
- Create: `src/app/api/sosmed/command/[id]/route.ts`
- Create: `src/app/api/sosmed/video-state/route.ts`

- [ ] **Step 1: Write `POST /api/sosmed/command`**

Create `src/app/api/sosmed/command/route.ts`:

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const commandSchema = z.object({
  command: z.enum(["generate", "publish", "suggest", "draft", "approve", "reset"]),
  platform: z.enum(["engage", "educate", "video"]),
  context: z.record(z.unknown()).optional(),
});

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = commandSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("bot_commands")
    .insert({
      command: parsed.data.command,
      platform: parsed.data.platform,
      context: parsed.data.context ?? null,
      user_id: user.id,
      status: "pending",
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, command_id: data.id }, { status: 201 });
}
```

- [ ] **Step 2: Write `GET /api/sosmed/command/[id]`**

Create `src/app/api/sosmed/command/[id]/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCommand } from "@/lib/sosmed/queries";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const command = await getCommand(supabase, Number(id));
  if (!command) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ command });
}
```

- [ ] **Step 3: Write `GET /api/sosmed/video-state`**

Create `src/app/api/sosmed/video-state/route.ts`:

```ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getVideoAgentState } from "@/lib/sosmed/queries";

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const items = await getVideoAgentState(supabase, user.id);
  return NextResponse.json({ items: items ?? [] });
}
```

- [ ] **Step 4: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/sosmed/
git commit -m "feat: add sosmed command and video-state API routes"
```

---

## Task 7: useCommandPoller Hook

**Files:**
- Create: `src/features/sosmed/hooks/useCommandPoller.ts`

- [ ] **Step 1: Write the hook**

Create `src/features/sosmed/hooks/useCommandPoller.ts`:

```ts
"use client";

import { useEffect, useRef, useState } from "react";
import type { SosmedCommandStatus } from "@/lib/sosmed/types";

export interface CommandPollState {
  status: SosmedCommandStatus | null;
  logText: string | null;
  error: string | null;
  isPolling: boolean;
}

/**
 * Polls /api/sosmed/command/[id] every 2s until status is completed or failed.
 * Pass null to stop polling (e.g. after re-firing a new command).
 */
export function useCommandPoller(commandId: number | null): CommandPollState {
  const [state, setState] = useState<CommandPollState>({
    status: null,
    logText: null,
    error: null,
    isPolling: false,
  });

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (commandId === null) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setState({ status: null, logText: null, error: null, isPolling: false });
      return;
    }

    setState((prev) => ({ ...prev, isPolling: true }));

    async function poll() {
      try {
        const res = await fetch(`/api/sosmed/command/${commandId}`);
        if (!res.ok) return;
        const json = await res.json();
        const cmd = json.command;
        setState({ status: cmd.status, logText: cmd.log_text ?? null, error: cmd.error ?? null, isPolling: cmd.status === "pending" || cmd.status === "processing" });
        if (cmd.status === "completed" || cmd.status === "failed") {
          if (intervalRef.current) clearInterval(intervalRef.current);
        }
      } catch {
        // network error — keep polling
      }
    }

    poll();
    intervalRef.current = setInterval(poll, 2000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [commandId]);

  return state;
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/features/sosmed/hooks/useCommandPoller.ts
git commit -m "feat: add useCommandPoller hook"
```

---

## Task 8: NewContentModal

**Files:**
- Create: `src/features/sosmed/components/NewContentModal.tsx`

- [ ] **Step 1: Write the modal**

Create `src/features/sosmed/components/NewContentModal.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import type { PostType } from "@/lib/types";

interface Option {
  type: PostType;
  code: string;
  label: string;
  description: string;
  color: string;
}

const OPTIONS: Option[] = [
  { type: "engage", code: "EG", label: "Simple Question", description: "Text-only question for Threads + X", color: "#1A73E8" },
  { type: "educate", code: "ED", label: "Coding Tip", description: "AI/coding tip with optional code card", color: "#188038" },
  { type: "video", code: "VD", label: "AI News Video", description: "Full video pipeline", color: "#5F6368" },
];

interface Props {
  open: boolean;
  dateSlot: string;
  onClose: () => void;
}

export function NewContentModal({ open, dateSlot, onClose }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<PostType | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleClose() {
    if (loading) return;
    setSelected(null);
    setError(null);
    onClose();
  }

  async function handleConfirm() {
    if (!selected) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: selected, dateSlot }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json.error ?? "Failed to create post");
        return;
      }
      const { post } = await res.json();
      router.push(`/posts/${post.id}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth
      PaperProps={{ sx: { borderRadius: "16px" } }}>
      <DialogTitle sx={{ fontSize: "1.125rem", fontWeight: 500, pb: 1 }}>
        New content — {dateSlot}
      </DialogTitle>
      <DialogContent sx={{ pt: 1 }}>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
          {OPTIONS.map((opt) => (
            <Box
              key={opt.type}
              onClick={() => setSelected(opt.type)}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 2,
                p: 2,
                borderRadius: "12px",
                border: "2px solid",
                borderColor: selected === opt.type ? opt.color : "#E8EAED",
                bgcolor: selected === opt.type ? `${opt.color}0D` : "#fff",
                cursor: "pointer",
                transition: "all 140ms",
                "&:hover": { borderColor: opt.color, bgcolor: `${opt.color}08` },
              }}
            >
              <Box sx={{ width: 40, height: 40, borderRadius: "10px", bgcolor: opt.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Typography sx={{ color: "#fff", fontSize: "0.75rem", fontWeight: 700 }}>{opt.code}</Typography>
              </Box>
              <Box>
                <Typography sx={{ fontWeight: 600, fontSize: "0.9375rem", color: "#1F1F1F" }}>{opt.label}</Typography>
                <Typography sx={{ fontSize: "0.8125rem", color: "#5F6368" }}>{opt.description}</Typography>
              </Box>
            </Box>
          ))}
        </Box>
        {error && <Typography sx={{ mt: 1.5, fontSize: "0.8125rem", color: "#D93025" }}>{error}</Typography>}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={handleClose} disabled={loading} sx={{ textTransform: "none" }}>Cancel</Button>
        <Button
          variant="contained"
          disabled={!selected || loading}
          onClick={handleConfirm}
          startIcon={loading ? <CircularProgress size={14} color="inherit" /> : null}
          sx={{ textTransform: "none", borderRadius: "9999px" }}
        >
          Create
        </Button>
      </DialogActions>
    </Dialog>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/features/sosmed/components/NewContentModal.tsx
git commit -m "feat: add NewContentModal for day-click post creation"
```

---

## Task 9: QueueSidebar

**Files:**
- Create: `src/features/sosmed/components/QueueSidebar.tsx`

- [ ] **Step 1: Write the sidebar component**

Create `src/features/sosmed/components/QueueSidebar.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import InboxOutlined from "@mui/icons-material/InboxOutlined";
import { TypeBadge } from "@/components/ui/Badge";
import type { ContentPost } from "@/lib/types";

interface Props {
  refreshKey?: number;
}

export function QueueSidebar({ refreshKey = 0 }: Props) {
  const [posts, setPosts] = useState<ContentPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch("/api/posts?status=draft&limit=50")
      .then((r) => r.json())
      .then((data) => setPosts(data.posts ?? []))
      .finally(() => setLoading(false));
  }, [refreshKey]);

  return (
    <Box sx={{ bgcolor: "#fff", borderRadius: "12px", overflow: "hidden", height: "100%", display: "flex", flexDirection: "column" }}>
      <Box sx={{ px: 2.5, py: 2, borderBottom: "1px solid #F1F3F4" }}>
        <Typography sx={{ fontSize: "0.8125rem", fontWeight: 600, color: "#1F1F1F" }}>
          Draft Queue
        </Typography>
      </Box>

      <Box sx={{ flex: 1, overflowY: "auto" }}>
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress size={20} />
          </Box>
        ) : posts.length === 0 ? (
          <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1.5, py: 5, px: 2, textAlign: "center" }}>
            <InboxOutlined sx={{ fontSize: 36, color: "#DADCE0" }} />
            <Typography sx={{ fontSize: "0.8125rem", color: "#9AA0A6" }}>
              No drafts — click a day to create a post
            </Typography>
          </Box>
        ) : (
          <Box component="nav" sx={{ display: "flex", flexDirection: "column" }}>
            {posts.map((post) => {
              const preview = post.headline ?? post.textContent?.slice(0, 60) ?? "Untitled post";
              return (
                <Box
                  key={post.id}
                  component={Link}
                  href={`/posts/${post.id}`}
                  sx={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 0.75,
                    px: 2.5,
                    py: 1.75,
                    borderBottom: "1px solid #F1F3F4",
                    textDecoration: "none",
                    "&:hover": { bgcolor: "rgba(0,0,0,0.02)" },
                    "&:last-child": { borderBottom: "none" },
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <TypeBadge type={post.type} sx={{ fontSize: "0.625rem", height: 18 }} />
                    <Typography sx={{ fontSize: "0.6875rem", color: "#9AA0A6", ml: "auto" }}>
                      {post.dateSlot}
                    </Typography>
                  </Box>
                  <Typography sx={{ fontSize: "0.8125rem", color: "#3C4043", lineHeight: 1.4, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                    {preview}
                  </Typography>
                </Box>
              );
            })}
          </Box>
        )}
      </Box>
    </Box>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/features/sosmed/components/QueueSidebar.tsx
git commit -m "feat: add QueueSidebar draft queue panel"
```

---

## Task 10: Update FullCalendarView + Calendar Page

**Files:**
- Modify: `src/components/calendar/FullCalendarView.tsx`
- Modify: `src/app/(app)/calendar/page.tsx`

- [ ] **Step 1: Add `onDateClick` prop to FullCalendarView**

In `src/components/calendar/FullCalendarView.tsx`:

1. Add `DateClickArg` to the FullCalendar core import:
```ts
import type { EventClickArg, EventInput, DateClickArg } from "@fullcalendar/core";
```

2. Add `onDateClick` to the props interface (after `onDatesChange`):
```ts
onDateClick?: (dateStr: string) => void;
```

3. Add it to the destructured props:
```ts
{ initialDate, initialView = "timeGridWeek", postsByDate, onOpenPost, onDatesChange, onDateClick },
```

4. Add `dateClick` handler to the `<FullCalendar>` component (after `eventClick`):
```tsx
dateClick={(arg: DateClickArg) => onDateClick?.(arg.dateStr)}
```

- [ ] **Step 2: Update the calendar page**

Replace the full content of `src/app/(app)/calendar/page.tsx` with the version below. Key changes: add modal state + queue sidebar, wire `onDateClick`, update the "Open in Posts" popover link, expand the grid layout to 3 columns.

```tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import MuiButton from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Popover from "@mui/material/Popover";
import CircularProgress from "@mui/material/CircularProgress";
import ChevronLeftOutlined from "@mui/icons-material/ChevronLeftOutlined";
import ChevronRightOutlined from "@mui/icons-material/ChevronRightOutlined";
import CloseOutlined from "@mui/icons-material/CloseOutlined";
import OpenInNewOutlined from "@mui/icons-material/OpenInNewOutlined";
import { MuiCalendar } from "@/components/calendar/MuiCalendar";
import {
  FullCalendarView,
  type CalendarView,
  type FullCalendarViewHandle,
} from "@/components/calendar/FullCalendarView";
import { PostDetail } from "@/components/posts/PostDetail";
import { NewContentModal } from "@/features/sosmed/components/NewContentModal";
import { QueueSidebar } from "@/features/sosmed/components/QueueSidebar";
import { useGlobalLoading } from "@/features/content/components/loading-context";
import type { ContentPost, PostSummary } from "@/lib/types";

const LEGEND = [
  { label: "Engage", color: "#1A73E8" },
  { label: "Educate", color: "#188038" },
  { label: "Video", color: "#5F6368" },
];

const STATUS_LEGEND = [
  { label: "Published", color: "#34A853", ring: false },
  { label: "Scheduled", color: "#FBBC04", ring: false },
  { label: "Failed", color: "#EA4335", ring: false },
  { label: "Draft", color: "#DADCE0", ring: true },
];

export default function CalendarPage() {
  const today = new Date();
  const [selectedDate, setSelectedDate] = useState<Date>(today);
  const [view, setView] = useState<CalendarView>("dayGridMonth");
  const [posts, setPosts] = useState<Record<string, PostSummary[]>>({});
  const [headerTitle, setHeaderTitle] = useState<string>("");
  const [loading, setLoading] = useState(true);

  // Event detail popover
  const [detailAnchor, setDetailAnchor] = useState<HTMLElement | null>(null);
  const [detailPost, setDetailPost] = useState<ContentPost | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // New content modal
  const [modalOpen, setModalOpen] = useState(false);
  const [modalDateSlot, setModalDateSlot] = useState("");
  const [queueRefreshKey, setQueueRefreshKey] = useState(0);

  useGlobalLoading(loading);

  const calRef = useRef<FullCalendarViewHandle>(null);

  const fetchYear = selectedDate.getFullYear();
  const fetchMonth = selectedDate.getMonth() + 1;

  const loadPostsForRange = useCallback(async () => {
    setLoading(true);
    try {
      const [curr, prev, next] = await Promise.all([
        fetch(`/api/calendar?year=${fetchYear}&month=${fetchMonth}`).then((r) => r.json()),
        fetch(`/api/calendar?year=${fetchMonth === 1 ? fetchYear - 1 : fetchYear}&month=${fetchMonth === 1 ? 12 : fetchMonth - 1}`).then((r) => r.json()),
        fetch(`/api/calendar?year=${fetchMonth === 12 ? fetchYear + 1 : fetchYear}&month=${fetchMonth === 12 ? 1 : fetchMonth + 1}`).then((r) => r.json()),
      ]);
      setPosts({ ...(prev.days ?? {}), ...(curr.days ?? {}), ...(next.days ?? {}) });
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [fetchYear, fetchMonth]);

  useEffect(() => {
    loadPostsForRange();
  }, [loadPostsForRange]);

  const handlePrev = () => calRef.current?.prev();
  const handleNext = () => calRef.current?.next();
  const handleToday = () => {
    calRef.current?.today();
    setSelectedDate(new Date());
  };
  const handleViewChange = (v: CalendarView) => {
    setView(v);
    calRef.current?.changeView(v);
  };

  const openPost = (id: number, anchorEl: HTMLElement) => {
    setDetailAnchor(anchorEl);
    setDetailPost(null);
    setDetailLoading(true);
    fetch(`/api/posts/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setDetailPost(data?.post ?? null))
      .finally(() => setDetailLoading(false));
  };

  const closeDetail = () => {
    setDetailAnchor(null);
    setDetailPost(null);
  };

  const handleDateClick = (dateStr: string) => {
    const datePart = dateStr.slice(0, 10);
    setModalDateSlot(datePart);
    setModalOpen(true);
  };

  const handleModalClose = () => {
    setModalOpen(false);
    setQueueRefreshKey((k) => k + 1);
  };

  return (
    <Box sx={{ minHeight: "100%", bgcolor: "#F0F4F9", display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Fixed page header */}
      <Box sx={{ position: "fixed", top: 64, left: 280, right: 0, zIndex: 10, height: 60, bgcolor: "#F0F4F9", borderBottom: "1px solid #E8EAED", display: "flex", alignItems: "center" }}>
        <Box sx={{ mx: "auto", px: 3, width: "100%", display: "flex", alignItems: "center", gap: 2 }}>
          <Typography component="h1" sx={{ fontSize: "1.375rem", fontWeight: 400, color: "#1F1F1F", minWidth: 120 }}>
            Calendar
          </Typography>
          <MuiButton onClick={handleToday} variant="outlined" size="small" sx={{ borderRadius: "9999px", borderColor: "#DADCE0", color: "#1F1F1F", textTransform: "none", fontWeight: 500 }}>
            Today
          </MuiButton>
          <Box sx={{ display: "flex", alignItems: "center" }}>
            <IconButton onClick={handlePrev} size="small" sx={{ color: "#5F6368" }}><ChevronLeftOutlined /></IconButton>
            <IconButton onClick={handleNext} size="small" sx={{ color: "#5F6368" }}><ChevronRightOutlined /></IconButton>
          </Box>
          <Typography sx={{ fontSize: "1.25rem", fontWeight: 400, color: "#1F1F1F", flex: 1 }}>{headerTitle}</Typography>
          <ToggleButtonGroup value={view} exclusive onChange={(_, v) => v && handleViewChange(v)} size="small"
            sx={{ "& .MuiToggleButton-root": { textTransform: "none", fontWeight: 500, fontSize: "0.8125rem", px: 2, borderColor: "#DADCE0", color: "#5F6368", "&.Mui-selected": { bgcolor: "#E8F0FE", color: "#0B57D0", "&:hover": { bgcolor: "#D2E3FC" } } } }}>
            <ToggleButton value="timeGridDay">Day</ToggleButton>
            <ToggleButton value="timeGridWeek">Week</ToggleButton>
            <ToggleButton value="dayGridMonth">Month</ToggleButton>
          </ToggleButtonGroup>
        </Box>
      </Box>

      {/* Body — 3-column grid */}
      <Box sx={{ pt: "76px", px: 3, pb: 3, flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: { xs: "1fr", md: "280px 1fr 260px" }, gap: 3 }}>
        {/* Mini calendar + legend */}
        <Box sx={{ display: { xs: "none", md: "flex" }, flexDirection: "column", gap: 2 }}>
          <MuiCalendar
            year={selectedDate.getFullYear()}
            month={selectedDate.getMonth() + 1}
            selectedDate={selectedDate}
            posts={posts}
            size="compact"
            onChangeDate={(d) => { setSelectedDate(d); calRef.current?.gotoDate(d); }}
            onChangeMonth={(y, m) => { const d = new Date(y, m - 1, 1); setSelectedDate(d); calRef.current?.gotoDate(d); }}
          />
          <Box sx={{ bgcolor: "#fff", borderRadius: "12px", p: 2 }}>
            <Typography sx={{ fontSize: "0.6875rem", fontWeight: 600, letterSpacing: "0.5px", textTransform: "uppercase", color: "#5F6368", mb: 1.5 }}>
              Content types
            </Typography>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {LEGEND.map((item) => (
                <Box key={item.label} sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
                  <Box sx={{ width: 10, height: 10, borderRadius: "3px", bgcolor: item.color, flexShrink: 0 }} />
                  <Typography sx={{ fontSize: "0.8125rem", color: "#3C4043" }}>{item.label}</Typography>
                </Box>
              ))}
            </Box>
            <Box sx={{ height: "1px", bgcolor: "#E8EAED", my: 1.5 }} />
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {STATUS_LEGEND.map((item) => (
                <Box key={item.label} sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
                  <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: item.color, flexShrink: 0, boxShadow: item.ring ? `0 0 0 1px ${item.color}` : "none" }} />
                  <Typography sx={{ fontSize: "0.8125rem", color: "#3C4043" }}>{item.label}</Typography>
                </Box>
              ))}
            </Box>
          </Box>
        </Box>

        {/* FullCalendar main view */}
        <Box sx={{ minHeight: 0, height: "100%" }}>
          <FullCalendarView
            ref={calRef}
            initialDate={today}
            initialView={view}
            postsByDate={posts}
            onOpenPost={openPost}
            onDateClick={handleDateClick}
            onDatesChange={(anchor, title) => {
              setHeaderTitle(title);
              setSelectedDate((prev) =>
                prev.getFullYear() === anchor.getFullYear() && prev.getMonth() === anchor.getMonth()
                  ? prev : anchor,
              );
            }}
          />
        </Box>

        {/* Draft Queue sidebar */}
        <Box sx={{ display: { xs: "none", md: "block" }, minHeight: 0 }}>
          <QueueSidebar refreshKey={queueRefreshKey} />
        </Box>
      </Box>

      {/* Event detail popover */}
      <Popover
        open={Boolean(detailAnchor)}
        anchorEl={detailAnchor}
        onClose={closeDetail}
        anchorOrigin={{ vertical: "center", horizontal: "right" }}
        transformOrigin={{ vertical: "center", horizontal: "left" }}
        slotProps={{ paper: { sx: { width: 380, maxWidth: "calc(100vw - 32px)", maxHeight: "72vh", borderRadius: "16px", overflow: "hidden", boxShadow: "0 8px 28px rgba(0,0,0,0.18)", display: "flex", flexDirection: "column" } } }}
      >
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 0.5, px: 1, py: 0.5, flexShrink: 0 }}>
          {detailPost && (
            <IconButton component={Link} href={`/posts/${detailPost.id}`} size="small" aria-label="Open post" sx={{ color: "#5F6368" }}>
              <OpenInNewOutlined sx={{ fontSize: 18 }} />
            </IconButton>
          )}
          <IconButton onClick={closeDetail} size="small" sx={{ color: "#5F6368" }}>
            <CloseOutlined sx={{ fontSize: 20 }} />
          </IconButton>
        </Box>
        <Box sx={{ overflowY: "auto", flex: 1 }}>
          {detailLoading ? (
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", py: 6 }}>
              <CircularProgress size={22} />
            </Box>
          ) : detailPost ? (
            <PostDetail post={detailPost} />
          ) : (
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", py: 6 }}>
              <Typography variant="body2" color="text.secondary">Post not found.</Typography>
            </Box>
          )}
        </Box>
      </Popover>

      {/* New content modal */}
      <NewContentModal open={modalOpen} dateSlot={modalDateSlot} onClose={handleModalClose} />
    </Box>
  );
}
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/calendar/FullCalendarView.tsx src/app/\(app\)/calendar/page.tsx
git commit -m "feat: add date-click modal and draft queue sidebar to calendar"
```

---

## Task 11: EngageGenerator

**Files:**
- Create: `src/features/sosmed/components/EngageGenerator.tsx`

- [ ] **Step 1: Write the component**

Create `src/features/sosmed/components/EngageGenerator.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import CircularProgress from "@mui/material/CircularProgress";
import CheckCircleOutlined from "@mui/icons-material/CheckCircleOutlined";
import { useCommandPoller } from "@/features/sosmed/hooks/useCommandPoller";
import type { ContentPost } from "@/lib/types";

interface Props {
  post: ContentPost;
  onPostUpdate: (post: ContentPost) => void;
  onAccept: () => void;
}

const THREADS_LIMIT = 490;
const X_LIMIT = 275;

export function EngageGenerator({ post, onPostUpdate, onAccept }: Props) {
  const [commandId, setCommandId] = useState<number | null>(null);
  const [feedback, setFeedback] = useState(post.userFeedback ?? "");
  const [accepting, setAccepting] = useState(false);
  const hasFiredRef = useRef(false);

  const { status: cmdStatus, error: cmdError, isPolling } = useCommandPoller(commandId);

  async function fireGenerate() {
    const res = await fetch("/api/sosmed/command", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        command: "generate",
        platform: "engage",
        context: feedback ? { user_feedback: feedback } : {},
      }),
    });
    const json = await res.json();
    setCommandId(json.command_id);
  }

  // Auto-generate on mount if no content yet
  useEffect(() => {
    if (!post.textContent && !hasFiredRef.current) {
      hasFiredRef.current = true;
      fireGenerate();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-fetch post when command completes
  useEffect(() => {
    if (cmdStatus === "completed") {
      setCommandId(null);
      fetch(`/api/posts/${post.id}`)
        .then((r) => r.json())
        .then((data) => { if (data.post) onPostUpdate(data.post); });
    }
  }, [cmdStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleAccept() {
    setAccepting(true);
    try {
      const res = await fetch(`/api/posts/${post.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "accepted" }),
      });
      const data = await res.json();
      if (data.post) onAccept();
    } finally {
      setAccepting(false);
    }
  }

  const charCount = post.textContent?.length ?? 0;
  const overThreads = charCount > THREADS_LIMIT;
  const overX = charCount > X_LIMIT;
  const cleanText = post.textContent?.replace(/```[\s\S]*?```/g, "").trim() ?? null;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
      {/* Spinner while generating */}
      {isPolling && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, py: 2 }}>
          <CircularProgress size={18} />
          <Typography sx={{ fontSize: "0.875rem", color: "#5F6368" }}>Generating post…</Typography>
        </Box>
      )}

      {/* Error */}
      {cmdError && <Typography sx={{ fontSize: "0.875rem", color: "#D93025" }}>{cmdError}</Typography>}

      {/* Text preview */}
      {cleanText && !isPolling && (
        <Box>
          <Typography sx={{ fontSize: "0.8125rem", color: "#5F6368", mb: 0.75 }}>Preview</Typography>
          <Box sx={{ p: 2, bgcolor: "#F8F9FA", borderRadius: "10px", border: "1px solid #E8EAED" }}>
            <Typography sx={{ fontSize: "0.9375rem", lineHeight: 1.7, whiteSpace: "pre-wrap", color: "#1F1F1F" }}>
              {cleanText}
            </Typography>
          </Box>
          <Typography sx={{ mt: 0.75, fontSize: "0.75rem", color: overX ? "#D93025" : overThreads ? "#E37400" : "#5F6368" }}>
            {charCount} chars · Threads ≤{THREADS_LIMIT} · X ≤{X_LIMIT}
          </Typography>
        </Box>
      )}

      {/* Feedback + Regenerate */}
      {(cleanText || cmdStatus === "failed") && !isPolling && (
        <Box sx={{ display: "flex", gap: 1 }}>
          <TextField
            size="small"
            placeholder="Feedback (optional)"
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            sx={{ flex: 1 }}
            slotProps={{ input: { sx: { fontSize: "0.875rem" } } }}
          />
          <Button
            variant="outlined"
            size="small"
            disabled={isPolling}
            onClick={() => {
              setCommandId(null);
              setTimeout(() => fireGenerate(), 0);
            }}
            sx={{ textTransform: "none", whiteSpace: "nowrap" }}
          >
            Regenerate
          </Button>
        </Box>
      )}

      {/* Approve button */}
      {cleanText && !isPolling && (
        <Button
          variant="contained"
          startIcon={accepting ? <CircularProgress size={14} color="inherit" /> : <CheckCircleOutlined />}
          disabled={accepting}
          onClick={handleAccept}
          sx={{ textTransform: "none", borderRadius: "9999px", alignSelf: "flex-start" }}
        >
          Approve &amp; Accept
        </Button>
      )}
    </Box>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/features/sosmed/components/EngageGenerator.tsx
git commit -m "feat: add EngageGenerator component"
```

---

## Task 12: EducateGenerator

**Files:**
- Create: `src/features/sosmed/components/EducateGenerator.tsx`

- [ ] **Step 1: Write the component**

Create `src/features/sosmed/components/EducateGenerator.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import LinearProgress from "@mui/material/LinearProgress";
import CircularProgress from "@mui/material/CircularProgress";
import CheckCircleOutlined from "@mui/icons-material/CheckCircleOutlined";
import { useCommandPoller } from "@/features/sosmed/hooks/useCommandPoller";
import { mediaUrl } from "@/components/posts/PostDetail";
import type { ContentPost } from "@/lib/types";

const STEPS = ["Warming up", "Drafting tip", "Writing code example", "Rendering code card", "Finishing up"];

interface Props {
  post: ContentPost;
  onPostUpdate: (post: ContentPost) => void;
  onAccept: () => void;
}

export function EducateGenerator({ post, onPostUpdate, onAccept }: Props) {
  const sourceLocked = !!(post.source as { source?: string } | null)?.source;
  const [source, setSource] = useState<"claude" | "github">("claude");
  const [commandId, setCommandId] = useState<number | null>(null);
  const [feedback, setFeedback] = useState(post.userFeedback ?? "");
  const [stepIndex, setStepIndex] = useState(0);
  const [accepting, setAccepting] = useState(false);
  const stepTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { status: cmdStatus, error: cmdError, isPolling } = useCommandPoller(commandId);

  async function fireGenerate(src: "claude" | "github") {
    const res = await fetch("/api/sosmed/command", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        command: "generate",
        platform: "educate",
        context: { source: src, ...(feedback ? { user_feedback: feedback } : {}) },
      }),
    });
    const json = await res.json();
    setCommandId(json.command_id);
    setStepIndex(0);
    // Advance step label every 5s for UX
    stepTimerRef.current = setInterval(() => {
      setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
    }, 5000);
  }

  useEffect(() => {
    if (cmdStatus === "completed" || cmdStatus === "failed") {
      if (stepTimerRef.current) clearInterval(stepTimerRef.current);
      if (cmdStatus === "completed") {
        setCommandId(null);
        fetch(`/api/posts/${post.id}`)
          .then((r) => r.json())
          .then((data) => { if (data.post) onPostUpdate(data.post); });
      }
    }
  }, [cmdStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => { if (stepTimerRef.current) clearInterval(stepTimerRef.current); }, []);

  async function handleAccept() {
    setAccepting(true);
    try {
      const res = await fetch(`/api/posts/${post.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "accepted" }),
      });
      const data = await res.json();
      if (data.post) onAccept();
    } finally {
      setAccepting(false);
    }
  }

  const lockedSource = (post.source as { source?: string } | null)?.source as "claude" | "github" | undefined;
  const effectiveSource = lockedSource ?? source;
  const cleanText = post.textContent?.replace(/```[\s\S]*?```/g, "").replace(/\n{3,}/g, "\n\n").trim() ?? null;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
      {/* Source picker — hidden after first generate */}
      {!sourceLocked && !isPolling && !cleanText && (
        <Box>
          <Typography sx={{ fontSize: "0.8125rem", color: "#5F6368", mb: 1 }}>Source</Typography>
          <Box sx={{ display: "flex", gap: 1.5 }}>
            {(["claude", "github"] as const).map((s) => (
              <Box
                key={s}
                onClick={() => setSource(s)}
                sx={{
                  flex: 1,
                  p: 2,
                  borderRadius: "12px",
                  border: "2px solid",
                  borderColor: source === s ? "#1A73E8" : "#E8EAED",
                  bgcolor: source === s ? "rgba(26,115,232,0.05)" : "#fff",
                  cursor: "pointer",
                  textAlign: "center",
                  transition: "all 140ms",
                  "&:hover": { borderColor: "#1A73E8" },
                }}
              >
                <Typography sx={{ fontWeight: 600, fontSize: "0.875rem", color: "#1F1F1F" }}>
                  {s === "claude" ? "Claude" : "GitHub Trending"}
                </Typography>
                <Typography sx={{ fontSize: "0.75rem", color: "#5F6368", mt: 0.25 }}>
                  {s === "claude" ? "Fresh AI tip" : "Trending repos"}
                </Typography>
              </Box>
            ))}
          </Box>
          <Button
            variant="outlined"
            onClick={() => fireGenerate(effectiveSource)}
            sx={{ mt: 1.5, textTransform: "none", borderRadius: "9999px" }}
          >
            Generate tip
          </Button>
        </Box>
      )}

      {/* Progress bar while generating */}
      {isPolling && (
        <Box>
          <Typography sx={{ fontSize: "0.875rem", color: "#5F6368", mb: 1 }}>
            {STEPS[stepIndex]}…
          </Typography>
          <LinearProgress variant="determinate" value={((stepIndex + 1) / STEPS.length) * 100} sx={{ borderRadius: 4, height: 6 }} />
        </Box>
      )}

      {cmdError && <Typography sx={{ fontSize: "0.875rem", color: "#D93025" }}>{cmdError}</Typography>}

      {/* Text preview */}
      {cleanText && !isPolling && (
        <Box>
          <Typography sx={{ fontSize: "0.8125rem", color: "#5F6368", mb: 0.75 }}>Tip</Typography>
          <Box sx={{ p: 2, bgcolor: "#F8F9FA", borderRadius: "10px", border: "1px solid #E8EAED" }}>
            <Typography sx={{ fontSize: "0.9375rem", lineHeight: 1.7, whiteSpace: "pre-wrap", color: "#1F1F1F" }}>
              {cleanText}
            </Typography>
          </Box>
          {lockedSource && (
            <Typography sx={{ mt: 0.5, fontSize: "0.75rem", color: "#9AA0A6" }}>
              Source: {lockedSource === "claude" ? "Claude" : "GitHub Trending"} (locked)
            </Typography>
          )}
        </Box>
      )}

      {/* Code card image */}
      {post.imagePath && !isPolling && (
        <Box>
          <Typography sx={{ fontSize: "0.8125rem", color: "#5F6368", mb: 0.75 }}>Code card</Typography>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={mediaUrl(post.imagePath)} alt="Code card" style={{ maxWidth: "100%", borderRadius: 8, border: "1px solid #E8EAED" }} />
        </Box>
      )}

      {/* Feedback + Regenerate */}
      {(cleanText || cmdStatus === "failed") && !isPolling && (
        <Box sx={{ display: "flex", gap: 1 }}>
          <TextField
            size="small"
            placeholder="Feedback (optional)"
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            sx={{ flex: 1 }}
            slotProps={{ input: { sx: { fontSize: "0.875rem" } } }}
          />
          <Button
            variant="outlined"
            size="small"
            disabled={isPolling}
            onClick={() => { setCommandId(null); setTimeout(() => fireGenerate(effectiveSource), 0); }}
            sx={{ textTransform: "none", whiteSpace: "nowrap" }}
          >
            Regenerate
          </Button>
        </Box>
      )}

      {/* Approve button */}
      {cleanText && !isPolling && (
        <Button
          variant="contained"
          startIcon={accepting ? <CircularProgress size={14} color="inherit" /> : <CheckCircleOutlined />}
          disabled={accepting}
          onClick={handleAccept}
          sx={{ textTransform: "none", borderRadius: "9999px", alignSelf: "flex-start" }}
        >
          Approve &amp; Accept
        </Button>
      )}
    </Box>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/features/sosmed/components/EducateGenerator.tsx
git commit -m "feat: add EducateGenerator component"
```

---

## Task 13: PublishSection

**Files:**
- Create: `src/features/sosmed/components/PublishSection.tsx`

- [ ] **Step 1: Write the component**

Create `src/features/sosmed/components/PublishSection.tsx`:

```tsx
"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { TimePicker } from "@mui/x-date-pickers/TimePicker";
import CheckCircleOutlined from "@mui/icons-material/CheckCircleOutlined";
import { useCommandPoller } from "@/features/sosmed/hooks/useCommandPoller";
import type { ContentPost } from "@/lib/types";

interface Props {
  post: ContentPost;
  onPostUpdate: (post: ContentPost) => void;
}

function formatDateTime(value: string): string {
  const d = new Date(value);
  return isNaN(d.getTime()) ? value : d.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

export function PublishSection({ post, onPostUpdate }: Props) {
  const [publishCommandId, setPublishCommandId] = useState<number | null>(null);
  const [scheduledTime, setScheduledTime] = useState<Date | null>(
    post.scheduledAt ? new Date(post.scheduledAt) : null,
  );
  const [savingTime, setSavingTime] = useState(false);

  const { status: cmdStatus, error: cmdError, isPolling } = useCommandPoller(publishCommandId);

  if (cmdStatus === "completed") {
    setPublishCommandId(null);
    fetch(`/api/posts/${post.id}`)
      .then((r) => r.json())
      .then((data) => { if (data.post) onPostUpdate(data.post); });
  }

  async function handleTimeChange(date: Date | null) {
    setScheduledTime(date);
    if (!date) return;
    setSavingTime(true);
    try {
      const base = new Date(`${post.dateSlot}T00:00:00`);
      base.setHours(date.getHours(), date.getMinutes(), 0, 0);
      await fetch(`/api/posts/${post.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduledAt: base.toISOString(), status: "scheduled" }),
      });
    } finally {
      setSavingTime(false);
    }
  }

  async function handlePublishNow() {
    const res = await fetch("/api/sosmed/command", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command: "publish", platform: post.type, context: { postId: post.id } }),
    });
    const json = await res.json();
    setPublishCommandId(json.command_id);
  }

  if (post.status === "published") {
    return (
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
        <Typography sx={{ color: "#188038", fontWeight: 500, fontSize: "0.9375rem", display: "flex", alignItems: "center", gap: 0.75 }}>
          <CheckCircleOutlined sx={{ fontSize: 18 }} />
          Published {post.publishedAt ? `· ${formatDateTime(post.publishedAt)}` : ""}
        </Typography>
        {post.publishResults?.map((r) => (
          <Box key={r.platform} sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Typography variant="caption" color="text.secondary" sx={{ width: 80 }}>{r.platform}</Typography>
            <Typography variant="caption" sx={{ fontWeight: 500, color: r.status === "ok" ? "#188038" : r.status === "skipped" ? "#5F6368" : "#D93025" }}>
              {r.status}
            </Typography>
            {r.error && <Typography variant="caption" sx={{ color: "#D93025" }} noWrap>{r.error}</Typography>}
          </Box>
        ))}
      </Box>
    );
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {post.status === "scheduled" && post.scheduledAt && (
          <Typography sx={{ fontSize: "0.875rem", color: "#1A73E8", fontWeight: 500 }}>
            Scheduled · {formatDateTime(post.scheduledAt)}
          </Typography>
        )}
        <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
          <TimePicker
            label="Schedule time"
            value={scheduledTime}
            onChange={handleTimeChange}
            slotProps={{ textField: { size: "small", sx: { width: 160 } } }}
          />
          {savingTime && <CircularProgress size={16} />}
        </Box>
        {cmdError && <Typography sx={{ fontSize: "0.8125rem", color: "#D93025" }}>{cmdError}</Typography>}
        <Button
          variant="contained"
          disabled={isPolling}
          onClick={handlePublishNow}
          startIcon={isPolling ? <CircularProgress size={14} color="inherit" /> : null}
          sx={{ textTransform: "none", borderRadius: "9999px", alignSelf: "flex-start" }}
        >
          {isPolling ? "Publishing…" : "Publish Now"}
        </Button>
      </Box>
    </LocalizationProvider>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/features/sosmed/components/PublishSection.tsx
git commit -m "feat: add PublishSection with time picker and publish now"
```

---

## Task 14: PostDetailShell

**Files:**
- Create: `src/features/sosmed/components/PostDetailShell.tsx`

- [ ] **Step 1: Write the client shell**

Create `src/features/sosmed/components/PostDetailShell.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import DeleteOutlined from "@mui/icons-material/DeleteOutlined";
import ArrowBackOutlined from "@mui/icons-material/ArrowBackOutlined";
import OpenInNewOutlined from "@mui/icons-material/OpenInNewOutlined";
import { TypeBadge, StatusBadge } from "@/components/ui/Badge";
import { PostDetail } from "@/components/posts/PostDetail";
import { EngageGenerator } from "./EngageGenerator";
import { EducateGenerator } from "./EducateGenerator";
import { PublishSection } from "./PublishSection";
import type { ContentPost } from "@/lib/types";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box>
      <Typography sx={{ fontSize: "0.6875rem", fontWeight: 600, letterSpacing: "0.5px", textTransform: "uppercase", color: "#5F6368", mb: 1.5 }}>
        {title}
      </Typography>
      {children}
    </Box>
  );
}

export function PostDetailShell({ initialPost }: { initialPost: ContentPost }) {
  const router = useRouter();
  const [post, setPost] = useState<ContentPost>(initialPost);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm("Delete this post? This cannot be undone.")) return;
    setDeleting(true);
    try {
      await fetch(`/api/posts/${post.id}`, { method: "DELETE" });
      router.push("/calendar");
    } finally {
      setDeleting(false);
    }
  }

  const isDraft = post.status === "draft";
  const canPublish = post.status === "accepted" || post.status === "scheduled" || post.status === "published";

  const captions = post.captions;
  const hasCaptions = captions && (captions.threads || captions.x || captions.instagram);

  return (
    <Box sx={{ maxWidth: 760, mx: "auto", px: 3, pt: "76px", pb: 6 }}>
      {/* Back link */}
      <Box sx={{ mb: 2 }}>
        <Button component={Link} href="/calendar" startIcon={<ArrowBackOutlined />} size="small" sx={{ textTransform: "none", color: "#5F6368" }}>
          Calendar
        </Button>
      </Box>

      {/* Header card */}
      <Box sx={{ bgcolor: "#fff", borderRadius: "16px", p: 3, mb: 2, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 2 }}>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
            <TypeBadge type={post.type} />
            <StatusBadge status={post.status} />
            <Typography variant="caption" color="text.secondary">#{post.id}</Typography>
          </Box>
          <Typography sx={{ fontSize: "1.25rem", fontWeight: 500, color: "#1F1F1F" }}>
            {post.headline ?? (post.type === "engage" ? "Engage Post" : post.type === "educate" ? "Educate Post" : "Video Post")}
          </Typography>
          <Typography variant="caption" color="text.secondary">{post.dateSlot}</Typography>
        </Box>
        <IconButton onClick={handleDelete} disabled={deleting} size="small" aria-label="Delete post" sx={{ color: "#D93025", flexShrink: 0 }}>
          <DeleteOutlined />
        </IconButton>
      </Box>

      {/* Generation section — only when draft */}
      {isDraft && (
        <Box sx={{ bgcolor: "#fff", borderRadius: "16px", p: 3, mb: 2 }}>
          <Section title="Generation">
            {post.type === "engage" && (
              <EngageGenerator
                post={post}
                onPostUpdate={setPost}
                onAccept={() => setPost((p) => ({ ...p, status: "accepted" }))}
              />
            )}
            {post.type === "educate" && (
              <EducateGenerator
                post={post}
                onPostUpdate={setPost}
                onAccept={() => setPost((p) => ({ ...p, status: "accepted" }))}
              />
            )}
            {post.type === "video" && (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                <Typography sx={{ fontSize: "0.875rem", color: "#5F6368" }}>
                  The video pipeline runs as a multi-step process.
                </Typography>
                <Button
                  component={Link}
                  href={`/posts/${post.id}/video`}
                  variant="outlined"
                  endIcon={<OpenInNewOutlined sx={{ fontSize: 16 }} />}
                  sx={{ textTransform: "none", borderRadius: "9999px", alignSelf: "flex-start" }}
                >
                  Go to Video Generator
                </Button>
              </Box>
            )}
          </Section>
        </Box>
      )}

      {/* Read-only content preview — when not draft */}
      {!isDraft && (
        <Box sx={{ bgcolor: "#fff", borderRadius: "16px", overflow: "hidden", mb: 2 }}>
          <PostDetail post={post} />
        </Box>
      )}

      {/* Captions — if present */}
      {hasCaptions && (
        <Box sx={{ bgcolor: "#fff", borderRadius: "16px", p: 3, mb: 2 }}>
          <Section title="Captions">
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {(["threads", "x", "instagram"] as const).map((platform) => {
                const text = captions[platform];
                if (!text) return null;
                return (
                  <Box key={platform}>
                    <Typography variant="caption" sx={{ display: "block", textTransform: "uppercase", letterSpacing: "0.5px", color: "#5F6368", mb: 0.25 }}>
                      {platform}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                      {text}
                    </Typography>
                  </Box>
                );
              })}
            </Box>
          </Section>
        </Box>
      )}

      {/* Publish section */}
      {canPublish && (
        <>
          <Divider sx={{ my: 2 }} />
          <Box sx={{ bgcolor: "#fff", borderRadius: "16px", p: 3 }}>
            <Section title="Publish">
              <PublishSection post={post} onPostUpdate={setPost} />
            </Section>
          </Box>
        </>
      )}
    </Box>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/features/sosmed/components/PostDetailShell.tsx
git commit -m "feat: add PostDetailShell client component"
```

---

## Task 15: Post Detail Page

**Files:**
- Create: `src/app/(app)/posts/[id]/page.tsx`

- [ ] **Step 1: Create the server component**

Create `src/app/(app)/posts/[id]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPost } from "@/lib/posts";
import { PostDetailShell } from "@/features/sosmed/components/PostDetailShell";

type Props = { params: Promise<{ id: string }> };

export default async function PostDetailPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const post = await getPost(supabase, Number(id));
  if (!post) notFound();
  return <PostDetailShell initialPost={post} />;
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(app)/posts/[id]/page.tsx"
git commit -m "feat: add /posts/[id] server route"
```

---

## Task 16: SuggestList

**Files:**
- Create: `src/features/sosmed/components/SuggestList.tsx`

- [ ] **Step 1: Write the component**

Create `src/features/sosmed/components/SuggestList.tsx`:

```tsx
"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import type { VideoSuggestItem } from "@/lib/sosmed/types";

interface Props {
  items: VideoSuggestItem[];
  selectedVideoId: string | null;
  onSelect: (videoId: string) => void;
}

export function SuggestList({ items, selectedVideoId, onSelect }: Props) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
      {items.map((item) => {
        const isSelected = item.videoId === selectedVideoId;
        return (
          <Box
            key={item.videoId}
            onClick={() => onSelect(item.videoId)}
            sx={{
              display: "flex",
              gap: 2,
              p: 2,
              borderRadius: "12px",
              border: "2px solid",
              borderColor: isSelected ? "#0B57D0" : "#E8EAED",
              bgcolor: isSelected ? "rgba(11,87,208,0.04)" : "#fff",
              cursor: "pointer",
              transition: "all 140ms",
              "&:hover": { borderColor: "#0B57D0" },
            }}
          >
            {/* Thumbnail */}
            {item.thumbnailUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.thumbnailUrl}
                alt={item.title}
                style={{ width: 120, height: 68, objectFit: "cover", borderRadius: 8, flexShrink: 0 }}
              />
            )}
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontSize: "0.9375rem", fontWeight: 500, color: "#1F1F1F", mb: 0.5, lineHeight: 1.4, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                {item.title}
              </Typography>
              <Typography sx={{ fontSize: "0.8125rem", color: "#5F6368", mb: 0.75 }}>{item.channelTitle}</Typography>
              <Chip label={item.duration} size="small" sx={{ fontSize: "0.6875rem", height: 20 }} />
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/features/sosmed/components/SuggestList.tsx
git commit -m "feat: add SuggestList video suggestion cards"
```

---

## Task 17: VideoStepper

**Files:**
- Create: `src/features/sosmed/components/VideoStepper.tsx`

- [ ] **Step 1: Write the component**

Create `src/features/sosmed/components/VideoStepper.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Stepper from "@mui/material/Stepper";
import Step from "@mui/material/Step";
import StepLabel from "@mui/material/StepLabel";
import CircularProgress from "@mui/material/CircularProgress";
import LinearProgress from "@mui/material/LinearProgress";
import ArrowBackOutlined from "@mui/icons-material/ArrowBackOutlined";
import RefreshOutlined from "@mui/icons-material/RefreshOutlined";
import { useCommandPoller } from "@/features/sosmed/hooks/useCommandPoller";
import { PublishSection } from "./PublishSection";
import { SuggestList } from "./SuggestList";
import type { ContentPost } from "@/lib/types";
import type { VideoSuggestItem } from "@/lib/sosmed/types";

const STEP_LABELS = ["Suggest", "Draft", "Approve", "Publish"];

function deriveStep(post: ContentPost, hasSuggestList: boolean): number {
  if (post.status === "published") return 4;
  if (post.status === "accepted") return 3;
  if (post.textContent) return 2;
  if (hasSuggestList) return 1;
  return 0;
}

export function VideoStepper({ initialPost }: { initialPost: ContentPost }) {
  const [post, setPost] = useState<ContentPost>(initialPost);
  const [commandId, setCommandId] = useState<number | null>(null);
  const [suggestItems, setSuggestItems] = useState<VideoSuggestItem[]>([]);
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
  const [logLines, setLogLines] = useState<string[]>([]);
  const logRef = useRef<HTMLDivElement>(null);

  const hasSuggestList = suggestItems.length > 0;
  const activeStep = deriveStep(post, hasSuggestList);

  const { status: cmdStatus, error: cmdError, logText, isPolling } = useCommandPoller(commandId);

  // Append new log lines
  useEffect(() => {
    if (logText) {
      const lines = logText.split("\n").filter(Boolean);
      setLogLines(lines);
      setTimeout(() => {
        if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
      }, 50);
    }
  }, [logText]);

  // Handle command completion
  useEffect(() => {
    if (cmdStatus === "completed") {
      setCommandId(null);
      // Re-fetch post
      fetch(`/api/posts/${post.id}`)
        .then((r) => r.json())
        .then((data) => { if (data.post) setPost(data.post); });
      // If suggest step just completed, fetch suggest list
      if (activeStep === 0) {
        fetch("/api/sosmed/video-state")
          .then((r) => r.json())
          .then((data) => setSuggestItems(data.items ?? []));
      }
    }
  }, [cmdStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  async function fireCommand(command: "suggest" | "draft" | "approve" | "reset", context?: Record<string, unknown>) {
    setLogLines([]);
    const res = await fetch("/api/sosmed/command", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command, platform: "video", context: context ?? {} }),
    });
    const json = await res.json();
    setCommandId(json.command_id);
  }

  async function handleReset() {
    await fireCommand("reset");
    setSuggestItems([]);
    setSelectedVideoId(null);
    setLogLines([]);
    setPost((p) => ({ ...p, status: "draft", textContent: null }));
  }

  return (
    <Box sx={{ maxWidth: 760, mx: "auto", px: 3, pt: "76px", pb: 6 }}>
      <Box sx={{ mb: 2 }}>
        <Button component={Link} href={`/posts/${post.id}`} startIcon={<ArrowBackOutlined />} size="small" sx={{ textTransform: "none", color: "#5F6368" }}>
          Back to post
        </Button>
      </Box>

      {/* Step indicator */}
      <Box sx={{ bgcolor: "#fff", borderRadius: "16px", p: 3, mb: 3 }}>
        <Stepper activeStep={Math.min(activeStep, STEP_LABELS.length - 1)} alternativeLabel>
          {STEP_LABELS.map((label) => (
            <Step key={label}><StepLabel>{label}</StepLabel></Step>
          ))}
        </Stepper>
      </Box>

      {/* Error recovery button — always visible when failed */}
      {post.status === "failed" && (
        <Box sx={{ mb: 2 }}>
          <Button variant="outlined" color="error" startIcon={<RefreshOutlined />} onClick={handleReset} sx={{ textTransform: "none" }}>
            Recover from state
          </Button>
        </Box>
      )}

      {cmdError && (
        <Typography sx={{ mb: 2, fontSize: "0.875rem", color: "#D93025" }}>{cmdError}</Typography>
      )}

      {/* Step 0 — Suggest */}
      {activeStep === 0 && (
        <Box sx={{ bgcolor: "#fff", borderRadius: "16px", p: 3 }}>
          <Typography sx={{ fontWeight: 500, fontSize: "1rem", mb: 2 }}>Find video ideas</Typography>
          {!isPolling && suggestItems.length === 0 && (
            <Button
              variant="contained"
              onClick={() => fireCommand("suggest")}
              sx={{ textTransform: "none", borderRadius: "9999px" }}
            >
              Find Video Ideas
            </Button>
          )}
          {isPolling && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, py: 1 }}>
              <CircularProgress size={18} />
              <Typography sx={{ fontSize: "0.875rem", color: "#5F6368" }}>Searching YouTube for video ideas…</Typography>
            </Box>
          )}
          {suggestItems.length > 0 && (
            <>
              <SuggestList items={suggestItems} selectedVideoId={selectedVideoId} onSelect={setSelectedVideoId} />
              <Button
                variant="contained"
                disabled={!selectedVideoId}
                onClick={() => fireCommand("draft", { videoId: selectedVideoId! })}
                sx={{ mt: 2, textTransform: "none", borderRadius: "9999px" }}
              >
                Continue with this video →
              </Button>
            </>
          )}
        </Box>
      )}

      {/* Step 1 — Draft (drafting in progress or completed) */}
      {activeStep === 1 && (
        <Box sx={{ bgcolor: "#fff", borderRadius: "16px", p: 3 }}>
          <Typography sx={{ fontWeight: 500, fontSize: "1rem", mb: 2 }}>Drafting video content</Typography>
          {isPolling && (
            <Box>
              <LinearProgress sx={{ mb: 1.5, borderRadius: 4, height: 6 }} />
              <Box
                ref={logRef}
                sx={{ height: 200, overflowY: "auto", bgcolor: "#0D1117", borderRadius: "10px", p: 2, fontFamily: "monospace", fontSize: "0.75rem", color: "#E6EDF3" }}
              >
                {logLines.map((line, i) => (
                  <div key={i}>{line}</div>
                ))}
                {logLines.length === 0 && <span style={{ color: "#8B949E" }}>Waiting for output…</span>}
              </Box>
            </Box>
          )}
          {!isPolling && !post.textContent && (
            <Typography sx={{ fontSize: "0.875rem", color: "#5F6368" }}>Drafting complete. Refreshing…</Typography>
          )}
        </Box>
      )}

      {/* Step 2 — Approve */}
      {activeStep === 2 && (
        <Box sx={{ bgcolor: "#fff", borderRadius: "16px", p: 3 }}>
          <Typography sx={{ fontWeight: 500, fontSize: "1rem", mb: 2 }}>Review &amp; Approve</Typography>
          {post.headline && (
            <Box sx={{ mb: 2 }}>
              <Typography sx={{ fontSize: "0.8125rem", color: "#5F6368", mb: 0.5 }}>Headline</Typography>
              <Typography sx={{ fontWeight: 500 }}>{post.headline}</Typography>
            </Box>
          )}
          {post.textContent && (
            <Box sx={{ mb: 2 }}>
              <Typography sx={{ fontSize: "0.8125rem", color: "#5F6368", mb: 0.5 }}>Content</Typography>
              <Typography sx={{ fontSize: "0.9375rem", lineHeight: 1.7, whiteSpace: "pre-wrap", color: "#1F1F1F" }}>
                {post.textContent.replace(/```[\s\S]*?```/g, "").trim()}
              </Typography>
            </Box>
          )}
          <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", mt: 2 }}>
            <Button
              variant="contained"
              disabled={isPolling}
              startIcon={isPolling ? <CircularProgress size={14} color="inherit" /> : null}
              onClick={() => fireCommand("approve")}
              sx={{ textTransform: "none", borderRadius: "9999px" }}
            >
              Approve
            </Button>
            <Button
              variant="outlined"
              color="error"
              disabled={isPolling}
              startIcon={<RefreshOutlined />}
              onClick={handleReset}
              sx={{ textTransform: "none", borderRadius: "9999px" }}
            >
              Reset
            </Button>
          </Box>
        </Box>
      )}

      {/* Step 3 — Publish */}
      {(activeStep === 3 || activeStep === 4) && (
        <Box sx={{ bgcolor: "#fff", borderRadius: "16px", p: 3 }}>
          <Typography sx={{ fontWeight: 500, fontSize: "1rem", mb: 2 }}>Publish</Typography>
          <PublishSection post={post} onPostUpdate={setPost} />
        </Box>
      )}
    </Box>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/features/sosmed/components/VideoStepper.tsx
git commit -m "feat: add VideoStepper full pipeline component"
```

---

## Task 18: Video Pipeline Page

**Files:**
- Create: `src/app/(app)/posts/[id]/video/page.tsx`

- [ ] **Step 1: Create the video pipeline page**

Create `src/app/(app)/posts/[id]/video/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPost } from "@/lib/posts";
import { VideoStepper } from "@/features/sosmed/components/VideoStepper";

type Props = { params: Promise<{ id: string }> };

export default async function VideoPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const post = await getPost(supabase, Number(id));
  if (!post) notFound();
  if (post.type !== "video") notFound();
  return <VideoStepper initialPost={post} />;
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Final build check**

```bash
npm run build
```

Expected: build succeeds with no type errors. Warnings about `img` tags are acceptable.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/posts/[id]/video/page.tsx"
git commit -m "feat: add /posts/[id]/video pipeline page"
```

---

## Self-Review Checklist

### Spec coverage
- [x] Migration widens bot_commands — Task 1
- [x] comment-bot getRecentCommands filter — Task 1
- [x] sosmed types — Task 2
- [x] sosmed queries (getCommand, getVideoAgentState) — Task 3
- [x] sosmed post write ops — Task 4
- [x] POST /api/posts — Task 5
- [x] PATCH + DELETE /api/posts/[id] — Task 5
- [x] POST /api/sosmed/command — Task 6
- [x] GET /api/sosmed/command/[id] — Task 6
- [x] GET /api/sosmed/video-state — Task 6
- [x] useCommandPoller hook — Task 7
- [x] NewContentModal (3 options, POST on confirm, navigate) — Task 8
- [x] QueueSidebar (draft posts list, refreshKey) — Task 9
- [x] Calendar dateClick → modal — Task 10
- [x] Calendar queue sidebar layout — Task 10
- [x] "Open in Posts" link updated to /posts/${id} — Task 10
- [x] EngageGenerator (auto-generate, char count, feedback, regenerate, approve) — Task 11
- [x] EducateGenerator (source picker, progress bar, code card, feedback, approve) — Task 12
- [x] PublishSection (TimePicker, Publish Now, published results) — Task 13
- [x] PostDetailShell (header, delete, generation section, captions, publish) — Task 14
- [x] /posts/[id] server route — Task 15
- [x] SuggestList — Task 16
- [x] VideoStepper (4 steps, live log, reset, recover) — Task 17
- [x] /posts/[id]/video server route (video-type guard) — Task 18
- [x] Rule: no publish section for draft posts — enforced in PostDetailShell (canPublish)
- [x] Rule: educate source picker hidden after first generate — EducateGenerator uses sourceLocked
- [x] Rule: engage/educate = Threads+X only, video = IG+Threads+X — enforced by VM worker (UI doesn't make platform choices, just fires commands)
