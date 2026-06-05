"use client";

import { useState, useTransition } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Tooltip from "@mui/material/Tooltip";
import RefreshOutlined from "@mui/icons-material/RefreshOutlined";
import SearchOutlined from "@mui/icons-material/SearchOutlined";
import SendOutlined from "@mui/icons-material/SendOutlined";
import EditNoteOutlined from "@mui/icons-material/EditNoteOutlined";
import { useRouter } from "next/navigation";
import type { QueueStats, BotCommandRow } from "@/lib/comment-bot/types";

interface Props {
  stats: QueueStats;
  commands: BotCommandRow[];
}

const COMMAND_STATUS_COLOR: Record<string, "default" | "warning" | "success" | "error"> = {
  pending: "warning",
  running: "warning",
  done: "success",
  failed: "error",
};

const PLATFORM_LABEL: Record<string, string> = {
  threads: "Threads",
  x: "X",
  all: "All",
};

function StatCard({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max?: number;
  color?: string;
}) {
  return (
    <Box
      sx={{
        bgcolor: "#fff",
        borderRadius: "12px",
        border: "1px solid #E8EAED",
        p: 2.5,
        minWidth: 140,
        flex: 1,
      }}
    >
      <Typography sx={{ fontSize: "0.75rem", color: "#5f6368", mb: 0.5 }}>{label}</Typography>
      <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.5 }}>
        <Typography
          sx={{
            fontSize: "2rem",
            fontWeight: 500,
            lineHeight: 1,
            color: color ?? "#1F1F1F",
          }}
        >
          {value}
        </Typography>
        {max != null && (
          <Typography sx={{ fontSize: "0.875rem", color: "#9AA0A6" }}>/ {max}</Typography>
        )}
      </Box>
    </Box>
  );
}

