import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSecret, setSecret } from "./vault";

// Discord "blog published" integration.
//
// Webhook URL lives encrypted in Supabase Vault (name = DISCORD_WEBHOOK_SECRET);
// non-secret config lives in public.integration_settings (singleton row id=1).
// public.discord_notified_articles is the dedup ledger — a slug present there is
// already handled, so it never fires twice.

export const DISCORD_WEBHOOK_SECRET = "discord_blog_webhook";

const BLOG_BASE_URL = (process.env.BLOG_PUBLIC_BASE_URL ?? "https://ocraft.id").replace(/\/+$/, "");
const BLOG_LOCALE = process.env.BLOG_PUBLIC_LOCALE ?? "id";

function blogUrl(slug: string): string {
  return `${BLOG_BASE_URL}/${BLOG_LOCALE}/blog/${slug}`;
}

const DISCORD_WEBHOOK_RE = /^https:\/\/(?:[\w.-]+\.)?discord(?:app)?\.com\/api\/webhooks\/\d+\/[\w-]+$/;

export function isValidDiscordWebhook(url: string): boolean {
  return DISCORD_WEBHOOK_RE.test(url.trim());
}

// Masked hint for the UI — never returns the full secret to the client.
function maskWebhook(url: string): string {
  const tail = url.slice(-6);
  return `https://discord.com/api/webhooks/••••${tail}`;
}

// ── Settings ────────────────────────────────────────────────

export interface DiscordSettings {
  enabled: boolean;
  /** null = notify for any source; else only these source_name values */
  sources: string[] | null;
  hasWebhook: boolean;
  webhookHint: string | null;
}

interface SettingsRow {
  discord_enabled: boolean;
  discord_sources: string[] | null;
  webhook_secret_name: string;
}

export async function getDiscordSettings(): Promise<DiscordSettings> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("integration_settings")
    .select("discord_enabled,discord_sources,webhook_secret_name")
    .eq("id", 1)
    .maybeSingle();
  if (error) throw error;
  const row = (data as SettingsRow | null) ?? null;
  const webhook = await getSecret(row?.webhook_secret_name ?? DISCORD_WEBHOOK_SECRET);
  return {
    enabled: row?.discord_enabled ?? true,
    sources: row?.discord_sources ?? null,
    hasWebhook: Boolean(webhook),
    webhookHint: webhook ? maskWebhook(webhook) : null,
  };
}

export interface SaveDiscordInput {
  /** undefined = leave unchanged; "" = clear the stored webhook */
  webhookUrl?: string;
  enabled?: boolean;
  sources?: string[] | null;
}

export async function saveDiscordSettings(input: SaveDiscordInput): Promise<void> {
  const admin = createAdminClient();

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.enabled !== undefined) patch.discord_enabled = input.enabled;
  if (input.sources !== undefined) patch.discord_sources = input.sources;
  if (Object.keys(patch).length > 1) {
    const { error } = await admin.from("integration_settings").update(patch).eq("id", 1);
    if (error) throw error;
  }

  if (input.webhookUrl !== undefined) {
    const trimmed = input.webhookUrl.trim();
    if (trimmed) {
      if (!isValidDiscordWebhook(trimmed)) {
        throw new Error("That doesn't look like a Discord webhook URL.");
      }
      await setSecret(DISCORD_WEBHOOK_SECRET, trimmed);
      // First webhook ever → mark existing articles as already handled so we
      // don't blast the whole history on the next sync.
      await backfillNotifiedIfEmpty(admin);
    } else {
      await setSecret(DISCORD_WEBHOOK_SECRET, "");
    }
  }
}

async function backfillNotifiedIfEmpty(admin: SupabaseClient): Promise<void> {
  const { count, error: cErr } = await admin
    .from("discord_notified_articles")
    .select("slug", { count: "exact", head: true });
  if (cErr) throw cErr;
  if ((count ?? 0) > 0) return;

  const { data, error } = await admin.from("articles").select("slug");
  if (error) throw error;
  const rows = ((data ?? []) as { slug: string | null }[])
    .filter((r): r is { slug: string } => Boolean(r.slug))
    .map((r) => ({ slug: r.slug }));
  if (rows.length) {
    const { error: insErr } = await admin
      .from("discord_notified_articles")
      .upsert(rows, { onConflict: "slug" });
    if (insErr) throw insErr;
  }
}

// ── Sending ─────────────────────────────────────────────────

