"use client";

import { useState } from "react";
import Link from "next/link";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Checkbox from "@mui/material/Checkbox";
import HelpOutline from "@mui/icons-material/HelpOutlineOutlined";
import CheckCircleOutlined from "@mui/icons-material/CheckCircleOutlined";
import ChevronRightOutlined from "@mui/icons-material/ChevronRightOutlined";
import { BarChart } from "@mui/x-charts/BarChart";
import type { TimeBucket } from "../queries";

const FAILED = "#5f6368"; // GSC "not indexed" gray
const SUCCEEDED = "#188038"; // GSC "indexed" green

function Tile({
  label,
  value,
  sub,
  bg,
  checked,
  onToggle,
}: {
  label: string;
  value: number;
  sub?: string;
  bg: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <Box
      onClick={onToggle}
      sx={{
        position: "relative",
        flex: 1,
        bgcolor: bg,
        px: 2.5,
        py: 2,
        minHeight: 120,
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        opacity: checked ? 1 : 0.55,
        transition: "opacity 120ms",
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, ml: -0.75 }}>
        <Checkbox
          checked={checked}
          size="small"
          disableRipple
          sx={{
            color: "rgba(255,255,255,0.7)",
            p: 0.5,
            "&.Mui-checked": { color: "#fff" },
          }}
        />
        <Typography sx={{ fontSize: "0.8125rem", color: "rgba(255,255,255,0.92)" }}>
          {label}
        </Typography>
      </Box>

      <Box>
        <Typography sx={{ fontSize: "2.25rem", fontWeight: 400, lineHeight: 1, color: "#fff" }}>
          {value.toLocaleString()}
        </Typography>
        {sub && (
          <Typography sx={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.75)", mt: 0.75 }}>
            {sub}
          </Typography>
        )}
      </Box>

      <HelpOutline
        sx={{ position: "absolute", right: 12, bottom: 12, fontSize: 16, color: "rgba(255,255,255,0.6)" }}
      />
    </Box>
  );
}

export function RunStatusCard({
  series,
  succeeded,
  failed,
  detailHref,
}: {
  series: TimeBucket[];
  succeeded: number;
  failed: number;
  detailHref: string;
}) {
  const [show, setShow] = useState({ failed: true, succeeded: true });

  const finished = succeeded + failed;
  const failRate = finished > 0 ? Math.round((failed / finished) * 100) : 0;
  const successRate = finished > 0 ? Math.round((succeeded / finished) * 100) : 0;

  const labels = series.map((b) => b.label);
  const chartSeries = [
    show.failed
      ? { data: series.map((b) => b.failed), label: "Failed", color: FAILED, stack: "runs" }
      : null,
    show.succeeded
      ? { data: series.map((b) => b.succeeded), label: "Succeeded", color: SUCCEEDED, stack: "runs" }
      : null,
  ].filter(Boolean) as { data: number[]; label: string; color: string; stack: string }[];

  const noneSelected = chartSeries.length === 0;
  const noData = series.every((b) => b.succeeded === 0 && b.failed === 0);

  const tickInterval =
    labels.length > 16
      ? (_: unknown, i: number) => i % 4 === 0
      : labels.length > 8
        ? (_: unknown, i: number) => i % 2 === 0
        : undefined;

  return (
    <Box sx={{ bgcolor: "#fff", borderRadius: "12px", border: "1px solid #E8EAED", p: 3 }}>
      {/* Two summary tiles — toggle the chart series, GSC-style */}
      <Box
        sx={{
          display: "flex",
          gap: "2px",
          borderRadius: "12px",
          overflow: "hidden",
          maxWidth: 560,
        }}
      >
        <Tile
          label="Failed"
          value={failed}
          sub={finished === 0 ? "No runs yet" : `${failRate}% of runs`}
          bg={FAILED}
          checked={show.failed}
          onToggle={() => setShow((s) => ({ ...s, failed: !s.failed }))}
        />
        <Tile
          label="Succeeded"
          value={succeeded}
          sub={finished === 0 ? "No runs yet" : `${successRate}% of runs`}
          bg={SUCCEEDED}
          checked={show.succeeded}
          onToggle={() => setShow((s) => ({ ...s, succeeded: !s.succeeded }))}
        />
      </Box>

      {/* Chart */}
      <Box sx={{ mt: 3 }}>
        {noData || noneSelected ? (
          <Box
            sx={{
              height: 300,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#9aa0a6",
              fontSize: "0.875rem",
            }}
          >
            {noData ? "No runs recorded in this period." : "Select a series to display."}
          </Box>
        ) : (
          <BarChart
            height={300}
            xAxis={[
              {
                data: labels,
                scaleType: "band",
                tickLabelStyle: { fontSize: 11, fill: "#5f6368" },
                ...(tickInterval ? { tickInterval } : {}),
                categoryGapRatio: 0.5,
              },
            ]}
            yAxis={[{ tickLabelStyle: { fontSize: 11, fill: "#5f6368" }, width: 40 }]}
            series={chartSeries}
            borderRadius={2}
            hideLegend
            margin={{ top: 8, right: 8, bottom: 24, left: 8 }}
            grid={{ horizontal: true }}
            sx={{
              "& .MuiChartsGrid-line": { stroke: "#F1F3F4" },
              "& .MuiChartsAxis-line, & .MuiChartsAxis-tick": { stroke: "#E8EAED" },
            }}
          />
        )}
      </Box>

      {/* CTA row */}
      <Box
        component={Link}
        href={detailHref}
        sx={{
          mt: 2,
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          px: 2.5,
          py: 1.75,
          borderRadius: "12px",
          border: "1px solid #E8EAED",
          textDecoration: "none",
          color: "inherit",
          transition: "background 120ms",
          "&:hover": { bgcolor: "#F8FAFD" },
        }}
      >
        <CheckCircleOutlined sx={{ fontSize: 22, color: "#188038" }} />
        <Typography sx={{ flex: 1, fontSize: "0.875rem", color: "#202124" }}>
          View run activity by agent
        </Typography>
        <ChevronRightOutlined sx={{ fontSize: 20, color: "#5f6368" }} />
      </Box>
    </Box>
  );
}
