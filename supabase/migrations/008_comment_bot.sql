-- ============================================================
-- OpenCraft Centralized — Comment Bot Schema
--
-- Implements the data model for the social-media reply bot
-- (previously SQLite-backed). Three tables:
--   * replies       — one row per discovered+drafted reply
--   * brand_profile — single JSONB row (editable from web UI)
--   * bot_commands  — UI-issued commands polled by the bot
--
-- RLS strategy:
--   * authenticated users can SELECT all three tables
--   * authenticated users can INSERT into bot_commands (trigger scrape/post)
--   * all writes to replies and brand_profile go through server-side
--     API routes using the service-role key (bypasses RLS)
-- ============================================================

-- ── replies — one row per discovered viral post ─────────────
create table replies (
  id                  bigint generated always as identity primary key,

  -- source platform
  platform            text not null
                        check (platform in ('threads', 'x')),
  account_username    text not null,

  -- the post we're replying to
  parent_post_id      text not null,
  parent_post_url     text,
  parent_post_text    text,
  parent_author       text,
  parent_likes        integer,
  parent_replies      integer,
  parent_created_at   timestamptz,

  -- our reply
  reply_mode          text,   -- agree_and_extend | polite_contrarian | concrete_example | ask_sharpening_question | translate_to_outcome
  draft_text          text,   -- AI-generated draft
  final_text          text,   -- approved + posted text (may differ from draft)
  reply_platform_id   text,   -- ID returned by Threads/X for our posted reply
  reply_url           text,   -- live permalink to our reply

  -- state machine
  status              text not null default 'scraped'
                        check (status in ('scraped','ready_for_review','approved','posted','failed','skipped')),
  error               text,
  note                text,   -- scraper metadata (e.g. "keyword=claude code")

  -- timestamps
  scraped_at          timestamptz not null default now(),
  drafted_at          timestamptz,
  approved_at         timestamptz,
  posted_at           timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- prevent duplicate replies to the same post from the same account
create unique index idx_replies_dedup
  on replies (platform, account_username, parent_post_id);

create index idx_replies_status       on replies (status);
create index idx_replies_platform     on replies (platform, status);
create index idx_replies_scraped_at   on replies (scraped_at desc);
create index idx_replies_posted_at    on replies (posted_at desc nulls last);

create trigger handle_updated_at_replies
  before update on replies
  for each row execute procedure extensions.moddatetime(updated_at);

-- ── brand_profile — single JSONB row per brand ──────────────
-- The web UI reads and writes this row. The bot reads it on
-- startup instead of loading brand-profile.json from disk.
create table brand_profile (
  id          bigint generated always as identity primary key,
  slug        text not null unique default 'opencraft',
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  updated_by  text                  -- user email who last saved
);

create trigger handle_updated_at_brand_profile
  before update on brand_profile
  for each row execute procedure extensions.moddatetime(updated_at);

-- Seed with a placeholder row — the UI will populate it on first save.
insert into brand_profile (slug, data) values ('opencraft', '{}'::jsonb)
  on conflict (slug) do nothing;

-- ── bot_commands — UI-issued work orders polled by bot ──────
-- The web UI inserts a row here; the bot polls for 'pending'
-- rows, sets status='running', executes, then marks 'done'/'failed'.
create table bot_commands (
  id            bigint generated always as identity primary key,
  command       text not null
                  check (command in ('scrape', 'post_approved', 'draft')),
  platform      text
                  check (platform in ('threads', 'x', 'all')),
  status        text not null default 'pending'
                  check (status in ('pending', 'running', 'done', 'failed')),
  context       jsonb,          -- optional extra params (e.g. keywords override)
  requested_by  text,           -- user email
  error         text,
  created_at    timestamptz not null default now(),
  started_at    timestamptz,
  finished_at   timestamptz
);

create index idx_bot_commands_status     on bot_commands (status, created_at desc);
create index idx_bot_commands_created_at on bot_commands (created_at desc);

-- ============================================================
-- Row-Level Security
-- ============================================================
alter table replies       enable row level security;
alter table brand_profile enable row level security;
alter table bot_commands  enable row level security;

-- Authenticated dashboard users can read everything
create policy "viewers read replies"       on replies       for select using (auth.uid() is not null);
create policy "viewers read brand_profile" on brand_profile for select using (auth.uid() is not null);
create policy "viewers read bot_commands"  on bot_commands  for select using (auth.uid() is not null);

-- Authenticated users can insert bot_commands (to trigger scrape/post)
-- All other writes (approve/skip on replies, brand_profile updates) go
-- through server-side API routes using the service-role key.
create policy "users insert bot_commands"  on bot_commands  for insert with check (auth.uid() is not null);
