# Task Management (`/tasks`)

The team's task board, replacing the "Timeline IoT" PDF plan (timeline + "Tugas per orang" checklist).
Sidebar item **Task Management** (section Operational). Migration `supabase/migrations/026_tasks.sql` (run it in the
Supabase SQL editor; until it is, `/tasks` shows a "database belum siap" note). It is safe to run more than once: it
only creates what is missing and seeds the plan from 22 November 2026 only while `task_members` is empty.

## Data (RLS: `is_allowed_user()` — every allow-listed account reads and edits everything)

- `task_members` — people tasks are assigned to, added by typing a name ("Tim & project", or "Tambah orang baru…"
  in the PIC picker): `name`, `initials`, `role`, `color`, `goal` ("Hasil: …" on the person card), `active`.
  `email` links a member to a login (migration 029, [ACCOUNTS.md](ACCOUNTS.md)): it is that login's profile, the
  person filter defaults to it, and comments show its name. Set as "Email login" in the member form.
- `task_projects` (shown as "Project"; also created from "Tambah project baru…" in the task dialog) — `name`, `label` (e.g. "V1", "Supporting"), `color`, `status` `active|parked|done` (parked =
  hidden from pickers and the project filter).
- `tasks` — `title`, `description`, `status` `todo|in_progress|review|done`, `priority` `low|medium|high|urgent`,
  `assignee_id` (PIC), `helper_ids` ("dibantu"), `start_date`, `due_date` (deadline), `is_milestone` (one-day event),
  `is_optional` ("kalau perlu"), `project_id`, `parent_id` (set = checklist item of another task), `sort`,
  `completed_at` (trigger: set when status becomes `done`), `updated_at` (trigger).
- `task_comments` — `task_id`, `body`, `author_email` (defaults to the login's email).
- All four tables are in the `supabase_realtime` publication: open boards refresh when someone else edits.

## UI

- Header: stats (belum selesai, sedang dikerjakan, deadline minggu ini, terlambat, selesai minggu ini) counted over
  "leaf" tasks (checklist items, and tasks without checklist), respecting the person/project filter.
- Toolbar: view switch (remembered), search, person filter (remembered), project filter, "Sembunyikan selesai".
- **Board** — columns per status, top-level tasks as cards (project, priority flag, milestone, checklist progress,
  PIC + helpers, deadline chip: "Terlambat N hari" red, ≤ 3 days amber). Drag a card to change status; "Tambah tugas"
  quick-adds into a column.
- **Timeline** — 6 weeks (starting last week; ‹ › to move, "Hari ini" to reset), rows grouped by project. Bar =
  start → deadline in the project color, striped = "kalau perlu", diamond = milestone, red outline = overdue,
  dashed line = today.
- **Per orang** — a card per active member: their leaf tasks grouped by period, checkbox to finish, overdue/soon
  chips, progress, and the member's `goal`.
- Task dialog — title, notes, checklist (add / tick / delete / open item), comments; status, PIC, helpers, project,
  start, deadline, priority, milestone, "kalau perlu". Delete asks to confirm (cascades to checklist items).
- "Tim & project" dialog — add/edit members and projects.

## Lampiran (attachments) & links

- A task and each comment can carry files (images, videos, PDFs, anything). They are uploaded straight to Google Drive
  through `/api/drive/upload`, into the dashboard folder **"Task Management"** (created on first use), as ordinary
  `drive_files` rows tagged in `metadata`: `{task_id}` for a file on the task, `{task_id, comment_id}` for a file on a
  comment (`src/features/tasks/attachments.ts`). No extra table or migration. They also show in `/documents`.
- Task dialog: "Lampiran" section (button or drag & drop), thumbnails for images/videos, click → the Drive preview
  dialog; the × moves the file to the Drive trash (restorable from Document → Sampah). Comment composer: paperclip or
  drop to queue files; they upload after the comment is posted (a files-only comment is stored with body "Lampiran").
- URLs in notes ("Catatan") and comments become links (`src/components/ui/Linkify.tsx`, new tab). Notes show as text
  with links; "Ubah" or a click switches to editing.

## Project icons, profile photos, mentions (migration 027)

- `task_projects.emoji` (Apple emoji, shown with the system emoji font) and `task_projects.logo_file_id` (custom logo,
  a drive_files image; logo wins over emoji). Colour: presets, native picker or hex. Managed in "Tim & project"
  (also reachable from the task dialog's Project menu → "Atur ikon, warna & logo…"). Upload warns when the image is
  not square or smaller than 500×500 px (logo) / 400×400 px (photo); max 5 MB.
- `task_members.photo_file_id`: profile photo shown in every avatar.
- Comments: "@" opens a picker of people, tasks and projects; stored as `@[Label](member|task|project:<uuid>)` and
  shown as chips (task chips open the task). No notifications yet.
- Board card: project pill (colour + icon) and deadline on top, progress bar, avatars and priority as coloured text.
- The "Milestone" and "Kalau perlu" switches were removed from the task dialog (existing values still render).
