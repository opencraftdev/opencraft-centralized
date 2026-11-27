"use client";

import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Dialog from "@mui/material/Dialog";
import IconButton from "@mui/material/IconButton";
import InputBase from "@mui/material/InputBase";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import CloseRounded from "@mui/icons-material/CloseRounded";
import DeleteRounded from "@mui/icons-material/DeleteRounded";
import AddRounded from "@mui/icons-material/AddRounded";
import ArrowBackRounded from "@mui/icons-material/ArrowBackRounded";
import SendRounded from "@mui/icons-material/SendRounded";
import { toastError, toastSuccess } from "@/components/ui/Toast";
import { formatRelative } from "@/features/drive/format";
import { addComment, createTask, deleteComment, deleteTask, listComments, saveMember, updateTask } from "../api";
import type { Task, TaskComment, TaskInput } from "../types";
import { PRIORITIES, STATUSES } from "../types";
import type { TasksCtx } from "./TasksApp";
import { DueChip, MemberAvatar } from "./bits";

// Create / edit one task: details on the right, checklist (subtasks) and comments on the left.

type Form = Omit<TaskInput, "sort">;

const EMPTY: Form = {
  project_id: null,
  parent_id: null,
  title: "",
  description: "",
  status: "todo",
  priority: "medium",
  assignee_id: null,
  helper_ids: [],
  start_date: null,
  due_date: null,
  is_milestone: false,
  is_optional: false,
};

function toForm(t: Task): Form {
  const { project_id, parent_id, title, description, status, priority, assignee_id, helper_ids, start_date, due_date, is_milestone, is_optional } = t;
  return { project_id, parent_id, title, description, status, priority, assignee_id, helper_ids, start_date, due_date, is_milestone, is_optional };
}

