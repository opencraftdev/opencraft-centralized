-- When someone @-tags a teammate in a task's Diskusi, a card also lands in Chat Tim, in the conversation between the
-- two of them: "Bagas menandai kamu di [task]". Stored as a team_messages row whose body starts with
-- "[[mention:<task id>]]" followed by a short plain copy of the comment. Safe to run more than once.

create or replace function public.team_chat_on_mention() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_author text := lower(coalesce(new.author_email, ''));
  v_snip text;
  v_id uuid;
  v_email text;
begin
  if v_author = '' then
    return null;
  end if;
  v_snip := new.body;
  v_snip := regexp_replace(v_snip, '^\[\[reply:[0-9a-f-]+\]\]\s*', '');
  v_snip := regexp_replace(v_snip, '@\[([^\]]+)\]\((member|task|project):[0-9a-f-]+\)', '@\1', 'g');
  v_snip := regexp_replace(v_snip, '\[\[file:[0-9a-f-]+\]\]', ' ', 'g');
  v_snip := regexp_replace(v_snip, '\[/?(b|i|u|c)(=#[0-9a-fA-F]{6})?\]', '', 'g');
  v_snip := left(btrim(regexp_replace(v_snip, '\s+', ' ', 'g')), 200);

  for v_id in
    select distinct (m[1])::uuid from regexp_matches(new.body, '@\[[^\]]+\]\(member:([0-9a-f-]{36})\)', 'g') as m
  loop
    select lower(email) into v_email from public.task_members where id = v_id;
    if v_email is not null and v_email <> '' and v_email <> v_author then
      insert into public.team_messages (thread, author_email, body)
      values (
        array_to_string(array(select unnest(array[v_author, v_email]) order by 1), '|'),
        v_author,
        '[[mention:' || new.task_id || ']]' || case when v_snip <> '' then E'\n' || v_snip else '' end
      );
    end if;
  end loop;
  return null;
end $$;

drop trigger if exists team_chat_on_mention on public.task_comments;
create trigger team_chat_on_mention after insert on public.task_comments
  for each row execute function public.team_chat_on_mention();