export interface BlogPublishedPayload {
  title: string;
  platform: string; // source_name (e.g. "OpenCraft")
  url: string;
  summary?: string | null;
  publishedAt?: string | null;
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s;
}

// Posts a rich embed to a Discord webhook. Discord replies 204 on success.
export async function sendDiscordBlogNotification(
  webhookUrl: string,
  p: BlogPublishedPayload,
): Promise<void> {
  const fields: { name: string; value: string; inline?: boolean }[] = [
    { name: "Platform", value: p.platform || "—", inline: true },
  ];
  if (p.publishedAt) {
    fields.push({
      name: "Published",
      value: `<t:${Math.floor(new Date(p.publishedAt).getTime() / 1000)}:D>`,
      inline: true,
    });
  }

  const embed = {
    title: truncate(`📝 New blog published: ${p.title}`, 256),
    url: p.url,
    description: p.summary ? truncate(p.summary, 300) : undefined,
    color: 0x1a73e8,
    fields,
    footer: { text: "OpenCraft · Blog automation" },
  };

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ embeds: [embed] }),
  });
  if (!res.ok && res.status !== 204) {
    const body = await res.text().catch(() => "");
    throw new Error(`Discord webhook returned ${res.status}${body ? `: ${body.slice(0, 200)}` : ""}`);
  }
}

export async function sendDiscordTest(): Promise<void> {
  const webhook = await getSecret(DISCORD_WEBHOOK_SECRET);
  if (!webhook) throw new Error("No Discord webhook configured yet.");
  await sendDiscordBlogNotification(webhook, {
    title: "Test notification ✅",
    platform: "OpenCraft",
    url: `${BLOG_BASE_URL}/${BLOG_LOCALE}/blog`,
    summary: "If you can see this in Discord, the blog-published webhook is wired up correctly.",
    publishedAt: new Date().toISOString(),
  });
}

// ── Detection: notify for newly-published articles (dedup via ledger) ────────

export interface DiscordNotifyResult {
  sent: number;
  reason?: string;
}

interface CandidateRow {
  slug: string | null;
  title: string | null;
  summary: string | null;
  source_name: string | null;
  published_at: string | null;
}

// Finds published articles (matching the source filter) not yet in the dedup
// ledger and posts each to Discord. Safe to call repeatedly. Never throws for a
// single failed send — it records successes and reports.
export async function notifyNewBlogArticles(admin: SupabaseClient): Promise<DiscordNotifyResult> {
  const { data: settings, error: sErr } = await admin
    .from("integration_settings")
    .select("discord_enabled,discord_sources,webhook_secret_name")
    .eq("id", 1)
    .maybeSingle();
  if (sErr) throw sErr;
  const s = (settings as SettingsRow | null) ?? null;

  if (!s?.discord_enabled) return { sent: 0, reason: "disabled" };

  const webhook = await getSecret(s.webhook_secret_name ?? DISCORD_WEBHOOK_SECRET);
  if (!webhook) return { sent: 0, reason: "no webhook configured" };

  let query = admin
    .from("articles")
    .select("slug,title,summary,source_name,published_at")
    .not("published_at", "is", null)
    .order("published_at", { ascending: true });
  const sources = s.discord_sources;
  if (sources && sources.length > 0) query = query.in("source_name", sources);

  const { data: arts, error: aErr } = await query;
  if (aErr) throw aErr;
  const articles = (arts ?? []) as CandidateRow[];

  const { data: notifiedRows, error: nErr } = await admin
    .from("discord_notified_articles")
    .select("slug");
  if (nErr) throw nErr;
  const notified = new Set(((notifiedRows ?? []) as { slug: string }[]).map((r) => r.slug));

  const pending = articles.filter((a): a is CandidateRow & { slug: string } =>
    Boolean(a.slug) && !notified.has(a.slug as string),
  );

  let sent = 0;
  for (const a of pending) {
    try {
      await sendDiscordBlogNotification(webhook, {
        title: a.title?.trim() || "Untitled",
        platform: a.source_name?.trim() || "OpenCraft",
        url: blogUrl(a.slug),
        summary: a.summary,
        publishedAt: a.published_at,
      });
      await admin.from("discord_notified_articles").insert({ slug: a.slug });
      sent++;
    } catch (err) {
      // Stop on the first send failure (e.g. bad webhook) so we don't hammer
      // Discord; the un-recorded slugs retry next run.
      console.error("Discord notify failed for", a.slug, err);
      return { sent, reason: err instanceof Error ? err.message : "send failed" };
    }
  }
  return { sent };
}
