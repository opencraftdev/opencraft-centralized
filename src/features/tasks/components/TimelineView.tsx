"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import ChevronLeftRounded from "@mui/icons-material/ChevronLeftRounded";
import ChevronRightRounded from "@mui/icons-material/ChevronRightRounded";
import CheckRounded from "@mui/icons-material/CheckRounded";
import AddRounded from "@mui/icons-material/AddRounded";
import type { Project, Task } from "../types";
import { addDays, diffDays, fmtRange, fmtShort, startOfWeek, todayISO } from "../dates";
import type { TasksCtx } from "./TasksApp";
import { AvatarStack, textOn } from "./bits";

// Timeline: weeks across, top-level tasks grouped by project down, like the "Timeline IoT" plan.
// Bar = start → deadline. Diamond = milestone. Striped = "kalau perlu".

const WEEKS = 6;
const LABEL_W = 240;

export function TimelineView({ ctx }: { ctx: TasksCtx }) {
  const today = todayISO();
  const [from, setFrom] = useState(() => addDays(startOfWeek(today), -7));
  const days = WEEKS * 7;
  const to = addDays(from, days - 1);
  const weeks = Array.from({ length: WEEKS }, (_, i) => addDays(from, i * 7));
  const thisWeek = startOfWeek(today);
  const todayPct = ((diffDays(from, today) + 0.5) / days) * 100;
  const showToday = today >= from && today <= to;

  const top = ctx.all.filter((t) => !t.parent_id && ctx.visible(t));
  const groups: { project: Project | null; tasks: Task[] }[] = [];
  for (const p of ctx.projects) {
    const tasks = top.filter((t) => t.project_id === p.id);
    if (tasks.length) groups.push({ project: p, tasks });
  }
  const loose = top.filter((t) => !t.project_id || !ctx.projectById.has(t.project_id));
  if (loose.length) groups.push({ project: null, tasks: loose });
  for (const g of groups) g.tasks.sort((a, b) => (a.start_date ?? a.due_date ?? "9999").localeCompare(b.start_date ?? b.due_date ?? "9999") || a.sort - b.sort);

  const grid = (
    <Box sx={{ position: "absolute", inset: 0, display: "grid", gridTemplateColumns: `repeat(${WEEKS}, 1fr)`, pointerEvents: "none" }}>
      {weeks.map((w) => (
        <Box key={w} sx={{ borderLeft: "1px solid #EEF1F4", bgcolor: w === thisWeek ? "rgba(11,87,208,0.03)" : "transparent" }} />
      ))}
    </Box>
  );

  return (
    <Box sx={{ p: { xs: 1.5, sm: 2 } }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5, flexWrap: "wrap" }}>
        <IconButton size="small" onClick={() => setFrom(addDays(from, -7))} aria-label="Minggu sebelumnya">
          <ChevronLeftRounded />
        </IconButton>
        <IconButton size="small" onClick={() => setFrom(addDays(from, 7))} aria-label="Minggu berikutnya">
          <ChevronRightRounded />
        </IconButton>
        <Button size="small" onClick={() => setFrom(addDays(thisWeek, -7))} sx={{ borderRadius: "9999px" }}>
          Hari ini
        </Button>
        <Typography sx={{ fontSize: "0.875rem", color: "#444746" }}>{fmtRange(from, to)}</Typography>
        <Box sx={{ flex: 1 }} />
        <Legend />
      </Box>

      <Box sx={{ overflowX: "auto", border: "1px solid #E0E3E7", borderRadius: "14px" }}>
        <Box sx={{ minWidth: 960 }}>
          {/* Week header */}
          <Box sx={{ display: "flex", borderBottom: "1px solid #E0E3E7", bgcolor: "#F8FAFD" }}>
            <Box sx={{ width: LABEL_W, flexShrink: 0, px: 2, py: 1.25, fontSize: "0.75rem", color: "#5F6368", fontWeight: 600 }}>TUGAS</Box>
            <Box sx={{ flex: 1, display: "grid", gridTemplateColumns: `repeat(${WEEKS}, 1fr)` }}>
              {weeks.map((w) => {
                const on = w === thisWeek;
                return (
                  <Box key={w} sx={{ px: 1.25, py: 1, borderLeft: "1px solid #E0E3E7" }}>
                    <Typography sx={{ fontSize: "0.8125rem", fontWeight: 600, color: on ? "#0B57D0" : "#1F1F1F" }}>{on ? "Minggu ini" : `Minggu ${fmtShort(w)}`}</Typography>
                    <Typography sx={{ fontSize: "0.6875rem", color: "#5F6368" }}>{fmtRange(w, addDays(w, 6))}</Typography>
                  </Box>
                );
              })}
            </Box>
          </Box>

          {/* Rows */}
          <Box sx={{ position: "relative" }}>
            {groups.length === 0 && (
              <Box sx={{ display: "flex" }}>
                <Box sx={{ width: LABEL_W, flexShrink: 0 }} />
                <Box sx={{ flex: 1, position: "relative", py: 6, textAlign: "center", color: "#5F6368", fontSize: "0.875rem" }}>
                  {grid}
                  Tidak ada tugas untuk filter ini.
                </Box>
              </Box>
            )}
            {groups.map((g) => (
              <Box key={g.project?.id ?? "none"}>
                <Box sx={{ display: "flex", alignItems: "stretch" }}>
                  <Box sx={{ width: LABEL_W, flexShrink: 0, px: 2, pt: 1.75, pb: 0.5, display: "flex", alignItems: "center", gap: 1 }}>
                    {g.project?.label && (
                      <Box component="span" sx={{ px: 0.75, py: "1px", borderRadius: "6px", bgcolor: `${g.project.color}1F`, color: g.project.color, fontSize: "0.625rem", fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase" }}>
                        {g.project.label}
                      </Box>
                    )}
                    <Typography sx={{ fontSize: "1rem", fontWeight: 600, color: "#1F1F1F" }}>{g.project?.name ?? "Tanpa project"}</Typography>
                  </Box>
                  <Box sx={{ flex: 1, position: "relative" }}>{grid}</Box>
                </Box>
                {g.tasks.map((t) => (
                  <Row key={t.id} task={t} ctx={ctx} from={from} days={days} grid={grid} color={g.project?.color ?? "#5F6368"} />
                ))}
                <Box sx={{ display: "flex" }}>
                  <Box sx={{ width: LABEL_W, flexShrink: 0, px: 1.25, pb: 0.75 }}>
                    <Button
                      size="small"
                      startIcon={<AddRounded sx={{ fontSize: 16 }} />}
                      onClick={() => ctx.create({ project_id: g.project?.id ?? null, start_date: today, due_date: addDays(today, 6) })}
                      sx={{ color: "#5F6368", fontSize: "0.75rem", borderRadius: "8px" }}
                    >
                      Tambah
                    </Button>
                  </Box>
                  <Box sx={{ flex: 1, position: "relative" }}>{grid}</Box>
                </Box>
              </Box>
            ))}

            {/* Today line */}
            {showToday && (
              <Box sx={{ position: "absolute", top: 0, bottom: 0, left: `calc(${LABEL_W}px + (100% - ${LABEL_W}px) * ${todayPct / 100})`, borderLeft: "1.5px dashed #1F1F1F", opacity: 0.55, pointerEvents: "none" }}>
                <Box sx={{ position: "absolute", top: 4, left: -24, width: 48, textAlign: "center", fontSize: "0.625rem", fontWeight: 600, bgcolor: "#1F1F1F", color: "#fff", borderRadius: "6px", py: "1px" }}>
                  Hari ini
                </Box>
              </Box>
            )}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

function Row({ task: t, ctx, from, days, grid, color }: { task: Task; ctx: TasksCtx; from: string; days: number; grid: React.ReactNode; color: string }) {
  const start = t.start_date ?? t.due_date;
  const end = t.due_date ?? t.start_date;
  const done = t.status === "done";
  const subs = ctx.childrenOf.get(t.id) ?? [];
  const subsDone = subs.filter((x) => x.status === "done").length;

  let bar: React.ReactNode = null;
  if (start && end) {
    const a = Math.max(0, diffDays(from, start));
    const b = Math.min(days - 1, diffDays(from, end));
    const overdue = !done && end < todayISO();
    if (b >= 0 && a <= days - 1) {
      const left = (a / days) * 100;
      const width = ((b - a + 1) / days) * 100;
      const names = [t.assignee_id, ...t.helper_ids].map((id) => (id ? ctx.memberById.get(id)?.name : null)).filter(Boolean) as string[];
      const label = names.length ? `${names[0]}${names.length > 1 ? ` · dibantu ${names.slice(1).join(", ")}` : ""}` : "Belum ada PIC";
      if (t.is_milestone) {
        bar = (
          <Box component="button" type="button" onClick={() => ctx.open(t)} sx={{ position: "absolute", top: "50%", left: `${left + width / 2}%`, transform: "translate(-9px,-50%)", display: "flex", alignItems: "center", gap: 1, border: "none", bgcolor: "transparent", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap", p: 0 }}>
            <Box sx={{ width: 14, height: 14, transform: "rotate(45deg)", bgcolor: done ? "#9AA0A6" : "#1F1F1F", borderRadius: "2px", m: "2px" }} />
            <Typography sx={{ fontSize: "0.75rem", fontWeight: 600, color: "#1F1F1F" }}>{t.description ? t.description.split("\n")[0] : label}</Typography>
          </Box>
        );
      } else {
        const fg = t.is_optional ? "#1F1F1F" : textOn(color);
        bar = (
          <Tooltip title={`${t.title} · ${fmtRange(start, end)}${overdue ? " · terlambat" : ""}`}>
            <Box
              component="button"
              type="button"
              onClick={() => ctx.open(t)}
              sx={{
                position: "absolute",
                top: 6,
                bottom: 6,
                left: `calc(${left}% + 3px)`,
                width: `calc(${width}% - 6px)`,
                display: "flex",
                alignItems: "center",
                gap: 0.75,
                px: 0.5,
                border: overdue ? "2px solid #B3261E" : "none",
                borderRadius: "9999px",
                cursor: "pointer",
                fontFamily: "inherit",
                overflow: "hidden",
                color: fg,
                opacity: done ? 0.45 : 1,
                transformOrigin: "left center",
                animation: "oc-grow-x 520ms cubic-bezier(0.22, 1, 0.36, 1) both",
                bgcolor: t.is_optional ? "transparent" : color,
                backgroundImage: t.is_optional ? `repeating-linear-gradient(135deg, ${color}2E 0 6px, ${color}12 6px 12px)` : "none",
                "&:hover": { filter: "brightness(1.06)", boxShadow: "0 1px 4px rgba(0,0,0,.2)" },
              }}
            >
              <AvatarStack ids={[t.assignee_id, ...t.helper_ids]} members={ctx.memberById} size={22} ring={t.is_optional ? "#fff" : color} />
              <Typography sx={{ fontSize: "0.75rem", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: "inherit" }}>{label}</Typography>
              {done && <CheckRounded sx={{ fontSize: 16, ml: "auto", mr: 0.5 }} />}
            </Box>
          </Tooltip>
        );
      }
    }
  }

  return (
    <Box sx={{ display: "flex", alignItems: "stretch", minHeight: 44, "&:hover .tl-label": { color: "#0B57D0" } }}>
      <Box
        component="button"
        type="button"
        onClick={() => ctx.open(t)}
        sx={{ width: LABEL_W, flexShrink: 0, px: 2, border: "none", bgcolor: "transparent", textAlign: "left", fontFamily: "inherit", cursor: "pointer", display: "flex", flexDirection: "column", justifyContent: "center", minWidth: 0 }}
      >
        <Typography className="tl-label" sx={{ fontSize: "0.8125rem", color: done ? "#5F6368" : "#1F1F1F", textDecoration: done ? "line-through" : "none", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {t.title}
        </Typography>
        {(subs.length > 0 || !start) && (
          <Typography sx={{ fontSize: "0.6875rem", color: "#5F6368" }}>
            {subs.length > 0 ? `${subsDone}/${subs.length} checklist` : ""}
            {subs.length > 0 && !start ? " · " : ""}
            {!start ? "belum ada tanggal" : ""}
          </Typography>
        )}
      </Box>
      <Box sx={{ flex: 1, position: "relative" }}>
        {grid}
        {bar}
      </Box>
    </Box>
  );
}

function Legend() {
  const item = (el: React.ReactNode, label: string) => (
    <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.75, fontSize: "0.75rem", color: "#5F6368" }}>
      {el}
      {label}
    </Box>
  );
  return (
    <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
      {item(<Box sx={{ width: 22, height: 10, borderRadius: 5, bgcolor: "#0B57D0" }} />, "Jadwal")}
      {item(<Box sx={{ width: 22, height: 10, borderRadius: 5, backgroundImage: "repeating-linear-gradient(135deg,#0B57D02E 0 4px,#0B57D012 4px 8px)" }} />, "Kalau perlu")}
      {item(<Box sx={{ width: 9, height: 9, transform: "rotate(45deg)", bgcolor: "#1F1F1F" }} />, "Milestone")}
      {item(<Box sx={{ width: 22, height: 10, borderRadius: 5, border: "2px solid #B3261E" }} />, "Terlambat")}
    </Box>
  );
}
