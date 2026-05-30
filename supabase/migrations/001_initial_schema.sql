-- ============================================================
-- OpenCraft Web App — Initial Schema
-- Migrated from SQLite (better-sqlite3) to Supabase Postgres
-- ============================================================

-- Extensions
create extension if not exists moddatetime schema extensions;

-- ── content_posts ───────────────────────────────────────────
create table content_posts (
  id                   bigint generated always as identity primary key,
  user_id              uuid not null references auth.users(id) on delete cascade,
  type                 text not null check (type in ('engage','educate','video')),
  status               text not null default 'draft'
                         check (status in ('draft','accepted','scheduled','published','failed')),
  date_slot            text not null,
  scheduled_at         text,
  published_at         text,
  text_content         text,
  image_path           text,
  video_path           text,
  headline             text,
  captions_json        text,
  hashtags_json        text,
  source_json          text,
  user_feedback        text,
  publish_results_json text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index idx_posts_date_slot on content_posts(date_slot);
create index idx_posts_status on content_posts(status);
create index idx_posts_user on content_posts(user_id);
create index idx_posts_scheduled on content_posts(scheduled_at)
  where scheduled_at is not null;

alter table content_posts enable row level security;

create policy "Users manage their own posts"
  on content_posts for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create trigger handle_updated_at_posts
  before update on content_posts
  for each row execute procedure extensions.moddatetime(updated_at);

-- ── weekly_template ─────────────────────────────────────────
create table weekly_template (
  day_of_week   integer not null check (day_of_week between 0 and 6),
  user_id       uuid not null references auth.users(id) on delete cascade,
  content_type  text not null check (content_type in ('engage','educate','video','off')),
  updated_at    timestamptz not null default now(),
  primary key (user_id, day_of_week)
);

alter table weekly_template enable row level security;

create policy "Users manage their own template"
  on weekly_template for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create trigger handle_updated_at_template
  before update on weekly_template
  for each row execute procedure extensions.moddatetime(updated_at);

-- ── generation_jobs ─────────────────────────────────────────
create table generation_jobs (
  id            bigint generated always as identity primary key,
  post_id       bigint not null references content_posts(id) on delete cascade,
  status        text not null default 'pending'
                  check (status in ('pending','running','completed','failed')),
  video_id      text,
  current_step  text,
  progress_pct  integer default 0,
  log_text      text,
  error_msg     text,
  started_at    text,
  completed_at  text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index idx_jobs_post_id on generation_jobs(post_id);
create index idx_jobs_status on generation_jobs(status);

alter table generation_jobs enable row level security;

-- Jobs are accessible if user owns the parent post
create policy "Users can manage jobs for their posts"
  on generation_jobs for all
  using (
    exists (
      select 1 from content_posts
      where content_posts.id = generation_jobs.post_id
        and content_posts.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from content_posts
      where content_posts.id = generation_jobs.post_id
        and content_posts.user_id = auth.uid()
    )
  );

create trigger handle_updated_at_jobs
  before update on generation_jobs
  for each row execute procedure extensions.moddatetime(updated_at);

-- ── Storage bucket ──────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('media', 'media', false);

create policy "Users upload to their own folder"
  on storage.objects for insert
  with check (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Authenticated users can read all media"
  on storage.objects for select
  using (bucket_id = 'media' and auth.uid() is not null);

create policy "Users delete their own files"
  on storage.objects for delete
  using (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
