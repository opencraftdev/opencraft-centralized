"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import Tooltip from "@mui/material/Tooltip";
import OpenInNewOutlined from "@mui/icons-material/OpenInNewOutlined";
import type { ReplyRow, ReplyStatus } from "@/lib/comment-bot/types";

interface Props {
  replies: ReplyRow[];
}

const STATUS_COLOR: Record<ReplyStatus, "default" | "success" | "error" | "warning" | "info"> = {
  scraped: "default",
  ready_for_review: "info",
  approved: "warning",
  posted: "success",
  failed: "error",
  skipped: "default",
};

const STATUS_LABEL: Record<ReplyStatus, string> = {
  scraped: "Scraped",
  ready_for_review: "In Review",
  approved: "Approved",
  posted: "Posted",
  failed: "Failed",
  skipped: "Skipped",
};

const MODE_LABEL: Record<string, string> = {
  agree_and_extend: "Agree & Extend",
  polite_contrarian: "Polite Contrarian",
  concrete_example: "Concrete Example",
  ask_sharpening_question: "Sharpening Q",
  translate_to_outcome: "Outcome",
};

const FILTER_TABS = [
  { label: "All", value: "all" },
  { label: "Posted", value: "posted" },
  { label: "Approved", value: "approved" },
  { label: "Skipped", value: "skipped" },
  { label: "Failed", value: "failed" },
];

export function ReplyHistory({ replies }: Props) {
  const [filter, setFilter] = useState<string>("all");

  const visible =
    filter === "all" ? replies : replies.filter((r) => r.status === filter);

  return (
    <Box>
      <Tabs
        value={filter}
        onChange={(_, v) => setFilter(v)}
        sx={{ mb: 2, "& .MuiTab-root": { fontSize: "0.8125rem", minHeight: 40, py: 1 } }}
      >
        {FILTER_TABS.map((t) => (
          <Tab key={t.value} label={t.label} value={t.value} />
        ))}
      </Tabs>

      <Box
        sx={{
          bgcolor: "#fff",
          borderRadius: "12px",
          border: "1px solid #E8EAED",
          overflow: "hidden",
        }}
      >
        {visible.length === 0 ? (
          <Box sx={{ p: 4, textAlign: "center" }}>
            <Typography sx={{ fontSize: "0.875rem", color: "#9AA0A6" }}>
              No replies in this category yet.
            </Typography>
          </Box>
        ) : (
          <Box component="table" sx={{ width: "100%", borderCollapse: "collapse" }}>
            <Box
              component="thead"
              sx={{
                bgcolor: "#F8F9FA",
                "& th": {
                  px: 2,
                  py: 1.5,
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  color: "#5f6368",
                  textAlign: "left",
                  borderBottom: "1px solid #E8EAED",
                  whiteSpace: "nowrap",
                },
              }}
            >
              <tr>
                <th>Platform</th>
                <th>Author</th>
                <th>Parent post</th>
                <th>Mode</th>
                <th>Status</th>
                <th>Date</th>
                <th>Reply</th>
              </tr>
            </Box>
            <Box
              component="tbody"
              sx={{
                "& tr": {
                  borderBottom: "1px solid #F1F3F4",
                  "&:last-child": { borderBottom: "none" },
                  "&:hover": { bgcolor: "#F8F9FA" },
                },
                "& td": {
                  px: 2,
                  py: 1.5,
                  fontSize: "0.8125rem",
                  color: "#3C4043",
                  verticalAlign: "middle",
                },
              }}
            >
              {visible.map((reply) => (
                <tr key={reply.id}>
                  <td>
                    <Typography sx={{ fontSize: "0.8125rem", fontWeight: 500, textTransform: "capitalize" }}>
                      {reply.platform}
                    </Typography>
                  </td>
                  <td>
                    <Typography sx={{ fontSize: "0.8125rem", color: "#5f6368" }}>
                      {reply.parent_author ? `@${reply.parent_author}` : "—"}
                    </Typography>
                  </td>
                  <td>
                    <Tooltip title={reply.parent_post_text ?? ""}>
                      <Typography
                        sx={{
                          fontSize: "0.8125rem",
                          maxWidth: 280,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          cursor: "default",
                        }}
                      >
                        {reply.parent_post_text
                          ? reply.parent_post_text.slice(0, 80) +
                            (reply.parent_post_text.length > 80 ? "…" : "")
                          : "—"}
                      </Typography>
                    </Tooltip>
                  </td>
                  <td>
                    {reply.reply_mode ? (
                      <Chip
                        label={MODE_LABEL[reply.reply_mode] ?? reply.reply_mode}
                        size="small"
                        variant="outlined"
                        sx={{ fontSize: "0.6875rem", height: 20 }}
                      />
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>
                    <Chip
                      label={STATUS_LABEL[reply.status]}
                      size="small"
                      color={STATUS_COLOR[reply.status]}
                      sx={{ fontSize: "0.6875rem", height: 20 }}
                    />
                    {reply.error && (
                      <Tooltip title={reply.error}>
                        <Typography
                          sx={{
                            fontSize: "0.6875rem",
                            color: "#D93025",
                            mt: 0.25,
                            maxWidth: 160,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {reply.error}
                        </Typography>
                      </Tooltip>
                    )}
                  </td>
                  <td>
                    <Typography sx={{ fontSize: "0.75rem", color: "#9AA0A6", whiteSpace: "nowrap" }}>
                      {reply.posted_at
                        ? new Date(reply.posted_at).toLocaleDateString()
                        : reply.updated_at
                        ? new Date(reply.updated_at).toLocaleDateString()
                        : "—"}
                    </Typography>
                  </td>
                  <td>
                    {reply.reply_url ? (
                      <Tooltip title="View posted reply">
                        <Box
                          component="a"
                          href={reply.reply_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          sx={{ color: "#1A73E8", display: "inline-flex" }}
                        >
                          <OpenInNewOutlined sx={{ fontSize: 16 }} />
                        </Box>
                      </Tooltip>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
}
