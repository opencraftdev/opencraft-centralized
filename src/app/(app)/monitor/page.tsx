import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { createClient } from "@/lib/supabase/server";
import { getAgentBySlug, getDocuments } from "@/lib/monitor/queries";
import { DocumentLibrary } from "@/features/monitor/components/DocumentLibrary";
import { StatusDot } from "@/features/monitor/components/StatusDot";
import { relativeTime } from "@/features/monitor/format";

export const dynamic = "force-dynamic";

const SLUG = "document-agent";
const MAX_W = 1200;
const SIDEBAR = 280;
const TOPBAR = 64;
const HEADER_H = 68;

// Fixed page header — matches the dashboard / posts / calendar design system:
// a gray bar pinned below the top nav, with the centered max-width container.
function PageHeader({ children }: { children: React.ReactNode }) {
  return (
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
      <Box sx={{ maxWidth: MAX_W, mx: "auto", px: 3, width: "100%" }}>{children}</Box>
    </Box>
  );
}

export default async function DocumentAgentPage() {
  const supabase = await createClient();
  const agent = await getAgentBySlug(supabase, SLUG);

  if (!agent) {
    return (
      <Box sx={{ minHeight: "100%", bgcolor: "#F0F4F9" }}>
        <PageHeader>
          <Typography
            component="h1"
            sx={{ fontSize: "1.375rem", fontWeight: 400, lineHeight: "1.75rem", color: "#1F1F1F" }}
          >
            Document
          </Typography>
        </PageHeader>
        <Box sx={{ maxWidth: MAX_W, mx: "auto", px: 3, pt: `${HEADER_H + 16}px`, pb: 5 }}>
          <Box
            sx={{
              bgcolor: "#fff",
              borderRadius: "12px",
              border: "1px solid #E8EAED",
              p: 4,
            }}
          >
            <Typography sx={{ fontSize: "0.875rem", color: "rgba(0,0,0,0.54)" }}>
              Document monitoring is not registered yet. Apply the telemetry migration and seed the
              registry.
            </Typography>
          </Box>
        </Box>
      </Box>
    );
  }

  const documents = await getDocuments(supabase, agent.id, 200);

  return (
    <Box sx={{ minHeight: "100%", bgcolor: "#F0F4F9" }}>
      <PageHeader>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Typography
            component="h1"
            sx={{ fontSize: "1.375rem", fontWeight: 400, lineHeight: "1.75rem", color: "#1F1F1F" }}
          >
            Document
          </Typography>
          <StatusDot status={agent.status} />
        </Box>
        <Typography sx={{ fontSize: "0.75rem", color: "#5f6368" }}>
          {documents.length} {documents.length === 1 ? "document" : "documents"} · last sync{" "}
          {relativeTime(agent.last_heartbeat_at)}
        </Typography>
      </PageHeader>

      <Box sx={{ maxWidth: MAX_W, mx: "auto", px: 3, pt: `${HEADER_H + 16}px`, pb: 5 }}>
        <Box
          sx={{
            bgcolor: "#fff",
            borderRadius: "12px",
            border: "1px solid #E8EAED",
            p: { xs: 2, md: 3 },
          }}
        >
          <DocumentLibrary documents={documents} />
        </Box>
      </Box>
    </Box>
  );
}
