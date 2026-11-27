-- Personal accounts + per-person chat history + shared chats. Contract: docs/ACCOUNTS.md.
-- Safe to run more than once.

-- ── 1) Who may log in (Google) ──
insert into public.app_allowed_emails (email) values
  ('rafireyhanwork@gmail.com'),
  ('bagasma.work@gmail.com'),
  ('deprasny@gmail.com'),
  ('mrayandika.work@gmail.com')
on conflict do nothing;

-- The caller's login email ('' when none, e.g. the service role).
create or replace function public.my_email() returns text
language sql stable as $$ select lower(coalesce(auth.jwt() ->> 'email', '')) $$;
grant execute on function public.my_email() to authenticated;

-- Is this email allowed to log in? (app_allowed_emails itself is service-role only.)
create or replace function public.is_allowed_email(p_email text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.app_allowed_emails where email = lower(coalesce(p_email, '')));
$$;
revoke all on function public.is_allowed_email(text) from public, anon;
grant execute on function public.is_allowed_email(text) to authenticated;

-- ── 2) Profiles = task_members linked to a login email ──
update public.task_members set email = 'rafireyhanwork@gmail.com'  where email is null and lower(name) = 'rafi';
update public.task_members set email = 'bagasma.work@gmail.com'    where email is null and lower(name) = 'bagas';
update public.task_members set email = 'deprasny@gmail.com'        where email is null and lower(name) = 'depras';
update public.task_members set email = 'mrayandika.work@gmail.com' where email is null and lower(name) = 'raka';
update public.task_members set email = lower(email) where email is not null and email <> lower(email);
update public.task_members set email = null where email = '';
create unique index if not exists task_members_email_key on public.task_members (email) where email is not null;

-- ── 3) Chats belong to a person; others see them only when added ──
alter table public.chats add column if not exists owner_email text;
update public.chats c set owner_email = lower(u.email) from auth.users u where c.owner_email is null and u.id = c.created_by;
update public.chats set owner_email = 'opencraft.dev@gmail.com' where owner_email is null;
alter table public.chats alter column owner_email set default public.my_email();
alter table public.chats alter column owner_email set not null;
create index if not exists chats_owner_email_idx on public.chats (owner_email);

-- Members of a chat (besides the owner). Added = in, no invitation to accept.
create table if not exists public.chat_members (
  chat_id uuid not null references public.chats(id) on delete cascade,
  email text not null check (email = lower(email)),
  added_by text default nullif(public.my_email(), ''),
  created_at timestamptz not null default now(),
  primary key (chat_id, email)
);
create index if not exists chat_members_email_idx on public.chat_members (email);
alter table public.chat_members enable row level security;

-- Who said it (user messages). Null = the assistant / older messages.
alter table public.chat_messages add column if not exists author_email text default nullif(public.my_email(), '');
update public.chat_messages m set author_email = c.owner_email
  from public.chats c where m.chat_id = c.id and m.role = 'user' and m.author_email is null;
update public.chat_messages set author_email = null where role = 'assistant' and author_email is not null;

-- Security-definer helpers (they read the tables without RLS, so policies don't recurse).
create or replace function public.is_chat_owner(p_chat uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.chats where id = p_chat and owner_email = public.my_email());
$$;
create or replace function public.is_chat_member(p_chat uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.chat_members where chat_id = p_chat and email = public.my_email());
$$;
create or replace function public.can_access_chat(p_chat uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_allowed_user() and (public.is_chat_owner(p_chat) or public.is_chat_member(p_chat));
$$;
revoke all on function public.is_chat_owner(uuid), public.is_chat_member(uuid), public.can_access_chat(uuid) from public, anon;
grant execute on function public.is_chat_owner(uuid), public.is_chat_member(uuid), public.can_access_chat(uuid) to authenticated;

drop policy if exists chats_allowed on public.chats;
drop policy if exists chats_read on public.chats;
drop policy if exists chats_insert on public.chats;
drop policy if exists chats_update on public.chats;
drop policy if exists chats_delete on public.chats;
create policy chats_read on public.chats for select to authenticated
  using (public.is_allowed_user() and (owner_email = public.my_email() or public.is_chat_member(id)));
create policy chats_insert on public.chats for insert to authenticated
  with check (public.is_allowed_user() and owner_email = public.my_email());
create policy chats_update on public.chats for update to authenticated
  using (public.is_allowed_user() and (owner_email = public.my_email() or public.is_chat_member(id)))
  with check (public.is_allowed_user());
create policy chats_delete on public.chats for delete to authenticated
  using (public.is_allowed_user() and owner_email = public.my_email());

-- Only the owner trashes a chat for everyone; nobody but the service role moves ownership.
create or replace function public.chats_guard() returns trigger
language plpgsql as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    if new.owner_email is distinct from old.owner_email then
      raise exception 'owner cannot be changed' using errcode = '42501';
    end if;
    if new.trashed_at is distinct from old.trashed_at and old.owner_email <> public.my_email() then
      raise exception 'only the owner can delete this chat' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists chats_guard on public.chats;
create trigger chats_guard before update on public.chats for each row execute function public.chats_guard();

drop policy if exists chat_messages_allowed on public.chat_messages;
drop policy if exists chat_messages_participants on public.chat_messages;
create policy chat_messages_participants on public.chat_messages for all to authenticated
  using (public.can_access_chat(chat_id)) with check (public.can_access_chat(chat_id));

drop policy if exists chat_members_read on public.chat_members;
drop policy if exists chat_members_add on public.chat_members;
drop policy if exists chat_members_remove on public.chat_members;
create policy chat_members_read on public.chat_members for select to authenticated
  using (public.can_access_chat(chat_id));
-- Anyone in the chat can add a teammate (an allow-listed login that isn't the owner).
create policy chat_members_add on public.chat_members for insert to authenticated
  with check (public.can_access_chat(chat_id) and public.is_allowed_email(email) and not exists (
    select 1 from public.chats c where c.id = chat_id and c.owner_email = email));
-- The owner removes anyone; a member can leave.
create policy chat_members_remove on public.chat_members for delete to authenticated
  using (public.is_allowed_user() and (email = public.my_email() or public.is_chat_owner(chat_id)));

-- Send: now checks the caller may write in that chat, and records the author / owner.
create or replace function public.chat_send(p_chat_id uuid, p_content text) returns uuid
language plpgsql security definer set search_path = public as $$
declare c uuid := p_chat_id; t text := btrim(coalesce(p_content, '')); me text := public.my_email();
begin
  if not public.is_allowed_user() then raise exception 'not allowed' using errcode = '42501'; end if;
  if t = '' then raise exception 'empty message'; end if;
  if c is null then
    insert into public.chats (title, created_by, owner_email)
    values (left(regexp_replace(regexp_replace(t, '^/[a-z0-9-]+\s*', ''), '\s+', ' ', 'g'), 60), auth.uid(), me)
    returning id into c;
    update public.chats set title = 'Chat baru' where id = c and title = '';
  elsif not public.can_access_chat(c) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  insert into public.chat_messages (chat_id, role, content, author_email) values (c, 'user', t, me);
  update public.chats
     set status = case when status = 'running' then 'running' else 'queued' end,
         error_msg = null, updated_at = now()
   where id = c;
  return c;
end $$;
revoke all on function public.chat_send(uuid, text) from public, anon;
grant execute on function public.chat_send(uuid, text) to authenticated;

-- ── 4) Live: open chat lists update when a chat is shared / changes ──
do $$
declare t text;
begin
  foreach t in array array['chats', 'chat_members', 'chat_messages'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
