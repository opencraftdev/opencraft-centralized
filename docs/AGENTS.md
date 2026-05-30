# Agent Registry & Contract

Every agent monitored by this dashboard is an **independent service in its own repository**. This
document is the registry of those agents and the contract each must satisfy to appear on the
dashboard.

## The contract (what every agent must do)

To be monitored, an agent must report telemetry to the shared store via the ingestion API
(see [INTEGRATION.md](INTEGRATION.md)). At minimum:

1. **Register** once: ensure a row exists in `agents` with its `slug`, `name`, `kind`, and
   `repo_url`. (Done by an admin, or self-registered on first heartbeat.)
2. **Heartbeat** on a fixed interval (`POST /api/ingest/heartbeat`) so status can be derived.
3. **Report each run** (`POST /api/ingest/run`) — one record per job/batch/cron tick with outcome
   and duration.
4. **Report metrics** (`POST /api/ingest/metric`) for its domain numbers.
5. **Report events** (`POST /api/ingest/event`) for errors and notable incidents.

The dashboard treats every agent uniformly through the **common metrics** (status, runs, success
rate, latency) and additionally renders each agent's **specific metrics**.

## Registered agents

### 1. Social Media Automation — `social-media-automation`

Generates short-form video/image posts and publishes them to social platforms.

- **Reports runs for:** each post pipeline execution (curate → draft → render → publish).
- **Specific metrics:** `posts_published`, `posts_by_platform` (IG / Threads / X), `queue_depth`
  (scheduled but unpublished), `approvals_pending`, `render_duration_ms`, `publish_failures`.
- **Key events:** publish failure, platform rate-limit, approval-gate timeout.

### 2. Document Agent — `document-agent`

Generates documents for internal tools. Repo: <https://github.com/opencraftdev/document-agent>

- **Reports runs for:** each document generated (or generation batch).
- **Specific metrics:** `documents_generated`, `documents_by_tool` (which internal tool requested
  it), `documents_by_type` (format/template), `words_generated`, `generation_duration_ms`,
  `generation_failures`.
- **Key events:** generation failure, missing/invalid template, validation failure.

### 3. Comment Bot — `comment-bot`

Auto-comments and replies on social media.

- **Reports runs for:** each commenting cycle / target batch.
- **Specific metrics:** `comments_posted`, `replies_posted`, `targets_scanned`, `skipped_count`
  (filtered/blocked), `flagged_count`, `engagement_received`, `comments_by_platform`.
- **Key events:** account flagged, rate-limit, content blocked by policy filter.

### 4. Blogpost Automation — `blogpost-automation`

Drafts and publishes blog posts.

- **Reports runs for:** each blog post drafted/published.
- **Specific metrics:** `posts_drafted`, `posts_published`, `words_generated`, `avg_seo_score`,
  `images_generated`, `publish_failures`.
- **Key events:** CMS publish failure, SEO score below threshold, image-gen failure.

## Registry fields

Each agent corresponds to one row in the `agents` table (see [DATA-MODEL.md](DATA-MODEL.md)):

| Field | Meaning |
|---|---|
| `slug` | Stable machine id used in URLs and ingestion (`social-media-automation`, …) |
| `name` | Human-friendly display name |
| `kind` | One of `social-media`, `document`, `comment-bot`, `blogpost` (drives which specific metrics render) |
| `repo_url` | Link to the agent's source repository |
| `heartbeat_interval_s` | Expected seconds between heartbeats (drives online/offline) |
| `degraded_below` | Success-rate threshold below which the agent is shown as `degraded` |

## Adding a fifth agent

The system is built to grow. A new agent appears on the dashboard as soon as it:

1. Has a registry row (new `slug` + `kind`).
2. Starts sending heartbeats and runs.

If its `kind` is new, add a small panel mapping that kind's specific metric keys to charts. No
schema change is required for new **metrics** — they flow through the generic `agent_metrics`
table. See [INTEGRATION.md](INTEGRATION.md).
