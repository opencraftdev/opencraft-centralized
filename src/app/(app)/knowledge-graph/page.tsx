import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

import { createClient } from "@/lib/supabase/server";
import { getBrandGraph } from "@/features/knowledge-graph/queries";
import { KnowledgeGraphView } from "@/features/knowledge-graph/components/KnowledgeGraphView";

export const dynamic = "force-dynamic";

const MAX_W = 1180;
const SIDEBAR = 280;
const TOPBAR = 64;
const HEADER_H = 68;

export default async function KnowledgeGraphPage() {
  const supabase = await createClient();
  const graph = await getBrandGraph(supabase, "opencraft");

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
              Knowledge Graph
            </Typography>
            <Typography sx={{ fontSize: "0.75rem", color: "#5f6368" }}>
              OpenCraft brand knowledge · {graph.nodes.length} entities · {graph.edges.length} relationships
            </Typography>
          </Box>
        </Box>
      </Box>

      <Box
        sx={{
          maxWidth: MAX_W,
          mx: "auto",
          px: 3,
          pt: `${HEADER_H + 16}px`,
          pb: 5,
          // Give the 3D canvas a tall, stable viewport.
          height: "calc(100vh - 64px)",
        }}
      >
        <KnowledgeGraphView graph={graph} />
      </Box>
    </Box>
  );
}
