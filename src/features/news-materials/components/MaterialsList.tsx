"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Collapse from "@mui/material/Collapse";
import Chip from "@mui/material/Chip";
import ArticleOutlined from "@mui/icons-material/ArticleOutlined";
import ContentCopyOutlined from "@mui/icons-material/ContentCopyOutlined";
import CheckOutlined from "@mui/icons-material/CheckOutlined";
import ExpandMoreOutlined from "@mui/icons-material/ExpandMoreOutlined";
import ExpandLessOutlined from "@mui/icons-material/ExpandLessOutlined";
import OpenInNewOutlined from "@mui/icons-material/OpenInNewOutlined";
import ScheduleOutlined from "@mui/icons-material/ScheduleOutlined";
import PersonOutlined from "@mui/icons-material/PersonOutlined";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import { formatDate } from "@/features/monitor/format";
import { PRESENTERS } from "@/features/tutorial-video/presenters";
import type { NewsBriefRow } from "../types";

const metaSx = { fontSize: "0.75rem", color: "#80868B" };

// Presenter picker for presenter-neutral briefs: the user chooses who will
// record this brief (the brief content itself names no presenter).
function PresenterPicker() {
  const [id, setId] = useState(PRESENTERS[0].id);
  return (
    <Select
      value={id}
      onChange={(e) => setId(e.target.value)}
      size="small"
      startAdornment={<PersonOutlined sx={{ fontSize: 16, color: "#5F6368", mr: 0.5 }} />}
      sx={{
        height: 26,
        fontSize: "0.75rem",
        color: "#3C4043",
        "& .MuiSelect-select": { py: 0, pl: 0.5 },
        "& .MuiOutlinedInput-notchedOutline": { borderColor: "#DADCE0" },
      }}
    >
      {PRESENTERS.map((p) => (
        <MenuItem key={p.id} value={p.id} sx={{ fontSize: "0.8125rem" }}>
          {p.name} · {p.handle}
        </MenuItem>
      ))}
    </Select>
  );
}

function fmtSeconds(s: number | null | undefined): string {
  if (s == null) return "—";
  const total = Math.round(s);
  const m = Math.floor(total / 60);
  const r = total % 60;
  return m > 0 ? `${m}m ${r}s` : `${r}s`;
}

// Copy-to-clipboard button with a transient check confirmation.
function CopyButton({ text, title }: { text: string; title: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard blocked — ignore
    }
  };
  return (
    <Tooltip title={copied ? "Copied" : title}>
      <IconButton size="small" onClick={copy} sx={{ color: copied ? "#1E8E3E" : "#5F6368" }}>
        {copied ? (
          <CheckOutlined sx={{ fontSize: 16 }} />
        ) : (
          <ContentCopyOutlined sx={{ fontSize: 16 }} />
        )}
      </IconButton>
    </Tooltip>
  );
}

function ScriptBlock({ brief }: { brief: NewsBriefRow }) {
  const [open, setOpen] = useState(false);
  const s = brief.script;
  const scriptText = [
    s?.hook,
    ...(s?.segments ?? []).map((seg) => `${seg.title}\n${seg.narration}`),
    s?.outro,
  ]
    .filter(Boolean)
    .join("\n\n");

  if (!s) return null;

  return (
    <Box sx={{ mt: 1.5 }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Box
          component="button"
          type="button"
          onClick={() => setOpen((v) => !v)}
          sx={{
            display: "inline-flex",
            alignItems: "center",
            gap: 0.5,
            border: "none",
            bgcolor: "transparent",
            cursor: "pointer",
            color: "#0B57D0",
            fontFamily: "inherit",
            fontSize: "0.8125rem",
            fontWeight: 600,
            px: 0,
          }}
        >
          {open ? (
            <ExpandLessOutlined sx={{ fontSize: 18 }} />
          ) : (
            <ExpandMoreOutlined sx={{ fontSize: 18 }} />
          )}
          Script ({s.total_words ?? 0} words · {fmtSeconds(s.est_seconds)})
        </Box>
        <CopyButton text={scriptText} title="Copy script" />
      </Box>
      <Collapse in={open}>
        <Box sx={{ mt: 1, pl: 1, borderLeft: "2px solid #E8EAED" }}>
          {s.hook && (
            <Typography sx={{ fontSize: "0.8125rem", color: "#3C4043", mb: 1, fontStyle: "italic" }}>
              {s.hook}
            </Typography>
          )}
          {(s.segments ?? []).map((seg, i) => (
            <Box key={i} sx={{ mb: 1.25 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mb: 0.25 }}>
                <Typography sx={{ fontSize: "0.8125rem", fontWeight: 600, color: "#3C4043" }}>
                  {seg.title}
                </Typography>
                <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.25, ...metaSx }}>
                  <ScheduleOutlined sx={{ fontSize: 13 }} />
                  {fmtSeconds(seg.seconds)}
                </Box>
              </Box>
              <Typography sx={{ fontSize: "0.8125rem", color: "#3C4043", lineHeight: 1.6 }}>
                {seg.narration}
              </Typography>
            </Box>
          ))}
          {s.outro && (
            <Typography sx={{ fontSize: "0.8125rem", color: "#3C4043", mt: 0.5, fontStyle: "italic" }}>
              {s.outro}
            </Typography>
          )}
        </Box>
      </Collapse>
    </Box>
  );
}

