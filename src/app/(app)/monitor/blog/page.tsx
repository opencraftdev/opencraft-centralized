import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { createClient } from "@/lib/supabase/server";
import { getAgentBySlug, getBlogDrafts, blogDraftStats } from "@/lib/monitor/queries";
import { BlogHistoryList } from "@/features/monitor/components/BlogHistoryList";
import { StatusDot } from "@/features/monitor/components/StatusDot";
import { BlogsShell } from "@/features/seo/components/BlogsShell";
import { relativeTime, formatNumber } from "@/features/monitor/format";

export const dynamic = "force-dynamic";

const SLUG = "blogpost-automation";

const CARD_SX = {
  bgcolor: "#fff",
  borderRadius: "12px",
  border: "1px solid #E8EAED",
} as const;

// Stat as a white card — sits on the gray page background.
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ ...CARD_SX, flex: "1 1 0", minWidth: 140, px: 2.5, py: 2 }}>
      <Typography sx={{ fontSize: "1.5rem", fontWeight: 400, color: "#1F1F1F", lineHeight: 1.2 }}>
        {value}
      </Typography>
      <Typography sx={{ fontSize: "0.8125rem", color: "#5f6368" }}>{label}</Typography>
    </Box>
  );
}

export default async function BlogHistoryPage() {
  const supabase = await createClient();
  // Agent row is optional — it only drives the "online / last sync" header chip.
  // The list reads articles directly, so it works even before the agent exists.
  const [agent, drafts] = await Promise.all([
    getAgentBySlug(supabase, SLUG),
    getBlogDrafts(supabase, 200),
  ]);
  const stats = blogDraftStats(drafts);

  const subtitle = agent
    ? `Blogs the agent drafted for you · last sync ${relativeTime(agent.last_heartbeat_at)}`
    : "Blogs the agent drafted for you";

  return (
    <BlogsShell
      title="History"
      subtitle={subtitle}
      status={agent ? <StatusDot status={agent.status} /> : undefined}
    >
      <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", mb: 2 }}>
        <Stat label="Drafts created" value={formatNumber(stats.total)} />
        <Stat label="Total words" value={formatNumber(stats.totalWords)} />
        <Stat label="Latest draft" value={relativeTime(stats.latestAt)} />
      </Box>
      <Box sx={{ ...CARD_SX, p: { xs: 2, md: 3 } }}>
        <BlogHistoryList items={drafts} />
      </Box>
    </BlogsShell>
  );
}
