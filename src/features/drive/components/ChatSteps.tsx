"use client";

import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import CheckRounded from "@mui/icons-material/CheckRounded";
import ChevronRightRounded from "@mui/icons-material/ChevronRightRounded";
import type { DriveStep } from "@/lib/drive/types";

// What the agent did while answering (docs/DRIVE.md → "Chat v2"). While a run is live the newest steps show, the
// last one with a spinner; under a finished answer they fold into "N langkah · 34 dtk" that opens on click.

export function formatDuration(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s} dtk`;
  const m = Math.floor(s / 60);
  return s % 60 ? `${m} mnt ${s % 60} dtk` : `${m} mnt`;
}

function StepRow({ step, live }: { step: DriveStep; live: boolean }) {
  return (
    <Box component="li" sx={{ display: "flex", alignItems: "center", gap: 1, minHeight: 24, listStyle: "none" }}>
      <Box sx={{ width: 16, display: "flex", justifyContent: "center", flexShrink: 0 }}>
        {live ? (
          <CircularProgress size={12} thickness={5} sx={{ color: "#0B57D0" }} />
        ) : (
          <CheckRounded sx={{ fontSize: 15, color: "#9AA0A6" }} />
        )}
      </Box>
      <Typography sx={{ fontSize: "0.8125rem", color: live ? "#1F1F1F" : "#5F6368", minWidth: 0, overflowWrap: "anywhere" }}>
        {step.label}
      </Typography>
    </Box>
  );
}

/** The run in progress: "Menunggu giliran…" while queued, else the last 3 steps + elapsed time. */
export function LiveSteps({ steps, queued, startedAt }: { steps: DriveStep[]; queued: boolean; startedAt: string | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (queued) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [queued]);

  if (queued) {
    return (
      <Box component="ul" sx={{ m: 0, p: 0 }} aria-live="polite">
        <StepRow step={{ label: "Menunggu giliran…", at: "" }} live />
      </Box>
    );
  }
  const list = steps.length ? steps : [{ label: "Menyiapkan…", at: startedAt ?? "" }];
  const tail = list.slice(-3);
  const hidden = list.length - tail.length;
  const started = startedAt ? Date.parse(startedAt) : NaN;
  const elapsed = Number.isFinite(started) ? formatDuration(now - started) : null;
  return (
    <Box>
      <Box component="ul" sx={{ m: 0, p: 0, display: "flex", flexDirection: "column", gap: 0.25 }} aria-live="polite">
        {hidden > 0 && (
          <Typography component="li" sx={{ listStyle: "none", fontSize: "0.75rem", color: "#9AA0A6", pl: 3 }}>
            {hidden} langkah sebelumnya
          </Typography>
        )}
        {tail.map((s, i) => (
          <StepRow key={`${hidden + i}-${s.at}`} step={s} live={i === tail.length - 1} />
        ))}
      </Box>
      {elapsed && (
        <Typography suppressHydrationWarning sx={{ fontSize: "0.75rem", color: "#9AA0A6", pl: 3, mt: 0.25, fontVariantNumeric: "tabular-nums" }}>
          {elapsed}
        </Typography>
      )}
    </Box>
  );
}

/** "N langkah · X dtk" under a finished answer; opens the full list. Null when the message has neither. */
export function FoldedSteps({ steps, durationMs }: { steps?: DriveStep[]; durationMs?: number }) {
  const [open, setOpen] = useState(false);
  const n = steps?.length ?? 0;
  const parts = [n ? `${n} langkah` : null, durationMs != null ? formatDuration(durationMs) : null].filter(Boolean);
  if (!parts.length) return null;
  const label = parts.join(" · ");
  if (!n) {
    return <Typography sx={{ fontSize: "0.75rem", color: "#5F6368", px: 0.75 }}>{label}</Typography>;
  }
  return (
    <Box sx={{ display: "contents" }}>
      <Box
        component="button"
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        sx={{
          display: "inline-flex",
          alignItems: "center",
          gap: 0.25,
          height: 28,
          pl: 0.25,
          pr: 1,
          border: "none",
          borderRadius: "8px",
          bgcolor: "transparent",
          color: "#5F6368",
          fontFamily: "inherit",
          fontSize: "0.75rem",
          cursor: "pointer",
          "&:hover": { bgcolor: "rgba(68,71,70,0.08)", color: "#1F1F1F" },
        }}
      >
        <ChevronRightRounded sx={{ fontSize: 18, transition: "transform .15s", transform: open ? "rotate(90deg)" : "none" }} />
        {label}
      </Box>
      {open && (
        <Box component="ul" sx={{ order: 10, flexBasis: "100%", m: 0, mt: 0.5, p: 0, pl: 0.5, display: "flex", flexDirection: "column", gap: 0.25 }}>
          {steps!.map((s, i) => (
            <StepRow key={`${i}-${s.at}`} step={s} live={false} />
          ))}
        </Box>
      )}
    </Box>
  );
}
