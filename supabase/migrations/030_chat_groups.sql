-- 030: chat groups (folders) in the chat history, like Claude's projects in the sidebar.
-- Each person has their own groups and decides which of their chats (own or shared with them) sit in which group.
-- Re-runnable.

create table if not exists public.chat_groups (
  id uuid primary key default gen_random_uuid(),
  owner_email text not null default public.my_email(),
  name text not null check (length(trim(name)) between 1 and 80),
  sort double precision not null default extract(epoch from now()),
  created_at timestamptz not null default now()
);
create index if not exists chat_groups_owner_idx on public.chat_groups (owner_email, sort);

-- Which group a chat is in, per person (a shared chat can be in different groups for different people).
create table if not exists public.chat_group_items (
  email text not null default public.my_email(),
  chat_id uuid not null references public.chats (id) on delete cascade,
  group_id uuid not null references public.chat_groups (id) on delete cascade,
  primary key (email, chat_id)
);
create index if not exists chat_group_items_group_idx on public.chat_group_items (group_id);

alter table public.chat_groups enable row level security;
alter table public.chat_group_items enable row level security;

drop policy if exists chat_groups_own on public.chat_groups;
create policy chat_groups_own on public.chat_groups for all to authenticated
  using (public.is_allowed_user() and owner_email = public.my_email())
  with check (public.is_allowed_user() and owner_email = public.my_email());

drop policy if exists chat_group_items_own on public.chat_group_items;
create policy chat_group_items_own on public.chat_group_items for all to authenticated
  using (public.is_allowed_user() and email = public.my_email())
  with check (
    public.is_allowed_user()
    and email = public.my_email()
    and public.can_access_chat(chat_id)
    and exists (select 1 from public.chat_groups g where g.id = group_id and g.owner_email = public.my_email())
  );

grant select, insert, update, delete on public.chat_groups, public.chat_group_items to authenticated;

-- check: should list both tables
select table_name from information_schema.tables where table_schema = 'public' and table_name in ('chat_groups', 'chat_group_items');