function SourceLinks({ brief }: { brief: NewsBriefRow }) {
  const picks = brief.picks ?? [];
  if (picks.length === 0) return null;
  return (
    <Box sx={{ mt: 1.5 }}>
      <Typography sx={{ fontSize: "0.6875rem", fontWeight: 600, color: "#5F6368", mb: 0.5 }}>
        SOURCES
      </Typography>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
        {picks.map((p, i) => (
          <Box
            key={i}
            component="a"
            href={p.url}
            target="_blank"
            rel="noopener noreferrer"
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 0.75,
              textDecoration: "none",
              color: "#0B57D0",
              fontSize: "0.8125rem",
              "&:hover": { textDecoration: "underline" },
            }}
          >
            <OpenInNewOutlined sx={{ fontSize: 14, flexShrink: 0 }} />
            <Box
              component="span"
              sx={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
            >
              {p.title}
            </Box>
            {p.source && (
              <Box component="span" sx={{ ...metaSx, flexShrink: 0 }}>
                · {p.source}
              </Box>
            )}
          </Box>
        ))}
      </Box>
    </Box>
  );
}

function BriefCard({ brief }: { brief: NewsBriefRow }) {
  const caption = brief.caption;
  const captionText = caption
    ? [caption.text, (caption.hashtags ?? []).map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ")]
        .filter(Boolean)
        .join("\n\n")
    : "";

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", md: "240px 1fr" },
        gap: 2.5,
        p: 2.5,
        borderRadius: "12px",
        border: "1px solid #E0E0E0",
        bgcolor: "#fff",
      }}
    >
      {/* Thumbnail — vertical 9:16 (short-video format) */}
      <Box
        sx={{
          aspectRatio: "9 / 16",
          width: "100%",
          maxWidth: { xs: 200, md: "100%" },
          mx: { xs: "auto", md: 0 },
          borderRadius: "8px",
          bgcolor: "#0B1220",
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {brief.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={brief.thumbnail_url}
            alt={brief.thumbnail?.headline ?? "thumbnail"}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <ArticleOutlined sx={{ fontSize: 48, color: "#5F6368" }} />
        )}
      </Box>

      {/* Details */}
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontSize: "1rem", fontWeight: 600, color: "#1F1F1F", lineHeight: 1.35 }}>
          {brief.title || brief.thumbnail?.headline || "Untitled brief"}
        </Typography>
        <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 1, mt: 0.5 }}>
          {brief.presenter_name ? (
            <Typography sx={metaSx}>{brief.presenter_name}</Typography>
          ) : (
            <PresenterPicker />
          )}
          <Typography sx={metaSx}>·</Typography>
          <Typography sx={metaSx}>{formatDate(brief.created_at)}</Typography>
          <Chip
            size="small"
            icon={<ScheduleOutlined sx={{ fontSize: "14px !important" }} />}
            label={fmtSeconds(brief.est_seconds ?? brief.script?.est_seconds)}
            sx={{ height: 22, fontSize: "0.6875rem", bgcolor: "#E8F0FE", color: "#0B57D0" }}
          />
        </Box>

        {/* Caption */}
        {caption?.text && (
          <Box sx={{ mt: 1.5, p: 1.5, borderRadius: "8px", bgcolor: "#F8F9FA" }}>
            <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 1 }}>
              <Typography sx={{ fontSize: "0.8125rem", color: "#3C4043", whiteSpace: "pre-wrap" }}>
                {caption.text}
              </Typography>
              <CopyButton text={captionText} title="Copy caption" />
            </Box>
            {(caption.hashtags ?? []).length > 0 && (
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mt: 1 }}>
                {caption.hashtags.map((h, i) => (
                  <Typography key={i} sx={{ fontSize: "0.75rem", color: "#0B57D0" }}>
                    {h.startsWith("#") ? h : `#${h}`}
                  </Typography>
                ))}
              </Box>
            )}
          </Box>
        )}

        <ScriptBlock brief={brief} />
        <SourceLinks brief={brief} />
      </Box>
    </Box>
  );
}

export function MaterialsList({ briefs }: { briefs: NewsBriefRow[] }) {
  if (briefs.length === 0) {
    return (
      <Box sx={{ textAlign: "center", py: 8, color: "rgba(0,0,0,0.45)" }}>
        <ArticleOutlined sx={{ fontSize: 48, color: "#DADCE0", mb: 1 }} />
        <Typography sx={{ fontSize: "0.9375rem", fontWeight: 500, color: "#5F6368" }}>
          No news briefs yet
        </Typography>
        <Typography sx={{ fontSize: "0.8125rem" }}>
          Run the video-materials agent (agents/video-materials/) to publish a brief here.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {briefs.map((b) => (
        <BriefCard key={b.id} brief={b} />
      ))}
    </Box>
  );
}
