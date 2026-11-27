"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Typography from "@mui/material/Typography";
import AddRounded from "@mui/icons-material/AddRounded";
import type { Member, Task } from "../types";
import { dueInfo, fmtRange, fmtShort } from "../dates";
import type { TasksCtx } from "./TasksApp";
import { DueChip, MemberAvatar, ProgressBar, textOn } from "./bits";

// Per orang: one card per team member with their own checklist (like "Tugas per orang" in the plan PDF).
// Shows the "leaf" tasks a person is PIC of — subtasks, and tasks without subtasks — grouped by period.

export function PeopleView({ ctx, memberFilter }: { ctx: TasksCtx; memberFilter: string }) {
  const people = ctx.members.filter((m) => m.active && (memberFilter === "all" || m.id === memberFilter));
  const leaves = ctx.all.filter((t) => !(ctx.childrenOf.get(t.id)?.length));
  const unassigned = leaves.filter((t) => !t.assignee_id && ctx.visible(t));

  return (
    <Box sx={{ p: { xs: 1.5, sm: 2 }, display: "grid", gap: 1.5, gridTemplateColumns: { xs: "1fr", sm: "repeat(auto-fill, minmax(280px, 1fr))" }, alignItems: "start" }}>
      {people.map((m) => (
        <PersonCard key={m.id} member={m} tasks={leaves.filter((t) => t.assignee_id === m.id && ctx.visible(t))} all={leaves.filter((t) => t.assignee_id === m.id)} ctx={ctx} />
      ))}
      {memberFilter === "all" && unassigned.length > 0 && <PersonCard member={null} tasks={unassigned} all={unassigned} ctx={ctx} />}
      {people.length === 0 && <Typography sx={{ color: "#5F6368", fontSize: "0.875rem", p: 2 }}>Belum ada anggota tim. Tambahkan lewat “Tim & proyek”.</Typography>}
    </Box>
  );
}

function PersonCard({ member, tasks, all, ctx }: { member: Member | null; tasks: Task[]; all: Task[]; ctx: TasksCtx }) {
  const done = all.filter((t) => t.status === "done").length;
  const overdue = all.filter((t) => dueInfo(t.due_date, t.status === "done")?.tone === "overdue").length;

  // Group by period (start → deadline), earliest first.
  const groups = new Map<string, { label: string; key: string; items: Task[] }>();
  for (const t of tasks) {
    const a = t.start_date ?? t.due_date;
    const b = t.due_date ?? t.start_date;
    const key = a && b ? `${a}|${b}` : "~";
    const label = a && b ? (a === b ? fmtShort(a) : fmtRange(a, b)) : "Tanpa tanggal";
    const g = groups.get(key) ?? { label, key, items: [] };
    g.items.push(t);
    groups.set(key, g);
  }
  const ordered = [...groups.values()].sort((x, y) => x.key.localeCompare(y.key));

  return (
    <Box sx={{ border: "1px solid #E0E3E7", borderRadius: "16px", display: "flex", flexDirection: "column", bgcolor: "#fff", overflow: "hidden" }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, px: 2, pt: 2, pb: 1.25 }}>
        <MemberAvatar member={member ?? undefined} size={40} />
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography sx={{ fontSize: "0.6875rem", fontWeight: 600, letterSpacing: ".06em", color: "#5F6368", textTransform: "uppercase" }}>{member?.role || (member ? "Anggota" : "Belum ada PIC")}</Typography>
          <Typography sx={{ fontSize: "1.125rem", fontWeight: 600, color: "#1F1F1F", lineHeight: 1.25 }}>{member?.name ?? "Belum di-assign"}</Typography>
        </Box>
        {overdue > 0 && (
          <Box sx={{ px: 1, height: 22, display: "flex", alignItems: "center", borderRadius: "9999px", bgcolor: "#FCE8E6", color: "#B3261E", fontSize: "0.6875rem", fontWeight: 600 }}>{overdue} terlambat</Box>
        )}
      </Box>
      <Box sx={{ px: 2, pb: 1 }}>
        <ProgressBar done={done} total={all.length} />
      </Box>

      <Box sx={{ px: 1, pb: 1, flex: 1 }}>
        {ordered.length === 0 && <Typography sx={{ fontSize: "0.8125rem", color: "#5F6368", px: 1, py: 2 }}>Tidak ada tugas.</Typography>}
        {ordered.map((g) => (
          <Box key={g.key} sx={{ mt: 1 }}>
            <Typography sx={{ fontSize: "0.6875rem", fontWeight: 600, letterSpacing: ".06em", color: "#5F6368", textTransform: "uppercase", px: 1, mb: 0.25 }}>{g.label}</Typography>
            {g.items
              .sort((a, b) => a.sort - b.sort)
              .map((t) => {
                const parent = t.parent_id ? ctx.all.find((x) => x.id === t.parent_id) : undefined;
                const isDone = t.status === "done";
                const tone = dueInfo(t.due_date, isDone)?.tone;
                return (
                  <Box key={t.id} sx={{ display: "flex", alignItems: "flex-start", gap: 0.5, borderRadius: "8px", "&:hover": { bgcolor: "#F8FAFD" } }}>
                    <Checkbox
                      size="small"
                      checked={isDone}
                      onChange={(e) => ctx.patch(t, { status: e.target.checked ? "done" : "todo" })}
                      slotProps={{ input: { "aria-label": `Selesai: ${t.title}` } }}
                      sx={{ p: 0.75 }}
                    />
                    <Box component="button" type="button" onClick={() => ctx.open(t)} sx={{ flex: 1, minWidth: 0, textAlign: "left", border: "none", bgcolor: "transparent", fontFamily: "inherit", cursor: "pointer", py: 0.75, pr: 1 }}>
                      <Typography sx={{ fontSize: "0.8125rem", color: isDone ? "#5F6368" : "#1F1F1F", textDecoration: isDone ? "line-through" : "none", lineHeight: 1.4 }}>{t.title}</Typography>
                      {(parent || tone === "overdue" || tone === "soon") && (
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mt: 0.25, flexWrap: "wrap" }}>
                          {parent && <Typography sx={{ fontSize: "0.6875rem", color: "#5F6368" }}>{parent.title}</Typography>}
                          {(tone === "overdue" || tone === "soon") && <DueChip due={t.due_date} done={isDone} compact />}
                        </Box>
                      )}
                    </Box>
                  </Box>
                );
              })}
          </Box>
        ))}
        <Button
          size="small"
          startIcon={<AddRounded sx={{ fontSize: 16 }} />}
          onClick={() => ctx.create({ assignee_id: member?.id ?? null })}
          sx={{ mt: 0.5, ml: 0.5, color: "#5F6368", fontSize: "0.75rem", borderRadius: "8px" }}
        >
          Tambah tugas
        </Button>
      </Box>

      {member?.goal && (
        <Box sx={{ m: 1.5, mt: 0, px: 1.5, py: 1, borderRadius: "10px", bgcolor: textOn(member.color) === "#FFFFFF" ? "#EEF1F4" : `${member.color}66`, fontSize: "0.75rem", color: "#1F1F1F" }}>
          <b>Hasil:</b> {member.goal}
        </Box>
      )}
    </Box>
  );
}
