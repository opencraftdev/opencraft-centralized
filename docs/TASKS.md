# Task Management (`/tasks`)

The team's task board, replacing the "Timeline IoT" PDF plan (timeline + "Tugas per orang" checklist).
Sidebar item **Task Management** (section Operational). Migration `supabase/migrations/026_tasks.sql` (run it in the
Supabase SQL editor; until it is, `/tasks` shows a "database belum siap" note). It is safe to run more than once: it
only creates what is missing and seeds the plan from 22 November 2026 only while `task_members` is empty.

## Data (RLS: `is_allowed_user()` — every allow-listed account reads and edits everything)

- `task_members` — people tasks are assigned to, added by typing a name ("Tim & project", or "Tambah orang baru…"
  in the PIC picker): `name`, `initials`, `role`, `color`, `goal` ("Hasil: …" on the person card), `active`.
  Not tied to login accounts. `email` exists for later (when it matches the login, the person filter defaults to
  that member) but the UI doesn't ask for it yet.
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
