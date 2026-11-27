-- In-app notifications (bell in the top bar). Contract: docs/NOTIFICATIONS.md.
-- Safe to run more than once. Rows are written only by the triggers below (security definer); the dashboard reads them.

create table if not exists public.app_notifications (
  id uuid primary key default gen_random_uuid(),
  area text not null check (area in ('tasks','finance','scrapers','documents')),
  kind text not null,                 -- task_created, task_status, task_assigned, task_updated, task_deleted, task_comment,
                                      -- task_attachment, expense_new, expense_updated, lead_new, doc_new, doc_ready
  title text not null,
  body text not null default '',
  link text not null default '',      -- in-app path, e.g. /tasks?task=<id>
  actor text,                         -- login email of who did it (null = an agent / the system)
  ref_id uuid,                        -- the row it is about
  count integer not null default 1,   -- events folded into this row (e.g. "12 lead baru")
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists app_notifications_updated_at_idx on public.app_notifications (updated_at desc);

alter table public.app_notifications enable row level security;
drop policy if exists app_notifications_read on public.app_notifications;
create policy app_notifications_read on public.app_notifications for select to authenticated using (public.is_allowed_user());

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'app_notifications') then
    alter publication supabase_realtime add table public.app_notifications;
  end if;
end $$;

-- Write (or fold into a recent identical one when p_group_minutes > 0; "{n}" in p_group_title = the new count).
create or replace function public.app_notify(
  p_area text, p_kind text, p_title text, p_body text, p_link text, p_ref uuid,
  p_group_minutes integer default 0, p_group_title text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_actor text := lower(nullif(coalesce(auth.jwt() ->> 'email', ''), ''));
  v_id uuid;
begin
  if p_group_minutes > 0 then
    select id into v_id from public.app_notifications
     where kind = p_kind and actor is not distinct from v_actor and ref_id is not distinct from p_ref
       and updated_at > now() - make_interval(mins => p_group_minutes)
     order by updated_at desc limit 1;
    if v_id is not null then
      update public.app_notifications
         set count = count + 1,
             title = coalesce(replace(p_group_title, '{n}', (count + 1)::text), p_title),
             body = p_body,
             updated_at = now()
       where id = v_id;
      return;
    end if;
  end if;
  insert into public.app_notifications (area, kind, title, body, link, actor, ref_id)
  values (p_area, p_kind, p_title, coalesce(p_body, ''), coalesce(p_link, ''), v_actor, p_ref);
  -- keep the table small
  if random() < 0.02 then
    delete from public.app_notifications where updated_at < now() - interval '60 days';
  end if;
end $$;
revoke all on function public.app_notify(text, text, text, text, text, uuid, integer, text) from public, anon, authenticated;

-- ── Task Management ──
create or replace function public.app_notify_tasks() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_parent text;
  v_project text;
  v_who text;
  v_status text;
  r public.tasks;
begin
  r := case when tg_op = 'DELETE' then old else new end;
  select title into v_parent from public.tasks where id = r.parent_id;
  select name into v_project from public.task_projects where id = r.project_id;

  if tg_op = 'INSERT' then
    perform public.app_notify('tasks', 'task_created',
      case when v_parent is null then 'Tugas baru: ' || r.title else 'Checklist baru di "' || v_parent || '": ' || r.title end,
      coalesce(v_project, ''), '/tasks?task=' || r.id, r.id);
  elsif tg_op = 'DELETE' then
    perform public.app_notify('tasks', 'task_deleted', 'Tugas dihapus: ' || r.title, coalesce(v_project, ''), '/tasks', null);
  else
    if new.status is distinct from old.status then
      v_status := case new.status when 'done' then 'selesai' when 'in_progress' then 'sedang dikerjakan' when 'review' then 'masuk review' else 'belum mulai' end;
      perform public.app_notify('tasks', 'task_status', '"' || new.title || '" ' || v_status,
        coalesce(v_parent, v_project, ''), '/tasks?task=' || new.id, new.id, 5);
    end if;
    if new.assignee_id is distinct from old.assignee_id and new.assignee_id is not null then
      select name into v_who from public.task_members where id = new.assignee_id;
      perform public.app_notify('tasks', 'task_assigned', coalesce(v_who, 'Seseorang') || ' jadi PIC "' || new.title || '"',
        coalesce(v_parent, v_project, ''), '/tasks?task=' || new.id, new.id, 5);
    end if;
    if (new.title, new.description, new.start_date, new.due_date, new.priority, new.project_id, new.helper_ids)
       is distinct from (old.title, old.description, old.start_date, old.due_date, old.priority, old.project_id, old.helper_ids) then
      perform public.app_notify('tasks', 'task_updated', 'Tugas diperbarui: ' || new.title,
        case when new.due_date is distinct from old.due_date and new.due_date is not null then 'Deadline ' || extract(day from new.due_date)::int || ' ' || (array['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'])[extract(month from new.due_date)::int] else coalesce(v_parent, v_project, '') end,
        '/tasks?task=' || new.id, new.id, 10);
    end if;
  end if;
  return null;
end $$;
drop trigger if exists app_notify_tasks on public.tasks;
create trigger app_notify_tasks after insert or update or delete on public.tasks
  for each row execute function public.app_notify_tasks();

create or replace function public.app_notify_task_comments() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_title text;
begin
  select title into v_title from public.tasks where id = new.task_id;
  perform public.app_notify('tasks', 'task_comment', 'Komentar baru di "' || coalesce(v_title, 'tugas') || '"',
    left(regexp_replace(new.body, '@\[([^\]]+)\]\((member|task|project):[0-9a-f-]+\)', '@\1', 'g'), 160),
    '/tasks?task=' || new.task_id, new.task_id);
  return null;
end $$;
drop trigger if exists app_notify_task_comments on public.task_comments;
create trigger app_notify_task_comments after insert on public.task_comments
  for each row execute function public.app_notify_task_comments();

-- ── Finance ──
create or replace function public.app_notify_finance() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform public.app_notify('finance', 'expense_new', 'Biaya baru: ' || new.item,
      new.vendor || ' · Rp ' || replace(to_char(new.amount, 'FM999,999,999,999'), ',', '.') || ' / bulan', '/finance', new.id);
  elsif (new.amount, new.active, new.item, new.billing_day) is distinct from (old.amount, old.active, old.item, old.billing_day) then
    perform public.app_notify('finance', 'expense_updated',
      case when not new.active and old.active then 'Biaya dihentikan: ' else 'Biaya diperbarui: ' end || new.item,
      new.vendor || ' · Rp ' || replace(to_char(new.amount, 'FM999,999,999,999'), ',', '.') || ' / bulan', '/finance', new.id, 10);
  end if;
  return null;
end $$;
drop trigger if exists app_notify_finance on public.finance_expenses;
create trigger app_notify_finance after insert or update on public.finance_expenses
  for each row execute function public.app_notify_finance();

-- ── Scrapers: new leads fold into one notification per hour ──
create or replace function public.app_notify_leads() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.app_notify('scrapers', 'lead_new', '1 lead baru dari Scrapers',
    'Terakhir: ' || new.business_name || coalesce(' · ' || new.location, ''), '/scrapers', null, 60, '{n} lead baru dari Scrapers');
  return null;
end $$;
drop trigger if exists app_notify_leads on public.scraper_leads;
create trigger app_notify_leads after insert on public.scraper_leads
  for each row execute function public.app_notify_leads();

-- ── Documents (Drive) and task attachments ──
create or replace function public.app_notify_drive() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_task uuid; v_title text;
begin
  -- Logos / profile photos are not news; files the Google sync mirrors are noise.
  if coalesce(new.metadata ->> 'kind', '') in ('project_logo', 'member_photo') or new.source = 'google' or new.trashed_at is not null then
    return null;
  end if;
  begin
    v_task := nullif(new.metadata ->> 'task_id', '')::uuid;
  exception when others then
    v_task := null;
  end;
  if tg_op = 'INSERT' then
    if v_task is not null then
      select title into v_title from public.tasks where id = v_task;
      perform public.app_notify('tasks', 'task_attachment', 'Lampiran baru di "' || coalesce(v_title, 'tugas') || '"', new.name, '/tasks?task=' || v_task, v_task, 5);
    elsif new.status = 'ready' then
      perform public.app_notify('documents', 'doc_new', 'Dokumen baru: ' || new.name, coalesce(upper(new.doc_type), ''), '/documents', new.id);
    end if;
  elsif new.status = 'ready' and old.status is distinct from 'ready' and v_task is null then
    perform public.app_notify('documents', 'doc_ready', 'Dokumen selesai dibuat: ' || new.name, coalesce(new.doc_number, ''), '/documents', new.id);
  end if;
  return null;
end $$;
drop trigger if exists app_notify_drive on public.drive_files;
create trigger app_notify_drive after insert or update of status on public.drive_files
  for each row execute function public.app_notify_drive();
