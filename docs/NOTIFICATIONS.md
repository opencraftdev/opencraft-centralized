# Notifications (bell in the top bar)

Migration `supabase/migrations/028_notifications.sql` (run it in the Supabase SQL editor; until then the bell is
hidden). Safe to run more than once.

## Data

- `app_notifications` — `area` (`tasks|finance|scrapers|documents`), `kind`, `title`, `body`, `link` (in-app path),
  `actor` (login email, null = agent/system), `ref_id`, `count` (folded events), `created_at`, `updated_at`.
  RLS: allow-listed users may read; nobody writes directly.
- Written only by triggers through `app_notify(...)` (security definer). `p_group_minutes` folds repeats of the same
  kind + actor + ref into one row (`count` + 1, `{n}` in the grouped title). Rows older than 60 days are pruned.
- Triggers:
  - `tasks`: created (task / checklist item), status changed, PIC changed, details changed (title, notes, dates,
    priority, project, helpers; folded per task for 10 min), deleted. Link `/tasks?task=<id>`.
  - `task_comments`: new comment (mention tokens shown as `@Name`).
  - `finance_entries`: new pemasukan / pengeluaran (docs/FINANCE.md). (`finance_expenses` triggers remain but the table is no longer used.)
  - `scraper_leads`: new leads, folded per hour ("12 lead baru dari Scrapers").
  - `drive_files`: task attachment, new ready document, document finished generating. Logos, profile photos and
    files mirrored from Google Drive are skipped.
- In `supabase_realtime`: open dashboards update live.

## UI

- `src/features/notifications/NotificationBell.tsx`, next to the avatar. "Read" is per browser (localStorage
  `notif.lastReadAt`) because the team may share one login. The red badge pops in and pulses while something is
  unread; the list opens as a sheet from the right (filters: Semua / Task / Finance / Scrapers / Document); items
  that were new flash blue once. `/tasks?task=<id>` opens the task dialog.
- Clicking an item shows quick actions in place (option 5): comment → Balas (inline reply, posted as a task comment) /
  Tandai dibaca / Buka; task assigned/created/updated → Buka tugas / Tandai selesai / Tandai dibaca; status /
  attachment → Buka tugas; leads → Lihat N lead; expense → Lihat di Finance / Oke; document → Unduh / Buka.
  "Tandai dibaca" is per item, per browser (localStorage `notif.readIds`).
