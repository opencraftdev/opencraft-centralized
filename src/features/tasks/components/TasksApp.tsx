"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import InputBase from "@mui/material/InputBase";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Switch from "@mui/material/Switch";
import FormControlLabel from "@mui/material/FormControlLabel";
import Typography from "@mui/material/Typography";
import AddRounded from "@mui/icons-material/AddRounded";
import SearchRounded from "@mui/icons-material/SearchRounded";
import GroupsOutlined from "@mui/icons-material/GroupsOutlined";
import ViewKanbanOutlined from "@mui/icons-material/ViewKanbanOutlined";
import ViewTimelineOutlined from "@mui/icons-material/ViewTimelineOutlined";
import PeopleAltOutlined from "@mui/icons-material/PeopleAltOutlined";
import { toastError } from "@/components/ui/Toast";
import { createTask, loadTaskData, subscribeTasks, updateTask, type TaskData } from "../api";
import type { Member, Project, Task, TaskInput, TaskStatus } from "../types";
import { addDays, startOfWeek, todayISO, diffDays } from "../dates";
import { BoardView } from "./BoardView";
import { TimelineView } from "./TimelineView";
import { PeopleView } from "./PeopleView";
import { TaskDialog } from "./TaskDialog";
import { TeamDialog } from "./TeamDialog";

// /tasks (docs/TASKS.md): the team's task board. Three views over the same tasks: Board (status columns),
// Timeline (weeks, like the "Timeline IoT" PDF) and Per orang (checklist per person).

export type View = "board" | "timeline" | "people";

export interface TasksCtx {
  members: Member[];
  memberById: Map<string, Member>;
  projects: Project[];
  projectById: Map<string, Project>;
  /** All tasks (unfiltered). */
  all: Task[];
  /** Subtasks per parent id (unfiltered, sorted). */
  childrenOf: Map<string, Task[]>;
  /** Does this task pass the toolbar filters (top-level: also when one of its subtasks passes)? */
  visible: (t: Task) => boolean;
  open: (t: Task) => void;
  create: (defaults: Partial<TaskInput>) => void;
  patch: (t: Task, p: Partial<TaskInput>) => void;
}

const VIEWS: { value: View; label: string; icon: React.ReactNode }[] = [
  { value: "board", label: "Board", icon: <ViewKanbanOutlined sx={{ fontSize: 18 }} /> },
  { value: "timeline", label: "Timeline", icon: <ViewTimelineOutlined sx={{ fontSize: 18 }} /> },
  { value: "people", label: "Per orang", icon: <PeopleAltOutlined sx={{ fontSize: 18 }} /> },
];

const LS_VIEW = "tasks.view";
const LS_MEMBER = "tasks.member";

function lsGet(k: string): string | null {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
}
function lsSet(k: string, v: string) {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* ignore */
  }
}

