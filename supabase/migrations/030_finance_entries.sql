-- Finance as a simple book (docs/FINANCE.md): one row per income ("pemasukan") or expense ("pengeluaran"),
-- like the team's spreadsheet: Tanggal · Keterangan · Kategori · Jumlah · Catatan, grouped per month, with a yearly
-- recap. The whole team (is_allowed_user) reads and writes. Safe to run more than once.
-- finance_expenses (007) is left in place but no longer shown.

create table if not exists public.finance_entries (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('income', 'expense')),
  entry_date date not null default current_date,
  description text not null check (length(trim(description)) > 0),
  category text not null default 'Lain-lain',
  amount bigint not null check (amount >= 0),       -- whole rupiah
  note text not null default '',
  created_by text default public.my_email(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists finance_entries_date_idx on public.finance_entries (entry_date desc);

drop trigger if exists handle_updated_at_finance_entries on public.finance_entries;
create trigger handle_updated_at_finance_entries before update on public.finance_entries
  for each row execute procedure extensions.moddatetime(updated_at);

alter table public.finance_entries enable row level security;
drop policy if exists finance_entries_all on public.finance_entries;
create policy finance_entries_all on public.finance_entries for all to authenticated
  using (public.is_allowed_user()) with check (public.is_allowed_user());

-- Notifications (028): a new entry shows in the bell under Finance.
create or replace function public.app_notify_finance_entries() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.app_notify('finance',
    case when new.kind = 'income' then 'income_new' else 'expense_new' end,
    case when new.kind = 'income' then 'Pemasukan: ' else 'Pengeluaran: ' end || new.description,
    new.category || ' · Rp ' || replace(to_char(new.amount, 'FM999,999,999,999'), ',', '.')
      || ' · ' || to_char(new.entry_date, 'DD/MM/YYYY'),
    '/finance?m=' || to_char(new.entry_date, 'YYYY-MM'), new.id);
  return null;
end $$;
drop trigger if exists app_notify_finance_entries on public.finance_entries;
create trigger app_notify_finance_entries after insert on public.finance_entries
  for each row execute function public.app_notify_finance_entries();

-- Seed from the spreadsheet (November 2026), once.
insert into public.finance_entries (kind, entry_date, description, category, amount, note, created_by)
select 'expense', date '2026-11-20', 'R&D Keychain', 'Lain-lain', 223690, 'R&D Keychain', null
where not exists (select 1 from public.finance_entries);
