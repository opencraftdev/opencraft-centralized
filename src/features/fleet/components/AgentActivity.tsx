import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Link from "next/link";
import HistoryOutlined from "@mui/icons-material/HistoryOutlined";
import BoltOutlined from "@mui/icons-material/BoltOutlined";
import DescriptionOutlined from "@mui/icons-material/DescriptionOutlined";
import ChevronRightOutlined from "@mui/icons-material/ChevronRightOutlined";
import ChevronLeftOutlined from "@mui/icons-material/ChevronLeftOutlined";
import KeyboardArrowDownOutlined from "@mui/icons-material/KeyboardArrowDownOutlined";
import { relativeTime } from "@/features/monitor/format";
import type { AgentKind } from "@/lib/monitor/types";
import type { ActivityItem, ActivityOutcome } from "../queries";

const KIND_COLOR: Record<AgentKind, string> = {
  "social-media": "#1a73e8",
  document: "#9334E6",
  "comment-bot": "#E37400",
  blogpost: "#188038",
};

const KIND_LABEL: Record<AgentKind, string> = {
  "social-media": "Social Media",
  document: "Document",
  "comment-bot": "Comment Bot",
  blogpost: "Blogpost",
};

const OUTCOME: Record<ActivityOutcome, { label: string; fg: string; bg: string }> = {
  succeeded: { label: "Succeeded", fg: "#188038", bg: "#E6F4EA" },
  generated: { label: "Generated", fg: "#188038", bg: "#E6F4EA" },
  failed: { label: "Failed", fg: "#D93025", bg: "#FCE8E6" },
  running: { label: "Running", fg: "#1a73e8", bg: "#E8F0FE" },
  pending: { label: "Pending", fg: "#E37400", bg: "#FEF7E0" },
};

const COLS = "minmax(220px, 2.4fr) 1.1fr 0.9fr 0.8fr";

function HeadCell({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <Typography sx={{ fontSize: "0.75rem", fontWeight: 500, color: "#5f6368", textAlign: align }}>
      {children}
    </Typography>
  );
}

function OutcomeChip({ outcome }: { outcome: ActivityOutcome }) {
  const o = OUTCOME[outcome];
  return (
    <Box
      sx={{
        display: "inline-flex",
        alignItems: "center",
        px: 1,
        py: "2px",
        borderRadius: "9999px",
        fontSize: "0.6875rem",
        fontWeight: 600,
        color: o.fg,
        bgcolor: o.bg,
      }}
    >
      {o.label}
    </Box>
  );
}

export function AgentActivity({ items }: { items: ActivityItem[] }) {
  const shown = items.slice(0, 10);
  const empty = items.length === 0;

  return (
    <Box sx={{ bgcolor: "#fff", borderRadius: "12px", border: "1px solid #E8EAED", overflow: "hidden" }}>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 2, px: 3, pt: 3, pb: 2 }}>
        <HistoryOutlined sx={{ fontSize: 26, color: "#0B57D0", mt: 0.25 }} />
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontSize: "1.25rem", fontWeight: 400, color: "#202124" }}>
            Agent activity
          </Typography>
          <Typography sx={{ fontSize: "0.8125rem", color: "#5f6368", mt: 0.5 }}>
            Recent runs and outputs across every agent.
          </Typography>
        </Box>
      </Box>

      {empty ? (
        <Box sx={{ px: 3, pb: 4, pt: 1, color: "#9aa0a6", fontSize: "0.875rem" }}>
          No agent activity recorded yet. Agents report runs and outputs through the ingestion API.
        </Box>
      ) : (
        <>
          {/* Column headers */}
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: COLS,
              gap: 2,
              px: 3,
              py: 1.25,
              borderTop: "1px solid #E8EAED",
              borderBottom: "1px solid #E8EAED",
            }}
          >
            <HeadCell>Activity</HeadCell>
            <HeadCell>Agent</HeadCell>
            <HeadCell>Result</HeadCell>
            <HeadCell align="right">When</HeadCell>
          </Box>

          {/* Rows */}
          {shown.map((it) => (
            <Box
              key={it.key}
              sx={{
                display: "grid",
                gridTemplateColumns: COLS,
                gap: 2,
                alignItems: "center",
                px: 3,
                py: 1.75,
                borderBottom: "1px solid #F1F3F4",
                "&:hover": { bgcolor: "#F8FAFD" },
              }}
            >
              {/* Activity */}
              <Box sx={{ minWidth: 0, display: "flex", alignItems: "center", gap: 1.25 }}>
                {it.type === "document" ? (
                  <DescriptionOutlined sx={{ fontSize: 18, color: "#5f6368", flexShrink: 0 }} />
                ) : (
                  <BoltOutlined sx={{ fontSize: 18, color: "#5f6368", flexShrink: 0 }} />
                )}
                <Box sx={{ minWidth: 0 }}>
                  <Typography
                    sx={{
                      fontSize: "0.8125rem",
                      color: "#202124",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {it.title}
                  </Typography>
                  {it.detail && (
                    <Typography
                      sx={{
                        fontSize: "0.6875rem",
                        color: "#80868b",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {it.detail}
                    </Typography>
                  )}
                </Box>
              </Box>

              {/* Agent */}
              <Box sx={{ minWidth: 0, display: "flex", alignItems: "center", gap: 1 }}>
                <Box
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: "2px",
                    bgcolor: it.agentKind ? KIND_COLOR[it.agentKind] : "#9aa0a6",
                    flexShrink: 0,
                  }}
                />
                <Box sx={{ minWidth: 0 }}>
                  <Typography
                    sx={{
                      fontSize: "0.8125rem",
                      color: "#202124",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {it.agentName}
                  </Typography>
                  {it.agentKind && (
                    <Typography sx={{ fontSize: "0.6875rem", color: "#80868b" }}>
                      {KIND_LABEL[it.agentKind]}
                    </Typography>
                  )}
                </Box>
              </Box>

              {/* Result */}
              <Box>
                <OutcomeChip outcome={it.outcome} />
              </Box>

              {/* When */}
              <Typography sx={{ fontSize: "0.8125rem", color: "#5f6368", textAlign: "right" }}>
                {relativeTime(it.at)}
              </Typography>
            </Box>
          ))}

          {/* Footer */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 2,
              px: 3,
              py: 1.5,
            }}
          >
            <Box
              component={Link}
              href="/monitor"
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 0.5,
                fontSize: "0.8125rem",
                fontWeight: 500,
                color: "#0B57D0",
                textDecoration: "none",
                "&:hover": { textDecoration: "underline" },
              }}
            >
              Open document library
              <ChevronRightOutlined sx={{ fontSize: 18 }} />
            </Box>

            <Box sx={{ display: "flex", alignItems: "center", gap: 3 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                <Typography sx={{ fontSize: "0.75rem", color: "#5f6368" }}>Rows per page: 10</Typography>
                <KeyboardArrowDownOutlined sx={{ fontSize: 18, color: "#5f6368" }} />
              </Box>
              <Typography sx={{ fontSize: "0.75rem", color: "#5f6368" }}>
                1–{shown.length} of {items.length}
              </Typography>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <ChevronLeftOutlined sx={{ fontSize: 20, color: "#bdc1c6" }} />
                <ChevronRightOutlined sx={{ fontSize: 20, color: items.length > 10 ? "#5f6368" : "#bdc1c6" }} />
              </Box>
            </Box>
          </Box>
        </>
      )}
    </Box>
  );
}
