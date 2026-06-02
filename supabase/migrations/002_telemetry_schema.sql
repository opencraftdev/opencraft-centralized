-- ============================================================
-- OpenCraft Centralized — Telemetry / Monitoring Schema
-- Additive migration: lives alongside the seed app's
-- content_posts / generation_jobs tables.
--
-- Implements the data model in docs/DATA-MODEL.md plus a
-- document-history table (agent_documents) for the Document Agent,
-- which records every generated document and where it is stored
-- (S3 primary, optional Supabase Storage).
--
-- Read-only by design (docs/ARCHITECTURE.md):
--   * Dashboard role (authenticated) — SELECT only.
--   * All writes happen server-side in /api/ingest/* using the
--     service-role key, after validating a per-agent API key.
-- ============================================================

create extension if not exists moddatetime schema extensions;

-- ── agents — the registry ───────────────────────────────────
create table agents (
  id                   bigint generated always as identity primary key,
  slug                 text not null unique,
  name                 text not null,
  kind                 text not null
                         check (kind in ('social-media','document','comment-bot','blogpost')),
  repo_url             text,
  heartbeat_interval_s integer not null default 300,
  degraded_below       numeric not null default 0.80,
  -- sha256 hex of the agent's ingestion API key. NULL = ingestion disabled.
  -- Set via: encode(digest('<raw-key>','sha256'),'hex')
  api_key_hash         text,
  last_heartbeat_at    timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create trigger handle_updated_at_agents
  before update on agents
  for each row execute procedure extensions.moddatetime(updated_at);

-- ── agent_runs — one row per unit of work ───────────────────
create table agent_runs (
  id              bigint generated always as identity primary key,
  agent_id        bigint not null references agents(id) on delete cascade,
  external_id     text,
  status          text not null default 'running'
                    check (status in ('running','succeeded','failed')),
  items_processed integer not null default 0,
  duration_ms     integer,
  error_msg       text,
  started_at      timestamptz not null default now(),
  finished_at     timestamptz,
  created_at      timestamptz not null default now()
);

create index idx_runs_agent_started on agent_runs(agent_id, started_at desc);
create index idx_runs_agent_status  on agent_runs(agent_id, status);
-- Lets the ingestion API dedupe / finish a run by the agent's own id.
-- Plain (non-partial) unique index so PostgREST/supabase-js upserts can infer
-- it for ON CONFLICT. NULL external_ids stay distinct, so they don't collide.
create unique index idx_runs_agent_external on agent_runs(agent_id, external_id);

-- ── agent_metrics — generic time-series ─────────────────────
create table agent_metrics (
  id          bigint generated always as identity primary key,
  agent_id    bigint not null references agents(id) on delete cascade,
  run_id      bigint references agent_runs(id) on delete set null,
  metric_key  text not null,
  value       numeric not null,
  labels      jsonb,
  recorded_at timestamptz not null default now()
);

create index idx_metrics_agent_key on agent_metrics(agent_id, metric_key, recorded_at desc);

-- ── agent_events — discrete events / log lines ──────────────
create table agent_events (
  id         bigint generated always as identity primary key,
  agent_id   bigint not null references agents(id) on delete cascade,
  run_id     bigint references agent_runs(id) on delete set null,
  level      text not null default 'info'
               check (level in ('info','warning','error')),
  message    text not null,
  context    jsonb,
  created_at timestamptz not null default now()
);

create index idx_events_agent_created on agent_events(agent_id, created_at desc);
create index idx_events_agent_level   on agent_events(agent_id, level);

-- ── agent_documents — Document Agent history ────────────────
-- One row per document the Document Agent produced. Records the
-- document's metadata and where the artifact lives. S3 is the
-- primary store (s3_bucket + s3_key + s3_region); Supabase Storage
-- (storage_bucket + storage_path) and a plain file_url are optional
-- alternates. The dashboard reads this for the "Documents" history
-- and builds a (presigned) link to view/download.
create table agent_documents (
  id             bigint generated always as identity primary key,
  agent_id       bigint not null references agents(id) on delete cascade,
  run_id         bigint references agent_runs(id) on delete set null,
  external_id    text,                       -- the agent's own document id (dedupe / upsert)
  title          text not null,
  doc_type       text,                       -- format/template: pdf | docx | md | html | ...
  tool           text,                       -- requesting internal tool
  status         text not null default 'generated'
                   check (status in ('generated','failed','pending')),
  word_count     integer,
  size_bytes     bigint,
  duration_ms    integer,
  -- S3 (primary)
  s3_bucket      text,
  s3_key         text,
  s3_region      text,
  -- Supabase Storage (optional alternate)
  storage_bucket text,
  storage_path   text,
  -- Plain stored URL (optional; used as-is if no presigning configured)
  file_url       text,
  error_msg      text,
  metadata       jsonb,
  generated_at   timestamptz not null default now(),
  created_at     timestamptz not null default now()
);

create index idx_docs_agent_generated on agent_documents(agent_id, generated_at desc);
create index idx_docs_agent_status    on agent_documents(agent_id, status);
create index idx_docs_tool            on agent_documents(agent_id, tool);
-- Plain unique index (not partial) so upserts can infer it for ON CONFLICT.
create unique index idx_docs_agent_external on agent_documents(agent_id, external_id);

-- ============================================================
-- Row-Level Security — dashboard reads, agents write via API.
-- ============================================================
alter table agents          enable row level security;
alter table agent_runs      enable row level security;
alter table agent_metrics   enable row level security;
alter table agent_events    enable row level security;
alter table agent_documents enable row level security;

create policy "viewers read agents"    on agents          for select using (auth.uid() is not null);
create policy "viewers read runs"      on agent_runs      for select using (auth.uid() is not null);
create policy "viewers read metrics"   on agent_metrics   for select using (auth.uid() is not null);
create policy "viewers read events"    on agent_events    for select using (auth.uid() is not null);
create policy "viewers read documents" on agent_documents for select using (auth.uid() is not null);
-- No insert/update/delete policies → the dashboard role cannot write.
-- The service-role key used by /api/ingest/* bypasses RLS.

-- ============================================================
-- Derived views — keep aggregation logic in one place.
-- ============================================================

-- agent_status: registry + computed live status from heartbeat & 24h success rate.
create view agent_status
with (security_invoker = true) as
select
  a.id,
  a.slug,
  a.name,
  a.kind,
  a.repo_url,
  a.heartbeat_interval_s,
  a.degraded_below,
  a.last_heartbeat_at,
  coalesce(r.runs_24h, 0)        as runs_24h,
  coalesce(r.succeeded_24h, 0)   as succeeded_24h,
  coalesce(r.failed_24h, 0)      as failed_24h,
  r.success_rate_24h,
  case
    when a.last_heartbeat_at is null then 'unknown'
    when a.last_heartbeat_at < now() - (a.heartbeat_interval_s * 2 || ' seconds')::interval then 'offline'
    when r.success_rate_24h is not null and r.success_rate_24h < a.degraded_below then 'degraded'
    else 'online'
  end as status
from agents a
left join lateral (
  select
    count(*)                                          as runs_24h,
    count(*) filter (where status = 'succeeded')      as succeeded_24h,
    count(*) filter (where status = 'failed')         as failed_24h,
    case
      when count(*) filter (where status in ('succeeded','failed')) = 0 then null
      else (count(*) filter (where status = 'succeeded'))::numeric
           / count(*) filter (where status in ('succeeded','failed'))
    end as success_rate_24h
  from agent_runs
  where agent_id = a.id
    and started_at >= now() - interval '24 hours'
) r on true;

-- agent_daily_throughput: runs rolled up by day (last 30 days).
create view agent_daily_throughput
with (security_invoker = true) as
select
  agent_id,
  date_trunc('day', started_at) as day,
  count(*)                                       as runs,
  count(*) filter (where status = 'succeeded')   as succeeded,
  count(*) filter (where status = 'failed')      as failed,
  sum(items_processed)                           as items_processed,
  avg(duration_ms)                               as avg_duration_ms
from agent_runs
where started_at >= now() - interval '30 days'
group by agent_id, date_trunc('day', started_at);

-- ============================================================
-- Seed the agent registry (from docs/AGENTS.md).
-- api_key_hash is left NULL — set each agent's key before it can
-- ingest, e.g.:
--   update agents set api_key_hash = encode(digest('PLAINTEXT_KEY','sha256'),'hex')
--   where slug = 'document-agent';
-- (digest() requires pgcrypto: create extension if not exists pgcrypto;)
-- ============================================================
insert into agents (slug, name, kind, repo_url, heartbeat_interval_s) values
  ('social-media-automation', 'Social Media Automation', 'social-media', null, 300),
  ('document-agent',          'Document Agent',          'document',     'https://github.com/opencraftdev/document-agent', 300),
  ('comment-bot',             'Comment Bot',             'comment-bot',  null, 300),
  ('blogpost-automation',     'Blogpost Automation',     'blogpost',     null, 300)
on conflict (slug) do nothing;
