import type { SupabaseClient } from "@supabase/supabase-js";

// ── Blog Monitoring Bot ─────────────────────────────────────────────────────
//
// A *pull* monitor for the Blogpost Automation agent. Unlike the Document Agent
// (which pushes telemetry from its own repo via /api/ingest/*), the blog
// pipeline publishes straight into the shared Supabase `articles` table
// (landing-pages POSTs to /api/articles). Both the blog data and the telemetry
// tables live in the same project, so this bot reconciles `articles` into the
// monitoring schema with the service-role client — no network hop, no API key.
//
// Each sync:
//   1. opens an agent_run for `blogpost-automation`,
//   2. upserts every article as an agent_documents row (idempotent on slug),
//   3. records articles_total / articles_new / sources_tracked metrics + an event,
//   4. closes the run and bumps the agent heartbeat (so it shows "online").
//
// Run it from the cron-protected /api/monitor/blog/sync route, or any scheduler.

const BLOG_AGENT_SLUG = "blogpost-automation";

// Public site where the blog is served. Articles link to /{locale}/blog/{slug}
// (see landing-pages app/[locale]/blog/[slug]). Indonesian is the default audience.
const BLOG_BASE_URL = (process.env.BLOG_PUBLIC_BASE_URL ?? "https://ocraft.id").replace(/\/+$/, "");
const BLOG_LOCALE = process.env.BLOG_PUBLIC_LOCALE ?? "id";

export interface BlogSyncResult {
  runId: number | null;
  articlesTotal: number;
  newArticles: number;
  updatedArticles: number;
  sources: string[];
  durationMs: number;
}

interface ArticleRow {
  slug: string;
  title: string;
  summary: string | null;
  content: string | null;
  og_image: string | null;
  source_url: string | null;
  source_name: string | null;
  published_at: string | null;
  scraped_at: string | null;
}

function wordCount(content: string | null): number | null {
  if (!content) return null;
  const words = content.trim().split(/\s+/).filter(Boolean);
  return words.length || null;
}

function blogUrl(slug: string): string {
  return `${BLOG_BASE_URL}/${BLOG_LOCALE}/blog/${slug}`;
}

export async function runBlogMonitorSync(admin: SupabaseClient): Promise<BlogSyncResult> {
  const startedAt = new Date();

  const { data: agent, error: agentErr } = await admin
    .from("agents")
    .select("id")
    .eq("slug", BLOG_AGENT_SLUG)
    .maybeSingle();
  if (agentErr) throw agentErr;
  if (!agent) {
    throw new Error(
      `Agent "${BLOG_AGENT_SLUG}" is not registered. Apply the telemetry migration and seed the registry.`,
    );
  }
  const agentId = agent.id as number;

  const { data: run, error: runErr } = await admin
    .from("agent_runs")
    .insert({ agent_id: agentId, status: "running", started_at: startedAt.toISOString() })
    .select("id")
    .single();
  if (runErr) throw runErr;
  const runId = run.id as number;

  try {
    const { data: articles, error: artErr } = await admin
      .from("articles")
      .select(
        "slug,title,summary,content,og_image,source_url,source_name,published_at,scraped_at",
      )
      .order("published_at", { ascending: false });
    if (artErr) throw artErr;
    const rows = (articles ?? []) as ArticleRow[];

    // Which articles have we already recorded? external_id == article slug.
    const { data: existing, error: exErr } = await admin
      .from("agent_documents")
      .select("external_id")
      .eq("agent_id", agentId);
    if (exErr) throw exErr;
    const known = new Set(
      ((existing ?? []) as { external_id: string | null }[])
        .map((r) => r.external_id)
        .filter((id): id is string => id != null),
    );

    const sources = new Set<string>();
    let newArticles = 0;
    let updatedArticles = 0;

    for (const a of rows) {
      const source = a.source_name?.trim() || "Unknown";
      sources.add(source);

      const doc = {
        agent_id: agentId,
        run_id: runId,
        external_id: a.slug,
        title: a.title,
        doc_type: "blogpost",
        // `tool` is what DocumentLibrary groups documents by ("folders"); the
        // source blog makes a natural grouping (LangChain, OpenAI, …).
        tool: source,
        status: "generated" as const,
        word_count: wordCount(a.content),
        file_url: blogUrl(a.slug),
        generated_at: a.published_at ?? a.scraped_at ?? startedAt.toISOString(),
        metadata: {
          source_name: a.source_name,
          source_url: a.source_url,
          summary: a.summary,
          og_image: a.og_image,
          scraped_at: a.scraped_at,
        },
      };

      const { error } = await admin
        .from("agent_documents")
        .upsert(doc, { onConflict: "agent_id,external_id" });
      if (error) throw error;

      if (known.has(a.slug)) updatedArticles++;
      else newArticles++;
    }

    const recordedAt = new Date().toISOString();
    const { error: metricErr } = await admin.from("agent_metrics").insert([
      { agent_id: agentId, run_id: runId, metric_key: "articles_total", value: rows.length, recorded_at: recordedAt },
      { agent_id: agentId, run_id: runId, metric_key: "articles_new", value: newArticles, recorded_at: recordedAt },
      { agent_id: agentId, run_id: runId, metric_key: "sources_tracked", value: sources.size, recorded_at: recordedAt },
    ]);
    if (metricErr) throw metricErr;

    await admin.from("agent_events").insert({
      agent_id: agentId,
      run_id: runId,
      level: "info",
      message: `Blog sync: ${rows.length} article${rows.length === 1 ? "" : "s"} tracked, ${newArticles} new`,
      context: { sources: [...sources] },
    });

    const durationMs = Date.now() - startedAt.getTime();
    await admin
      .from("agent_runs")
      .update({
        status: "succeeded",
        items_processed: newArticles,
        duration_ms: durationMs,
        finished_at: new Date().toISOString(),
      })
      .eq("id", runId);

    // Heartbeat → the agent_status view reports "online".
    await admin
      .from("agents")
      .update({ last_heartbeat_at: new Date().toISOString() })
      .eq("id", agentId);

    return {
      runId,
      articlesTotal: rows.length,
      newArticles,
      updatedArticles,
      sources: [...sources],
      durationMs,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await admin
      .from("agent_runs")
      .update({ status: "failed", error_msg: message, finished_at: new Date().toISOString() })
      .eq("id", runId);
    await admin.from("agent_events").insert({
      agent_id: agentId,
      run_id: runId,
      level: "error",
      message: `Blog sync failed: ${message}`,
    });
    throw err;
  }
}
