-- ============================================================
-- OpenCraft Centralized — Record Tutorial Video
-- Additive migration for the "Record Tutorial Video" feature
-- under Social Media Automated.
--
-- One row per processed tutorial: the user uploads a recording
-- (straight to Cloudinary), we kick off an eager render that
-- overlays their name + the logo on the opening and splices a
-- fixed outro onto the end, then store the finished MP4 URL.
--
-- Consistent with the read-only design (docs/ARCHITECTURE.md):
--   * Dashboard role (authenticated) — SELECT only.
--   * All writes happen server-side in /api/tutorial-video/*
--     using the service-role key.
-- ============================================================

create extension if not exists pgcrypto;                 -- gen_random_uuid()
create extension if not exists moddatetime schema extensions;

create table tutorial_videos (
  id                uuid primary key default gen_random_uuid(),
  user_email        text,
  name_text         text not null,            -- the bottom-left name overlay
  source_public_id  text not null,            -- Cloudinary id of the raw upload
  output_url        text,                     -- finished MP4 (set when render done)
  status            text not null default 'processing'
                      check (status in ('processing','done','failed')),
  error             text,
  duration_seconds  numeric,                  -- source duration (from upload response)
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index idx_tutorial_videos_created on tutorial_videos(created_at desc);
create index idx_tutorial_videos_source  on tutorial_videos(source_public_id);
create index idx_tutorial_videos_status  on tutorial_videos(status);

create trigger handle_updated_at_tutorial_videos
  before update on tutorial_videos
  for each row execute procedure extensions.moddatetime(updated_at);

-- ── Row-Level Security — dashboard reads, server writes via API ──
alter table tutorial_videos enable row level security;

create policy "viewers read tutorial videos"
  on tutorial_videos for select
  using (auth.uid() is not null);
-- No insert/update/delete policies → the dashboard role cannot write.
-- The service-role key used by /api/tutorial-video/* bypasses RLS.
