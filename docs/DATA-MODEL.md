# Data Model — Metrics Store

The shared metrics store is a Supabase Postgres database. This document defines the **telemetry
tables** the dashboard reads from and agents write to. It follows the conventions already used in
[`supabase/migrations/001_initial_schema.sql`](../supabase/migrations/001_initial_schema.sql):
`bigint generated always as identity` PKs, `timestamptz` timestamps, RLS enabled, and
`moddatetime` triggers for `updated_at`.

> These tables are **additive** — they live alongside (or eventually replace) the seed app's
> `content_posts` / `generation_jobs` tables. Ship them as a new migration, e.g.
> `002_telemetry_schema.sql`.

## Tables

### `agents` — the registry

One row per monitored agent.

| Column | Type | Notes |
|---|---|---|
| `id` | `bigint` PK | identity |
| `slug` | `text` unique | stable id used in URLs & ingestion (`social-media-automation`) |
| `name` | `text` | display name |
| `kind` | `text` | `social-media` \| `document` \| `comment-bot` \| `blogpost` |
| `repo_url` | `text` | link to the agent's repository |
| `heartbeat_interval_s` | `integer` | expected seconds between heartbeats (default 300) |
| `degraded_below` | `numeric` | success-rate threshold for `degraded` (default 0.80) |
| `last_heartbeat_at` | `timestamptz` | updated on each heartbeat |
| `created_at` / `updated_at` | `timestamptz` | |

### `agent_runs` — one row per unit of work

| Column | Type | Notes |
|---|---|---|
| `id` | `bigint` PK | identity |
| `agent_id` | `bigint` FK → `agents(id)` | |
| `external_id` | `text` | the agent's own job/run id (optional, for dedupe) |
| `status` | `text` | `running` \| `succeeded` \| `failed` |
| `items_processed` | `integer` | throughput contribution (default 0) |
| `duration_ms` | `integer` | filled when the run finishes |
| `error_msg` | `text` | populated on failure |
| `started_at` | `timestamptz` | |
| `finished_at` | `timestamptz` | null while running |
| `created_at` | `timestamptz` | |

Indexes: `(agent_id, started_at desc)`, `(agent_id, status)`.

### `agent_metrics` — generic time-series for specific metrics

A flexible key/value/time table so new metrics need **no schema change**.

| Column | Type | Notes |
|---|---|---|
| `id` | `bigint` PK | identity |
| `agent_id` | `bigint` FK → `agents(id)` | |
| `run_id` | `bigint` FK → `agent_runs(id)` | nullable; links a metric to a run |
| `metric_key` | `text` | e.g. `posts_published`, `parse_success_rate` |
| `value` | `numeric` | the number |
| `labels` | `jsonb` | optional dimensions, e.g. `{"platform":"instagram"}` |
| `recorded_at` | `timestamptz` | when it was true |

Indexes: `(agent_id, metric_key, recorded_at desc)`.

### `agent_events` — discrete events / log lines

| Column | Type | Notes |
|---|---|---|
| `id` | `bigint` PK | identity |
| `agent_id` | `bigint` FK → `agents(id)` | |
| `run_id` | `bigint` FK → `agent_runs(id)` | nullable |
| `level` | `text` | `info` \| `warning` \| `error` |
| `message` | `text` | human-readable |
| `context` | `jsonb` | optional structured detail |
| `created_at` | `timestamptz` | |

Indexes: `(agent_id, created_at desc)`, `(agent_id, level)`.

## Reference migration (sketch)

```sql
-- 002_telemetry_schema.sql
create extension if not exists moddatetime schema extensions;

create table agents (
  id                   bigint generated always as identity primary key,
  slug                 text not null unique,
  name                 text not null,
  kind                 text not null
                         check (kind in ('social-media','document','comment-bot','blogpost')),
  repo_url             text,
  heartbeat_interval_s integer not null default 300,
  degraded_below       numeric not null default 0.80,
  last_heartbeat_at    timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create trigger handle_updated_at_agents
  before update on agents
  for each row execute procedure extensions.moddatetime(updated_at);

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
```

## Row-Level Security

The principle from [ARCHITECTURE.md](ARCHITECTURE.md#read-only-by-design): **the dashboard reads,
agents write through the ingestion API.**

- **Dashboard role (anon/authenticated):** `SELECT` only on all four tables. Enable RLS with a
  read policy for authenticated users:

  ```sql
  alter table agents        enable row level security;
  alter table agent_runs    enable row level security;
  alter table agent_metrics enable row level security;
  alter table agent_events  enable row level security;

  create policy "viewers read agents"        on agents        for select using (auth.uid() is not null);
  create policy "viewers read runs"          on agent_runs    for select using (auth.uid() is not null);
  create policy "viewers read metrics"       on agent_metrics for select using (auth.uid() is not null);
  create policy "viewers read events"        on agent_events  for select using (auth.uid() is not null);
  ```

  No `insert`/`update`/`delete` policies for this role → writes are impossible from the dashboard.

- **Ingestion writes** run **server-side** in the `/api/ingest/*` route handlers using the Supabase
  **service-role** key (which bypasses RLS). The route validates the per-agent API key first, then
  inserts. The service-role key never reaches the browser.

## Derived views (optional, convenience)

To keep dashboard queries simple, add SQL views such as:

- `agent_status` — joins `agents` with last heartbeat + recent success rate to expose the computed
  status enum.
- `agent_daily_throughput` — `agent_runs` rolled up by day.

These are read-only and keep aggregation logic in one place.
