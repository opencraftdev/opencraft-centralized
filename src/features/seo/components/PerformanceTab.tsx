"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Checkbox from "@mui/material/Checkbox";
import HelpOutline from "@mui/icons-material/HelpOutlineOutlined";
import ArrowUpwardOutlined from "@mui/icons-material/ArrowUpwardOutlined";
import ArrowDownwardOutlined from "@mui/icons-material/ArrowDownwardOutlined";
import { BarChart } from "@mui/x-charts/BarChart";
import {
  perfKpis,
  perfTrend,
  cwvMetrics,
  topQueries,
  topPages,
  type KpiDelta,
  type CwvStatus,
  type CwvMetric,
  type QueryRow,
  type PageRow,
} from "../mock";

const CLICKS = "#1A73E8";
const IMPRESSIONS = "#9334E6";

const CARD_SX = {
  bgcolor: "#fff",
  borderRadius: "12px",
  border: "1px solid #E8EAED",
} as const;

const CWV_META: Record<CwvStatus, { color: string; label: string }> = {
  good: { color: "#188038", label: "Good" },
  "needs-improvement": { color: "#F9AB00", label: "Needs improvement" },
  poor: { color: "#D93025", label: "Poor" },
};

// GSC-style summary tile (mirrors the dashboard Run-activity tiles): a flat
// colored block with a checkbox that toggles its series in the chart.
function Tile({
  label,
  value,
  sub,
  bg,
  checked,
  onToggle,
}: {
  label: string;
  value: string;
  sub: string;
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
          sx={{ color: "rgba(255,255,255,0.7)", p: 0.5, "&.Mui-checked": { color: "#fff" } }}
        />
        <Typography sx={{ fontSize: "0.8125rem", color: "rgba(255,255,255,0.92)" }}>
          {label}
        </Typography>
      </Box>
      <Box>
        <Typography sx={{ fontSize: "2.25rem", fontWeight: 400, lineHeight: 1, color: "#fff" }}>
          {value}
        </Typography>
        <Typography sx={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.78)", mt: 0.75 }}>
          {sub}
        </Typography>
      </Box>
      <HelpOutline
        sx={{ position: "absolute", right: 12, bottom: 12, fontSize: 16, color: "rgba(255,255,255,0.6)" }}
      />
    </Box>
  );
}

