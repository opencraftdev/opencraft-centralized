"use client";

import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import AutoAwesomeRounded from "@mui/icons-material/AutoAwesomeRounded";
import CheckRounded from "@mui/icons-material/CheckRounded";
import ChevronRightRounded from "@mui/icons-material/ChevronRightRounded";
import type { ChatStep } from "../types";

// What the agent did while answering (docs/CHAT.md → "UI"). While a run is live the newest steps show, the
// last one with a spinner; under a finished answer they fold into "N langkah · 34 dtk" that opens on click.

export function formatDuration(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s} dtk`;
  const m = Math.floor(s / 60);
  return s % 60 ? `${m} mnt ${s % 60} dtk` : `${m} mnt`;
}

/** Gemini-like "thinking" mark: a blue sparkle that turns and breathes. */
export function Sparkle({ size = 18 }: { size?: number }) {
  return (
    <AutoAwesomeRounded
      aria-hidden
      sx={{
        fontSize: size,
        color: "#0B57D0",
        animation: "chatSparkle 1.6s ease-in-out infinite",
        "@keyframes chatSparkle": {
          "0%": { transform: "rotate(0deg) scale(0.85)", opacity: 0.7 },
          "50%": { transform: "rotate(180deg) scale(1.05)", opacity: 1 },
          "100%": { transform: "rotate(360deg) scale(0.85)", opacity: 0.7 },
        },
        "@media (prefers-reduced-motion: reduce)": { animation: "none" },
      }}
    />
  );
}

function StepRow({ step, live }: { step: ChatStep; live: boolean }) {
  return (
    <Box component="li" sx={{ display: "flex", alignItems: "center", gap: 1.25, minHeight: 28, listStyle: "none" }}>
      <Box sx={{ width: 20, display: "flex", justifyContent: "center", flexShrink: 0 }}>
        {live ? <Sparkle /> : <CheckRounded sx={{ fontSize: 16, color: "#5E5E5E" }} />}
      </Box>
      <Typography sx={{ fontSize: "0.75rem", color: live ? "#1F1F1F" : "#444746", minWidth: 0, overflowWrap: "anywhere" }}>
        {step.label}
      </Typography>
    </Box>
  );
}

/** The run in progress: "Menunggu giliran…" while queued, else the last 3 steps + elapsed time. */
export function LiveSteps({ steps, queued, startedAt }: { steps: ChatStep[]; queued: boolean; startedAt: string | null }) {
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
          <Typography component="li" sx={{ listStyle: "none", fontSize: "0.75rem", color: "#5E5E5E", pl: 4 }}>
            {hidden} langkah sebelumnya
          </Typography>
        )}
        {tail.map((s, i) => (
          <StepRow key={`${hidden + i}-${s.at}`} step={s} live={i === tail.length - 1} />
        ))}
      </Box>
      {elapsed && (
        <Typography suppressHydrationWarning sx={{ fontSize: "0.75rem", color: "#5E5E5E", pl: 4, mt: 0.25, fontVariantNumeric: "tabular-nums" }}>
          {elapsed}
        </Typography>
      )}
    </Box>
  );
}

/** "N langkah · X dtk" under a finished answer; opens the full list. Null when the message has neither. */
export function FoldedSteps({ steps, durationMs }: { steps?: ChatStep[]; durationMs?: number }) {
  const [open, setOpen] = useState(false);
  // "Memulai…" only marks the run start; an answer that used no tools has nothing else, so hide it.
  steps = steps?.filter((s) => !/^Memulai/.test(s.label));
  const n = steps?.length ?? 0;
  const parts = [n ? `${n} langkah` : null, durationMs != null ? formatDuration(durationMs) : null].filter(Boolean);
  if (!parts.length) return null;
  const label = parts.join(" · ");
  if (!n) {
    return <Typography sx={{ fontSize: "0.8125rem", color: "#444746", px: 1 }}>{label}</Typography>;
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
          height: 32,
          pl: 0.5,
          pr: 1.25,
          border: "none",
          borderRadius: "9999px",
          bgcolor: "transparent",
          color: "#444746",
          fontFamily: "inherit",
          fontSize: "0.8125rem",
          cursor: "pointer",
          "&:hover": { bgcolor: "rgba(68,71,70,0.08)", color: "#1F1F1F" },
        }}
      >
        <ChevronRightRounded sx={{ fontSize: 18, transition: "transform .15s", transform: open ? "rotate(90deg)" : "none" }} />
        {label}
      </Box>
      {open && (
        <Box component="ul" sx={{ order: 10, flexBasis: "100%", m: 0, mt: 0.5, p: 0, pl: 1, display: "flex", flexDirection: "column", gap: 0.25 }}>
          {steps!.map((s, i) => (
            <StepRow key={`${i}-${s.at}`} step={s} live={false} />
          ))}
        </Box>
      )}
    </Box>
  );
}