export function StatusOverview({ stats, commands }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [loadingCmd, setLoadingCmd] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function sendCommand(
    command: "scrape" | "post_approved" | "draft",
    platform?: "threads" | "x" | "all",
  ) {
    const key = `${command}-${platform ?? "all"}`;
    setLoadingCmd(key);
    setError(null);
    try {
      const res = await fetch("/api/comment-bot/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command, platform: platform ?? "all" }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json.error ?? "Failed to send command");
        return;
      }
      startTransition(() => router.refresh());
    } finally {
      setLoadingCmd(null);
    }
  }

  const threadsAtCap = stats.posted_today_threads >= stats.cap_per_day;
  const xAtCap = stats.posted_today_x >= stats.cap_per_day;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      {/* Stat cards */}
      <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
        <StatCard
          label="Threads today"
          value={stats.posted_today_threads}
          max={stats.cap_per_day}
          color={threadsAtCap ? "#D93025" : undefined}
        />
        <StatCard
          label="X today"
          value={stats.posted_today_x}
          max={stats.cap_per_day}
          color={xAtCap ? "#D93025" : undefined}
        />
        <StatCard
          label="Ready for review"
          value={stats.ready_for_review}
          color={stats.ready_for_review > 0 ? "#1A73E8" : undefined}
        />
        <StatCard label="Approved (pending post)" value={stats.approved} />
        <StatCard label="Scraped (not drafted)" value={stats.scraped} />
      </Box>

      {/* Quick actions */}
      <Box
        sx={{
          bgcolor: "#fff",
          borderRadius: "12px",
          border: "1px solid #E8EAED",
          p: 2.5,
        }}
      >
        <Typography sx={{ fontSize: "0.875rem", fontWeight: 500, mb: 2, color: "#1F1F1F" }}>
          Quick Actions
        </Typography>
        <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }}>
          <Tooltip title="Scrape Threads for new viral posts">
            <span>
              <Button
                variant="outlined"
                size="small"
                startIcon={
                  loadingCmd === "scrape-threads" ? (
                    <CircularProgress size={14} />
                  ) : (
                    <SearchOutlined />
                  )
                }
                disabled={!!loadingCmd || pending}
                onClick={() => sendCommand("scrape", "threads")}
              >
                Scrape Threads
              </Button>
            </span>
          </Tooltip>
          <Tooltip title="Scrape X for new viral posts">
            <span>
              <Button
                variant="outlined"
                size="small"
                startIcon={
                  loadingCmd === "scrape-x" ? (
                    <CircularProgress size={14} />
                  ) : (
                    <SearchOutlined />
                  )
                }
                disabled={!!loadingCmd || pending}
                onClick={() => sendCommand("scrape", "x")}
              >
                Scrape X
              </Button>
            </span>
          </Tooltip>
          <Tooltip title="Draft replies for all scraped (not yet drafted) posts">
            <span>
              <Button
                variant="outlined"
                size="small"
                startIcon={
                  loadingCmd === "draft-all" ? (
                    <CircularProgress size={14} />
                  ) : (
                    <EditNoteOutlined />
                  )
                }
                disabled={!!loadingCmd || pending}
                onClick={() => sendCommand("draft", "all")}
              >
                Draft All
              </Button>
            </span>
          </Tooltip>
          <Tooltip
            title={
              stats.approved === 0
                ? "No approved replies to post"
                : "Post all approved replies (respects daily cap + delays)"
            }
          >
            <span>
              <Button
                variant="contained"
                size="small"
                startIcon={
                  loadingCmd === "post_approved-all" ? (
                    <CircularProgress size={14} color="inherit" />
                  ) : (
                    <SendOutlined />
                  )
                }
                disabled={!!loadingCmd || pending || stats.approved === 0}
                onClick={() => sendCommand("post_approved", "all")}
              >
                Post All Approved ({stats.approved})
              </Button>
            </span>
          </Tooltip>
        </Box>
        {error && (
          <Typography sx={{ mt: 1.5, fontSize: "0.8125rem", color: "#D93025" }}>{error}</Typography>
        )}
      </Box>

      {/* Recent commands */}
      <Box
        sx={{
          bgcolor: "#fff",
          borderRadius: "12px",
          border: "1px solid #E8EAED",
          p: 2.5,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
          <Typography sx={{ fontSize: "0.875rem", fontWeight: 500, color: "#1F1F1F" }}>
            Recent Commands
          </Typography>
          <Button
            size="small"
            startIcon={pending ? <CircularProgress size={14} /> : <RefreshOutlined />}
            disabled={pending}
            onClick={() => startTransition(() => router.refresh())}
            sx={{ fontSize: "0.8125rem" }}
          >
            Refresh
          </Button>
        </Box>
        {commands.length === 0 ? (
          <Typography sx={{ fontSize: "0.875rem", color: "#9AA0A6" }}>
            No commands issued yet. Use the quick actions above to trigger scraping or posting.
          </Typography>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {commands.map((cmd) => (
              <Box
                key={cmd.id}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1.5,
                  py: 0.75,
                  borderBottom: "1px solid #F1F3F4",
                  "&:last-child": { borderBottom: "none" },
                }}
              >
                <Chip
                  label={cmd.status}
                  size="small"
                  color={COMMAND_STATUS_COLOR[cmd.status] ?? "default"}
                  sx={{ fontSize: "0.6875rem", height: 20, minWidth: 64 }}
                />
                <Typography sx={{ fontSize: "0.875rem", fontWeight: 500 }}>
                  {cmd.command}
                </Typography>
                {cmd.platform && (
                  <Typography sx={{ fontSize: "0.8125rem", color: "#5f6368" }}>
                    {PLATFORM_LABEL[cmd.platform] ?? cmd.platform}
                  </Typography>
                )}
                {cmd.command === "scrape" && cmd.status === "done" && cmd.context?.scraped_count != null && (
                  <Typography sx={{ fontSize: "0.75rem", color: "#1A73E8", fontWeight: 500 }}>
                    +{cmd.context.scraped_count as number} scraped
                  </Typography>
                )}
                {cmd.command === "draft" && cmd.status === "done" && cmd.context?.drafted_count != null && (
                  <Typography sx={{ fontSize: "0.75rem", color: "#1A73E8", fontWeight: 500 }}>
                    +{cmd.context.drafted_count as number} drafted
                  </Typography>
                )}
                <Typography sx={{ fontSize: "0.75rem", color: "#9AA0A6", ml: "auto" }}>
                  {new Date(cmd.created_at).toLocaleString()}
                </Typography>
                {cmd.error && (
                  <Tooltip title={cmd.error}>
                    <Typography sx={{ fontSize: "0.75rem", color: "#D93025", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {cmd.error}
                    </Typography>
                  </Tooltip>
                )}
              </Box>
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
}
