# Blog Monitoring Bot

Monitors the **Blogpost Automation** agent (`blogpost-automation`, kind `blogpost`)
inside the centralized dashboard.

## Why this one is a *pull* monitor

The Document Agent **pushes** telemetry from its own repo via `/api/ingest/*`
using a per-agent API key. The blog pipeline is different: landing-pages
publishes articles straight into the **shared `articles` table** (via its
`POST /api/articles` endpoint). Because the blog data and the telemetry tables
live in the *same* Supabase project, the bot doesn't need a network hop or an
API key — it reconciles `articles` into the monitoring schema directly with the
service-role client.

## What a sync does

`runBlogMonitorSync()` ([src/lib/monitor/blog-bot.ts](../src/lib/monitor/blog-bot.ts)):

1. Opens an `agent_runs` row (`running`) for `blogpost-automation`.
2. Reads every row from `articles` and **upserts** each into `agent_documents`
   (idempotent on `external_id = article slug`):
   - `doc_type = "blogpost"`, `tool = source_name` (used as the folder/grouping),
   - `word_count` computed from the article body,
   - `file_url = {BLOG_PUBLIC_BASE_URL}/{BLOG_PUBLIC_LOCALE}/blog/{slug}` (the live post),
   - `metadata` keeps `summary`, `source_url`, `og_image`, `scraped_at`.
3. Records metrics `articles_total`, `articles_new`, `sources_tracked` + an event.
4. Closes the run (`succeeded`, `items_processed = new count`) and bumps the
   agent heartbeat, so it shows **online** in `agent_status`.

A failure marks the run `failed`, logs an `error` event, and re-throws.

It reuses the existing telemetry schema (`002_telemetry_schema.sql`) — **no new
migration required**.

## Dashboard

- Page: **Blog Agent** at [`/monitor/blog`](../src/app/(app)/monitor/blog/page.tsx)
  (sidebar entry next to Document Agent). Shows live status, article/word/run
  stats, and a source-filterable article list that links out to each live post.

## Trigger

Protected endpoint (fail-closed if `MONITOR_CRON_SECRET` is unset):

```
POST /api/monitor/blog/sync      Authorization: Bearer $MONITOR_CRON_SECRET
GET  /api/monitor/blog/sync?key=$MONITOR_CRON_SECRET   # for GET-only cron services
```

Manual run:

```bash
curl -X POST https://<dashboard-host>/api/monitor/blog/sync \
  -H "Authorization: Bearer $MONITOR_CRON_SECRET"
```

### Scheduling options

- **Supabase pg_cron** (recommended — same project, no extra infra). Run once,
  replacing the host + secret:

  ```sql
  select cron.schedule(
    'blog-monitor-sync',
    '*/30 * * * *',                       -- every 30 min
    $$ select net.http_post(
         url    := 'https://<dashboard-host>/api/monitor/blog/sync',
         headers:= jsonb_build_object('Authorization', 'Bearer <MONITOR_CRON_SECRET>')
       ); $$
  );
  ```
  (Requires the `pg_cron` and `pg_net` extensions.)

- **Vercel/Netlify scheduled function** or any external cron hitting the GET URL.

## Env vars

| Var | Required | Default | Purpose |
|---|---|---|---|
| `MONITOR_CRON_SECRET` | yes | — | Bearer/`?key=` secret for the sync endpoint |
| `BLOG_PUBLIC_BASE_URL` | no | `https://ocraft.id` | Site the article links point to |
| `BLOG_PUBLIC_LOCALE` | no | `id` | Locale segment in the blog URL |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | — | Already required; the bot writes with it |
