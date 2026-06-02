"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Tooltip from "@mui/material/Tooltip";
import InfoOutlined from "@mui/icons-material/InfoOutlined";
import type { CreditUsage } from "../types";

const CARD_SX = {
  bgcolor: "#fff",
  borderRadius: "12px",
  border: "1px solid #E8EAED",
} as const;

// One gradient stat card (Search-Console style): big number, label, sub-label,
// and a help icon in the corner.
function StatCard({
  label,
  value,
  sub,
  gradient,
  tip,
  progress,
}: {
  label: string;
  value: string;
  sub: string;
  gradient: string;
  tip: string;
  progress?: number; // 0–100, draws a subtle bar along the bottom
}) {
  return (
    <Box
      sx={{
        position: "relative",
        flex: "1 1 0",
        minWidth: 200,
        borderRadius: "12px",
        background: gradient,
        color: "#fff",
        px: 2.5,
        py: 2,
        overflow: "hidden",
        boxShadow: "0 1px 2px rgba(60,64,67,0.15)",
      }}
    >
      <Typography sx={{ fontSize: "0.875rem", fontWeight: 500, color: "rgba(255,255,255,0.92)" }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: "2.25rem", fontWeight: 700, lineHeight: 1.15, mt: 0.25 }}>
        {value}
      </Typography>
      <Typography sx={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.8)", mt: 0.25 }}>
        {sub}
      </Typography>

      <Tooltip title={tip}>
        <InfoOutlined
          sx={{
            position: "absolute",
            right: 10,
            bottom: 10,
            fontSize: 16,
            color: "rgba(255,255,255,0.7)",
            cursor: "help",
          }}
        />
      </Tooltip>

      {progress != null && (
        <Box
          sx={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: 4,
            bgcolor: "rgba(255,255,255,0.25)",
          }}
        >
          <Box
            sx={{
              height: "100%",
              width: `${Math.min(100, Math.max(0, progress))}%`,
              bgcolor: "rgba(255,255,255,0.9)",
            }}
          />
        </Box>
      )}
    </Box>
  );
}

// Cloudinary credit usage for the current 30-day cycle, shown as gradient stat
// cards inside a card.
export function CreditsMeter({ usage }: { usage: CreditUsage | null }) {
  return (
    <Box sx={{ ...CARD_SX, p: { xs: 2, md: 2.5 } }}>
      <Typography sx={{ fontSize: "0.75rem", color: "#5f6368", mb: 1.5 }}>
        Cloudinary credits · this 30-day cycle
      </Typography>

      {!usage || usage.limit <= 0 ? (
        <Typography sx={{ fontSize: "0.875rem", color: "#5f6368" }}>
          Usage unavailable — check the Cloudinary configuration.
        </Typography>
      ) : (
        (() => {
          const used = usage.used;
          const limit = usage.limit;
          const remaining = Math.max(0, limit - used);
          const pct = (used / limit) * 100;
          const rendersLeft = Math.floor(remaining); // ~1 credit per render
          return (
            <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
              <StatCard
                label="Credits used"
                value={used.toFixed(2)}
                sub={`of ${limit} this cycle`}
                gradient="linear-gradient(135deg, #5596F6 0%, #2667D8 100%)"
                tip="Credits spent rendering tutorials this 30-day cycle. The free plan resets to 25 every cycle."
                progress={pct}
              />
              <StatCard
                label="Credits remaining"
                value={remaining.toFixed(2)}
                sub={`≈ ${rendersLeft} more ${rendersLeft === 1 ? "render" : "renders"}`}
                gradient="linear-gradient(135deg, #A95EEE 0%, #7A28C7 100%)"
                tip="Roughly one credit per finished tutorial, so this is about how many more you can render before the cycle resets."
              />
            </Box>
          );
        })()
      )}
    </Box>
  );
}
