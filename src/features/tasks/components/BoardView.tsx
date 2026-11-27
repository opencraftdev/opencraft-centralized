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
import { AvatarStack, CommentCount, DueChip, PriorityText, ProgressBar, ProjectTag } from "./bits";

// Board: one column per status, top-level tasks as cards, in their manual order (`sort`). Drag a card up/down to
// reorder it, or into another column to change its status; a blue line shows where it will land.

export function BoardView({ ctx, onQuickAdd }: { ctx: TasksCtx; onQuickAdd: (title: string, status: TaskStatus) => Promise<void> }) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<{ col: TaskStatus; index: number } | null>(null);

  const top = ctx.all
    .filter((t) => !t.parent_id && ctx.visible(t))
    .sort((a, b) => a.sort - b.sort || (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999") || a.created_at.localeCompare(b.created_at));

  const reset = () => {
    setDragId(null);
    setOver(null);
  };

  /** Puts the dragged card at `index` of column `status` (index counts the column as shown, the card included). */
  const drop = (status: TaskStatus, index: number) => {
    const t = ctx.all.find((x) => x.id === dragId);
    reset();
    if (!t) return;
    const shown = top.filter((x) => x.status === status);
    const from = shown.findIndex((x) => x.id === t.id);
    if (from !== -1 && (index === from || index === from + 1)) return; // dropped where it already is
    const rest = shown.filter((x) => x.id !== t.id);
    const at = from !== -1 && from < index ? index - 1 : index;
    const prev = rest[at - 1];
    const next = rest[at];
    const statusPatch = t.status !== status ? { status } : {};
    let sort: number | null = null;
    if (prev && next) sort = prev.sort < next.sort ? (prev.sort + next.sort) / 2 : null;
    else if (prev) sort = prev.sort + 1;
    else if (next) sort = next.sort - 1;
    else sort = t.sort;
    if (sort !== null) {
      ctx.patch(t, { ...statusPatch, sort });
      return;
    }
    // neighbours share a sort value (older data): number the whole column in its new order
    const order = [...rest.slice(0, at), t, ...rest.slice(at)];
    order.forEach((x, i) => {
      const p = x.id === t.id ? { ...statusPatch, sort: i } : { sort: i };
      if (x.id === t.id || x.sort !== i) ctx.patch(x, p);
    });
  };

  /** Index to insert at, from the pointer's position over card `i`. */
  const overCard = (e: React.DragEvent, col: TaskStatus, i: number) => {
    if (!dragId) return;
    e.preventDefault();
    e.stopPropagation();
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const index = e.clientY < r.top + r.height / 2 ? i : i + 1;
    setOver((o) => (o && o.col === col && o.index === index ? o : { col, index }));
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
              // over the column but not over a card (header, gaps, empty space below): append at the end
              if (!over || over.col !== s.value) setOver({ col: s.value, index: items.length });
            }}
            onDragLeave={(e) => {
              if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node | null)) setOver((o) => (o?.col === s.value ? null : o));
            }}
            onDrop={(e) => {
              e.preventDefault();
              drop(s.value, over?.col === s.value ? over.index : items.length);
            }}
            sx={{
              flex: "1 0 260px",
              maxWidth: 360,
              bgcolor: over?.col === s.value ? "#EEF3FD" : "#F8FAFD",
              border: "1px solid",
              borderColor: over?.col === s.value ? "#A8C7FA" : "#EEF1F4",
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
                    onDragOver={(e: React.DragEvent) => overCard(e, s.value, i)}
                    style={{ position: "relative" }}
                  >
                    {over?.col === s.value && over.index === i && <DropLine edge="top" />}
                    {over?.col === s.value && over.index === items.length && i === items.length - 1 && <DropLine edge="bottom" />}
                    <Card task={t} ctx={ctx} dragging={dragId === t.id} onDragStart={() => setDragId(t.id)} onDragEnd={reset} />
                  </motion.div>
                ))}
              </AnimatePresence>
              {over?.col === s.value && items.length === 0 && <Box sx={{ height: 3, borderRadius: 2, bgcolor: "#0B57D0", mx: 0.5 }} />}
              <QuickAdd onAdd={(title) => onQuickAdd(title, s.value)} />
            </Box>
          </Box>
        );
      })}
    </Box>
    </LayoutGroup>
  );
}

/** The blue "it lands here" line, in the 8px gap above or below a card. */
function DropLine({ edge }: { edge: "top" | "bottom" }) {
  return (
    <Box
      aria-hidden
      sx={{
        position: "absolute",
        left: 4,
        right: 4,
        [edge]: -5.5,
        height: 3,
        borderRadius: 2,
        bgcolor: "#0B57D0",
        pointerEvents: "none",
        animation: "oc-grow-x 160ms cubic-bezier(0.22, 1, 0.36, 1) both",
        "&::before, &::after": { content: '""', position: "absolute", top: -2.5, width: 8, height: 8, borderRadius: "50%", border: "2px solid #0B57D0", bgcolor: "#fff" },
        "&::before": { left: -4 },
        "&::after": { right: -4 },
      }}
    />
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
        <CommentCount count={ctx.commentTotal(t.id)} />
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
