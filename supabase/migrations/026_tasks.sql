-- Task Management (/tasks). Contract: docs/TASKS.md.
-- Not applied yet. Apply in the Supabase SQL editor (or `supabase db push`) before using /tasks.

-- ── Team members (people tasks are assigned to; not tied to login accounts) ──
create table public.task_members (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  initials text not null default '',          -- shown in the avatar (1–2 letters)
  role text not null default '',              -- e.g. "Lead · Bisnis"
  color text not null default '#C2E7FF',      -- avatar background
  email text unique check (email is null or email = lower(email)),  -- optional: matches the login for "Tugas saya"
  goal text not null default '',              -- expected outcome, e.g. "NIB, daftar harga, akun toko"
  sort integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ── Projects (group of tasks: Remeh, Keychain, Bisnis, …) ──
create table public.task_projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  label text not null default '',             -- small tag, e.g. "Supporting", "V1"
  color text not null default '#0B57D0',      -- bar / chip color
  status text not null default 'active' check (status in ('active','parked','done')),
  sort integer not null default 0,
  created_at timestamptz not null default now()
);

-- ── Tasks (parent_id set = a checklist item / subtask of another task) ──
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.task_projects(id) on delete set null,
  parent_id uuid references public.tasks(id) on delete cascade,
  title text not null check (btrim(title) <> ''),
  description text not null default '',
  status text not null default 'todo' check (status in ('todo','in_progress','review','done')),
  priority text not null default 'medium' check (priority in ('low','medium','high','urgent')),
  assignee_id uuid references public.task_members(id) on delete set null,   -- PIC
  helper_ids uuid[] not null default '{}',                                   -- "dibantu"
  start_date date,
  due_date date,                                                             -- deadline
  is_milestone boolean not null default false,                               -- one-day event (diamond on the timeline)
  is_optional boolean not null default false,                                -- "kalau perlu" (hatched on the timeline)
  sort double precision not null default 0,
  completed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (start_date is null or due_date is null or start_date <= due_date)
);
create index on public.tasks (parent_id);
create index on public.tasks (assignee_id);
create index on public.tasks (due_date);

create table public.task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  body text not null check (btrim(body) <> ''),
  author_email text default lower(auth.jwt() ->> 'email'),
  created_at timestamptz not null default now()
);
create index on public.task_comments (task_id, created_at);

-- updated_at + completed_at bookkeeping
create or replace function public.tasks_touch() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  if new.status = 'done' and (tg_op = 'INSERT' or old.status is distinct from 'done') then
    new.completed_at := now();
  elsif new.status <> 'done' then
    new.completed_at := null;
  end if;
  return new;
end $$;
create trigger tasks_touch before insert or update on public.tasks
  for each row execute function public.tasks_touch();

-- RLS: every allow-listed user (the whole team) can read and edit everything.
alter table public.task_members enable row level security;
alter table public.task_projects enable row level security;
alter table public.tasks enable row level security;
alter table public.task_comments enable row level security;
create policy task_members_allowed on public.task_members for all to authenticated
  using (public.is_allowed_user()) with check (public.is_allowed_user());
create policy task_projects_allowed on public.task_projects for all to authenticated
  using (public.is_allowed_user()) with check (public.is_allowed_user());
create policy tasks_allowed on public.tasks for all to authenticated
  using (public.is_allowed_user()) with check (public.is_allowed_user());
create policy task_comments_allowed on public.task_comments for all to authenticated
  using (public.is_allowed_user()) with check (public.is_allowed_user());

-- Live updates for everyone looking at /tasks
alter publication supabase_realtime add table public.tasks, public.task_comments, public.task_members, public.task_projects;

-- ── Seed: "Timeline IoT — rencana kerja per 22 November 2026" ──
-- Minggu 1 = 23–29 Nov · Minggu 2 = 30 Nov–6 Des · Minggu 3 = 7–13 Des · Minggu 4 = 14–20 Des
do $$
declare
  raka uuid; bagas uuid; rafi uuid; depras uuid;
  p_remeh uuid; p_key uuid; p_bis uuid;
  t uuid;
