-- Applied 2026-11-23. See docs/DRIVE.md → "Sync status in the UI" and "Chat tab".

-- Sync status the dashboard can show (no secrets here; google_drive_auth stays service-role only).
create table public.drive_sync_state (
  id smallint primary key default 1 check (id = 1),
  root_folder_id text,
  last_sync_at timestamptz,
  last_sync_summary text,          -- e.g. "+1 ~0 -0"
  last_error text,
  sync_requested_at timestamptz,   -- set by the UI "Sinkronkan sekarang"; worker syncs soon after
  updated_at timestamptz not null default now()
);
alter table public.drive_sync_state enable row level security;
create policy drive_sync_state_read on public.drive_sync_state for select to authenticated using (public.is_allowed_user());
create policy drive_sync_state_request on public.drive_sync_state for update to authenticated using (public.is_allowed_user()) with check (public.is_allowed_user());
revoke update on public.drive_sync_state from authenticated;
grant update (sync_requested_at) on public.drive_sync_state to authenticated;
insert into public.drive_sync_state (id, root_folder_id) select 1, root_folder_id from public.google_drive_auth where id = 1;

-- Chat: live progress line while the agent works (e.g. "Membaca pricelist…").
alter table public.drive_files add column progress text;

-- "Sinkronkan sekarang": stamp the request with the DB clock (not the browser's).
create or replace function public.request_drive_sync() returns timestamptz
language plpgsql security definer set search_path = public as $$
declare t timestamptz := now();
begin
  if not public.is_allowed_user() then raise exception 'not allowed' using errcode = '42501'; end if;
  update public.drive_sync_state set sync_requested_at = t where id = 1;
  return t;
end $$;
revoke all on function public.request_drive_sync() from public, anon;
grant execute on function public.request_drive_sync() to authenticated;
