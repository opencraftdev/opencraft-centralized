# OpenCraft Centralized

> **The single pane of glass for every OpenCraft automation agent.**
> This repo is a **read-only monitoring dashboard**. It does not create, edit, schedule, or
> control anything — it only **reads metrics** that the agents report and **shows them** to users.

OpenCraft runs several independent automation agents, each in its own repository, each doing its
own job on its own schedule. This dashboard aggregates their health and performance into one place
so a user can answer, at a glance:

- Is every agent **up**?
- What did each agent **do today** (and is it succeeding or failing)?
- What are the **trends** — throughput, success rate, latency — over time?

It is intentionally a **viewer**, not a control plane. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#read-only-by-design).

---

## The agents being monitored

| Agent | Slug | What it does | Repository |
|---|---|---|---|
| Social Media Automation | `social-media-automation` | Generates & publishes short-form video / image posts | _(its own repo)_ |
| Document Agent | `document-agent` | Generates documents for internal tools | [document-agent](https://github.com/opencraftdev/document-agent) |
| Comment Bot | `comment-bot` | Auto-comments / replies on social media | _(its own repo)_ |
| Blogpost Automation | `blogpost-automation` | Drafts & publishes blog posts | _(its own repo)_ |

Each agent is the **owner of its own data**. The dashboard never reaches into an agent's repo or
runtime — agents **push** their metrics to a shared store, and the dashboard **reads** from it.
Full contract in [docs/AGENTS.md](docs/AGENTS.md) and [docs/INTEGRATION.md](docs/INTEGRATION.md).

---

## How it fits together (30-second version)

```
┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐
│ social-media     │   │ document-agent   │   │ comment-bot      │   │ blogpost-        │
│ -automation repo │   │ repo             │   │ repo             │   │ automation repo  │
└────────┬─────────┘   └────────┬─────────┘   └────────┬─────────┘   └────────┬─────────┘
         │  push heartbeats / runs / metrics (server-to-server, API key)      │
         └───────────────────────────┬───────────────────────────────────────┘
                                      ▼
                       ┌─────────────────────────────┐
                       │  Shared metrics store        │   Supabase Postgres
                       │  (agents, runs, metrics,     │   (see docs/DATA-MODEL.md)
                       │   events)                    │
                       └──────────────┬──────────────┘
                                      │  read-only queries
                                      ▼
                       ┌─────────────────────────────┐
                       │  opencraft-centralized       │   ◀── THIS REPO
                       │  Next.js dashboard (viewer)  │
                       └─────────────────────────────┘
```

---

## Documentation

Start with the architecture, then pick the doc you need:

| Doc | Read it when you want to… |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Understand the system, the read-only principle, and the data flow |
| [docs/AGENTS.md](docs/AGENTS.md) | See the registry of agents and the contract each must satisfy |
| [docs/METRICS.md](docs/METRICS.md) | Look up the catalog of metrics (common + per-agent) |
| [docs/DATA-MODEL.md](docs/DATA-MODEL.md) | See the Supabase schema for the metrics store |
| [docs/INTEGRATION.md](docs/INTEGRATION.md) | Onboard a new agent so it shows up on the dashboard |

---

## Tech stack

- **Next.js 15** (App Router) · **React 19** · **TypeScript**
- **MUI 9** + `@mui/x-charts` for charts, `@fullcalendar` for time views
- **Supabase** (Postgres + Auth + SSR) — the read side of the metrics store
- **Zod** for validating ingested payloads

## Local development

```powershell
npm install
npm run dev        # http://localhost:3000
npm run typecheck  # tsc --noEmit
```

Environment variables live in `.env.local` (git-ignored). Copy the template:

```powershell
Copy-Item .env.local.example .env.local
```

> **Note on current state:** this repo was seeded from the `opencraft-dashboard` client, which
> still contains content-creation features (post generation, scheduling, etc.). Per the monitoring
> mandate, those write paths are being **retired** in favor of read-only metric views. See
> [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#migration-from-the-seed-app) for the migration plan.
