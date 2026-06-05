import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { createClient } from "@/lib/supabase/server";
import { getBrandProfile } from "@/lib/comment-bot/queries";
import { BrandProfileEditor } from "@/features/comment-bot/components/BrandProfileEditor";

export const dynamic = "force-dynamic";

const MAX_W = 900;
const SIDEBAR = 280;
const TOPBAR = 64;
const HEADER_H = 68;

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

export default async function BrandPage() {
  const supabase = await createClient();
  const profile = await getBrandProfile(supabase);

  return (
    <Box sx={{ minHeight: "100%", bgcolor: "#F0F4F9" }}>
      <PageHeader>
        <Typography
          component="h1"
          sx={{ fontSize: "1.375rem", fontWeight: 400, lineHeight: "1.75rem", color: "#1F1F1F" }}
        >
          Brand Profile
        </Typography>
        <Typography sx={{ fontSize: "0.75rem", color: "#5f6368" }}>
          Single source of truth for bot voice, keywords, and posting rules
        </Typography>
      </PageHeader>

      <Box sx={{ maxWidth: MAX_W, mx: "auto", px: 3, pt: `${HEADER_H + 16}px`, pb: 5 }}>
        <BrandProfileEditor profile={profile} />
      </Box>
    </Box>
  );
}
