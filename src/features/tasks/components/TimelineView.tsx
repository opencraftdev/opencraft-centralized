"use client";

import { useId, useState } from "react";
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
import { AvatarStack, ProjectMark } from "./bits";

const WEEKS = 6;
const LABEL_W = 168;

/** Readable text colour on a light tint of `c`: the colour itself, or near-black when it is too light. */
function inkOf(c: string) {
  const h = c.replace("#", "");
  if (h.length < 6) return "#1F1F1F";
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return 0.299 * r + 0.587 * g + 0.114 * b > 170 ? "#1F1F1F" : c;
}

// Timeline (option "per project"): weeks across; one block per project with each task as a labelled ribbon
// (start → deadline). Milestones are a golden star that gently pulses. Fits the screen width.
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
        <Box key={w} sx={{ borderLeft: "1px solid #EEF1F4", bgcolor: w === thisWeek ? "#F5F8FE" : "transparent" }} />
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

      <Box sx={{ overflowX: { xs: "auto", md: "visible" } }}>
        <Box sx={{ minWidth: { xs: 720, md: 0 }, position: "relative" }}>
          {/* Week header */}
          <Box sx={{ display: "flex", borderBottom: "1px solid #E0E3E7" }}>
            <Box sx={{ width: LABEL_W, flexShrink: 0 }} />
            <Box sx={{ flex: 1, display: "grid", gridTemplateColumns: `repeat(${WEEKS}, 1fr)` }}>
              {weeks.map((w) => {
                const on = w === thisWeek;
                return (
                  <Box key={w} sx={{ px: 1, pb: 1, borderLeft: "1px solid #E0E3E7", minWidth: 0 }}>
                    <Typography noWrap sx={{ fontSize: "0.8125rem", fontWeight: 600, color: on ? "#0B57D0" : "#1F1F1F" }}>{on ? "Minggu ini" : `Minggu ${fmtShort(w)}`}</Typography>
                    <Typography noWrap sx={{ fontSize: "0.6875rem", color: on ? "#0B57D0" : "#5F6368", fontWeight: on ? 600 : 400 }}>{fmtRange(w, addDays(w, 6))}</Typography>
                  </Box>
                );
              })}
            </Box>
          </Box>

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
            {groups.map((g) => {
              const color = g.project?.color ?? "#5F6368";
              const dated = g.tasks.filter((t) => t.start_date || t.due_date);
              const undated = g.tasks.filter((t) => !t.start_date && !t.due_date);
              return (
                <Box key={g.project?.id ?? "none"} sx={{ display: "flex", borderBottom: "1px solid #E6E9EE", "&:last-of-type": { borderBottom: "none" } }}>
                  {/* Project */}
                  <Box sx={{ width: LABEL_W, flexShrink: 0, pr: 1.5, py: 1.5, minWidth: 0 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.875, minWidth: 0 }}>
                      {g.project && (g.project.emoji || g.project.logo_file_id) ? <ProjectMark project={g.project} size={16} /> : <Box sx={{ width: 10, height: 10, borderRadius: "3px", bgcolor: color, flexShrink: 0 }} />}
                      <Typography noWrap sx={{ fontSize: "0.9375rem", fontWeight: 600, color: "#1F1F1F" }}>{g.project?.name ?? "Tanpa project"}</Typography>
                    </Box>
                    <Typography sx={{ fontSize: "0.6875rem", color: "#80868B", mt: 0.25 }}>
                      {g.project?.label ? `${g.project.label} · ` : ""}
                      {g.tasks.length} tugas
                    </Typography>
                    <Box
                      component="button"
                      type="button"
                      onClick={() => ctx.create({ project_id: g.project?.id ?? null, start_date: today, due_date: addDays(today, 6) })}
                      sx={{ display: "inline-flex", alignItems: "center", gap: 0.25, mt: 0.75, ml: -0.5, px: 0.5, py: 0.25, border: "none", bgcolor: "transparent", borderRadius: "6px", color: "#5F6368", fontFamily: "inherit", fontSize: "0.75rem", cursor: "pointer", "&:hover": { bgcolor: "#F1F3F4", color: "#1F1F1F" } }}
                    >
                      <AddRounded sx={{ fontSize: 16 }} /> Tambah
                    </Box>
                  </Box>
                  {/* Ribbons */}
                  <Box sx={{ flex: 1, position: "relative", py: 1.25, display: "flex", flexDirection: "column", gap: 0.75, minWidth: 0 }}>
                    {grid}
                    {dated.map((t) => (
                      <Ribbon key={t.id} task={t} ctx={ctx} from={from} days={days} color={color} />
                    ))}
                    {undated.length > 0 && (
                      <Box sx={{ position: "relative", display: "flex", flexWrap: "wrap", gap: 0.5, alignItems: "center", px: 0.5 }}>
                        <Typography sx={{ fontSize: "0.6875rem", color: "#80868B", mr: 0.5 }}>Belum ada tanggal:</Typography>
                        {undated.map((t) => (
                          <Box key={t.id} component="button" type="button" onClick={() => ctx.open(t)} sx={{ border: "1px dashed #C4C7C5", bgcolor: "#fff", borderRadius: "9999px", px: 1, py: 0.25, fontFamily: "inherit", fontSize: "0.6875rem", color: "#444746", cursor: "pointer", "&:hover": { borderColor: color, color: inkOf(color) } }}>
                            {t.title}
                          </Box>
                        ))}
                      </Box>
                    )}
                  </Box>
                </Box>
              );
            })}

            {/* Today line */}
            {showToday && groups.length > 0 && (
              <Box sx={{ position: "absolute", top: 0, bottom: 0, left: `calc(${LABEL_W}px + (100% - ${LABEL_W}px) * ${todayPct / 100})`, borderLeft: "2px solid #0B57D0", pointerEvents: "none", zIndex: 2 }}>
                <Box sx={{ position: "absolute", top: -9, left: 0, zIndex: 4, transform: "translateX(-50%)", fontSize: "0.625rem", fontWeight: 600, bgcolor: "#0B57D0", color: "#fff", borderRadius: "6px", px: 0.75, py: "1px", whiteSpace: "nowrap" }}>
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

const RIBBON_H = 30;

function Ribbon({ task: t, ctx, from, days, color }: { task: Task; ctx: TasksCtx; from: string; days: number; color: string }) {
  const start = (t.start_date ?? t.due_date)!;
  const end = (t.due_date ?? t.start_date)!;
  const done = t.status === "done";
  const subs = ctx.childrenOf.get(t.id) ?? [];
  const subsDone = subs.filter((x) => x.status === "done").length;
  const a = diffDays(from, start);
  const b = diffDays(from, end);
  // outside the visible weeks: keep the row (so rows don't jump) but show a small arrow hint
  if (b < 0 || a > days - 1) {
    const before = b < 0;
    return (
      <Box sx={{ position: "relative", height: RIBBON_H, display: "flex", alignItems: "center", justifyContent: before ? "flex-start" : "flex-end", px: 0.5 }}>
        <Box component="button" type="button" onClick={() => ctx.open(t)} sx={{ border: "none", bgcolor: "transparent", fontFamily: "inherit", fontSize: "0.6875rem", color: "#80868B", cursor: "pointer", "&:hover": { color: "#1F1F1F" } }}>
          {before ? `‹ ${t.title}` : `${t.title} ›`}
        </Box>
      </Box>
    );
  }
  const ca = Math.max(0, a);
  const cb = Math.min(days - 1, b);
  const left = (ca / days) * 100;
  const width = ((cb - ca + 1) / days) * 100;
  const ink = inkOf(color);

  if (t.is_milestone) {
    return (
      <Box sx={{ position: "relative", height: RIBBON_H }}>
        <Tooltip title={`Milestone · ${fmtRange(start, end)}`}>
          <Box
            component="button"
            type="button"
            onClick={() => ctx.open(t)}
            sx={{ position: "absolute", top: 0, height: RIBBON_H, left: `${((a + 0.5) / days) * 100}%`, transform: "translateX(-15px)", display: "flex", alignItems: "center", gap: 0.75, border: "none", bgcolor: "transparent", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap", p: 0, maxWidth: "none", zIndex: 3 }}
          >
            <MilestoneStar done={done} />
            <Box component="span" sx={{ fontSize: "0.75rem", fontWeight: 600, color: done ? "#80868B" : "#1F1F1F", bgcolor: "#FFF7DB", border: "1px solid #F6D77A", borderRadius: "9999px", px: 1, py: "3px", textDecoration: done ? "line-through" : "none" }}>
              {t.title}
            </Box>
          </Box>
        </Tooltip>
      </Box>
    );
  }

  const overdue = !done && end < todayISO();
  return (
    <Box sx={{ position: "relative", height: RIBBON_H }}>
      <Tooltip title={`${t.title} · ${fmtRange(start, end)}${overdue ? " · terlambat" : ""}${t.is_optional ? " · kalau perlu" : ""}`}>
        <Box
          component="button"
          type="button"
          onClick={() => ctx.open(t)}
          sx={{
            position: "absolute",
            top: 0,
            height: RIBBON_H,
            left: `calc(${left}% + 2px)`,
            width: `calc(${width}% - 4px)`,
            display: "flex",
            alignItems: "center",
            gap: 0.75,
            pl: 0.5,
            pr: 1,
            border: "none",
            borderRadius: "8px",
            boxShadow: overdue ? "inset 0 0 0 2px #C5221F" : "none",
            cursor: "pointer",
            fontFamily: "inherit",
            overflow: "hidden",
            color: ink,
            opacity: done ? 0.5 : 1,
            transformOrigin: "left center",
            animation: "oc-grow-x 520ms cubic-bezier(0.22, 1, 0.36, 1) both",
            bgcolor: t.is_optional ? "#fff" : `color-mix(in srgb, ${color} 13%, #fff)`,
            zIndex: 3,
            backgroundImage: t.is_optional ? `repeating-linear-gradient(135deg, ${color}33 0 6px, ${color}12 6px 12px)` : "none",
            transition: "filter 150ms, box-shadow 150ms",
            "&:hover": { filter: "brightness(0.97)", boxShadow: overdue ? "inset 0 0 0 2px #C5221F, 0 1px 3px rgba(60,64,67,.2)" : "0 1px 3px rgba(60,64,67,.2)" },
          }}
        >
          <AvatarStack ids={[t.assignee_id, ...t.helper_ids]} members={ctx.memberById} size={22} ring="#fff" />
          <Typography sx={{ fontSize: "0.75rem", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: "inherit", textDecoration: done ? "line-through" : "none", minWidth: 0 }}>{t.title}</Typography>
          <Box sx={{ flex: 1 }} />
          {done ? <CheckRounded sx={{ fontSize: 16 }} /> : subs.length > 0 && <Typography sx={{ fontSize: "0.6875rem", fontWeight: 600, color: "inherit", opacity: 0.75, fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>{subsDone}/{subs.length}</Typography>}
        </Box>
      </Tooltip>
    </Box>
  );
}

/** Golden star with a soft looping pulse, glow ring and a little shine, so milestones get noticed. */
function MilestoneStar({ done, size = 22 }: { done?: boolean; size?: number }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  return (
    <Box
      component="span"
      aria-hidden
      sx={{
        position: "relative",
        width: size + 8,
        height: size + 8,
        display: "grid",
        placeItems: "center",
        flexShrink: 0,
        "@keyframes oc-star-pulse": { "0%,100%": { transform: "scale(1) rotate(0deg)" }, "45%": { transform: "scale(1.14) rotate(-8deg)" }, "60%": { transform: "scale(1.08) rotate(6deg)" } },
        "@keyframes oc-star-ring": { "0%": { transform: "scale(.6)", opacity: 0.55 }, "70%,100%": { transform: "scale(1.5)", opacity: 0 } },
        "@keyframes oc-star-shine": { "0%,55%": { transform: "translateX(-140%) rotate(20deg)" }, "85%,100%": { transform: "translateX(140%) rotate(20deg)" } },
        "&::before": done
          ? {}
          : { content: '""', position: "absolute", inset: 0, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,200,40,.55) 0%, rgba(255,200,40,0) 70%)", animation: "oc-star-ring 2.4s cubic-bezier(0.22, 1, 0.36, 1) infinite" },
        "@media (prefers-reduced-motion: reduce)": { "&::before, & svg, & .shine": { animation: "none !important" } },
      }}
    >
      <Box component="svg" viewBox="0 0 24 24" width={size} height={size} sx={{ position: "relative", filter: done ? "grayscale(1) opacity(.5)" : "drop-shadow(0 1px 2px rgba(214,140,0,.45))", animation: done ? "none" : "oc-star-pulse 2.4s cubic-bezier(0.45, 0, 0.55, 1) infinite", overflow: "visible" }}>
        <defs>
          <linearGradient id={`${id}g`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FFF1A6" />
            <stop offset="45%" stopColor="#FFC928" />
            <stop offset="100%" stopColor="#F29900" />
          </linearGradient>
          <clipPath id={`${id}c`}>
            <path d="M12 2.2l2.83 5.97 6.52.8-4.8 4.5 1.24 6.47L12 16.77l-5.79 3.17 1.24-6.47-4.8-4.5 6.52-.8z" />
          </clipPath>
        </defs>
        <path d="M12 2.2l2.83 5.97 6.52.8-4.8 4.5 1.24 6.47L12 16.77l-5.79 3.17 1.24-6.47-4.8-4.5 6.52-.8z" fill={`url(#${id}g)`} stroke="#E8A100" strokeWidth="0.8" strokeLinejoin="round" />
        {!done && (
          <g clipPath={`url(#${id}c)`}>
            <Box component="rect" className="shine" x="6" y="-4" width="5" height="32" fill="rgba(255,255,255,.75)" sx={{ transformBox: "fill-box", transformOrigin: "center", animation: "oc-star-shine 2.4s ease-in-out infinite" }} />
          </g>
        )}
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
    <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", alignItems: "center" }}>
      {item(<Box sx={{ width: 22, height: 10, borderRadius: "4px", bgcolor: "#D3E3FD" }} />, "Jadwal")}
      {item(<MilestoneStar size={14} />, "Milestone")}
      {item(<Box sx={{ width: 22, height: 10, borderRadius: "4px", backgroundImage: "repeating-linear-gradient(135deg, #0B57D033 0 4px, #0B57D012 4px 8px)" }} />, "Kalau perlu")}
      {item(<Box sx={{ width: 22, height: 10, borderRadius: "4px", boxShadow: "inset 0 0 0 2px #C5221F" }} />, "Terlambat")}
    </Box>
  );
}
