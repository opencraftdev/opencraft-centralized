"use client";

import { useState } from "react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import Box from "@mui/material/Box";
import InputBase from "@mui/material/InputBase";
import Typography from "@mui/material/Typography";
import AddRounded from "@mui/icons-material/AddRounded";
import type { Task, TaskStatus } from "../types";
import { STATUSES } from "../types";
import { EASE_OUT, SPRING } from "@/components/ui/motion";
import type { TasksCtx } from "./TasksApp";
import { AvatarStack, DueChip, PriorityText, ProgressBar, ProjectTag } from "./bits";

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
    <LayoutGroup>
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
              <AnimatePresence initial={false}>
                {items.map((t, i) => (
                  // layoutId: a card that changes status glides to its new column.
                  <motion.div
                    key={t.id}
                    layoutId={`task-card-${t.id}`}
                    initial={{ opacity: 0, y: 8, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.15 } }}
                    transition={{ layout: SPRING, default: { duration: 0.28, ease: EASE_OUT, delay: Math.min(i, 8) * 0.025 } }}
                  >
                    <Card task={t} ctx={ctx} dragging={dragId === t.id} onDragStart={() => setDragId(t.id)} onDragEnd={() => { setDragId(null); setOverCol(null); }} />
                  </motion.div>
                ))}
              </AnimatePresence>
              <QuickAdd onAdd={(title) => onQuickAdd(title, s.value)} />
            </Box>
          </Box>
        );
      })}
    </Box>
    </LayoutGroup>
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
      {/* Project pill · deadline */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
        <ProjectTag project={t.project_id ? ctx.projectById.get(t.project_id) : undefined} />
        <Box sx={{ flex: 1 }} />
        <DueChip due={t.due_date} done={isDone} compact />
      </Box>
      <Typography sx={{ fontSize: "0.9375rem", fontWeight: 500, color: isDone ? "#5F6368" : "#1F1F1F", textDecoration: isDone ? "line-through" : "none", lineHeight: 1.35 }}>
        {t.title}
      </Typography>
      {subs.length > 0 && <ProgressBar done={done} total={subs.length} />}
      {/* People · priority */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <AvatarStack ids={[t.assignee_id, ...t.helper_ids]} members={ctx.memberById} size={24} />
        <Box sx={{ flex: 1 }} />
        <PriorityText priority={t.priority} />
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
