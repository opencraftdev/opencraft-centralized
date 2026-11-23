-- Drive storage moves from Supabase Storage to Google Drive (account opencraft.dev@gmail.com).
-- Contract: docs/DRIVE.md → "Storage: Google Drive".
--
-- PART 1 is already applied in production (wdzmuniyqqyngzckeoph); it is written idempotently.
-- PART 2 is APPLY AT CUTOVER only — after the Google-backed web app + worker are deployed and the
-- legacy rows have been re-uploaded to Google. Do not run it before that.

-- ───────────────────────────── PART 1: schema (applied) ─────────────────────────────

-- OAuth credentials + root folder for the Google account. Single row (id = 1).
create table if not exists public.google_drive_auth (
  id smallint primary key default 1 check (id = 1),
  account_email text,
  client_id text not null,
  client_secret text not null,
  refresh_token text not null,
  root_folder_id text, -- Google folder "OpenCraft Documents" = dashboard root ("Drive Saya")
  updated_at timestamptz not null default now()
);

-- Service role only: RLS on, no policies, no grants to client roles.
alter table public.google_drive_auth enable row level security;
revoke all on table public.google_drive_auth from anon, authenticated;

-- Mirror ids (null = not created in Google yet; folders are created lazily).
alter table public.drive_folders add column if not exists google_folder_id text;
alter table public.drive_files add column if not exists google_file_id text;

create unique index if not exists drive_folders_google_folder_id_idx
  on public.drive_folders (google_folder_id) where google_folder_id is not null;
create unique index if not exists drive_files_google_file_id_idx
  on public.drive_files (google_file_id) where google_file_id is not null;

-- ───────────────────── PART 2: APPLY AT CUTOVER (not applied yet) ─────────────────────
-- Run manually after deploy, once no row relies on Supabase Storage / the legacy S3 link any more:
--   select id, name from public.drive_files where google_file_id is null and status = 'ready';  -- expect none
--
-- drop policy if exists drive_objects_auth_select on storage.objects;
-- drop policy if exists drive_objects_auth_insert on storage.objects;
-- drop policy if exists drive_objects_auth_update on storage.objects;
-- drop policy if exists drive_objects_auth_delete on storage.objects;
-- alter table public.drive_files drop column if exists legacy_document_id;
-- alter table public.drive_files drop column if exists storage_path;
--
-- (Optional, once it is empty: remove the bucket via the Storage API / dashboard — Supabase blocks
--  direct deletes from storage.buckets / storage.objects in SQL.)
