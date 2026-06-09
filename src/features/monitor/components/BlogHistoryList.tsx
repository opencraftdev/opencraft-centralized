"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import ArticleOutlined from "@mui/icons-material/ArticleOutlined";
import OpenInNewOutlined from "@mui/icons-material/OpenInNewOutlined";
import { formatDate, formatNumber } from "../format";
import type { BlogArticleItem } from "@/lib/monitor/types";

// Flat, reverse-chronological history of the blog drafts the agent authored.
const COLS = "minmax(0, 1fr) 130px 110px 36px";
const headSx = { fontSize: "0.75rem", fontWeight: 600, color: "#5F6368" };
const metaSx = { fontSize: "0.8125rem", color: "#5F6368" };

function DraftRow({ item }: { item: BlogArticleItem }) {
  const open = () => item.url && window.open(item.url, "_blank", "noopener,noreferrer");

  return (
    <Box
      onClick={open}
      sx={{
        display: "grid",
        gridTemplateColumns: COLS,
        alignItems: "center",
        gap: 2,
        px: 2,
        minHeight: 52,
        py: 1,
        borderBottom: "1px solid #F1F3F4",
        cursor: item.url ? "pointer" : "default",
        "&:hover": { bgcolor: "#F8F9FA" },
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, minWidth: 0 }}>
        <ArticleOutlined sx={{ fontSize: 20, color: "#1A73E8", flexShrink: 0 }} />
        <Box sx={{ minWidth: 0 }}>
          <Typography
            sx={{
              fontSize: "0.875rem",
              color: "#3C4043",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {item.title}
          </Typography>
          {item.summary && (
            <Typography
              sx={{
                fontSize: "0.75rem",
                color: "#80868B",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {item.summary}
            </Typography>
          )}
        </Box>
      </Box>
      <Typography sx={metaSx}>{formatDate(item.published_at ?? item.created_at)}</Typography>
      <Typography sx={metaSx}>
        {item.word_count != null ? `${formatNumber(item.word_count)} words` : "—"}
      </Typography>
      <Box sx={{ justifySelf: "end", color: "#9AA0A6" }}>
        {item.url && <OpenInNewOutlined sx={{ fontSize: 16 }} />}
      </Box>
    </Box>
  );
}

export function BlogHistoryList({ items }: { items: BlogArticleItem[] }) {
  if (items.length === 0) {
    return (
      <Box sx={{ textAlign: "center", py: 10, color: "rgba(0,0,0,0.45)" }}>
        <ArticleOutlined sx={{ fontSize: 48, color: "#DADCE0", mb: 1 }} />
        <Typography sx={{ fontSize: "0.9375rem", fontWeight: 500, color: "#5F6368" }}>
          No drafts yet
        </Typography>
        <Typography sx={{ fontSize: "0.8125rem" }}>
          Blog drafts the agent writes for you will appear here.
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: COLS,
          gap: 2,
          px: 2,
          pb: 1,
          borderBottom: "1px solid #E0E0E0",
        }}
      >
        {["Draft", "Date", "Length", ""].map((h, i) => (
          <Typography key={i} sx={headSx}>
            {h}
          </Typography>
        ))}
      </Box>
      {items.map((item) => (
        <DraftRow key={item.slug || item.title} item={item} />
      ))}
    </Box>
  );
}
