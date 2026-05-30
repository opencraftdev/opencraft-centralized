# Integration Guide — Onboarding an Agent

This guide is for the **owner of an agent repo** (social-media-automation, document-agent,
comment-bot, blogpost-automation, or a new one). Follow it and your agent shows up on the
dashboard. You do **not** change anything in `opencraft-centralized` itself — you only **push
telemetry** to it.

## 1. Get registered

Ask an admin to add your agent to the `agents` table (or self-register on first heartbeat if that's
enabled). You need:

- `slug` — stable, lowercase, hyphenated (e.g. `document-agent`).
- `name` — display name.
- `kind` — one of `social-media`, `document`, `comment-bot`, `blogpost`.
- `repo_url` — your repository URL.
- `heartbeat_interval_s` — how often you'll ping (e.g. 300).

You'll receive an **API key** for your agent. Store it as a secret in your agent's environment
(e.g. `OPENCRAFT_MONITOR_API_KEY`), never commit it.

## 2. Configure two env vars in your agent

```bash
OPENCRAFT_MONITOR_URL=https://<dashboard-host>     # base URL of opencraft-centralized
OPENCRAFT_MONITOR_API_KEY=<your-agent-key>         # per-agent secret
```

## 3. Send telemetry

All endpoints accept JSON and require the header `Authorization: Bearer $OPENCRAFT_MONITOR_API_KEY`.
Payloads are validated with Zod; a `400` means your shape is wrong, a `401` means a bad/missing key.

### Heartbeat — on your interval

```
POST /api/ingest/heartbeat
{ "slug": "document-agent" }
```

Call this on a timer (matching `heartbeat_interval_s`). It updates `last_heartbeat_at`, which drives
the online/offline dot.

### Run — once per job/batch/cron tick

Open a run when work starts, close it when it ends:

```
POST /api/ingest/run            # start
{ "slug": "document-agent", "external_id": "job-8821", "status": "running",
  "started_at": "2026-05-30T09:00:00Z" }
→ { "run_id": 4127 }

POST /api/ingest/run            # finish (reference the run_id)
{ "slug": "document-agent", "run_id": 4127, "status": "succeeded",
  "items_processed": 42, "duration_ms": 18230,
  "finished_at": "2026-05-30T09:00:18Z" }
```

On failure, send `"status": "failed"` and an `"error_msg"`.

### Metric — your domain numbers

Report **incremental** values per run (not running totals):

```
POST /api/ingest/metric
{ "slug": "document-agent", "run_id": 4127,
  "metric_key": "documents_generated", "value": 42 }

POST /api/ingest/metric
{ "slug": "social-media-automation", "run_id": 4127,
  "metric_key": "posts_by_platform", "value": 3,
  "labels": { "platform": "instagram" } }
```

See [METRICS.md](METRICS.md) for the catalog of `metric_key`s per agent kind. New keys work
immediately — no schema change needed.

### Event — errors & notable incidents

```
POST /api/ingest/event
{ "slug": "comment-bot", "run_id": 4127, "level": "error",
  "message": "Instagram rate limit hit", "context": { "retry_after_s": 900 } }
```

`level` is `info` | `warning` | `error`. Errors surface in the agent's "Last error" and recent-events
panel.

## 4. Minimal client (any language)

A tiny wrapper keeps your agent code clean. Example in TypeScript:

```ts
const BASE = process.env.OPENCRAFT_MONITOR_URL!;
const KEY  = process.env.OPENCRAFT_MONITOR_API_KEY!;
const SLUG = "document-agent";

async function post(path: string, body: object) {
  const res = await fetch(`${BASE}/api/ingest/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${KEY}` },
    body: JSON.stringify({ slug: SLUG, ...body }),
  });
  if (!res.ok) console.error(`monitor ${path} failed: ${res.status}`);
  return res.ok ? res.json().catch(() => ({})) : null;
}

export const monitor = {
  heartbeat: () => post("heartbeat", {}),
  startRun:  (external_id: string) =>
    post("run", { external_id, status: "running", started_at: new Date().toISOString() }),
  finishRun: (run_id: number, ok: boolean, items: number, ms: number, error_msg?: string) =>
    post("run", { run_id, status: ok ? "succeeded" : "failed",
      items_processed: items, duration_ms: ms, finished_at: new Date().toISOString(), error_msg }),
  metric: (run_id: number, metric_key: string, value: number, labels?: object) =>
    post("metric", { run_id, metric_key, value, labels }),
  event: (level: "info"|"warning"|"error", message: string, run_id?: number, context?: object) =>
    post("event", { run_id, level, message, context }),
};
```

Usage in a job:

```ts
const { run_id } = await monitor.startRun("job-8821");
const t0 = performance.now();
try {
  const n = await doWork();
  await monitor.metric(run_id, "documents_generated", n);
  await monitor.finishRun(run_id, true, n, performance.now() - t0);
} catch (e) {
  await monitor.event("error", String(e), run_id);
  await monitor.finishRun(run_id, false, 0, performance.now() - t0, String(e));
}
```

## 5. Design rules for agents

- **Telemetry must never block your real work.** Fire-and-forget; swallow monitor errors (log,
  don't throw). The dashboard being down must not break your agent.
- **Report increments, not totals**, for counters — keeps replays/back-fills correct
  (see [METRICS.md](METRICS.md#aggregation-notes)).
- **One run per unit of work.** Don't batch unrelated work into one run, or throughput/latency lose
  meaning.
- **Keep the API key server-side.** It only authorizes *writing your own telemetry*; it grants no
  read access and no control over other agents.

## 6. Verify

After wiring it up:

1. Trigger one run in your agent.
2. Open the dashboard → your agent card should turn 🟢 and show **Runs today: 1**.
3. Open `/agents/<your-slug>` → confirm your run, metrics, and any events appear.

If nothing shows: check the API key, confirm heartbeats return `200`, and confirm your `slug`
matches the registry exactly.
