import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { createClient } from "@/lib/supabase/server";
import { getRecentTutorialVideos } from "@/features/tutorial-video/queries";
import { RecordVideoTabs } from "@/features/tutorial-video/components/RecordVideoTabs";
import { getRecentNewsBriefs } from "@/features/news-materials/queries";
import { getCloudinaryConfig, getCreditUsage } from "@/lib/cloudinary";
import type { CreditUsage, TutorialVideoRow } from "@/features/tutorial-video/types";
import type { NewsBriefRow } from "@/features/news-materials/types";

export const dynamic = "force-dynamic";

const MAX_W = "100%";
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

export default async function TutorialVideoPage() {
  const supabase = await createClient();

  // Degrade gracefully if the migration hasn't been applied or Cloudinary
  // isn't configured — the page still renders.
  let videos: TutorialVideoRow[] = [];
  try {
    videos = await getRecentTutorialVideos(supabase, 20);
  } catch {
    videos = [];
  }

  let usage: CreditUsage | null = null;
  const config = getCloudinaryConfig();
  if (config) usage = await getCreditUsage(config);

  // AI News Brief tab — degrade gracefully if the migration isn't applied yet.
  let briefs: NewsBriefRow[] = [];
  try {
    briefs = await getRecentNewsBriefs(supabase, 20);
  } catch {
    briefs = [];
  }

  return (
    <Box sx={{ minHeight: "100%", bgcolor: "#F0F4F9" }}>
      <PageHeader>
        <Typography
          component="h1"
          sx={{ fontSize: "1.375rem", fontWeight: 400, lineHeight: "1.75rem", color: "#1F1F1F" }}
        >
          Record Video
        </Typography>
        <Typography sx={{ fontSize: "0.75rem", color: "#5f6368" }}>
          Record with the desktop app, then upload your 9:16 clip to add your name, logo, captions and outro — or browse ready-to-record AI news briefs.
        </Typography>
      </PageHeader>

      <Box sx={{ maxWidth: MAX_W, mx: "auto", px: 3, pt: `${HEADER_H + 16}px`, pb: 5 }}>
        <RecordVideoTabs initialVideos={videos} initialUsage={usage} initialBriefs={briefs} />
      </Box>
    </Box>
  );
}
