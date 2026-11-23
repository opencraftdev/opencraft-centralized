-- Google-Drive style document store + AI generation queue for /documents (see docs/DRIVE.md)
create table public.drive_folders (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  parent_id uuid references public.drive_folders(id) on delete cascade,
  starred boolean not null default false,
  trashed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.drive_folders(parent_id);

create table public.drive_files (
  id uuid primary key default gen_random_uuid(),
  folder_id uuid references public.drive_folders(id) on delete set null,
  name text not null,
  mime_type text,
  size_bytes bigint,
  storage_path text,                       -- object path in private bucket 'drive'
  legacy_document_id bigint references public.agent_documents(id) on delete set null, -- old S3-backed docs
  source text not null default 'upload' check (source in ('generated','upload','agent')),
  status text not null default 'ready' check (status in ('queued','generating','needs_input','ready','failed')),
  doc_type text check (doc_type in ('sph','mou','deck','other')),
  prompt text,                              -- original user request (generated files)
  messages jsonb not null default '[]'::jsonb, -- [{role:'user'|'assistant', text, at}]
  agent_message text,                       -- last assistant reply / clarifying question
  gateway_session_id text,                  -- cc-gateway session for follow-ups
  run_id text,
  doc_number text,
  cost_usd numeric,
  error_msg text,
  starred boolean not null default false,
  trashed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);
create index on public.drive_files(folder_id);
create index on public.drive_files(status) where status in ('queued','generating');

create or replace function public.drive_touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger drive_folders_updated_at before update on public.drive_folders for each row execute function public.drive_touch_updated_at();
create trigger drive_files_updated_at before update on public.drive_files for each row execute function public.drive_touch_updated_at();

-- Worker claims the oldest queued job atomically (service role only).
create or replace function public.claim_drive_job() returns setof public.drive_files
language sql security definer set search_path = public as $$
  update public.drive_files f
     set status = 'generating', started_at = now(), error_msg = null
   where f.id = (select id from public.drive_files
                  where status = 'queued' and trashed_at is null
                  order by created_at
                  for update skip locked limit 1)
  returning f.*;
$$;
revoke all on function public.claim_drive_job() from public, anon, authenticated;
grant execute on function public.claim_drive_job() to service_role;

-- RLS: internal tool, any signed-in user has full access.
alter table public.drive_folders enable row level security;
alter table public.drive_files enable row level security;
create policy drive_folders_auth_all on public.drive_folders for all to authenticated using (true) with check (true);
create policy drive_files_auth_all on public.drive_files for all to authenticated using (true) with check (true);

-- Private storage bucket
insert into storage.buckets (id, name, public, file_size_limit) values ('drive','drive', false, 52428800)
on conflict (id) do nothing;
create policy drive_objects_auth_select on storage.objects for select to authenticated using (bucket_id = 'drive');
create policy drive_objects_auth_insert on storage.objects for insert to authenticated with check (bucket_id = 'drive');
create policy drive_objects_auth_update on storage.objects for update to authenticated using (bucket_id = 'drive');
create policy drive_objects_auth_delete on storage.objects for delete to authenticated using (bucket_id = 'drive');

-- Default folders + import existing Document Agent docs (still served from S3 via legacy_document_id)
insert into public.drive_folders (name) values ('SPH'), ('MoU'), ('Deck');
insert into public.drive_files (folder_id, name, mime_type, size_bytes, legacy_document_id, source, status, doc_type, doc_number, error_msg, created_at, finished_at, metadata)
select (select id from public.drive_folders where name = case lower(coalesce(d.doc_type,'')) when 'sph' then 'SPH' when 'mou' then 'MoU' when 'deck' then 'Deck' end and parent_id is null),
       d.title, case when d.doc_type ilike 'deck' then 'application/vnd.openxmlformats-officedocument.presentationml.presentation' else 'application/pdf' end,
       d.size_bytes, d.id, 'agent',
       case d.status when 'generated' then 'ready' when 'failed' then 'failed' else 'queued' end,
       case lower(coalesce(d.doc_type,'')) when 'sph' then 'sph' when 'mou' then 'mou' when 'deck' then 'deck' else 'other' end,
       d.external_id, d.error_msg, d.generated_at, d.generated_at, coalesce(d.metadata,'{}'::jsonb)
  from public.agent_documents d
  join public.agents a on a.id = d.agent_id and a.slug = 'document-agent';
-- never let imported non-final docs get picked up by the worker
update public.drive_files set status = 'failed', error_msg = 'Imported pending document' where source = 'agent' and status = 'queued';
