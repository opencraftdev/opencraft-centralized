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

const TABS: { key: DueTab; label: string; empty: string; tone: string; soft: string }[] = [
  { key: "late", label: "Terlambat", empty: "Tidak ada yang terlambat.", tone: "#B3261E", soft: "#FCE8E6" },
  { key: "today", label: "Hari ini", empty: "Tidak ada deadline hari ini.", tone: "#B06000", soft: "#FEF0DB" },
  { key: "week", label: "Minggu ini", empty: "Minggu ini bebas deadline.", tone: "#0B57D0", soft: "#E8F0FE" },
  { key: "next", label: "Minggu depan", empty: "Belum ada deadline minggu depan.", tone: "#5F6368", soft: "#F1F3F4" },
];

/** Filled duotone icons in the sidebar's style (light layer at 35% + strong layer), tinted per deadline. */
function DeadlineIcon({ kind, color }: { kind: DueTab; color: string }) {
  const b = { fill: color, opacity: 0.35 };
  const a = { fill: color };
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false" style={{ flexShrink: 0 }}>
      {kind === "late" ? (
        <>
          <circle cx="12" cy="13" r="9.5" style={b} />
          <rect x="10.8" y="7.5" width="2.4" height="7" rx="1.2" style={a} />
          <circle cx="12" cy="17.6" r="1.4" style={a} />
          <path d="M3.2 6.4 6.6 3a1.2 1.2 0 0 1 1.7 1.7L4.9 8.1a1.2 1.2 0 0 1-1.7-1.7zM20.8 6.4 17.4 3a1.2 1.2 0 0 0-1.7 1.7l3.4 3.4a1.2 1.2 0 0 0 1.7-1.7z" style={a} />
        </>
      ) : (
        <>
          <rect x="2.5" y="4" width="19" height="18" rx="3.5" style={b} />
          <rect x="6.5" y="1.5" width="2.6" height="5.5" rx="1.3" style={a} />
          <rect x="14.9" y="1.5" width="2.6" height="5.5" rx="1.3" style={a} />
          {kind === "today" && <rect x="6.5" y="11" width="6" height="6" rx="1.6" style={a} />}
          {kind === "week" && <rect x="5.5" y="12.5" width="13" height="4.4" rx="1.6" style={a} />}
          {kind === "next" && <path d="M13.2 10.3a1.15 1.15 0 0 1 1.63 0l3.4 3.4a1.15 1.15 0 0 1 0 1.63l-3.4 3.4a1.15 1.15 0 0 1-1.63-1.63l1.44-1.44H7.3a1.15 1.15 0 0 1 0-2.3h7.34l-1.44-1.44a1.15 1.15 0 0 1 0-1.62z" style={a} />}
        </>
      )}
    </svg>
  );
}
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
      {/* Deadline tabs: duotone icon (same style as the sidebar) + label + count, coloured underline when active */}
      <Box role="tablist" aria-label="Deadline" sx={{ display: "flex", flexWrap: "wrap", columnGap: { xs: 2, sm: 3 }, rowGap: 0.5, borderBottom: "1px solid #EEF1F4", mb: 0.25 }}>
        {TABS.map((t) => {
          const on = t.key === tab;
          const n = data.lists[t.key].length;
          return (
            <Box
              key={t.key}
              component="button"
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setTab(t.key)}
              sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: 0.875,
                border: "none",
                bgcolor: "transparent",
                px: 0.25,
                pt: 0.5,
                pb: 1.1,
                mb: "-1px",
                borderBottom: "2px solid",
                borderColor: on ? t.tone : "transparent",
                cursor: "pointer",
                fontFamily: "inherit",
                fontSize: "0.875rem",
                fontWeight: on ? 500 : 400,
                whiteSpace: "nowrap",
                color: on ? t.tone : "#444746",
                transition: "color 200ms, border-color 200ms",
                "&:hover": { color: t.tone },
                "&:focus-visible": { outline: "2px solid #0B57D0", outlineOffset: 2, borderRadius: "4px" },
              }}
            >
              <DeadlineIcon kind={t.key} color={t.tone} />
              {t.label}
              <Box
                component="span"
                sx={{
                  minWidth: 20,
                  height: 20,
                  px: 0.75,
                  borderRadius: "9999px",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "0.7188rem",
                  fontWeight: 500,
                  fontVariantNumeric: "tabular-nums",
                  bgcolor: n ? t.soft : "#F1F3F4",
                  color: n ? t.tone : "#9AA0A6",
                }}
              >
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
