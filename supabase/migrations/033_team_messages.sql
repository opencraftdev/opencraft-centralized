-- Team chat: one-to-one messages between teammates ("Chat Tim" button, "Chat" on a person's profile card).
-- A conversation is identified by `thread` = the two login emails, lower case, sorted, joined with "|".
-- Only the two people in a thread can read it. Safe to run more than once.

create table if not exists public.team_messages (
  id uuid primary key default gen_random_uuid(),
  thread text not null,
  author_email text not null default public.my_email(),
  body text not null check (length(trim(body)) > 0),
  read_at timestamptz,                       -- when the other person opened it
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists team_messages_thread_idx on public.team_messages (thread, created_at);

alter table public.team_messages enable row level security;

drop policy if exists team_messages_read on public.team_messages;
create policy team_messages_read on public.team_messages for select to authenticated
  using (public.is_allowed_user() and public.my_email() = any (string_to_array(thread, '|')));

drop policy if exists team_messages_send on public.team_messages;
create policy team_messages_send on public.team_messages for insert to authenticated
  with check (public.is_allowed_user() and author_email = public.my_email() and public.my_email() = any (string_to_array(thread, '|')));

-- edit own text; the other person may only set read_at (enforced in the app; both stay inside their own thread)
drop policy if exists team_messages_update on public.team_messages;
create policy team_messages_update on public.team_messages for update to authenticated
  using (public.is_allowed_user() and public.my_email() = any (string_to_array(thread, '|')))
  with check (public.my_email() = any (string_to_array(thread, '|')));

drop policy if exists team_messages_delete on public.team_messages;
create policy team_messages_delete on public.team_messages for delete to authenticated
  using (public.is_allowed_user() and author_email = public.my_email());

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'team_messages') then
    alter publication supabase_realtime add table public.team_messages;
  end if;
end $$;
