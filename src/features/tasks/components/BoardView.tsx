"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import InputBase from "@mui/material/InputBase";
import Typography from "@mui/material/Typography";
import AddRounded from "@mui/icons-material/AddRounded";
import DiamondOutlined from "@mui/icons-material/DiamondOutlined";
import ChecklistRounded from "@mui/icons-material/ChecklistRounded";
import type { Task, TaskStatus } from "../types";
import { STATUSES } from "../types";
import type { TasksCtx } from "./TasksApp";
import { AvatarStack, DueChip, PriorityFlag, ProgressBar, ProjectTag } from "./bits";

// Board: one column per status, top-level tasks as cards. Drag a card to another column to change its status.

export function BoardView({ ctx, onQuickAdd }: { ctx: TasksCtx; onQuickAdd: (title: string, status: TaskStatus) => Promise<void> }) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<TaskStatus | null>(null);

  const top = ctx.all
    .filter((t) => !t.parent_id && ctx.visible(t))
    .sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999") || a.sort - b.sort);

  const drop = (status: TaskStatus) => {
    const t = ctx.all.find((x) => x.id === dragId);
    setDragId(null);
    setOverCol(null);
    if (t && t.status !== status) ctx.patch(t, { status });
  };

  return (
    <Box sx={{ display: "flex", gap: 1.5, p: { xs: 1.5, sm: 2 }, overflowX: "auto", alignItems: "flex-start", height: "100%" }}>
      {STATUSES.map((s) => {
        const items = top.filter((t) => t.status === s.value);
        return (
          <Box
            key={s.value}
            onDragOver={(e) => {
              if (!dragId) return;
              e.preventDefault();
              setOverCol(s.value);
            }}
            onDragLeave={() => setOverCol((c) => (c === s.value ? null : c))}
            onDrop={(e) => {
              e.preventDefault();
              drop(s.value);
            }}
            sx={{
              flex: "1 0 260px",
              maxWidth: 360,
              bgcolor: overCol === s.value ? "#E8F0FE" : "#F8FAFD",
              border: "1px solid",
              borderColor: overCol === s.value ? "#A8C7FA" : "#EEF1F4",
              borderRadius: "14px",
              p: 1,
              transition: "background-color 120ms",
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 0.75, pt: 0.5, pb: 1 }}>
              <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: s.color }} />
              <Typography sx={{ fontSize: "0.875rem", fontWeight: 600, color: "#1F1F1F" }}>{s.label}</Typography>
              <Typography sx={{ fontSize: "0.8125rem", color: "#5F6368" }}>{items.length}</Typography>
            </Box>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {items.map((t) => (
                <Card key={t.id} task={t} ctx={ctx} dragging={dragId === t.id} onDragStart={() => setDragId(t.id)} onDragEnd={() => { setDragId(null); setOverCol(null); }} />
              ))}
              <QuickAdd onAdd={(title) => onQuickAdd(title, s.value)} />
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}

function Card({ task: t, ctx, dragging, onDragStart, onDragEnd }: { task: Task; ctx: TasksCtx; dragging: boolean; onDragStart: () => void; onDragEnd: () => void }) {
  const subs = ctx.childrenOf.get(t.id) ?? [];
  const done = subs.filter((x) => x.status === "done").length;
  const isDone = t.status === "done";
  return (
    <Box
      component="button"
      type="button"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", t.id);
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      onClick={() => ctx.open(t)}
      sx={{
        textAlign: "left",
        fontFamily: "inherit",
        width: "100%",
        bgcolor: "#fff",
        border: "1px solid #E0E3E7",
        borderRadius: "12px",
        p: 1.5,
        cursor: "grab",
        opacity: dragging ? 0.4 : 1,
        display: "flex",
        flexDirection: "column",
        gap: 1,
        "&:hover": { borderColor: "#A8C7FA", boxShadow: "0 1px 3px rgba(60,64,67,.15)" },
        "&:focus-visible": { outline: "2px solid #0B57D0", outlineOffset: 1 },
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
        <ProjectTag project={t.project_id ? ctx.projectById.get(t.project_id) : undefined} />
        <Box sx={{ flex: 1 }} />
        {t.is_milestone && <DiamondOutlined sx={{ fontSize: 16, color: "#444746" }} titleAccess="Milestone" />}
        <PriorityFlag priority={t.priority} />
      </Box>
      <Typography sx={{ fontSize: "0.9375rem", fontWeight: 500, color: isDone ? "#5F6368" : "#1F1F1F", textDecoration: isDone ? "line-through" : "none", lineHeight: 1.35 }}>
        {t.title}
        {t.is_optional && (
          <Box component="span" sx={{ ml: 0.75, px: 0.75, py: "1px", borderRadius: "6px", bgcolor: "#F1F3F4", color: "#5F6368", fontSize: "0.6875rem", fontWeight: 500, verticalAlign: "middle", textDecoration: "none", display: "inline-block" }}>
            kalau perlu
          </Box>
        )}
      </Typography>
      {subs.length > 0 && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
          <ChecklistRounded sx={{ fontSize: 16, color: "#5F6368" }} />
          <Box sx={{ flex: 1 }}>
            <ProgressBar done={done} total={subs.length} />
          </Box>
        </Box>
      )}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <AvatarStack ids={[t.assignee_id, ...t.helper_ids]} members={ctx.memberById} size={24} />
        <Box sx={{ flex: 1 }} />
        <DueChip due={t.due_date} done={isDone} compact />
      </Box>
    </Box>
  );
}

function QuickAdd({ onAdd }: { onAdd: (title: string) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  if (!editing) {
    return (
      <Box
        component="button"
        type="button"
        onClick={() => setEditing(true)}
        sx={{ display: "flex", alignItems: "center", gap: 0.75, border: "none", bgcolor: "transparent", color: "#5F6368", fontFamily: "inherit", fontSize: "0.8125rem", px: 1, py: 0.75, borderRadius: "8px", cursor: "pointer", "&:hover": { bgcolor: "#EEF1F4", color: "#1F1F1F" } }}
      >
        <AddRounded sx={{ fontSize: 18 }} /> Tambah tugas
      </Box>
    );
  }
  const submit = async () => {
    const t = value.trim();
    if (t) await onAdd(t);
    setValue("");
  };
  return (
    <Box sx={{ bgcolor: "#fff", border: "1px solid #A8C7FA", borderRadius: "12px", px: 1.5, py: 1 }}>
      <InputBase
        autoFocus
        fullWidth
        multiline
        value={value}
        placeholder="Judul tugas, Enter untuk simpan"
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => {
          void submit();
          setEditing(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            void submit();
          }
          if (e.key === "Escape") {
            setValue("");
            setEditing(false);
          }
        }}
        sx={{ fontSize: "0.875rem" }}
      />
    </Box>
  );
}