function PerformanceChartCard() {
  const [show, setShow] = useState({ clicks: true, impressions: true });
  const [clicks, impressions] = perfKpis;

  const labels = perfTrend.map((p) => p.label);
  const series = [
    show.clicks
      ? {
          data: perfTrend.map((p) => p.clicks),
          label: "Clicks",
          color: CLICKS,
          yAxisId: "clicks",
        }
      : null,
    show.impressions
      ? {
          data: perfTrend.map((p) => p.impressions),
          label: "Impressions",
          color: IMPRESSIONS,
          yAxisId: "impr",
        }
      : null,
  ].filter(Boolean) as { data: number[]; label: string; color: string; yAxisId: string }[];

  const noneSelected = series.length === 0;

  return (
    <Box sx={{ ...CARD_SX, p: 3 }}>
      {/* Toggle tiles — GSC style */}
      <Box sx={{ display: "flex", gap: "2px", borderRadius: "12px", overflow: "hidden", maxWidth: 560 }}>
        <Tile
          label={clicks.label}
          value={clicks.value}
          sub={`${clicks.deltaLabel} vs prev 28 days`}
          bg={CLICKS}
          checked={show.clicks}
          onToggle={() => setShow((s) => ({ ...s, clicks: !s.clicks }))}
        />
        <Tile
          label={impressions.label}
          value={impressions.value}
          sub={`${impressions.deltaLabel} vs prev 28 days`}
          bg={IMPRESSIONS}
          checked={show.impressions}
          onToggle={() => setShow((s) => ({ ...s, impressions: !s.impressions }))}
        />
      </Box>

      {/* Chart */}
      <Box sx={{ mt: 3 }}>
        {noneSelected ? (
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
            Select a series to display.
          </Box>
        ) : (
          <BarChart
            height={300}
            xAxis={[
              {
                data: labels,
                scaleType: "band",
                tickLabelStyle: { fontSize: 11, fill: "#5f6368" },
                tickInterval: (_: unknown, i: number) => i % 4 === 0,
                categoryGapRatio: 0.5,
              },
            ]}
            yAxis={[
              { id: "clicks", width: 40, tickLabelStyle: { fontSize: 11, fill: "#5f6368" } },
              {
                id: "impr",
                position: "right",
                width: 48,
                tickLabelStyle: { fontSize: 11, fill: "#5f6368" },
              },
            ]}
            series={series}
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
    </Box>
  );
}

function KpiCard({ kpi }: { kpi: KpiDelta }) {
  const up = kpi.delta >= 0;
  const good = kpi.goodWhenUp ? up : !up;
  const color = good ? "#188038" : "#D93025";
  const Arrow = up ? ArrowUpwardOutlined : ArrowDownwardOutlined;
  return (
    <Box sx={{ ...CARD_SX, flex: "1 1 0", minWidth: 240, px: 2.5, py: 2 }}>
      <Typography sx={{ fontSize: "0.8125rem", color: "#5f6368", mb: 0.5 }}>{kpi.label}</Typography>
      <Box sx={{ display: "flex", alignItems: "baseline", gap: 1 }}>
        <Typography sx={{ fontSize: "1.75rem", fontWeight: 400, color: "#1F1F1F", lineHeight: 1.1 }}>
          {kpi.value}
        </Typography>
        <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.25, color }}>
          <Arrow sx={{ fontSize: 14 }} />
          <Typography sx={{ fontSize: "0.75rem", fontWeight: 600 }}>{kpi.deltaLabel}</Typography>
        </Box>
        <Typography sx={{ fontSize: "0.6875rem", color: "#9AA0A6" }}>vs last 28 days</Typography>
      </Box>
      <Typography sx={{ fontSize: "0.75rem", color: "#5f6368", mt: 0.75, lineHeight: 1.45 }}>
        {kpi.plain}
      </Typography>
    </Box>
  );
}

function CwvCard({ metric }: { metric: CwvMetric }) {
  const meta = CWV_META[metric.status];
  return (
    <Box sx={{ ...CARD_SX, flex: "1 1 0", minWidth: 220, px: 2.5, py: 2 }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, mb: 0.5 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 0 }}>
          <Typography sx={{ fontSize: "0.875rem", fontWeight: 600, color: "#3C4043" }}>
            {metric.title}
          </Typography>
          <Box
            sx={{
              fontSize: "0.625rem",
              fontWeight: 600,
              color: "#80868B",
              bgcolor: "#F1F3F4",
              px: 0.625,
              py: 0.125,
              borderRadius: "4px",
              letterSpacing: "0.3px",
            }}
          >
            {metric.code}
          </Box>
        </Box>
        <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.75, flexShrink: 0 }}>
          <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: meta.color }} />
          <Typography sx={{ fontSize: "0.6875rem", fontWeight: 600, color: meta.color }}>
            {meta.label}
          </Typography>
        </Box>
      </Box>
      <Typography sx={{ fontSize: "1.5rem", fontWeight: 400, color: "#1F1F1F", lineHeight: 1.1 }}>
        {metric.value}
      </Typography>
      <Typography sx={{ fontSize: "0.75rem", color: "#5f6368", mt: 0.5, lineHeight: 1.45 }}>
        {metric.plain}
      </Typography>
      <Typography sx={{ fontSize: "0.6875rem", color: meta.color, fontWeight: 600, mt: 0.75 }}>
        {metric.goodText}
      </Typography>
    </Box>
  );
}

const headSx = { fontSize: "0.75rem", fontWeight: 600, color: "#5F6368" } as const;
const metaSx = { fontSize: "0.8125rem", color: "#5F6368" } as const;
const TABLE_COLS = "minmax(0, 1fr) 56px 64px 72px 52px";

