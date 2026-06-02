import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

import { createClient } from "@/lib/supabase/server";
import { getFleetOverview, parseWindow } from "@/features/fleet/queries";
import { WindowToggle } from "@/features/fleet/components/WindowToggle";
import { RunStatusCard } from "@/features/fleet/components/RunStatusCard";
import { AgentActivity } from "@/features/fleet/components/AgentActivity";

export const dynamic = "force-dynamic";

const MAX_W = 1180;
const SIDEBAR = 280;
const TOPBAR = 64;
const HEADER_H = 68;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ window?: string }>;
}) {
  const { window: windowParam } = await searchParams;
  const window = parseWindow(windowParam);

  const supabase = await createClient();
  const fleet = await getFleetOverview(supabase, window);

  const { agents, totals, series, activity } = fleet;
  const totalAgents = agents.length;

  return (
    <Box sx={{ minHeight: "100%", bgcolor: "#F0F4F9" }}>
      {/* Fixed page header */}
      <Box
        sx={{
          position: "fixed",
          top: TOPBAR,
          left: SIDEBAR,
          right: 0,
          zIndex: 10,
          height: HEADER_H,
          bgcolor: "#F0F4F9",
          borderBottom: "1px solid #E8EAED",
          display: "flex",
          alignItems: "center",
        }}
      >
        <Box
          sx={{
            maxWidth: MAX_W,
            mx: "auto",
            px: 3,
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 2,
          }}
        >
          <Box>
            <Typography
              component="h1"
              sx={{ fontSize: "1.375rem", fontWeight: 400, lineHeight: "1.75rem", color: "#1F1F1F" }}
            >
              Run activity
            </Typography>
            <Typography sx={{ fontSize: "0.75rem", color: "#5f6368" }}>
              {totalAgents} automation {totalAgents === 1 ? "agent" : "agents"} · read-only telemetry
            </Typography>
          </Box>
          <WindowToggle value={window} />
        </Box>
      </Box>

      <Box sx={{ maxWidth: MAX_W, mx: "auto", px: 3, pt: `${HEADER_H + 16}px`, pb: 5 }}>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {/* Hero: run analytics — succeeded vs failed over time */}
          <RunStatusCard
            series={series}
            succeeded={totals.succeeded}
            failed={totals.failed}
            detailHref="/monitor"
          />

          {/* Unified activity history across all agents */}
          <AgentActivity items={activity} />
        </Box>
      </Box>
    </Box>
  );
}
