import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { createClient } from "@/lib/supabase/server";
import {
  getAgentBySlug,
  getDocuments,
  getDocumentStats,
  getRecentRuns,
} from "@/lib/monitor/queries";
import { BlogLibrary } from "@/features/monitor/components/BlogLibrary";
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
  const agent = await getAgentBySlug(supabase, SLUG);

  if (!agent) {
    return (
      <BlogsShell title="History" subtitle="Articles tracked by Blogpost Automation">
        <Box sx={{ ...CARD_SX, p: 4 }}>
          <Typography sx={{ fontSize: "0.875rem", color: "rgba(0,0,0,0.54)" }}>
            Blogpost Automation is not registered yet. Apply the telemetry migration and seed the
            registry to populate History.
          </Typography>
        </Box>
      </BlogsShell>
    );
  }

  const [documents, stats, runs] = await Promise.all([
    getDocuments(supabase, agent.id, 200),
    getDocumentStats(supabase, agent.id),
    getRecentRuns(supabase, agent.id, 1),
  ]);
  const lastRun = runs[0] ?? null;

  return (
    <BlogsShell
      title="History"
      subtitle={`Blogpost Automation · last sync ${relativeTime(agent.last_heartbeat_at)}${
        lastRun?.status === "failed" ? " · last run failed" : ""
      }`}
      status={<StatusDot status={agent.status} />}
    >
      <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", mb: 2 }}>
        <Stat label="Articles tracked" value={formatNumber(stats.total)} />
        <Stat label="Total words" value={formatNumber(stats.totalWords)} />
        <Stat label="Runs (24h)" value={formatNumber(agent.runs_24h)} />
        <Stat
          label="Success rate (24h)"
          value={
            agent.success_rate_24h == null ? "—" : `${Math.round(agent.success_rate_24h * 100)}%`
          }
        />
      </Box>
      <Box sx={{ ...CARD_SX, p: { xs: 2, md: 3 } }}>
        <BlogLibrary documents={documents} />
      </Box>
    </BlogsShell>
  );
}
