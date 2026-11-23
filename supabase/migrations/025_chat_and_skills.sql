-- Applied 2026-11-23. Contract: docs/CHAT.md.

-- ── Skills: SKILL.md files the chat agent loads (synced by the worker into ~/opencraft-chat/.claude/skills/) ──
create table public.skills (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (name ~ '^[a-z0-9][a-z0-9-]{0,62}$'),  -- folder name and "/name" in the chat
  title text not null,                    -- display name
  description text not null,              -- one sentence: when Claude should use it (frontmatter description)
  body text not null default '',          -- SKILL.md body (Markdown instructions)
  enabled boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.skills enable row level security;
create policy skills_allowed on public.skills for all to authenticated
  using (public.is_allowed_user()) with check (public.is_allowed_user());

-- ── Chats ──
create table public.chats (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'Chat baru',
  status text not null default 'idle' check (status in ('idle','queued','running','failed')),
  session_id text,                         -- cc-gateway session (resumed on every run)
  consumed_at timestamptz,                 -- user messages created after this are not yet sent to the agent
  run_steps jsonb,                         -- live: [{label, at}] of the run in progress
  stream_text text,                        -- live: reply text so far (ATTACH lines cut)
  started_at timestamptz,
  cancel_requested_at timestamptz,         -- UI "Stop"
  error_msg text,
  cost_usd numeric not null default 0,
  pinned boolean not null default false,
  trashed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.chats (updated_at desc);
create index on public.chats (status) where status in ('queued','running');
alter table public.chats enable row level security;
create policy chats_allowed on public.chats for all to authenticated
  using (public.is_allowed_user()) with check (public.is_allowed_user());

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null default '',
  steps jsonb,                             -- assistant: [{label, at}]
  duration_ms integer,
  stopped boolean not null default false,
  error text,                              -- assistant: the run failed
  attachments jsonb,                       -- assistant: [{file_id, name, mime_type}] (drive_files ids)
  created_at timestamptz not null default clock_timestamp()
);
create index on public.chat_messages (chat_id, created_at);
alter table public.chat_messages enable row level security;
create policy chat_messages_allowed on public.chat_messages for all to authenticated
  using (public.is_allowed_user()) with check (public.is_allowed_user());

-- Files the chat agent attaches are stored in Google Drive like any other file.
alter table public.drive_files drop constraint drive_files_source_check;
alter table public.drive_files add constraint drive_files_source_check
  check (source in ('generated','upload','agent','google','chat'));
alter table public.drive_files add column chat_id uuid references public.chats(id) on delete set null;
alter table public.drive_files add column chat_path text;   -- server path the agent attached (re-attach replaces)

-- Send a message: creates the chat when p_chat_id is null; queues a run unless one is running (the worker picks up
-- messages sent meanwhile when the run ends). Returns the chat id.
create or replace function public.chat_send(p_chat_id uuid, p_content text) returns uuid
language plpgsql security definer set search_path = public as $$
declare c uuid := p_chat_id; t text := btrim(coalesce(p_content, ''));
begin
  if not public.is_allowed_user() then raise exception 'not allowed' using errcode = '42501'; end if;
  if t = '' then raise exception 'empty message'; end if;
  if c is null then
    insert into public.chats (title, created_by)
    values (left(regexp_replace(regexp_replace(t, '^/[a-z0-9-]+\s*', ''), '\s+', ' ', 'g'), 60), auth.uid())
    returning id into c;
    update public.chats set title = 'Chat baru' where id = c and title = '';
  end if;
  insert into public.chat_messages (chat_id, role, content) values (c, 'user', t);
  update public.chats
     set status = case when status = 'running' then 'running' else 'queued' end,
         error_msg = null, updated_at = now()
   where id = c;
  return c;
end $$;
revoke all on function public.chat_send(uuid, text) from public, anon;
grant execute on function public.chat_send(uuid, text) to authenticated;

-- Worker: claim the oldest queued chat (service role only).
create or replace function public.claim_chat_run() returns setof public.chats
language plpgsql security definer set search_path = public as $$
begin
  return query
  update public.chats set status = 'running', started_at = now(), error_msg = null
   where id = (select id from public.chats where status = 'queued' and trashed_at is null
               order by updated_at limit 1 for update skip locked)
  returning *;
end $$;
revoke all on function public.claim_chat_run() from public, anon, authenticated;

-- First skill: document generation (SPH / MoU / Deck) through ~/document-agent.
insert into public.skills (name, title, description, body) values (
  'opencraft-document',
  'Dokumen OpenCraft',
  'Membuat atau merevisi dokumen bisnis OpenCraft: SPH (Surat Pengajuan Harga), MoU, dan Deck presentasi. Pakai saat user minta dibuatkan SPH, MoU, penawaran harga, atau deck.',
$md$# Dokumen OpenCraft (SPH / MoU / Deck)

Semua pembuatan dokumen dikerjakan di `/home/opencraft/document-agent`.

1. Baca dulu `/home/opencraft/document-agent/CLAUDE.md` dan ikuti semua aturannya (hard rules, workflow SPH/MoU, workflow Deck).
2. Jalankan semua perintah dari folder itu (`cd /home/opencraft/document-agent && …`).
3. Jangan pernah mengarang nomor dokumen atau harga. Kalau data klien atau harga belum lengkap, tanyakan ke user dulu (format Markdown, daftar bernomor), lalu berhenti dan tunggu jawabannya.
4. Revisi dokumen yang sudah dibuat di chat ini: render ulang dokumen yang sama dengan nomor yang sama (jangan `doc_number.py next`/`record` lagi), kecuali user eksplisit minta dokumen baru.
5. Setelah file jadi, lampirkan ke chat dengan satu baris di akhir jawaban:
   `ATTACH: {"path":"/home/opencraft/document-agent/documents/sph/004_SPH-OC_2026.pdf","folder":"SPH","doc_number":"004/SPH-OC/2026"}`
   `folder` = `SPH`, `MoU`, atau `Deck` (folder di Google Drive "OpenCraft Documents").
6. Tulis ringkasan singkat dalam Bahasa Indonesia: nomor dokumen, klien, total (untuk SPH).
$md$);