function DataTable({
  title,
  subtitle,
  firstCol,
  rows,
}: {
  title: string;
  subtitle: string;
  firstCol: string;
  rows: (QueryRow | PageRow)[];
}) {
  return (
    <Box sx={{ ...CARD_SX, flex: "1 1 0", minWidth: 340, overflow: "hidden" }}>
      <Box sx={{ px: 2.5, py: 2 }}>
        <Typography sx={{ fontSize: "0.9375rem", fontWeight: 500, color: "#1F1F1F" }}>
          {title}
        </Typography>
        <Typography sx={{ fontSize: "0.75rem", color: "#5f6368" }}>{subtitle}</Typography>
      </Box>
      <Box sx={{ height: "1px", bgcolor: "#F1F3F4" }} />
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: TABLE_COLS,
          gap: 1.5,
          px: 2.5,
          py: 1,
          borderBottom: "1px solid #F1F3F4",
        }}
      >
        <Typography sx={headSx}>{firstCol}</Typography>
        <Typography sx={{ ...headSx, textAlign: "right" }}>Visits</Typography>
        <Typography sx={{ ...headSx, textAlign: "right" }}>Shown</Typography>
        <Typography sx={{ ...headSx, textAlign: "right" }}>Click rate</Typography>
        <Typography sx={{ ...headSx, textAlign: "right" }}>Rank</Typography>
      </Box>
      {rows.map((r, i) => {
        const first = "query" in r ? r.query : r.page;
        return (
          <Box
            key={first}
            sx={{
              display: "grid",
              gridTemplateColumns: TABLE_COLS,
              gap: 1.5,
              alignItems: "center",
              px: 2.5,
              py: 1.25,
              borderBottom: i === rows.length - 1 ? "none" : "1px solid #F1F3F4",
              "&:hover": { bgcolor: "#F8F9FA" },
            }}
          >
            <Typography
              sx={{
                fontSize: "0.8125rem",
                color: "#3C4043",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {first}
            </Typography>
            <Typography sx={{ ...metaSx, textAlign: "right", color: "#3C4043" }}>
              {r.clicks.toLocaleString()}
            </Typography>
            <Typography sx={{ ...metaSx, textAlign: "right" }}>
              {r.impressions.toLocaleString()}
            </Typography>
            <Typography sx={{ ...metaSx, textAlign: "right" }}>{r.ctr}</Typography>
            <Typography sx={{ ...metaSx, textAlign: "right" }}>{r.position.toFixed(1)}</Typography>
          </Box>
        );
      })}
    </Box>
  );
}

export function PerformanceTab() {
  const ctr = perfKpis[2];
  const position = perfKpis[3];
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <PerformanceChartCard />

      {/* Scalar metrics */}
      <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
        <KpiCard kpi={ctr} />
        <KpiCard kpi={position} />
      </Box>

      {/* Page experience (Core Web Vitals, in plain English) */}
      <Box>
        <Typography sx={{ fontSize: "0.9375rem", fontWeight: 500, color: "#1F1F1F", mt: 0.5 }}>
          Page experience
        </Typography>
        <Typography sx={{ fontSize: "0.75rem", color: "#5f6368", mb: 1.5 }}>
          How fast and stable your pages feel to real visitors — measured by Google.
        </Typography>
        <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
          {cwvMetrics.map((m) => (
            <CwvCard key={m.key} metric={m} />
          ))}
        </Box>
      </Box>

      {/* Top search terms + pages */}
      <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
        <DataTable
          title="Top search terms"
          subtitle="What people typed into Google to find you"
          firstCol="Search term"
          rows={topQueries}
        />
        <DataTable
          title="Most-visited pages"
          subtitle="Your pages getting the most traffic from search"
          firstCol="Page"
          rows={topPages}
        />
      </Box>
    </Box>
  );
}