export function TaskDialog({
  open,
  task,
  defaults,
  ctx,
  onOpenTask,
  onClose,
  onChanged,
}: {
  open: boolean;
  task: Task | null;
  defaults?: Partial<TaskInput>;
  ctx: TasksCtx;
  onOpenTask: (t: Task) => void;
  onClose: () => void;
  onChanged: () => void;
}) {
  const mobile = useMediaQuery("(max-width:700px)");
  const [form, setForm] = useState<Form>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [comment, setComment] = useState("");
  const [newSub, setNewSub] = useState("");
  const [newPerson, setNewPerson] = useState<string | null>(null); // typing a new member's name

  // The live copy (realtime / checkbox changes) of the task being edited.
  const live = task ? ctx.all.find((x) => x.id === task.id) ?? task : null;
  const taskId = task?.id ?? null;

  useEffect(() => {
    if (!open) return;
    setForm(task ? toForm(task) : { ...EMPTY, ...defaults });
    setConfirmDelete(false);
    setComment("");
    setNewSub("");
    setNewPerson(null);
    setComments([]);
    if (task) listComments(task.id).then(setComments).catch(() => setComments([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, taskId]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));
  const dirty = live ? JSON.stringify(toForm(live)) !== JSON.stringify(form) : form.title.trim() !== "";
  const parent = form.parent_id ? ctx.all.find((x) => x.id === form.parent_id) : undefined;
  const subs = taskId ? ctx.childrenOf.get(taskId) ?? [] : [];
  const dateError = form.start_date && form.due_date && form.start_date > form.due_date ? "Mulai harus sebelum deadline" : "";

  const addPerson = async () => {
    const name = (newPerson ?? "").trim();
    if (!name) return;
    try {
      const id = await saveMember({ name, initials: initialsOf(name), sort: ctx.members.length + 1 });
      set("assignee_id", id);
      setNewPerson(null);
      toastSuccess(`${name} ditambahkan ke tim.`);
      onChanged();
    } catch (e) {
      toastError((e as Error).message);
    }
  };

  const save = async () => {
    if (!form.title.trim()) return toastError("Judul tugas wajib diisi.");
    if (dateError) return toastError(dateError);
    setSaving(true);
    try {
      const payload = { ...form, title: form.title.trim(), due_date: form.is_milestone ? form.start_date ?? form.due_date : form.due_date };
      if (form.is_milestone && payload.due_date) payload.start_date = payload.due_date;
      if (live) await updateTask(live.id, payload);
      else await createTask({ ...payload, sort: Date.now() / 1000 });
      toastSuccess(live ? "Tugas disimpan." : "Tugas dibuat.");
      onChanged();
      onClose();
    } catch (e) {
      toastError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!live) return;
    try {
      await deleteTask(live.id);
      toastSuccess("Tugas dihapus.");
      onChanged();
      if (parent) onOpenTask(parent);
      else onClose();
    } catch (e) {
      toastError((e as Error).message);
    }
  };

  const addSub = async () => {
    const title = newSub.trim();
    if (!title || !live) return;
    setNewSub("");
    try {
      await createTask({
        title,
        parent_id: live.id,
        project_id: live.project_id,
        assignee_id: live.assignee_id,
        start_date: live.start_date,
        due_date: live.due_date,
        sort: subs.length ? Math.max(...subs.map((s) => s.sort)) + 1 : 1,
      });
      onChanged();
    } catch (e) {
      toastError((e as Error).message);
    }
  };

  const sendComment = async () => {
    const body = comment.trim();
    if (!body || !live) return;
    setComment("");
    try {
      await addComment(live.id, body);
      setComments(await listComments(live.id));
    } catch (e) {
      toastError((e as Error).message);
    }
  };

  const label = (text: string) => <Typography sx={{ fontSize: "0.75rem", fontWeight: 600, color: "#5F6368", mb: 0.5 }}>{text}</Typography>;
  const fieldSx = { "& .MuiOutlinedInput-root": { borderRadius: "10px", fontSize: "0.875rem" } } as const;

  return (
    <Dialog open={open} onClose={onClose} fullScreen={mobile} maxWidth="md" fullWidth slotProps={{ paper: { sx: { borderRadius: mobile ? 0 : "20px" } } }}>
      {/* Top bar */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 2, pt: 1.5 }}>
        {parent ? (
          <Button size="small" startIcon={<ArrowBackRounded sx={{ fontSize: 16 }} />} onClick={() => onOpenTask(parent)} sx={{ color: "#444746", borderRadius: "9999px", textTransform: "none", maxWidth: "70%", justifyContent: "flex-start" }}>
            <Box component="span" sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Bagian dari: {parent.title}</Box>
          </Button>
        ) : (
          <Typography sx={{ fontSize: "0.8125rem", color: "#5F6368", pl: 1 }}>{live ? "Detail tugas" : "Tugas baru"}</Typography>
        )}
        <Box sx={{ flex: 1 }} />
        {live && <DueChip due={live.due_date} done={live.status === "done"} />}
        <IconButton onClick={onClose} aria-label="Tutup">
          <CloseRounded />
        </IconButton>
      </Box>

      <Box sx={{ display: "flex", flexDirection: { xs: "column", sm: "row" }, gap: 3, px: 3, pt: 1, pb: 2, overflowY: "auto" }}>
        {/* Main */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <InputBase
            autoFocus={!live}
            fullWidth
            multiline
            value={form.title}
            onChange={(e) => set("title", e.target.value.replace(/\n/g, " "))}
            placeholder="Judul tugas"
            sx={{ fontSize: "1.375rem", fontWeight: 500, color: "#1F1F1F", mb: 1.5 }}
            inputProps={{ "aria-label": "Judul tugas" }}
          />
          {label("Catatan")}
          <TextField
            fullWidth
            multiline
            minRows={3}
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="Detail, link, atau hasil yang diharapkan…"
            sx={fieldSx}
          />

          {/* Checklist */}
          {live && !live.parent_id && (
            <Box sx={{ mt: 2.5 }}>
              {label(`Checklist${subs.length ? ` · ${subs.filter((s) => s.status === "done").length}/${subs.length}` : ""}`)}
              <Box sx={{ border: "1px solid #E0E3E7", borderRadius: "12px", overflow: "hidden" }}>
                {subs.map((s) => {
                  const d = s.status === "done";
                  return (
                    <Box key={s.id} sx={{ display: "flex", alignItems: "center", gap: 0.5, pr: 1, borderBottom: "1px solid #EEF1F4", "&:hover": { bgcolor: "#F8FAFD" }, "&:hover .sub-del": { opacity: 1 } }}>
                      <Checkbox size="small" checked={d} onChange={(e) => ctx.patch(s, { status: e.target.checked ? "done" : "todo" })} slotProps={{ input: { "aria-label": `Selesai: ${s.title}` } }} />
                      <Box component="button" type="button" onClick={() => onOpenTask(s)} sx={{ flex: 1, minWidth: 0, textAlign: "left", border: "none", bgcolor: "transparent", fontFamily: "inherit", cursor: "pointer", py: 1, fontSize: "0.875rem", color: d ? "#5F6368" : "#1F1F1F", textDecoration: d ? "line-through" : "none" }}>
                        {s.title}
                      </Box>
                      {!d && <DueChip due={s.due_date} done={d} compact />}
                      <MemberAvatar member={s.assignee_id ? ctx.memberById.get(s.assignee_id) : undefined} size={22} />
                      <IconButton
                        className="sub-del"
                        size="small"
                        aria-label={`Hapus ${s.title}`}
                        onClick={() => deleteTask(s.id).then(onChanged).catch((e) => toastError((e as Error).message))}
                        sx={{ opacity: { xs: 1, sm: 0 }, color: "#5F6368" }}
                      >
                        <DeleteRounded sx={{ fontSize: 18 }} />
                      </IconButton>
                    </Box>
                  );
                })}
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 1.5, py: 0.75 }}>
                  <AddRounded sx={{ fontSize: 18, color: "#5F6368" }} />
                  <InputBase
                    fullWidth
                    value={newSub}
                    onChange={(e) => setNewSub(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                        e.preventDefault();
                        void addSub();
                      }
                    }}
                    placeholder="Tambah item checklist, Enter untuk simpan"
                    sx={{ fontSize: "0.875rem" }}
                  />
                </Box>
              </Box>
            </Box>
          )}

          {/* Comments */}
          {live && (
            <Box sx={{ mt: 2.5 }}>
              {label(`Komentar${comments.length ? ` · ${comments.length}` : ""}`)}
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                {comments.map((c) => (
                  <Box key={c.id} sx={{ bgcolor: "#F0F4F9", borderRadius: "12px", px: 1.5, py: 1, "&:hover .c-del": { opacity: 1 } }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Typography sx={{ fontSize: "0.75rem", fontWeight: 600, color: "#1F1F1F" }}>{authorName(c.author_email, ctx)}</Typography>
                      <Typography sx={{ fontSize: "0.6875rem", color: "#5F6368" }}>{formatRelative(c.created_at)}</Typography>
                      <Box sx={{ flex: 1 }} />
                      <IconButton
                        className="c-del"
                        size="small"
                        aria-label="Hapus komentar"
                        onClick={() => deleteComment(c.id).then(() => setComments((l) => l.filter((x) => x.id !== c.id))).catch((e) => toastError((e as Error).message))}
                        sx={{ opacity: { xs: 1, sm: 0 }, p: 0.25 }}
                      >
                        <DeleteRounded sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Box>
                    <Typography sx={{ fontSize: "0.875rem", color: "#1F1F1F", whiteSpace: "pre-wrap", mt: 0.25 }}>{c.body}</Typography>
                  </Box>
                ))}
                <Box sx={{ display: "flex", alignItems: "flex-end", gap: 1, border: "1px solid #C4C7C5", borderRadius: "12px", pl: 1.5, pr: 0.5, py: 0.5 }}>
                  <InputBase
                    fullWidth
                    multiline
                    maxRows={6}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                        e.preventDefault();
                        void sendComment();
                      }
                    }}
                    placeholder="Tulis update atau pertanyaan…"
                    sx={{ fontSize: "0.875rem", py: 0.75 }}
                  />
                  <IconButton aria-label="Kirim komentar" onClick={() => void sendComment()} disabled={!comment.trim()} sx={{ color: "#0B57D0" }}>
                    <SendRounded sx={{ fontSize: 20 }} />
                  </IconButton>
                </Box>
              </Box>
            </Box>
          )}
        </Box>

        {/* Details */}
        <Box sx={{ width: { xs: "100%", sm: 260 }, flexShrink: 0, display: "flex", flexDirection: "column", gap: 1.5 }}>
          <Box>
            {label("Status")}
            <Select fullWidth size="small" value={form.status} onChange={(e) => set("status", e.target.value as Form["status"])} sx={{ borderRadius: "10px", fontSize: "0.875rem" }}>
              {STATUSES.map((s) => (
                <MenuItem key={s.value} value={s.value}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: s.color }} />
                    {s.label}
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </Box>
          <Box>
            {label("PIC (penanggung jawab)")}
            {newPerson !== null ? (
              <Box sx={{ display: "flex", gap: 0.5 }}>
                <TextField
                  autoFocus
                  fullWidth
                  size="small"
                  placeholder="Nama orang baru"
                  value={newPerson}
                  onChange={(e) => setNewPerson(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                      e.preventDefault();
                      void addPerson();
                    }
                    if (e.key === "Escape") {
                      e.stopPropagation();
                      setNewPerson(null);
                    }
                  }}
                  sx={fieldSx}
                />
                <Button variant="contained" disableElevation disabled={!newPerson.trim()} onClick={() => void addPerson()} sx={{ borderRadius: "10px", minWidth: 0, px: 1.5 }}>
                  Tambah
                </Button>
                <IconButton size="small" aria-label="Batal" onClick={() => setNewPerson(null)}>
                  <CloseRounded sx={{ fontSize: 18 }} />
                </IconButton>
              </Box>
            ) : (
            <Select fullWidth size="small" displayEmpty value={form.assignee_id ?? ""} onChange={(e) => (e.target.value === "__new" ? setNewPerson("") : set("assignee_id", e.target.value || null))} sx={{ borderRadius: "10px", fontSize: "0.875rem" }}>
              <MenuItem value="">
                <em>Belum ada</em>
              </MenuItem>
              {ctx.members.filter((m) => m.active || m.id === form.assignee_id).map((m) => (
                <MenuItem key={m.id} value={m.id}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <MemberAvatar member={m} size={20} />
                    {m.name}
                  </Box>
                </MenuItem>
              ))}
              <MenuItem value="__new" sx={{ color: "#0B57D0", borderTop: "1px solid #EEF1F4" }}>
                <AddRounded sx={{ fontSize: 18, mr: 1 }} /> Tambah orang baru…
              </MenuItem>
            </Select>
            )}
          </Box>
          <Box>
            {label("Dibantu oleh")}
            <Select
              fullWidth
              size="small"
              multiple
              displayEmpty
              value={form.helper_ids}
              onChange={(e) => set("helper_ids", (typeof e.target.value === "string" ? e.target.value.split(",") : e.target.value).filter((id) => id !== form.assignee_id))}
              renderValue={(ids) =>
                ids.length === 0 ? (
                  <Typography sx={{ fontSize: "0.875rem", color: "#9AA0A6" }}>Tidak ada</Typography>
                ) : (
                  <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                    {ids.map((id) => (
                      <Box key={id} sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, fontSize: "0.8125rem" }}>
                        <MemberAvatar member={ctx.memberById.get(id)} size={18} />
                        {ctx.memberById.get(id)?.name}
                      </Box>
                    ))}
                  </Box>
                )
              }
              sx={{ borderRadius: "10px", fontSize: "0.875rem" }}
            >
              {ctx.members.filter((m) => m.active && m.id !== form.assignee_id).map((m) => (
                <MenuItem key={m.id} value={m.id}>
                  <Checkbox size="small" checked={form.helper_ids.includes(m.id)} sx={{ p: 0.5, mr: 1 }} />
                  {m.name}
                </MenuItem>
              ))}
            </Select>
          </Box>
          <Box>
            {label("Proyek")}
            <Select fullWidth size="small" displayEmpty value={form.project_id ?? ""} onChange={(e) => set("project_id", e.target.value || null)} sx={{ borderRadius: "10px", fontSize: "0.875rem" }}>
              <MenuItem value="">
                <em>Tanpa proyek</em>
              </MenuItem>
              {ctx.projects.filter((p) => p.status !== "parked" || p.id === form.project_id).map((p) => (
                <MenuItem key={p.id} value={p.id}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Box sx={{ width: 10, height: 10, borderRadius: "3px", bgcolor: p.color }} />
                    {p.name}
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </Box>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
            {!form.is_milestone && (
              <Box sx={{ flex: 1 }}>
                {label("Mulai")}
                <TextField fullWidth size="small" type="date" value={form.start_date ?? ""} onChange={(e) => set("start_date", e.target.value || null)} sx={fieldSx} slotProps={{ htmlInput: { max: form.due_date ?? undefined } }} />
              </Box>
            )}
            <Box sx={{ flex: 1 }}>
              {label(form.is_milestone ? "Tanggal" : "Deadline")}
              <TextField fullWidth size="small" type="date" value={form.due_date ?? ""} onChange={(e) => set("due_date", e.target.value || null)} sx={fieldSx} error={!!dateError} slotProps={{ htmlInput: { min: form.is_milestone ? undefined : form.start_date ?? undefined } }} />
            </Box>
          </Box>
          {dateError && <Typography sx={{ fontSize: "0.75rem", color: "#B3261E", mt: -1 }}>{dateError}</Typography>}
          <Box>
            {label("Prioritas")}
            <Select fullWidth size="small" value={form.priority} onChange={(e) => set("priority", e.target.value as Form["priority"])} sx={{ borderRadius: "10px", fontSize: "0.875rem" }}>
              {PRIORITIES.map((p) => (
                <MenuItem key={p.value} value={p.value}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: p.color }} />
                    {p.label}
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </Box>
          <Box sx={{ border: "1px solid #E0E3E7", borderRadius: "12px", px: 1.5, py: 0.5 }}>
            <Toggle label="Milestone (satu hari)" hint="Mis. rapat/diskusi penting" checked={form.is_milestone} onChange={(v) => set("is_milestone", v)} />
            <Toggle label="Kalau perlu" hint="Opsional, belum pasti dikerjakan" checked={form.is_optional} onChange={(v) => set("is_optional", v)} />
          </Box>
        </Box>
      </Box>

      {/* Footer */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 3, py: 1.5, borderTop: "1px solid #E0E3E7", position: "sticky", bottom: 0, bgcolor: "#fff" }}>
        {live &&
          (confirmDelete ? (
            <>
              <Typography sx={{ fontSize: "0.8125rem", color: "#B3261E" }}>{subs.length ? `Hapus beserta ${subs.length} item checklist?` : "Hapus tugas ini?"}</Typography>
              <Button size="small" color="error" variant="contained" disableElevation onClick={() => void remove()} sx={{ borderRadius: "9999px" }}>
                Ya, hapus
              </Button>
              <Button size="small" onClick={() => setConfirmDelete(false)} sx={{ borderRadius: "9999px" }}>
                Batal
              </Button>
            </>
          ) : (
            <Button size="small" color="error" startIcon={<DeleteRounded />} onClick={() => setConfirmDelete(true)} sx={{ borderRadius: "9999px" }}>
              Hapus
            </Button>
          ))}
        <Box sx={{ flex: 1 }} />
        <Button onClick={onClose} sx={{ borderRadius: "9999px", color: "#444746" }}>
          {live && !dirty ? "Tutup" : "Batal"}
        </Button>
        <Button variant="contained" disableElevation disabled={saving || !dirty || !form.title.trim()} onClick={() => void save()} sx={{ borderRadius: "9999px" }}>
          {live ? "Simpan" : "Buat tugas"}
        </Button>
      </Box>
    </Dialog>
  );
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <Box component="label" sx={{ display: "flex", alignItems: "center", gap: 1, cursor: "pointer", py: 0.5 }}>
      <Box sx={{ flex: 1 }}>
        <Typography sx={{ fontSize: "0.8125rem", color: "#1F1F1F" }}>{label}</Typography>
        <Typography sx={{ fontSize: "0.6875rem", color: "#5F6368" }}>{hint}</Typography>
      </Box>
      <Switch size="small" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </Box>
  );
}

function authorName(email: string | null, ctx: TasksCtx): string {
  if (!email) return "Seseorang";
  const m = ctx.members.find((x) => x.email === email);
  return m ? m.name : email.split("@")[0];
}

/** "Dimas Pratama" → "DP", "Raka" → "R". */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  return (parts.length > 1 ? parts[0][0] + parts[1][0] : parts[0][0]).toUpperCase();
}