begin
  insert into public.task_members (name, initials, role, color, goal, sort) values
    ('Raka',   'RK', 'Lead · Bisnis',      '#1B2533', 'NIB, daftar harga, akun toko', 1) returning id into raka;
  insert into public.task_members (name, initials, role, color, goal, sort) values
    ('Bagas',  'B', 'Desain · Branding',  '#D9F2A6', 'List vendor, nama, brand kit', 2) returning id into bagas;
  insert into public.task_members (name, initials, role, color, goal, sort) values
    ('Rafi',   'RF', 'IoT · R&D',          '#A8C7FA', 'Prototipe IoT Keychain', 3) returning id into rafi;
  insert into public.task_members (name, initials, role, color, goal, sort) values
    ('Depras', 'D', 'Software',           '#C4EEF2', 'Landing page online (+ aplikasi kalau perlu)', 4) returning id into depras;

  insert into public.task_projects (name, label, color, sort) values ('Remeh', 'Supporting', '#C0453A', 1) returning id into p_remeh;
  insert into public.task_projects (name, label, color, sort) values ('Keychain', 'V1', '#0B57D0', 2) returning id into p_key;
  insert into public.task_projects (name, label, color, sort) values ('Bisnis', '', '#1B2533', 3) returning id into p_bis;
  insert into public.task_projects (name, label, color, status, sort) values ('Nyamo', 'V2', '#80868B', 'parked', 4);

  -- Remeh
  insert into public.tasks (project_id, title, assignee_id, helper_ids, start_date, due_date, status, sort)
  values (p_remeh, 'Vendor 3D · Remeh & Keychain', bagas, array[rafi], '2026-11-23', '2026-11-29', 'in_progress', 1) returning id into t;
  insert into public.tasks (project_id, parent_id, title, assignee_id, helper_ids, start_date, due_date, sort) values
    (p_remeh, t, 'Riset vendor 3D Remeh & Keychain', bagas, array[rafi], '2026-11-23', '2026-11-29', 1),
    (p_remeh, t, 'Bantu riset vendor 3D', rafi, '{}', '2026-11-23', '2026-11-29', 2);

  insert into public.tasks (project_id, title, description, assignee_id, helper_ids, start_date, due_date, is_milestone, priority, sort)
  values (p_remeh, 'Diskusi: lanjut jual Remeh?', 'Semua tim · cetak sendiri atau vendor.', raka, array[bagas, rafi, depras],
          '2026-11-30', '2026-11-30', true, 'high', 2) returning id into t;
  insert into public.tasks (project_id, parent_id, title, assignee_id, start_date, due_date, sort) values
    (p_remeh, t, 'Pimpin diskusi Remeh', raka, '2026-11-30', '2026-11-30', 1);

  -- Keychain
  insert into public.tasks (project_id, title, assignee_id, helper_ids, start_date, due_date, status, priority, sort)
  values (p_key, 'R&D IoT', rafi, array[raka], '2026-11-23', '2026-12-13', 'in_progress', 'high', 3) returning id into t;
  insert into public.tasks (project_id, parent_id, title, assignee_id, start_date, due_date, sort) values
    (p_key, t, 'R&D IoT Keychain di mesin', rafi, '2026-11-23', '2026-12-13', 1),
    (p_key, t, 'Prototipe yang bisa jalan', rafi, '2026-11-23', '2026-12-13', 2),
    (p_key, t, 'Kalau butuh aplikasi: tulis kebutuhannya untuk Depras', rafi, '2026-11-23', '2026-12-13', 3),
    (p_key, t, 'Bantu Rafi di R&D IoT', raka, '2026-11-23', '2026-12-20', 4);

  insert into public.tasks (project_id, title, assignee_id, helper_ids, start_date, due_date, status, sort)
  values (p_key, 'Branding · nama & desain', bagas, array[raka], '2026-11-23', '2026-12-06', 'in_progress', 4) returning id into t;
  insert into public.tasks (project_id, parent_id, title, assignee_id, helper_ids, start_date, due_date, sort) values
    (p_key, t, 'Nama Keychain', bagas, array[raka], '2026-11-23', '2026-12-06', 1),
    (p_key, t, 'Logo & warna brand', bagas, '{}', '2026-11-23', '2026-12-06', 2),
    (p_key, t, 'Desain produk Keychain', bagas, '{}', '2026-11-23', '2026-12-06', 3),
    (p_key, t, 'Bantu Bagas: nama & brand Keychain', raka, '{}', '2026-11-23', '2026-12-06', 4);

  insert into public.tasks (project_id, title, assignee_id, helper_ids, start_date, due_date, is_optional, sort)
  values (p_key, 'Aplikasi (kalau perlu)', depras, array[raka], '2026-11-30', '2026-12-20', true, 5) returning id into t;
  insert into public.tasks (project_id, parent_id, title, assignee_id, start_date, due_date, sort) values
    (p_key, t, 'Tanya Rafi: butuh aplikasi apa?', depras, '2026-11-30', '2026-12-20', 1),
    (p_key, t, 'Kalau perlu: bikin aplikasinya', depras, '2026-11-30', '2026-12-20', 2);

  insert into public.tasks (project_id, title, description, assignee_id, helper_ids, start_date, due_date, status, sort)
  values (p_key, 'Landing page', 'Minggu 1–2 kerangka, minggu 3–4 pasang branding dari Bagas.', depras, array[bagas, raka],
          '2026-11-23', '2026-12-20', 'in_progress', 6) returning id into t;
  insert into public.tasks (project_id, parent_id, title, assignee_id, start_date, due_date, sort) values
    (p_key, t, 'Siapkan repo & kerangka halaman', depras, '2026-11-23', '2026-12-06', 1),
    (p_key, t, 'Bikin form pemesanan', depras, '2026-11-23', '2026-12-06', 2),
    (p_key, t, 'Serahkan brand ke Depras untuk landing page', bagas, '2026-12-07', '2026-12-20', 3),
    (p_key, t, 'Pasang nama & desain dari Bagas', depras, '2026-12-07', '2026-12-20', 4),
    (p_key, t, 'Online + kirim link ke Raka', depras, '2026-12-07', '2026-12-20', 5),
    (p_key, t, 'Bantu & cek progres Depras', raka, '2026-11-23', '2026-12-20', 6);

  -- Bisnis
  insert into public.tasks (project_id, title, assignee_id, start_date, due_date, sort)
  values (p_bis, 'Kompetitor & harga', raka, '2026-11-23', '2026-12-06', 7) returning id into t;
  insert into public.tasks (project_id, parent_id, title, assignee_id, start_date, due_date, sort) values
    (p_bis, t, 'Riset kompetitor & harga Remeh + Keychain', raka, '2026-11-23', '2026-12-06', 1);

  insert into public.tasks (project_id, title, assignee_id, start_date, due_date, priority, sort)
  values (p_bis, 'NIB', raka, '2026-11-23', '2026-12-06', 'high', 8) returning id into t;
  insert into public.tasks (project_id, parent_id, title, assignee_id, start_date, due_date, sort) values
    (p_bis, t, 'Urus NIB', raka, '2026-11-23', '2026-12-06', 1);

  insert into public.tasks (project_id, title, assignee_id, start_date, due_date, sort)
  values (p_bis, 'Buka marketplace', raka, '2026-11-30', '2026-12-13', 9) returning id into t;
  insert into public.tasks (project_id, parent_id, title, assignee_id, start_date, due_date, sort) values
    (p_bis, t, 'Buka akun marketplace', raka, '2026-11-30', '2026-12-13', 1);
end $$;
