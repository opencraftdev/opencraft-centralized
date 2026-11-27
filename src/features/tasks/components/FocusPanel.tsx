"use client";

import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { Task } from "../types";
import type { TasksCtx } from "./TasksApp";
import { DueChip, MemberAvatar, ProjectMark } from "./bits";

// Header summary of /tasks (option "3B"): deadline tabs (Terlambat · Hari ini · Minggu ini · Minggu depan) with the
// tasks in each, and the overall numbers as rows with small bars.

export type DueTab = "late" | "today" | "week" | "next";

export interface FocusData {
  lists: Record<DueTab, Task[]>;
  open: number;
  doing: number;
  overdue: number;
  doneWeek: number;
}

const TABS: { key: DueTab; label: string; empty: string }[] = [
  { key: "late", label: "Terlambat", empty: "Tidak ada yang terlambat." },
  { key: "today", label: "Hari ini", empty: "Tidak ada deadline hari ini." },
  { key: "week", label: "Minggu ini", empty: "Minggu ini bebas deadline." },
  { key: "next", label: "Minggu depan", empty: "Belum ada deadline minggu depan." },
];
const MAX_ROWS = 5;

export function FocusPanel({ data, ctx }: { data: FocusData; ctx: TasksCtx }) {
  const pickDefault = (): DueTab => (data.lists.late.length ? "late" : data.lists.today.length ? "today" : "week");
  const [tab, setTab] = useState<DueTab>(pickDefault);
  // Jump to "Terlambat" when something becomes overdue.
  useEffect(() => {
    if (data.lists.late.length) setTab("late");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.lists.late.length]);

  const list = data.lists[tab];
  const meta = TABS.find((t) => t.key === tab)!;
  const hot = tab === "late" && list.length > 0;

  return (
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "minmax(0,1.2fr) minmax(0,1fr)" }, gap: 1.5, px: { xs: 2, sm: 3 }, pb: 2 }}>
      {/* Deadline tabs */}
      <Box
        sx={{
          borderRadius: "16px",
          p: 2,
          border: "1px solid",
          borderColor: hot ? "#F6AEA9" : "#D3E3FD",
          background: hot ? "linear-gradient(135deg,#FCE8E6,#FFF5F4 60%,#fff)" : "linear-gradient(135deg,#E8F0FE,#F3F8FF 60%,#fff)",
          display: "flex",
          flexDirection: "column",
          gap: 0.75,
          transition: "background 300ms, border-color 300ms",
          minWidth: 0,
        }}
      >
        <Box role="tablist" aria-label="Deadline" sx={{ display: "inline-flex", alignSelf: "flex-start", maxWidth: "100%", overflowX: "auto", scrollbarWidth: "none", bgcolor: "rgba(11,87,208,.08)", borderRadius: "9999px", p: "3px", gap: "2px" }}>
          {TABS.map((t) => {
            const on = t.key === tab;
            const n = data.lists[t.key].length;
            const late = t.key === "late" && n > 0;
            return (
              <Box
                key={t.key}
                component="button"
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setTab(t.key)}
                sx={{
                  border: "none",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontSize: "0.8125rem",
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                  px: 1.5,
                  py: "5px",
                  borderRadius: "9999px",
                  color: on ? "#fff" : late ? "#B3261E" : "#0B57D0",
                  bgcolor: on ? (late ? "#B3261E" : "#0B57D0") : "transparent",
                  transition: "background-color 200ms, color 200ms",
                }}
              >
                {t.label}
                <Box component="span" sx={{ opacity: 0.75, ml: 0.5, fontVariantNumeric: "tabular-nums" }}>
                  {n}
                </Box>
              </Box>
            );
          })}
        </Box>

        <Box sx={{ display: "flex", alignItems: "baseline", gap: 1.25, mt: 0.5 }}>
          <Typography sx={{ fontSize: "2.75rem", fontWeight: 600, lineHeight: 1, color: hot ? "#B3261E" : "#0B57D0", fontVariantNumeric: "tabular-nums" }}>{list.length}</Typography>
          <Typography sx={{ fontSize: "0.9375rem", color: "#444746" }}>{meta.label.toLowerCase()}</Typography>
        </Box>

        <Box key={tab} sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
          {list.length === 0 ? (
            <Typography sx={{ fontSize: "0.875rem", color: "#5F6368", textAlign: "center", py: 1.5, bgcolor: "#fff", borderRadius: "10px", animation: "oc-rise 300ms both" }}>{meta.empty}</Typography>
          ) : (
            list.slice(0, MAX_ROWS).map((t, i) => <FocusRow key={t.id} task={t} ctx={ctx} index={i} />)
          )}
          {list.length > MAX_ROWS && (
            <Typography sx={{ fontSize: "0.8125rem", color: "#5F6368", textAlign: "center" }}>dan {list.length - MAX_ROWS} lainnya</Typography>
          )}
        </Box>
      </Box>

      {/* Numbers */}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "1fr" }, gap: 1 }}>
        <StatLine n={data.open} label="Belum selesai" color="#1F1F1F" pct={data.open ? 100 : 0} />
        <StatLine n={data.doing} label="Sedang dikerjakan" color="#0B57D0" pct={data.open ? (data.doing / data.open) * 100 : 0} />
        <StatLine n={data.overdue} label="Terlambat" color="#B3261E" pct={data.open ? (data.overdue / data.open) * 100 : 0} />
        <StatLine n={data.doneWeek} label="Selesai minggu ini" color="#146C2E" pct={data.open + data.doneWeek ? (data.doneWeek / (data.open + data.doneWeek)) * 100 : 0} />
      </Box>
    </Box>
  );
}

