# Task Management (`/tasks`)

The team's task board, replacing the "Timeline IoT" PDF plan (timeline + "Tugas per orang" checklist).
Sidebar item **Task Management**. Migration `supabase/migrations/026_tasks.sql` (**not applied yet**; until it is,
`/tasks` shows a "database belum siap" note). The migration also seeds the plan from 22 November 2026.

## Data (RLS: `is_allowed_user()` — every allow-listed account reads and edits everything)

- `task_members` — people tasks are assigned to: `name`, `initials`, `role`, `color`, optional `email` (when it
  matches the login, the person filter defaults to that member), `goal` ("Hasil: …" on the person card), `active`.
  Not tied to login accounts: one shared login can still assign work to everyone.
- `task_projects` — `name`, `label` (e.g. "V1", "Supporting"), `color`, `status` `active|parked|done` (parked =
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
- "Tim & proyek" dialog — add/edit members and projects.
