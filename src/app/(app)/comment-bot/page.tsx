import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { createClient } from "@/lib/supabase/server";
import { getQueueStats, getRecentCommands, getScrapedPosts } from "@/lib/comment-bot/queries";
import { StatusOverview } from "@/features/comment-bot/components/StatusOverview";
import { ScrapedPosts } from "@/features/comment-bot/components/ScrapedPosts";

export const dynamic = "force-dynamic";

const MAX_W = 1200;
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

export default async function CommentBotPage() {
  const supabase = await createClient();

  const [stats, commands, scraped] = await Promise.all([
    getQueueStats(supabase),
    getRecentCommands(supabase, 10),
    getScrapedPosts(supabase, 20),
  ]);

  return (
    <Box sx={{ minHeight: "100%", bgcolor: "#F0F4F9" }}>
      <PageHeader>
        <Typography
          component="h1"
          sx={{ fontSize: "1.375rem", fontWeight: 400, lineHeight: "1.75rem", color: "#1F1F1F" }}
        >
          Comment Bot
        </Typography>
        <Typography sx={{ fontSize: "0.75rem", color: "#5f6368" }}>
          {stats.posted_today_threads + stats.posted_today_x} posts today ·{" "}
          {stats.ready_for_review} awaiting review
        </Typography>
      </PageHeader>

      <Box sx={{ maxWidth: MAX_W, mx: "auto", px: 3, pt: `${HEADER_H + 16}px`, pb: 5 }}>
        <StatusOverview stats={stats} commands={commands} />

        {/* Recently scraped posts */}
        <Box sx={{ mt: 3 }}>
          <Typography sx={{ fontSize: "0.875rem", fontWeight: 500, color: "#1F1F1F", mb: 1.5 }}>
            Recently Scraped ({scraped.length})
          </Typography>
          <ScrapedPosts posts={scraped} />
        </Box>
      </Box>
    </Box>
  );
}
