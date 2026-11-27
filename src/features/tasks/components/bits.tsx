"use client";

import Box from "@mui/material/Box";
import Tooltip from "@mui/material/Tooltip";
import FlagRounded from "@mui/icons-material/FlagRounded";
import EventRounded from "@mui/icons-material/EventRounded";
import type { Member, Project, TaskPriority, TaskStatus } from "../types";
import { priorityMeta, statusMeta } from "../types";
import { DUE_COLORS, dueInfo } from "../dates";
import { driveContentUrl } from "@/lib/drive/links";

/** Dark text on light colors, white on dark ones. */
export function textOn(hex: string): string {
  const h = hex.replace("#", "");
  if (h.length !== 6) return "#1F1F1F";
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? "#1F1F1F" : "#FFFFFF";
}

export function MemberAvatar({ member, size = 24, ring }: { member: Member | undefined; size?: number; ring?: string }) {
  const bg = member?.color ?? "#E3E3E3";
  const label = member ? (member.initials || member.name.slice(0, 1)).toUpperCase() : "?";
  const photo = member?.photo_file_id ? driveContentUrl(member.photo_file_id) : null;
  return (
    <Tooltip title={member ? `${member.name}${member.role ? ` · ${member.role}` : ""}` : "Belum ada PIC"}>
      <Box
        component="span"
        sx={{
          backgroundImage: photo ? `url("${photo}")` : "none",
          backgroundSize: "cover",
          backgroundPosition: "center",
          width: size,
          height: size,
          borderRadius: "50%",
          bgcolor: bg,
          color: textOn(bg),
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: size * 0.45,
          fontWeight: 600,
          flexShrink: 0,
          boxShadow: ring ? `0 0 0 2px ${ring}` : undefined,
          lineHeight: 1,
        }}
      >
        {photo ? null : label}
      </Box>
    </Tooltip>
  );
}

/** PIC first, then helpers, overlapping. */
export function AvatarStack({ ids, members, size = 24, ring = "#fff" }: { ids: (string | null)[]; members: Map<string, Member>; size?: number; ring?: string }) {
  const list = ids.filter((x): x is string => !!x);
  if (list.length === 0) return <MemberAvatar member={undefined} size={size} ring={ring} />;
  return (
    <Box sx={{ display: "inline-flex", alignItems: "center" }}>
      {list.map((id, i) => (
        // PIC on top, helpers tucked behind it.
        <Box key={id} component="span" sx={{ display: "inline-flex", position: "relative", zIndex: list.length - i, ml: i ? `-${size * 0.2}px` : 0 }}>
          <MemberAvatar member={members.get(id)} size={size} ring={ring} />
        </Box>
      ))}
    </Box>
  );
}

export function DueChip({ due, done, compact }: { due: string | null; done: boolean; compact?: boolean }) {
  const info = dueInfo(due, done);
  if (!info) return null;
  const c = DUE_COLORS[info.tone];
  return (
    <Box
      component="span"
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 0.5,
        px: compact ? 0.75 : 1,
        height: compact ? 20 : 24,
        borderRadius: "9999px",
        bgcolor: c.bg,
        color: c.color,
        fontSize: "0.75rem",
        fontWeight: 500,
        whiteSpace: "nowrap",
      }}
    >
      <EventRounded sx={{ fontSize: 14 }} />
      {info.label}
    </Box>
  );
}

export function StatusPill({ status }: { status: TaskStatus }) {
  const m = statusMeta(status);
  return (
    <Box
      component="span"
      sx={{ display: "inline-flex", alignItems: "center", px: 1, height: 22, borderRadius: "9999px", bgcolor: m.bg, color: m.color, fontSize: "0.75rem", fontWeight: 600, whiteSpace: "nowrap" }}
    >
      {m.label}
    </Box>
  );
}

export function PriorityFlag({ priority, showLow }: { priority: TaskPriority; showLow?: boolean }) {
  if (!showLow && (priority === "low" || priority === "medium")) return null;
  const m = priorityMeta(priority);
  return (
    <Tooltip title={`Prioritas ${m.label.toLowerCase()}`}>
      <FlagRounded sx={{ fontSize: 16, color: m.color }} />
    </Tooltip>
  );
}

/** The project's icon: custom logo, else emoji, else a colour square. */
export function ProjectMark({ project, size = 14 }: { project: Project | undefined; size?: number }) {
  if (!project) return null;
  if (project.logo_file_id)
    return (
      <Box component="span" sx={{ width: size, height: size, borderRadius: "4px", flexShrink: 0, backgroundImage: `url("${driveContentUrl(project.logo_file_id)}")`, backgroundSize: "cover", backgroundPosition: "center" }} />
    );
  if (project.emoji)
    return (
      <Box component="span" sx={{ fontSize: size, lineHeight: 1, flexShrink: 0, fontFamily: '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif' }}>
        {project.emoji}
      </Box>
    );
  return <Box component="span" sx={{ width: size * 0.65, height: size * 0.65, borderRadius: "3px", bgcolor: project.color, flexShrink: 0 }} />;
}

/** Project as a pill in its own colour. */
export function ProjectTag({ project }: { project: Project | undefined }) {
  if (!project) return null;
  return (
    <Box
      component="span"
      sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, height: 22, px: 1, borderRadius: "9999px", bgcolor: `${project.color}1A`, color: project.color, fontSize: "0.75rem", fontWeight: 600, whiteSpace: "nowrap", minWidth: 0, maxWidth: "100%" }}
    >
      {(project.emoji || project.logo_file_id) && <ProjectMark project={project} size={13} />}
      <Box component="span" sx={{ overflow: "hidden", textOverflow: "ellipsis" }}>
        {project.name}
      </Box>
    </Box>
  );
}

/** Priority as coloured text (board card, bottom right). */
export function PriorityText({ priority }: { priority: TaskPriority }) {
  const m = priorityMeta(priority);
  return (
    <Box component="span" sx={{ fontSize: "0.75rem", fontWeight: 600, color: m.color, whiteSpace: "nowrap" }}>
      {m.label}
    </Box>
  );
}

export function ProgressBar({ done, total }: { done: number; total: number }) {
  if (total === 0) return null;
  const pct = Math.round((done / total) * 100);
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
      <Box sx={{ flex: 1, height: 4, borderRadius: 2, bgcolor: "#E3E3E3", overflow: "hidden" }}>
        <Box sx={{ width: `${pct}%`, height: "100%", bgcolor: pct === 100 ? "#146C2E" : "#0B57D0", transition: "width 200ms" }} />
      </Box>
      <Box component="span" sx={{ fontSize: "0.75rem", color: "#5F6368", fontVariantNumeric: "tabular-nums" }}>
        {done}/{total}
      </Box>
    </Box>
  );
}
