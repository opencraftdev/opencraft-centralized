-- ============================================================
-- OpenCraft Centralized — AI News Brief
-- Additive migration for the "AI News Brief" video-materials agent.
--
-- A local Python runner (agents/video-materials/) fetches top AI
-- news picks, generates a <=2-minute video brief (script + caption
-- + thumbnail) via the Claude Code subscription, renders a 1280x720
-- thumbnail PNG, and writes the result here using the service-role
-- key — exactly how the Document Agent / tutorial-video pipeline
-- already push.
--
-- Consistent with the read-only design (same shape as 003_tutorial_videos):
--   * Dashboard role (authenticated) — SELECT only.
--   * All writes happen via the service-role key (bypasses RLS).
-- ============================================================

create extension if not exists pgcrypto;                 -- gen_random_uuid()
create extension if not exists moddatetime schema extensions;

create table news_briefs (
  id             uuid primary key default gen_random_uuid(),
  title          text,
  presenter_id   text not null,
  presenter_name text not null,
  picks          jsonb not null,        -- NewsPick[]  [{title,url,source,score,summary}]
  script         jsonb not null,        -- {hook, segments[], outro, total_words, est_seconds}
  caption        jsonb not null,        -- {text, hashtags[]}
  thumbnail      jsonb not null,        -- {headline, subtext}
  thumbnail_url  text,                  -- public URL in the news-thumbnails bucket
  est_seconds    numeric,
  source         text default 'video-materials',  -- which agent produced it
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index idx_news_briefs_created on news_briefs(created_at desc);

create trigger handle_updated_at_news_briefs
  before update on news_briefs
  for each row execute procedure extensions.moddatetime(updated_at);

-- ── Row-Level Security — dashboard reads, agent writes via service-role ──
alter table news_briefs enable row level security;

create policy "viewers read news briefs"
  on news_briefs for select
  using (auth.uid() is not null);
-- No insert/update/delete policies → the dashboard role cannot write.
-- The service-role key used by the video-materials agent bypasses RLS.

-- ── Storage bucket: news-thumbnails (public-read) ──
-- Public read so the dashboard <img src=thumbnail_url> works without signing.
-- The agent uploads <brief-id>.png with the service-role key (bypasses RLS).
insert into storage.buckets (id, name, public)
values ('news-thumbnails', 'news-thumbnails', true)
on conflict (id) do nothing;
