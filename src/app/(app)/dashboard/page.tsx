import { createClient } from "@/lib/supabase/server";
import { getMonthHeatmap, getRecentPosts } from "@/features/dashboard/queries";
import { CalendarHeatmap } from "@/features/dashboard/components/CalendarHeatmap";
import { RecentPosts } from "@/features/dashboard/components/RecentPosts";
import Link from "next/link";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import MuiButton from "@mui/material/Button";
import ChevronRightOutlined from "@mui/icons-material/ChevronRightOutlined";
import TipsAndUpdatesOutlined from "@mui/icons-material/TipsAndUpdatesOutlined";

function OverviewCard({
  title,
  href,
  children,
}: {
  title: string;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Card variant="outlined" sx={{ borderRadius: "12px", border: "none", bgcolor: "#fff" }}>
      <CardContent sx={{ p: 0, "&:last-child": { pb: 0 } }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            px: 3,
            py: 1.5,
          }}
        >
          <Typography
            sx={{
              fontSize: "1.5rem",
              fontWeight: 400,
              lineHeight: "2rem",
              color: "#474747",
            }}
          >
            {title}
          </Typography>
          <MuiButton
            component={Link}
            href={href}
            variant="text"
            size="small"
            endIcon={<ChevronRightOutlined sx={{ fontSize: "18px !important" }} />}
            sx={{
              color: "#0B57D0",
              fontSize: "0.875rem",
              fontWeight: 500,
              textTransform: "none",
            }}
          >
            Open
          </MuiButton>
        </Box>
        <Box sx={{ px: 3, pb: 2.5 }}>{children}</Box>
      </CardContent>
    </Card>
  );
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const [heatmap, recentPosts] = await Promise.all([
    getMonthHeatmap(supabase, year, month),
    getRecentPosts(supabase),
  ]);

  return (
    <Box sx={{ minHeight: "100%", bgcolor: "#F0F4F9" }}>
      {/* Fixed page header */}
      <Box
        sx={{
          position: "fixed",
          top: 64,
          left: 280,
          right: 0,
          zIndex: 10,
          height: 60,
          bgcolor: "#F0F4F9",
          borderBottom: "1px solid #E8EAED",
          display: "flex",
          alignItems: "center",
        }}
      >
        <Box sx={{ maxWidth: 936, mx: "auto", px: 3, width: "100%" }}>
          <Typography
            component="h1"
            sx={{
              fontSize: "1.375rem",
              fontWeight: 400,
              lineHeight: "1.75rem",
              color: "#1F1F1F",
            }}
          >
            Overview
          </Typography>
        </Box>
      </Box>

      <Box sx={{ maxWidth: 936, mx: "auto", px: 3, pt: "76px", pb: 4 }}>

        {/* Insights banner */}
        <Card
          variant="outlined"
          sx={{
            mb: 2,
            borderRadius: "12px",
            border: "none",
            bgcolor: "#fff",
          }}
        >
          <CardContent
            sx={{
              py: 1.5,
              px: 2.5,
              "&:last-child": { pb: 1.5 },
              display: "flex",
              alignItems: "center",
              gap: 1.5,
            }}
          >
            <TipsAndUpdatesOutlined sx={{ fontSize: 24, color: "#F9AB00", flexShrink: 0 }} />
            <Typography variant="body2" sx={{ flex: 1, color: "rgba(0,0,0,0.87)" }}>
              Track your agentic content on the timeline.
            </Typography>
            <MuiButton
              component={Link}
              href="/calendar"
              variant="text"
              size="small"
              endIcon={<ChevronRightOutlined sx={{ fontSize: "18px !important" }} />}
              sx={{
                color: "#0B57D0",
                fontSize: "0.875rem",
                fontWeight: 500,
                textTransform: "none",
                flexShrink: 0,
              }}
            >
              Open timeline
            </MuiButton>
          </CardContent>
        </Card>

        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {/* Activity heatmap card */}
          <OverviewCard title="Activity" href="/calendar">
            <CalendarHeatmap year={year} month={month} data={heatmap} />
          </OverviewCard>

          {/* Recent agentic content card */}
          <Card variant="outlined" sx={{ borderRadius: "12px", border: "none", bgcolor: "#fff" }}>
            <CardContent sx={{ p: 0, "&:last-child": { pb: 0 } }}>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  px: 3,
                  py: 1.5,
                }}
              >
                <Typography
                  sx={{
                    fontSize: "1.5rem",
                    fontWeight: 400,
                    lineHeight: "2rem",
                    color: "#474747",
                  }}
                >
                  Recent content
                </Typography>
                <MuiButton
                  component={Link}
                  href="/calendar"
                  variant="text"
                  size="small"
                  endIcon={<ChevronRightOutlined sx={{ fontSize: "18px !important" }} />}
                  sx={{
                    color: "#0B57D0",
                    fontSize: "0.875rem",
                    fontWeight: 500,
                    textTransform: "none",
                  }}
                >
                  Open timeline
                </MuiButton>
              </Box>
              <RecentPosts posts={recentPosts} />
            </CardContent>
          </Card>
        </Box>
      </Box>
    </Box>
  );
}
