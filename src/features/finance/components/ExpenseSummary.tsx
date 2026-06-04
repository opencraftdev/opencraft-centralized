"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Checkbox from "@mui/material/Checkbox";
import HelpOutline from "@mui/icons-material/HelpOutlineOutlined";
import { BarChart } from "@mui/x-charts/BarChart";
import { CATEGORY_META, formatIDR, type FinanceSummary } from "../data";
import type { ResolvedExpense } from "../types";

const PAID = "#188038";
const PENDING = "#E37400";

const CARD_SX = {
  bgcolor: "#fff",
  borderRadius: "12px",
  border: "1px solid #E8EAED",
} as const;

/** Compact IDR for axis ticks: 250000 → "250rb", 1000000 → "1jt". */
function compactIDR(n: number): string {
  if (n >= 1_000_000) {
    const v = n / 1_000_000;
    return `${v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)}jt`;
  }
  if (n >= 1_000) return `${Math.round(n / 1_000)}rb`;
  return String(n);
}

// GSC-style summary tile: a flat colored block with a checkbox that toggles
// its series in the chart below (mirrors the blog Performance tab).
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

export function ExpenseSummary({
  expenses,
  summary,
}: {
  expenses: ResolvedExpense[];
  summary: FinanceSummary;
}) {
  const [show, setShow] = useState({ paid: true, pending: true });

  // Categories ordered by total spend (desc), same order as the summary.
  const cats = summary.byCategory.map((c) => c.category);
  const labels = cats.map((c) => CATEGORY_META[c].label);

  const sumWhere = (cat: string, status: "paid" | "pending") =>
    expenses
      .filter((e) => e.category === cat && e.status === status)
      .reduce((s, e) => s + e.amount, 0);

  const paidByCat = cats.map((c) => sumWhere(c, "paid"));
  const pendingByCat = cats.map((c) => sumWhere(c, "pending"));

  const paidCount = expenses.filter((e) => e.status === "paid").length;
  const pendingCount = expenses.length - paidCount;

  const fmt = (v: number | null) => (v == null ? "" : formatIDR(v));

  const series = [
    show.paid
      ? { data: paidByCat, label: "Paid", color: PAID, stack: "total", valueFormatter: fmt }
      : null,
    show.pending
      ? { data: pendingByCat, label: "Pending", color: PENDING, stack: "total", valueFormatter: fmt }
      : null,
  ].filter(Boolean) as {
    data: number[];
    label: string;
    color: string;
    stack: string;
    valueFormatter: (v: number | null) => string;
  }[];

  const noneSelected = series.length === 0;

  return (
    <Box sx={{ ...CARD_SX, p: 3 }}>
      {/* Toggle tiles — GSC style */}
      <Box sx={{ display: "flex", gap: "2px", borderRadius: "12px", overflow: "hidden", maxWidth: 560 }}>
        <Tile
          label="Paid this cycle"
          value={formatIDR(summary.paidTotal)}
          sub={`${paidCount} of ${expenses.length} items settled`}
          bg={PAID}
          checked={show.paid}
          onToggle={() => setShow((s) => ({ ...s, paid: !s.paid }))}
        />
        <Tile
          label="Pending"
          value={formatIDR(summary.pendingTotal)}
          sub={`${pendingCount} ${pendingCount === 1 ? "item" : "items"} due this cycle`}
          bg={PENDING}
          checked={show.pending}
          onToggle={() => setShow((s) => ({ ...s, pending: !s.pending }))}
        />
      </Box>

      {/* Spending by category — Paid vs Pending, stacked */}
      <Box sx={{ mt: 1, ml: 0.5 }}>
        <Typography sx={{ fontSize: "0.9375rem", fontWeight: 500, color: "#1F1F1F" }}>
          Spending by category
        </Typography>
        <Typography sx={{ fontSize: "0.75rem", color: "#5f6368" }}>
          Monthly burn of {formatIDR(summary.monthlyTotal)} across {expenses.length} items.
        </Typography>
      </Box>

      <Box sx={{ mt: 1.5 }}>
        {noneSelected ? (
          <Box
            sx={{
              height: 260,
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
            height={260}
            xAxis={[
              {
                data: labels,
                scaleType: "band",
                tickLabelStyle: { fontSize: 11, fill: "#5f6368" },
                categoryGapRatio: 0.5,
              },
            ]}
            yAxis={[
              {
                width: 48,
                valueFormatter: (v: number) => compactIDR(v),
                tickLabelStyle: { fontSize: 11, fill: "#5f6368" },
              },
            ]}
            series={series}
            borderRadius={4}
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
