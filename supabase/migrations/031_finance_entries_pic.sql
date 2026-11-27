-- Finance PIC (docs/FINANCE.md): who paid an expense / received an income. Several people allowed.
-- Ids of task_members (same people as the PIC on the board).
alter table public.finance_entries add column if not exists pic_ids uuid[] not null default '{}';