function FocusRow({ task: t, ctx, index }: { task: Task; ctx: TasksCtx; index: number }) {
  const parent = t.parent_id ? ctx.all.find((x) => x.id === t.parent_id) : undefined;
  const project = ctx.projectById.get(t.project_id ?? "");
  return (
    <Box
      component="button"
      type="button"
      onClick={() => ctx.open(t)}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.25,
        width: "100%",
        px: 1.25,
        py: 1,
        border: "none",
        bgcolor: "#fff",
        borderRadius: "10px",
        cursor: "pointer",
        fontFamily: "inherit",
        textAlign: "left",
        boxShadow: "0 1px 2px rgba(60,64,67,.08)",
        animation: `oc-rise 320ms cubic-bezier(0.22, 1, 0.36, 1) ${index * 40}ms both`,
        transition: "transform 250ms cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 200ms",
        "&:hover": { transform: "translateX(3px)", boxShadow: "0 3px 10px -4px rgba(11,87,208,.35)" },
      }}
    >
      <MemberAvatar member={t.assignee_id ? ctx.memberById.get(t.assignee_id) : undefined} size={22} />
      <Box sx={{ minWidth: 0, flex: 1, display: "flex", alignItems: "center", gap: 1 }}>
        <Typography sx={{ fontSize: "0.875rem", color: "#1F1F1F", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</Typography>
        <Box component="span" sx={{ display: { xs: "none", sm: "inline-flex" }, alignItems: "center", gap: 0.5, fontSize: "0.75rem", color: "#5F6368", whiteSpace: "nowrap", flexShrink: 0 }}>
          {project && <ProjectMark project={project} size={12} />}
          {parent ? parent.title.slice(0, 24) : project?.name}
        </Box>
      </Box>
      <DueChip due={t.due_date} done={false} compact />
    </Box>
  );
}

function StatLine({ n, label, color, pct }: { n: number; label: string; color: string; pct: number }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, border: "1px solid #E0E3E7", borderRadius: "12px", px: 1.75, py: 1.1, flex: 1 }}>
      <Typography sx={{ fontSize: "1.375rem", fontWeight: 600, minWidth: 34, color: n ? color : color === "#B3261E" ? "#1F1F1F" : color, fontVariantNumeric: "tabular-nums" }}>{n}</Typography>
      <Typography sx={{ fontSize: { xs: "0.8125rem", sm: "0.875rem" }, color: "#444746", lineHeight: 1.25 }}>{label}</Typography>
      <Box sx={{ display: { xs: "none", sm: "block" }, ml: "auto", width: 90, height: 6, borderRadius: 3, bgcolor: "#EEF1F4", overflow: "hidden", flexShrink: 0 }}>
        <Box sx={{ width: `${Math.min(100, pct)}%`, height: "100%", borderRadius: 3, bgcolor: color, transformOrigin: "left", animation: "oc-grow-x 700ms cubic-bezier(0.22, 1, 0.36, 1) both" }} />
      </Box>
    </Box>
  );
}