export function TasksApp({ initial, userEmail }: { initial: TaskData; userEmail: string }) {
  const [data, setData] = useState<TaskData>(initial);
  const [view, setView] = useState<View>("board");
  const [q, setQ] = useState("");
  const [memberFilter, setMemberFilter] = useState<string>("all");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [hideDone, setHideDone] = useState(false);
  const [dialog, setDialog] = useState<{ task: Task | null; defaults?: Partial<TaskInput> } | null>(null);
  const [teamOpen, setTeamOpen] = useState(false);

  // Restore view + person filter; default person = the member whose email is the login.
  useEffect(() => {
    const v = lsGet(LS_VIEW);
    if (v === "board" || v === "timeline" || v === "people") setView(v);
    const m = lsGet(LS_MEMBER);
    if (m && (m === "all" || initial.members.some((x) => x.id === m))) setMemberFilter(m);
    else {
      const me = initial.members.find((x) => x.email && x.email === userEmail.toLowerCase());
      if (me) setMemberFilter(me.id);
    }
  }, [initial.members, userEmail]);

  const refresh = useCallback(async () => {
    try {
      setData(await loadTaskData());
    } catch (e) {
      toastError((e as Error).message);
    }
  }, []);

  // Live: other people's edits (Supabase realtime), debounced; plus a refresh when the tab regains focus.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const unsub = subscribeTasks(() => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void refresh(), 400);
    });
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      unsub();
      window.removeEventListener("focus", onFocus);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [refresh]);

  const memberById = useMemo(() => new Map(data.members.map((m) => [m.id, m])), [data.members]);
  const projectById = useMemo(() => new Map(data.projects.map((p) => [p.id, p])), [data.projects]);
  const childrenOf = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of data.tasks) {
      if (!t.parent_id) continue;
      const list = map.get(t.parent_id) ?? [];
      list.push(t);
      map.set(t.parent_id, list);
    }
    for (const list of map.values()) list.sort((a, b) => a.sort - b.sort || a.created_at.localeCompare(b.created_at));
    return map;
  }, [data.tasks]);

  const visible = useCallback(
    (t: Task): boolean => {
      const self = (x: Task) => {
        if (hideDone && x.status === "done") return false;
        if (projectFilter !== "all" && x.project_id !== projectFilter) return false;
        if (memberFilter !== "all" && x.assignee_id !== memberFilter && !x.helper_ids.includes(memberFilter)) return false;
        if (q.trim()) {
          const s = q.trim().toLowerCase();
          if (!x.title.toLowerCase().includes(s) && !x.description.toLowerCase().includes(s)) return false;
        }
        return true;
      };
      if (self(t)) return true;
      if (t.parent_id) return false;
      if (hideDone && t.status === "done") return false;
      return (childrenOf.get(t.id) ?? []).some(self);
    },
    [hideDone, projectFilter, memberFilter, q, childrenOf],
  );

  const patch = useCallback(
    (t: Task, p: Partial<TaskInput>) => {
      setData((d) => ({ ...d, tasks: d.tasks.map((x) => (x.id === t.id ? { ...x, ...p } : x)) }));
      updateTask(t.id, p).catch((e) => {
        toastError((e as Error).message);
        void refresh();
      });
    },
    [refresh],
  );

  const ctx: TasksCtx = {
    members: data.members,
    memberById,
    projects: data.projects,
    projectById,
    all: data.tasks,
    childrenOf,
    visible,
    open: (t) => setDialog({ task: t }),
    create: (defaults) => setDialog({ task: null, defaults }),
    patch,
  };

  // Summary numbers (top-level and subtasks alike, respecting the person/project filter but not "hide done").
  const stats = useMemo(() => {
    const today = todayISO();
    const weekStart = startOfWeek(today);
    const byId = new Map(data.tasks.map((t) => [t.id, t]));
    const leaves = data.tasks.filter((t) => !(childrenOf.get(t.id)?.length));
    const mine = leaves.filter(
      (t) =>
        (memberFilter === "all" || t.assignee_id === memberFilter || t.helper_ids.includes(memberFilter)) &&
        (projectFilter === "all" || t.project_id === projectFilter),
    );
    const open = mine.filter((t) => t.status !== "done");
    return {
      open: open.length,
      // A checklist item counts as "being worked on" when it, or the task it belongs to, is in progress / review.
      doing: open.filter((t) => {
        const active = (x: Task | undefined) => !!x && (x.status === "in_progress" || x.status === "review");
        return active(t) || (t.parent_id ? active(byId.get(t.parent_id)) : false);
      }).length,
      overdue: open.filter((t) => t.due_date && diffDays(today, t.due_date) < 0).length,
      dueWeek: open.filter((t) => t.due_date && t.due_date >= today && t.due_date <= addDays(weekStart, 6)).length,
      doneWeek: mine.filter((t) => t.status === "done" && t.completed_at && t.completed_at.slice(0, 10) >= weekStart).length,
    };
  }, [data.tasks, childrenOf, memberFilter, projectFilter]);

  const changeView = (v: View) => {
    setView(v);
    lsSet(LS_VIEW, v);
  };
  const changeMember = (m: string) => {
    setMemberFilter(m);
    lsSet(LS_MEMBER, m);
  };

  const quickAdd = async (title: string, status: TaskStatus) => {
    try {
      const t = await createTask({
        title,
        status,
        project_id: projectFilter !== "all" ? projectFilter : null,
        assignee_id: memberFilter !== "all" ? memberFilter : null,
        sort: Date.now() / 1000,
      });
      setData((d) => ({ ...d, tasks: [...d.tasks, t] }));
    } catch (e) {
      toastError((e as Error).message);
    }
  };

  const activeProjects = data.projects.filter((p) => p.status !== "parked");

  return (
    <Box sx={{ minHeight: "100%", bgcolor: "#F0F4F9", px: { xs: 1, md: 2 }, pt: 1, pb: { xs: 1, md: 2 } }}>
      <Box sx={{ bgcolor: "#fff", borderRadius: "16px", overflow: "hidden", minHeight: "calc(100dvh - 64px - 24px)", display: "flex", flexDirection: "column" }}>
        {/* Header */}
        <Box sx={{ display: "flex", alignItems: { xs: "flex-start", sm: "center" }, gap: 2, px: { xs: 2, sm: 3 }, pt: 2.5, pb: 1.5, flexWrap: "wrap" }}>
          <Box sx={{ flex: "1 1 260px", minWidth: 0 }}>
            <Typography component="h1" sx={{ fontSize: "1.5rem", color: "#1F1F1F" }}>
              Task Management
            </Typography>
            <Typography sx={{ fontSize: "0.875rem", color: "#5F6368", mt: 0.25 }}>
              Rencana kerja tim: siapa mengerjakan apa, dan kapan deadline-nya.
            </Typography>
          </Box>
          <Box sx={{ display: "flex", gap: 1, flexShrink: 0 }}>
            <Button variant="outlined" startIcon={<GroupsOutlined />} onClick={() => setTeamOpen(true)} sx={{ borderRadius: "9999px", borderColor: "#C4C7C5", color: "#444746" }}>
              Tim & proyek
            </Button>
            <Button variant="contained" disableElevation startIcon={<AddRounded />} onClick={() => ctx.create({})} sx={{ borderRadius: "9999px" }}>
              Tugas baru
            </Button>
          </Box>
        </Box>

        {/* Stats */}
        <Box sx={{ display: "flex", gap: 1, px: { xs: 2, sm: 3 }, pb: 1.5, overflowX: "auto", scrollbarWidth: "none" }}>
          <Stat label="Belum selesai" value={stats.open} />
          <Stat label="Sedang dikerjakan" value={stats.doing} color="#0B57D0" />
          <Stat label="Deadline minggu ini" value={stats.dueWeek} color="#8E4B00" />
          <Stat label="Terlambat" value={stats.overdue} color={stats.overdue ? "#B3261E" : undefined} />
          <Stat label="Selesai minggu ini" value={stats.doneWeek} color="#146C2E" />
        </Box>

        {/* Toolbar */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: { xs: 2, sm: 3 }, py: 1.25, borderTop: "1px solid #E0E3E7", borderBottom: "1px solid #E0E3E7", flexWrap: "wrap" }}>
          <Box role="tablist" sx={{ display: "inline-flex", p: 0.5, bgcolor: "#F0F4F9", borderRadius: "9999px", gap: 0.5 }}>
            {VIEWS.map((v) => {
              const on = v.value === view;
              return (
                <Box
                  key={v.value}
                  component="button"
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => changeView(v.value)}
                  sx={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 0.75,
                    height: 32,
                    px: 1.5,
                    border: "none",
                    borderRadius: "9999px",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    fontSize: "0.8125rem",
                    fontWeight: on ? 600 : 500,
                    bgcolor: on ? "#fff" : "transparent",
                    color: on ? "#0B57D0" : "#444746",
                    boxShadow: on ? "0 1px 2px rgba(0,0,0,.12)" : "none",
                  }}
                >
                  {v.icon}
                  {v.label}
                </Box>
              );
            })}
          </Box>

          <Box sx={{ flex: 1 }} />

          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, height: 36, px: 1.5, bgcolor: "#F0F4F9", borderRadius: "9999px", width: { xs: "100%", sm: 220 }, order: { xs: 5, sm: 0 } }}>
            <SearchRounded sx={{ fontSize: 18, color: "#5F6368" }} />
            <InputBase value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari tugas…" sx={{ flex: 1, fontSize: "0.875rem" }} inputProps={{ "aria-label": "Cari tugas" }} />
          </Box>
          <Select size="small" value={memberFilter} onChange={(e) => changeMember(e.target.value)} sx={selectSx} aria-label="Filter orang">
            <MenuItem value="all">Semua orang</MenuItem>
            {data.members.filter((m) => m.active).map((m) => (
              <MenuItem key={m.id} value={m.id}>
                {m.name}
              </MenuItem>
            ))}
          </Select>
          <Select size="small" value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)} sx={selectSx} aria-label="Filter proyek">
            <MenuItem value="all">Semua proyek</MenuItem>
            {activeProjects.map((p) => (
              <MenuItem key={p.id} value={p.id}>
                {p.name}
              </MenuItem>
            ))}
          </Select>
          <FormControlLabel
            control={<Switch size="small" checked={hideDone} onChange={(e) => setHideDone(e.target.checked)} />}
            label="Sembunyikan selesai"
            sx={{ m: 0, ml: 0.5, "& .MuiFormControlLabel-label": { fontSize: "0.8125rem", color: "#444746" } }}
          />
        </Box>

        {/* View */}
        <Box sx={{ flex: 1, minHeight: 0 }}>
          {view === "board" && <BoardView ctx={ctx} onQuickAdd={quickAdd} />}
          {view === "timeline" && <TimelineView ctx={ctx} />}
          {view === "people" && <PeopleView ctx={ctx} memberFilter={memberFilter} />}
        </Box>
      </Box>

      <TaskDialog
        open={dialog != null}
        task={dialog?.task ?? null}
        defaults={dialog?.defaults}
        ctx={ctx}
        onOpenTask={(t) => setDialog({ task: t })}
        onClose={() => setDialog(null)}
        onChanged={() => void refresh()}
      />
      <TeamDialog open={teamOpen} members={data.members} projects={data.projects} onClose={() => setTeamOpen(false)} onChanged={() => void refresh()} />
    </Box>
  );
}

const selectSx = {
  height: 36,
  borderRadius: "9999px",
  fontSize: "0.8125rem",
  minWidth: 140,
  bgcolor: "#fff",
  "& .MuiOutlinedInput-notchedOutline": { borderColor: "#C4C7C5" },
} as const;

function Stat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <Box sx={{ flex: "1 0 120px", minWidth: 120, border: "1px solid #E0E3E7", borderRadius: "12px", px: 1.75, py: 1.25 }}>
      <Typography sx={{ fontSize: "0.75rem", color: "#5F6368" }}>{label}</Typography>
      <Typography sx={{ fontSize: "1.375rem", fontWeight: 600, color: color ?? "#1F1F1F", lineHeight: 1.3, fontVariantNumeric: "tabular-nums" }}>{value}</Typography>
    </Box>
  );
}
