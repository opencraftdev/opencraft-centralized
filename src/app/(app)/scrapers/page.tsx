import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

import { createClient } from "@/lib/supabase/server";
import { getScraperLeads } from "@/features/scrapers/queries";
import { ScrapersView } from "@/features/scrapers/components/ScrapersView";

export const dynamic = "force-dynamic";

const MAX_W = 1180;
const SIDEBAR = 280;
const TOPBAR = 64;
const HEADER_H = 68;

export default async function ScrapersPage() {
  const supabase = await createClient();
  const leads = await getScraperLeads(supabase);

  const withEmail = leads.filter((l) => l.email).length;

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
              Scrapers
            </Typography>
            <Typography sx={{ fontSize: "0.75rem", color: "#5f6368" }}>
              Google Maps leads · {leads.length} businesses · {withEmail} with email
            </Typography>
          </Box>
        </Box>
      </Box>

      <Box sx={{ maxWidth: MAX_W, mx: "auto", px: 3, pt: `${HEADER_H + 16}px`, pb: 5 }}>
        <ScrapersView leads={leads} />
      </Box>
    </Box>
  );
}
