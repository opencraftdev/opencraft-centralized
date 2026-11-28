-- A task can have more than one PIC and more than one project. pic_ids / project_ids hold all of them (first = main);
-- assignee_id / project_id stay in sync with the first one so older code and the notification triggers keep working.
-- Safe to run more than once.

alter table public.tasks add column if not exists pic_ids uuid[] not null default '{}';
alter table public.tasks add column if not exists project_ids uuid[] not null default '{}';

update public.tasks set pic_ids = array[assignee_id]
 where assignee_id is not null and coalesce(array_length(pic_ids, 1), 0) = 0;
update public.tasks set project_ids = array[project_id]
 where project_id is not null and coalesce(array_length(project_ids, 1), 0) = 0;

-- Notifications (028): "<Name> jadi PIC" for every person newly added as PIC (instead of only assignee_id).
create or replace function public.app_notify_task_pics() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_parent text;
  v_project text;
  v_id uuid;
  v_who text;
begin
  if new.pic_ids is not distinct from old.pic_ids then
    return null;
  end if;
  select title into v_parent from public.tasks where id = new.parent_id;
  select name into v_project from public.task_projects where id = new.project_id;
  foreach v_id in array new.pic_ids loop
    -- the new main PIC is already announced by app_notify_tasks (assignee_id change)
    if not (v_id = any (old.pic_ids)) and v_id is distinct from old.assignee_id
       and not (v_id = new.assignee_id and new.assignee_id is distinct from old.assignee_id) then
      select name into v_who from public.task_members where id = v_id;
      perform public.app_notify('tasks', 'task_assigned', coalesce(v_who, 'Seseorang') || ' jadi PIC "' || new.title || '"',
        coalesce(v_parent, v_project, ''), '/tasks?task=' || new.id, new.id, 5);
    end if;
  end loop;
  return null;
end $$;
drop trigger if exists app_notify_task_pics on public.tasks;
create trigger app_notify_task_pics after update of pic_ids on public.tasks
  for each row execute function public.app_notify_task_pics();
