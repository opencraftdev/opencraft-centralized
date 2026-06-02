"use client";

import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import ArticleOutlined from "@mui/icons-material/ArticleOutlined";
import OpenInNewOutlined from "@mui/icons-material/OpenInNewOutlined";
import FilterListOutlined from "@mui/icons-material/FilterListOutlined";
import { formatDate, formatNumber } from "../format";
import type { DocumentHistoryItem } from "@/lib/monitor/types";

const COLS = "minmax(0, 1fr) 160px 110px 90px 36px";
const headSx = { fontSize: "0.75rem", fontWeight: 600, color: "#5F6368" };
const metaSx = { fontSize: "0.8125rem", color: "#5F6368" };

const ALL = "All sources";

function sourceOf(doc: DocumentHistoryItem): string {
  return doc.tool?.trim() || (doc.metadata?.source_name as string | undefined)?.trim() || "Unknown";
}

function ArticleRow({ doc }: { doc: DocumentHistoryItem }) {
  const open = () =>
    doc.file_url && window.open(doc.file_url, "_blank", "noopener,noreferrer");
  const summary = (doc.metadata?.summary as string | undefined) ?? "";

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
        cursor: doc.file_url ? "pointer" : "default",
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
            {doc.title}
          </Typography>
          {summary && (
            <Typography
              sx={{
                fontSize: "0.75rem",
                color: "#80868B",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {summary}
            </Typography>
          )}
        </Box>
      </Box>
      <Typography sx={metaSx}>{sourceOf(doc)}</Typography>
      <Typography sx={metaSx}>{formatDate(doc.generated_at)}</Typography>
      <Typography sx={metaSx}>
        {doc.word_count != null ? `${formatNumber(doc.word_count)} words` : "—"}
      </Typography>
      <Box sx={{ justifySelf: "end", color: "#9AA0A6" }}>
        {doc.file_url && <OpenInNewOutlined sx={{ fontSize: 16 }} />}
      </Box>
    </Box>
  );
}

export function BlogLibrary({ documents }: { documents: DocumentHistoryItem[] }) {
  const [source, setSource] = useState<string>(ALL);

  const sources = useMemo(() => {
    const set = new Set(documents.map(sourceOf));
    return [ALL, ...[...set].sort((a, b) => a.localeCompare(b))];
  }, [documents]);

  const filtered = useMemo(
    () => (source === ALL ? documents : documents.filter((d) => sourceOf(d) === source)),
    [documents, source],
  );

  if (documents.length === 0) {
    return (
      <Box sx={{ textAlign: "center", py: 10, color: "rgba(0,0,0,0.45)" }}>
        <ArticleOutlined sx={{ fontSize: 48, color: "#DADCE0", mb: 1 }} />
        <Typography sx={{ fontSize: "0.9375rem", fontWeight: 500, color: "#5F6368" }}>
          No articles tracked yet
        </Typography>
        <Typography sx={{ fontSize: "0.8125rem" }}>
          Articles published by Blogpost Automation will appear here after the next sync.
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      {sources.length > 2 && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", mb: 1.5 }}>
          <FilterListOutlined sx={{ fontSize: 18, color: "#9AA0A6" }} />
          {sources.map((s) => (
            <Chip
              key={s}
              label={s}
              size="small"
              onClick={() => setSource(s)}
              variant={source === s ? "filled" : "outlined"}
              sx={{
                fontSize: "0.75rem",
                bgcolor: source === s ? "#E8F0FE" : "transparent",
                color: source === s ? "#1A73E8" : "#5F6368",
                borderColor: "#DADCE0",
              }}
            />
          ))}
        </Box>
      )}

      <Box sx={{ display: "grid", gridTemplateColumns: COLS, gap: 2, px: 2, pb: 1, borderBottom: "1px solid #E0E0E0" }}>
        {["Article", "Source", "Published", "Length", ""].map((h, i) => (
          <Typography key={i} sx={headSx}>{h}</Typography>
        ))}
      </Box>
      {filtered.map((doc) => (
        <ArticleRow key={doc.id} doc={doc} />
      ))}
    </Box>
  );
}
