# Architecture

`opencraft-centralized` is a **monitoring dashboard** for OpenCraft's fleet of automation agents.
Its only job is to **collect metrics that agents report** and **present them** to users.

## Read-only by design

This is the most important rule in the system, so it comes first.

**The dashboard never mutates an agent's state.** There are no "create", "update", "delete",
"trigger", "pause", or "retry" actions exposed to dashboard users. A user logs in and sees numbers,
charts, statuses, and timelines — nothing else.

Why this matters:

- **Blast radius is zero.** A bug in the dashboard can, at worst, show wrong numbers. It can never
  break, spam, or misfire an agent.
- **Each agent owns its lifecycle.** Starting/stopping/configuring an agent happens in *that
  agent's* repo and runtime, not here.
- **Security is simple.** The dashboard's database role only needs `SELECT`. The only write path in
  the whole system is the narrow, authenticated **ingestion** endpoint that agents push to.

> If a feature would let a dashboard user change something in an agent, it does **not** belong in
> this repo. It belongs in the agent's own repo.

## Components

### 1. Agents (external — one repo each)

Four independent services, each on its own schedule (cron, queue worker, webhook, etc.):

- `social-media-automation`
- `document-agent`
- `comment-bot`
- `blogpost-automation`

Each agent is responsible for **reporting** three things (see [METRICS.md](METRICS.md)):

1. **Heartbeats** — "I'm alive" pings, so we can tell online vs. offline.
2. **Runs** — one record per unit of work (a job, a batch, a cron tick): start, end, outcome.
3. **Metrics / events** — domain numbers (posts published, docs processed, comments posted…) and
   notable events (errors, rate-limit hits).

### 2. Shared metrics store (Supabase Postgres)

A single Supabase project holds the fleet's telemetry. Tables: `agents`, `agent_runs`,
`agent_metrics`, `agent_events`. Full schema in [DATA-MODEL.md](DATA-MODEL.md).

This is the **contract boundary**. Agents write to it; the dashboard reads from it. Neither side
needs to know the other's internals.

### 3. Ingestion endpoint (server-to-server only)

Agents do not get direct table access. They `POST` to a thin, key-authenticated ingestion API
(`/api/ingest/*`) that validates payloads with Zod and writes the rows. This keeps the write
surface tiny and auditable. This endpoint is **not** part of the user-facing UI — it is a
machine-to-machine API. See [INTEGRATION.md](INTEGRATION.md).

> **Alternative:** agents may write directly to Postgres using a Supabase **service-role** key
> scoped to the telemetry tables. The ingestion API is preferred because it centralizes validation
> and lets us evolve the schema without re-deploying every agent.

### 4. The dashboard (this repo)

A Next.js App Router app that runs read-only Supabase queries and renders:

- **Fleet overview** — one card per agent: status dot, last seen, runs today, success rate.
- **Per-agent detail** — time-series charts (throughput, success rate, latency), recent runs,
  recent events/errors.
- **Cross-fleet trends** — totals and comparisons across all four agents.

## Data flow

```
agent run completes
   │
   ├─ POST /api/ingest/run      ──┐
   ├─ POST /api/ingest/metric   ──┤  (API key in header, Zod-validated)
   └─ POST /api/ingest/event    ──┘
                                   ▼
                         Supabase Postgres (telemetry tables)
                                   ▲
                                   │  SELECT only
                         Dashboard server components / route handlers
                                   ▼
                         Charts & status cards in the browser
```

Heartbeats follow the same path (`POST /api/ingest/heartbeat`) on a fixed interval.

## Status model

An agent's **live status** is derived, not stored as truth:

| Status | Rule (default thresholds — tune per agent) |
|---|---|
| 🟢 `online` | last heartbeat within **2× its expected interval** |
| 🟡 `degraded` | heartbeat recent **but** recent run success rate below threshold (e.g. < 80%) |
| 🔴 `offline` | no heartbeat within the window |
| ⚪ `unknown` | never reported (newly registered) |

Thresholds live alongside each agent's registry row (`agents.heartbeat_interval_s`,
`agents.degraded_below`). See [DATA-MODEL.md](DATA-MODEL.md).

## Authentication & access

- **Dashboard users** authenticate via Supabase Auth (already wired in the seed app). They get
  read-only views. Consider a single `viewer` role — no per-row ownership is needed because this is
  org-internal fleet data, not per-user data.
- **Agents** authenticate to the ingestion API with a **per-agent API key** (one secret per agent,
  rotatable). A key only authorizes writing telemetry for *that* agent.

## Migration from the seed app

This repo was seeded from `opencraft-dashboard` (the social-media client), which includes
content-creation features. To become a pure monitor:

1. **Keep & repurpose** the read-only building blocks: layout/shell (`Sidebar`, `TopBar`), the
   chart components in `src/features/dashboard/components/` (`StatCards`, `PublishChart`,
   `ContentTypeChart`, `CalendarHeatmap`, `RecentPosts`), the Supabase SSR client, the MUI theme.
2. **Remove the write paths**: the generation/scheduling/approval API routes under
   `src/app/api/generate/*`, `src/app/api/posts/*`, `src/app/api/calendar/*`, `src/app/api/template/*`,
   and their forms/modals under `src/components/generate/*`, `src/components/template/*`.
3. **Add the telemetry tables** (new migration, see [DATA-MODEL.md](DATA-MODEL.md)) and point the
   dashboard's queries at them.
4. **Rebuild the pages** as: `/` fleet overview, `/agents/[slug]` per-agent detail.

Do this incrementally — the existing dashboard page is a good visual starting point; swap its data
source from `content_posts` to the telemetry tables.
