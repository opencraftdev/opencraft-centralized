"use client";

import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { Task } from "../types";
import type { TasksCtx } from "./TasksApp";
import { DueChip, MemberAvatar, ProjectMark } from "./bits";
import { AutoHeight } from "@/components/ui/AutoHeight";

// Header of /tasks: the deadline tabs as plain text (Terlambat · Hari ini · Minggu ini · Minggu depan) and that
// tab's tasks as plain rows. No boxes.

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

  return (
    <Box sx={{ px: { xs: 2, sm: 3 }, pt: 1.5, pb: 2.5, maxWidth: 980 }}>
      {/* Deadline tabs as plain text */}
      <Box role="tablist" aria-label="Deadline" sx={{ display: "flex", flexWrap: "wrap", gap: { xs: 1.5, sm: 2.25 }, mb: 0.5 }}>
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
                bgcolor: "transparent",
                p: 0,
                py: 0.25,
                cursor: "pointer",
                fontFamily: "inherit",
                fontSize: "0.875rem",
                fontWeight: on ? 500 : 400,
                whiteSpace: "nowrap",
                color: on ? (late ? "#B3261E" : "#0B57D0") : late ? "#B3261E" : "#5F6368",
                transition: "color 200ms",
                "&:hover": { color: late ? "#B3261E" : "#0B57D0" },
                "&:focus-visible": { outline: "2px solid #0B57D0", outlineOffset: 2, borderRadius: "4px" },
              }}
            >
              {t.label}{" "}
              <Box component="span" sx={{ fontVariantNumeric: "tabular-nums" }}>
                {n}
              </Box>
            </Box>
          );
        })}
      </Box>

      <AutoHeight>
        <Box key={tab}>
          {list.length === 0 && <Typography sx={{ fontSize: "0.875rem", color: "#5F6368", py: 1.1, animation: "oc-rise 300ms both" }}>{meta.empty}</Typography>}
          {list.slice(0, MAX_ROWS).map((t, i) => (
            <FocusRow key={t.id} task={t} ctx={ctx} index={i} />
          ))}
          {list.length > MAX_ROWS && (
            <Typography sx={{ fontSize: "0.8125rem", color: "#5F6368", pt: 1, borderTop: "1px solid #EEF1F4" }}>dan {list.length - MAX_ROWS} lainnya</Typography>
          )}
        </Box>
      </AutoHeight>
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
        px: 0,
        py: 1.1,
        border: "none",
        borderTop: index ? "1px solid #EEF1F4" : "none",
        bgcolor: "transparent",
        cursor: "pointer",
        fontFamily: "inherit",
        textAlign: "left",
        animation: `oc-rise 320ms cubic-bezier(0.22, 1, 0.36, 1) ${index * 40}ms both`,
        "& .focus-title": { transition: "color 150ms" },
        "&:hover .focus-title": { color: "#0B57D0" },
        "&:focus-visible": { outline: "2px solid #0B57D0", outlineOffset: 2, borderRadius: "6px" },
      }}
    >
      <MemberAvatar member={t.assignee_id ? ctx.memberById.get(t.assignee_id) : undefined} size={22} />
      <Box sx={{ minWidth: 0, flex: 1, display: "flex", alignItems: "center", gap: 1 }}>
        <Typography className="focus-title" sx={{ fontSize: "0.875rem", color: "#1F1F1F", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</Typography>
        <Box component="span" sx={{ display: { xs: "none", sm: "inline-flex" }, alignItems: "center", gap: 0.5, fontSize: "0.75rem", color: "#5F6368", whiteSpace: "nowrap", flexShrink: 0 }}>
          {project && <ProjectMark project={project} size={12} />}
          {parent ? parent.title.slice(0, 24) : project?.name}
        </Box>
      </Box>
      <DueChip due={t.due_date} done={false} compact />
    </Box>
  );
}
