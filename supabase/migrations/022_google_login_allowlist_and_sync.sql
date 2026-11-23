-- Applied 2026-11-23. See docs/DRIVE.md → "Login: Google only" and "Two-way sync".

-- 1) Only allow-listed Google accounts may use the dashboard.
create table public.app_allowed_emails (email text primary key check (email = lower(email)));
alter table public.app_allowed_emails enable row level security;
revoke all on public.app_allowed_emails from anon, authenticated;
insert into public.app_allowed_emails values ('opencraft.dev@gmail.com');

create or replace function public.is_allowed_user() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.app_allowed_emails where email = lower(coalesce(auth.jwt() ->> 'email', '')));
$$;
revoke all on function public.is_allowed_user() from public, anon;
grant execute on function public.is_allowed_user() to authenticated;

drop policy drive_files_auth_all on public.drive_files;
drop policy drive_folders_auth_all on public.drive_folders;
create policy drive_files_allowed on public.drive_files for all to authenticated using (public.is_allowed_user()) with check (public.is_allowed_user());
create policy drive_folders_allowed on public.drive_folders for all to authenticated using (public.is_allowed_user()) with check (public.is_allowed_user());

drop policy "viewers read documents" on public.agent_documents;
drop policy "viewers read runs" on public.agent_runs;
drop policy "viewers read agents" on public.agents;
drop policy "viewers read finance expenses" on public.finance_expenses;
drop policy "viewers read scraper leads" on public.scraper_leads;
create policy allowed_read on public.agent_documents for select to authenticated using (public.is_allowed_user());
create policy allowed_read on public.agent_runs for select to authenticated using (public.is_allowed_user());
create policy allowed_read on public.agents for select to authenticated using (public.is_allowed_user());
create policy allowed_read on public.finance_expenses for select to authenticated using (public.is_allowed_user());
create policy allowed_read on public.scraper_leads for select to authenticated using (public.is_allowed_user());

-- Auth hook (Before User Created): reject sign-ups from any other email.
create or replace function public.hook_before_user_created(event jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.app_allowed_emails where email = lower(coalesce(event -> 'user' ->> 'email', ''))) then
    return '{}'::jsonb;
  end if;
  return jsonb_build_object('error', jsonb_build_object('http_code', 403, 'message', 'Akun ini tidak diizinkan masuk ke OpenCraft Internal.'));
end $$;
revoke all on function public.hook_before_user_created(jsonb) from public, anon, authenticated;
grant execute on function public.hook_before_user_created(jsonb) to supabase_auth_admin;
grant select on public.app_allowed_emails to supabase_auth_admin;

-- 2) Two-way sync of the "OpenCraft Documents" folder (Drive Changes API, scope drive).
alter table public.google_drive_auth
  add column scope text,
  add column changes_page_token text,
  add column last_sync_at timestamptz;
alter table public.drive_files drop constraint drive_files_source_check;
alter table public.drive_files add constraint drive_files_source_check check (source in ('generated','upload','agent','google'));
alter table public.drive_files add column google_modified_at timestamptz;
alter table public.drive_folders add column google_modified_at timestamptz;
