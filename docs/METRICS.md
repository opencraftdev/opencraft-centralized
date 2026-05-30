# Metrics Catalog

This is the catalog of what the dashboard displays. There are two layers:

- **Common metrics** — derived for *every* agent from heartbeats and runs. The dashboard renders
  these identically for all agents.
- **Specific metrics** — domain numbers each agent reports through the generic `agent_metrics`
  table. Rendered per `kind`.

All metrics are **observed and displayed only**. The dashboard computes nothing that writes back to
an agent.

## Common metrics (every agent)

| Metric | Source | How it's shown |
|---|---|---|
| **Status** | derived from last heartbeat + recent success rate | colored dot: 🟢/🟡/🔴/⚪ |
| **Last seen** | most recent heartbeat | relative time ("2m ago") |
| **Runs today** | `count(agent_runs)` where `started_at >= today` | stat card |
| **Total runs** | `count(agent_runs)` | stat card |
| **Success rate** | `succeeded / (succeeded + failed)` over a window | percentage + sparkline |
| **Error rate** | `failed / total` over a window | percentage |
| **Avg duration** | `avg(duration_ms)` over a window | stat card + trend line |
| **p95 duration** | 95th percentile of `duration_ms` | stat card |
| **Last error** | most recent `agent_events` with `level = error` | text + timestamp |
| **Throughput** | sum of `items_processed` per run over time | bar/line chart |

### Status derivation

See [ARCHITECTURE.md](ARCHITECTURE.md#status-model). Thresholds come from the agent's registry row
(`heartbeat_interval_s`, `degraded_below`).

## Specific metrics by agent kind

These are reported as rows in `agent_metrics` (`metric_key` + `value` + `recorded_at`). New keys
need **no schema change** — only a chart mapping if you want a dedicated visualization.

### `social-media` (Social Media Automation)

| `metric_key` | Meaning | Suggested viz |
|---|---|---|
| `posts_published` | posts published in period | counter + line |
| `posts_by_platform` | published per platform (IG/Threads/X) | stacked bar |
| `queue_depth` | scheduled-but-unpublished | gauge |
| `approvals_pending` | drafts awaiting approval | counter |
| `render_duration_ms` | Remotion render time | trend line |
| `publish_failures` | failed publishes | counter (alert if > 0) |

### `document` (Document Agent)

| `metric_key` | Meaning | Suggested viz |
|---|---|---|
| `documents_processed` | docs handled | counter + line |
| `pages_processed` | total pages | counter |
| `parse_success_rate` | successful parses % | percentage + trend |
| `ocr_confidence_avg` | avg OCR confidence | gauge |
| `queue_depth` | docs waiting | gauge |
| `bytes_ingested` | data volume | area chart |

### `comment-bot` (Comment Bot)

| `metric_key` | Meaning | Suggested viz |
|---|---|---|
| `comments_posted` | comments made | counter + line |
| `replies_posted` | replies made | counter |
| `targets_scanned` | candidates evaluated | counter |
| `skipped_count` | filtered/blocked | counter |
| `flagged_count` | flagged by platform | counter (alert) |
| `engagement_received` | likes/replies back | trend line |
| `comments_by_platform` | per platform | stacked bar |

### `blogpost` (Blogpost Automation)

| `metric_key` | Meaning | Suggested viz |
|---|---|---|
| `posts_drafted` | drafts created | counter |
| `posts_published` | posts published | counter + line |
| `words_generated` | total words | counter |
| `avg_seo_score` | average SEO score | gauge |
| `images_generated` | images created | counter |
| `publish_failures` | failed CMS publishes | counter (alert) |

## Time windows

The dashboard offers standard windows; queries aggregate on demand:

- **Today** (since local midnight)
- **7 days**
- **30 days**
- **All time** (totals only)

## Aggregation notes

- Counters (`posts_published`, etc.) are reported as **incremental values per run** and summed over
  the window — never as a running total, so back-fills and replays stay correct.
- Rates (`parse_success_rate`, `avg_seo_score`) are reported as the value **for that run/period**;
  the dashboard averages them (optionally weighted by volume).
- Durations are taken from `agent_runs.duration_ms`; specific `*_duration_ms` metrics are for finer
  sub-steps an agent wants to expose.
