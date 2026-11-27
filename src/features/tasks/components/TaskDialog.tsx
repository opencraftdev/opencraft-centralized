"use client";

import { useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Dialog from "@mui/material/Dialog";
import IconButton from "@mui/material/IconButton";
import InputBase from "@mui/material/InputBase";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import CloseRounded from "@mui/icons-material/CloseRounded";
import DeleteRounded from "@mui/icons-material/DeleteRounded";
import AddRounded from "@mui/icons-material/AddRounded";
import TuneRounded from "@mui/icons-material/TuneRounded";
import ArrowBackRounded from "@mui/icons-material/ArrowBackRounded";
import SendRounded from "@mui/icons-material/SendRounded";
import CircleRounded from "@mui/icons-material/CircleRounded";
import PersonRounded from "@mui/icons-material/PersonRounded";
import GroupRounded from "@mui/icons-material/GroupRounded";
import FolderRounded from "@mui/icons-material/FolderRounded";
import EventRounded from "@mui/icons-material/EventRounded";
import FlagRounded from "@mui/icons-material/FlagRounded";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import EditRounded from "@mui/icons-material/EditRounded";
import CheckRounded from "@mui/icons-material/CheckRounded";
import ImageRounded from "@mui/icons-material/ImageRounded";
import VideocamRounded from "@mui/icons-material/VideocamRounded";
import DescriptionRounded from "@mui/icons-material/DescriptionRounded";
import AttachFileRounded from "@mui/icons-material/AttachFileRounded";
import ExpandMoreRounded from "@mui/icons-material/ExpandMoreRounded";
import ReplyRounded from "@mui/icons-material/ReplyRounded";
import { useAccount } from "@/features/accounts/account";
import { toastError, toastSuccess } from "@/components/ui/Toast";
import { formatRelative } from "@/features/drive/format";
import { addComment, createTask, deleteComment, deleteTask, listComments, saveMember, saveProject, updateTask } from "../api";
import type { Task, TaskComment, TaskInput } from "../types";
import { PRIORITIES, STATUSES } from "../types";
import type { TasksCtx } from "./TasksApp";
import { CommentCount, DueChip, MemberAvatar } from "./bits";
import { PROJECT_COLORS } from "./TeamDialog";
import { AttachmentGrid, AttachPicker, DropZone, PendingFiles } from "./Attachments";
import { commentIdOf, listAttachments, removeAttachment, uploadAttachments } from "../attachments";
import { SwapIn } from "@/components/ui/AutoHeight";
import { DatePill } from "./DatePicker";
import { CommentBody, MentionInput, type MentionInputHandle } from "./Mentions";
import { ProjectMark } from "./bits";
import { PreviewDialog } from "@/features/drive/components/PreviewDialog";
import type { DriveFile } from "@/lib/drive/types";

// Create / edit one task (main task or checklist item): title, properties as pills, the brief with its files and the
// checklist on the left; the comments as chat bubbles on the right (ClickUp-like).

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
  const [replyTo, setReplyTo] = useState<TaskComment | null>(null); // WhatsApp-style reply to one comment
  const [newSub, setNewSub] = useState("");
  const [newPerson, setNewPerson] = useState<string | null>(null); // typing a new member's name
  const [newProject, setNewProject] = useState<string | null>(null); // typing a new project's name
  const [files, setFiles] = useState<DriveFile[]>([]); // attachments of this task and its comments
  const [pending, setPending] = useState<File[]>([]); // picked for the next comment, not uploaded yet
  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(null);
  const [preview, setPreview] = useState<DriveFile | null>(null);
  const [previewSet, setPreviewSet] = useState<DriveFile[]>([]); // the files ‹ › move through (brief, or one comment)
  const openPreview = (f: DriveFile, set: DriveFile[]) => {
    setPreviewSet(set);
    setPreview(f);
  };
  const [editingNote, setEditingNote] = useState(false);
  const mention = useRef<MentionInputHandle>(null);
  const brief = useRef<MentionInputHandle>(null);
  const { email: myEmail } = useAccount();

  // The live copy (realtime / checkbox changes) of the task being edited.
  const live = task ? ctx.all.find((x) => x.id === task.id) ?? task : null;
  const taskId = task?.id ?? null;
  // Slide direction: into a checklist item = forward, back to its parent = back.
  const prevTask = useRef<Task | null>(null);
  const swapDir: 1 | -1 | 0 = !task || !prevTask.current ? 0 : task.parent_id === prevTask.current.id ? 1 : prevTask.current.parent_id === task.id ? -1 : 0;
  useEffect(() => {
    prevTask.current = open ? task : null;
  }, [open, task]);

  useEffect(() => {
    if (!open) return;
    setForm(task ? toForm(task) : { ...EMPTY, ...defaults });
    setConfirmDelete(false);
    setComment("");
    setReplyTo(null);
    setNewSub("");
    setNewPerson(null);
    setNewProject(null);
    setComments([]);
    setFiles([]);
    setPending([]);
    setUploading(null);
    setEditingNote(!task);
    if (task) {
      listComments(task.id).then(setComments).catch(() => setComments([]));
      listAttachments(task.id).then(setFiles).catch(() => setFiles([]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, taskId]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));
  const startBrief = () => {
    setEditingNote(true);
    requestAnimationFrame(() => {
      brief.current?.load(form.description);
      brief.current?.focus();
    });
  };
  const finishBrief = () => {
    if (brief.current) set("description", brief.current.serialize());
    setEditingNote(false);
  };
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

  const addProject = async () => {
    const name = (newProject ?? "").trim();
    if (!name) return;
    try {
      const id = await saveProject({ name, color: PROJECT_COLORS[ctx.projects.length % PROJECT_COLORS.length], sort: ctx.projects.length + 1 });
      set("project_id", id);
      setNewProject(null);
      toastSuccess(`Project ${name} dibuat.`);
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
      const description = editingNote && brief.current ? brief.current.serialize() : form.description;
      const payload = { ...form, description, title: form.title.trim(), due_date: form.is_milestone ? form.start_date ?? form.due_date : form.due_date };
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

  const reloadFiles = async () => {
    if (live) setFiles(await listAttachments(live.id).catch(() => files));
  };

  const upload = async (picked: File[], commentId?: string) => {
    if (!live || picked.length === 0) return;
    try {
      await uploadAttachments(picked, { taskId: live.id, commentId }, (done, total) => setUploading({ done, total }));
    } catch (e) {
      toastError(`Upload gagal: ${(e as Error).message}`);
    } finally {
      setUploading(null);
      await reloadFiles();
    }
  };

  const sendComment = async () => {
    const text = (mention.current?.serialize() ?? comment).trim();
    const picked = pending;
    if ((!text && picked.length === 0) || !live || uploading) return;
    const reply = replyTo;
    setComment("");
    setPending([]);
    setReplyTo(null);
    mention.current?.reset();
    try {
      const id = await addComment(live.id, withReply(text || "Lampiran", reply?.id ?? null));
      setComments(await listComments(live.id));
      onChanged();
      if (picked.length) await upload(picked, id);
    } catch (e) {
      toastError((e as Error).message);
    }
  };

  const removeFile = async (f: DriveFile) => {
    setFiles((l) => l.filter((x) => x.id !== f.id));
    try {
      await removeAttachment(f.id);
    } catch (e) {
      toastError((e as Error).message);
      await reloadFiles();
    }
  };

  const label = (text: string) => <Typography sx={{ fontSize: "0.75rem", fontWeight: 600, color: "#5F6368", mb: 0.75 }}>{text}</Typography>;
  const fieldSx = { "& .MuiOutlinedInput-root": { borderRadius: "10px", fontSize: "0.875rem" } } as const;
  const taskFiles = files.filter((f) => !commentIdOf(f));
  const st = STATUSES.find((x) => x.value === form.status) ?? STATUSES[0];
  const pr = PRIORITIES.find((x) => x.value === form.priority) ?? PRIORITIES[1];

  // newest comment in view
  const feed = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = feed.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [comments.length, files.length, taskId]);

  const inlineNew = (value: string, setValue: (v: string | null) => void, onAdd: () => void, placeholder: string) => (
    <Box sx={{ display: "flex", gap: 0.5, alignItems: "center", width: "100%" }}>
      <TextField
        autoFocus
        fullWidth
        size="small"
        placeholder={placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.nativeEvent.isComposing) {
            e.preventDefault();
            onAdd();
          }
          if (e.key === "Escape") {
            e.stopPropagation();
            setValue(null);
          }
        }}
        sx={{ ...fieldSx, "& .MuiOutlinedInput-root": { borderRadius: "9999px", fontSize: "0.8125rem", height: 32 } }}
      />
      <Button variant="contained" disableElevation disabled={!value.trim()} onClick={onAdd} sx={{ borderRadius: "9999px", minWidth: 0, px: 1.5, height: 32 }}>
        Tambah
      </Button>
      <IconButton size="small" aria-label="Batal" onClick={() => setValue(null)}>
        <CloseRounded sx={{ fontSize: 18 }} />
      </IconButton>
    </Box>
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen={mobile}
      maxWidth="lg"
      fullWidth
      slotProps={{ paper: { sx: { borderRadius: mobile ? 0 : "20px", height: mobile ? "100%" : "min(780px, 92vh)", display: "flex", flexDirection: "column" } } }}
    >
      {/* Top bar */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 2, pt: 1.5, pb: 0.5, flexShrink: 0 }}>
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

      <Box sx={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: { xs: "1fr", md: "minmax(0, 1.35fr) minmax(320px, 1fr)" }, overflowY: { xs: "auto", md: "hidden" } }}>
        {/* ── Left: title, properties, brief (+ files), checklist ── */}
        <Box sx={{ overflowY: { md: "auto" }, minHeight: 0 }}>
          <SwapIn id={taskId ?? "new"} dir={swapDir}>
            <Box sx={{ px: 3, pt: 0.5, pb: 3 }}>
              <InputBase
                autoFocus={!live}
                fullWidth
                multiline
                value={form.title}
                onChange={(e) => set("title", e.target.value.replace(/\n/g, " "))}
                placeholder="Judul tugas"
                sx={{ fontSize: "1.375rem", fontWeight: 500, color: "#1F1F1F", mb: 1 }}
                inputProps={{ "aria-label": "Judul tugas" }}
              />

              {/* Properties: label on the left, the value as a clickable pill */}
              <Box sx={{ display: "flex", flexDirection: "column", mb: 2.5 }}>
                <PropRow icon={<CircleRounded />} label="Status">
                  <Select
                    value={form.status}
                    onChange={(e) => set("status", e.target.value as Form["status"])}
                    variant="standard" input={<InputBase />}
                    renderValue={() => (
                      <>
                        <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: st.dot }} />
                        {st.label}
                      </>
                    )}
                    sx={pillSx(st.bg, st.color)}
                    inputProps={{ "aria-label": "Status" }}
                  >
                    {STATUSES.map((s) => (
                      <MenuItem key={s.value} value={s.value}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                          <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: s.dot }} />
                          {s.label}
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </PropRow>

                <PropRow icon={<PersonRounded />} label="PIC">
                  {newPerson !== null ? (
                    inlineNew(newPerson, setNewPerson, () => void addPerson(), "Nama orang baru")
                  ) : (
                    <Select
                      displayEmpty
                      value={form.assignee_id ?? ""}
                      onChange={(e) => (e.target.value === "__new" ? setNewPerson("") : set("assignee_id", e.target.value || null))}
                      variant="standard" input={<InputBase />}
                      renderValue={(id) =>
                        id ? (
                          <>
                            <MemberAvatar member={ctx.memberById.get(id)} size={20} />
                            {ctx.memberById.get(id)?.name}
                          </>
                        ) : (
                          <Box component="span" sx={{ color: "#80868B" }}>Pilih orang</Box>
                        )
                      }
                      sx={pillSx("#fff", "#1F1F1F", true, Boolean(form.assignee_id))}
                      inputProps={{ "aria-label": "PIC" }}
                    >
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
                </PropRow>

                <PropRow icon={<GroupRounded />} label="Dibantu oleh">
                  <Select
                    multiple
                    displayEmpty
                    value={form.helper_ids}
                    onChange={(e) => set("helper_ids", (typeof e.target.value === "string" ? e.target.value.split(",") : e.target.value).filter((id) => id !== form.assignee_id))}
                    variant="standard" input={<InputBase />}
                    renderValue={(ids) =>
                      ids.length === 0 ? (
                        <Box component="span" sx={{ color: "#80868B" }}>+ Tambah</Box>
                      ) : (
                        ids.map((id) => (
                          <Box key={id} component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}>
                            <MemberAvatar member={ctx.memberById.get(id)} size={20} />
                            {ctx.memberById.get(id)?.name}
                          </Box>
                        ))
                      )
                    }
                    sx={pillSx("#fff", "#1F1F1F", true, form.helper_ids.length > 0)}
                    inputProps={{ "aria-label": "Dibantu oleh" }}
                  >
                    {ctx.members.filter((m) => m.active && m.id !== form.assignee_id).map((m) => (
                      <MenuItem key={m.id} value={m.id}>
                        <Checkbox size="small" checked={form.helper_ids.includes(m.id)} sx={{ p: 0.5, mr: 1 }} />
                        <MemberAvatar member={m} size={20} />
                        <Box component="span" sx={{ ml: 1 }}>{m.name}</Box>
                      </MenuItem>
                    ))}
                  </Select>
                </PropRow>

                <PropRow icon={<FolderRounded />} label="Project">
                  {newProject !== null ? (
                    inlineNew(newProject, setNewProject, () => void addProject(), "Nama project baru")
                  ) : (
                    <Select
                      displayEmpty
                      value={form.project_id ?? ""}
                      onChange={(e) => (e.target.value === "__new" ? setNewProject("") : e.target.value === "__manage" ? ctx.openTeam("projects") : set("project_id", e.target.value || null))}
                      variant="standard" input={<InputBase />}
                      renderValue={(id) =>
                        id ? (
                          <>
                            <ProjectMark project={ctx.projectById.get(id)} size={14} />
                            {ctx.projectById.get(id)?.name}
                          </>
                        ) : (
                          <Box component="span" sx={{ color: "#80868B" }}>Tanpa project</Box>
                        )
                      }
                      sx={pillSx("#fff", "#1F1F1F", true, Boolean(form.project_id))}
                      inputProps={{ "aria-label": "Project" }}
                    >
                      <MenuItem value="">
                        <em>Tanpa project</em>
                      </MenuItem>
                      {ctx.projects.filter((p) => p.status !== "parked" || p.id === form.project_id).map((p) => (
                        <MenuItem key={p.id} value={p.id}>
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                            <Box sx={{ width: 18, display: "grid", placeItems: "center" }}>
                              <ProjectMark project={p} size={16} />
                            </Box>
                            {p.name}
                          </Box>
                        </MenuItem>
                      ))}
                      <MenuItem value="__new" sx={{ color: "#0B57D0", borderTop: "1px solid #EEF1F4" }}>
                        <AddRounded sx={{ fontSize: 18, mr: 1 }} /> Tambah project baru…
                      </MenuItem>
                      <MenuItem value="__manage" sx={{ color: "#444746" }}>
                        <TuneRounded sx={{ fontSize: 18, mr: 1 }} /> Atur ikon, warna & logo…
                      </MenuItem>
                    </Select>
                  )}
                </PropRow>

                <PropRow icon={<EventRounded />} label="Tanggal">
                  {!form.is_milestone && (
                    <>
                      <Box component="span" sx={dateLabelSx}>Start Date</Box>
                      <DatePill label="Start Date" value={form.start_date} max={form.due_date} other={form.due_date} onChange={(v) => set("start_date", v)} />
                      <ArrowForwardRounded sx={{ fontSize: 16, color: "#80868B", mx: 0.25 }} />
                    </>
                  )}
                  <Box component="span" sx={dateLabelSx}>End Date</Box>
                  <DatePill label="End Date" value={form.due_date} min={form.is_milestone ? null : form.start_date} other={form.is_milestone ? null : form.start_date} onChange={(v) => set("due_date", v)} strong error={!!dateError} />
                </PropRow>
                {dateError && <Typography sx={{ fontSize: "0.75rem", color: "#B3261E", pl: "120px", mt: -0.5 }}>{dateError}</Typography>}

                <PropRow icon={<FlagRounded />} label="Prioritas">
                  <Select
                    value={form.priority}
                    onChange={(e) => set("priority", e.target.value as Form["priority"])}
                    variant="standard" input={<InputBase />}
                    renderValue={() => (
                      <>
                        <FlagRounded sx={{ fontSize: 15 }} />
                        {pr.label}
                      </>
                    )}
                    sx={pillSx(`${pr.color}1A`, pr.color)}
                    inputProps={{ "aria-label": "Prioritas" }}
                  >
                    {PRIORITIES.map((p) => (
                      <MenuItem key={p.value} value={p.value}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                          <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: p.color }} />
                          {p.label}
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </PropRow>
              </Box>

              {/* Brief: plain text that expands (read); "Edit Brief" opens a blue-outlined editor with @mentions and attach icons */}
              <Box sx={{ display: "flex", alignItems: "center", mb: 0.5 }}>
                <Typography sx={{ fontSize: "0.75rem", fontWeight: 600, color: "#5F6368" }}>
                  Brief{taskFiles.length ? ` · ${taskFiles.length} lampiran` : ""}
                </Typography>
                <Box sx={{ flex: 1 }} />
                <Button
                  size="small"
                  startIcon={editingNote ? <CheckRounded sx={{ fontSize: "16px !important" }} /> : <EditRounded sx={{ fontSize: "15px !important" }} />}
                  onClick={() => (editingNote ? finishBrief() : startBrief())}
                  sx={{ borderRadius: "9999px", py: 0.25, px: 1.25, fontSize: "0.75rem", fontWeight: 500, color: "#0B57D0" }}
                >
                  {editingNote ? "Selesai" : "Edit Brief"}
                </Button>
              </Box>
              <DropZone onDrop={(l) => void upload(l)} disabled={!live || !!uploading}>
                <Box>
                  {editingNote ? (
                    <Box sx={{ position: "relative", zIndex: 3, border: "1px solid #A8C7FA", borderRadius: "12px", bgcolor: "#fff", transition: "border-color 150ms, box-shadow 150ms", "&:focus-within": { borderColor: "#0B57D0", boxShadow: "0 0 0 1px #0B57D0" }, animation: "oc-rise 200ms cubic-bezier(0.22, 1, 0.36, 1) both" }}>
                      <Box sx={{ px: 1.5, pt: 0.5 }}>
                        <MentionInput
                          ref={brief}
                          value={form.description}
                          onChange={(v) => set("description", v)}
                          onSubmit={() => {}}
                          newlineOnEnter
                          popupBelow
                          minRows={3}
                          ctx={ctx}
                          currentTaskId={live?.id}
                          ariaLabel="Brief"
                          placeholder="Tulis brief: tujuan, detail, link, atau hasil yang diharapkan… ketik @ untuk tag orang, tugas, atau project"
                          inputSx={{ lineHeight: 1.6 }}
                        />
                      </Box>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.25, px: 0.5, pb: 0.5, borderTop: "1px solid #F1F3F4" }}>
                        {live ? (
                          <>
                            <AttachPicker variant="icon" accept="image/*" label="Lampirkan gambar" icon={<ImageRounded sx={{ fontSize: 20 }} />} onPick={(l) => void upload(l)} disabled={!!uploading} />
                            <AttachPicker variant="icon" accept="video/*" label="Lampirkan video" icon={<VideocamRounded sx={{ fontSize: 20 }} />} onPick={(l) => void upload(l)} disabled={!!uploading} />
                            <AttachPicker
                              variant="icon"
                              accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.ppt,.pptx,.txt"
                              label="Lampirkan dokumen (PDF, Word, Excel, PPT)"
                              icon={<DescriptionRounded sx={{ fontSize: 20 }} />}
                              onPick={(l) => void upload(l)}
                              disabled={!!uploading}
                            />
                            <AttachPicker variant="icon" label="Lampirkan file lain" icon={<AttachFileRounded sx={{ fontSize: 20 }} />} onPick={(l) => void upload(l)} disabled={!!uploading} />
                          </>
                        ) : (
                          <Typography sx={{ fontSize: "0.75rem", color: "#80868B", px: 1, py: 0.75 }}>Buat tugasnya dulu, lalu file bisa dilampirkan.</Typography>
                        )}
                      </Box>
                    </Box>
                  ) : form.description.trim() ? (
                    <BriefText text={form.description} onEdit={startBrief} render={(t) => <CommentBody text={t} ctx={ctx} onOpenTask={onOpenTask} />} />
                  ) : (
                    <Box component="button" type="button" onClick={startBrief} sx={{ display: "block", width: "100%", textAlign: "left", border: "none", bgcolor: "transparent", fontFamily: "inherit", p: 0, py: 0.5, fontSize: "0.875rem", color: "#9AA0A6", cursor: "text" }}>
                      Belum ada brief. Klik untuk menulis tujuan, detail, atau hasil yang diharapkan.
                    </Box>
                  )}
                  {uploading && (
                    <Typography sx={{ fontSize: "0.75rem", color: "#0B57D0", mt: 0.75 }}>
                      Mengunggah {Math.min(uploading.done + 1, uploading.total)} dari {uploading.total} file…
                    </Typography>
                  )}
                  {taskFiles.length > 0 && (
                    <Box sx={{ pt: 1.25 }}>
                      <AttachmentGrid files={taskFiles} size={72} onOpen={(f) => openPreview(f, taskFiles)} onRemove={(f) => void removeFile(f)} />
                    </Box>
                  )}
                </Box>
              </DropZone>

              {/* Checklist (main task only) */}
              {live && !live.parent_id && (
                <Box sx={{ mt: 2.5 }}>
                  {label(`Checklist${subs.length ? ` · ${subs.filter((s) => s.status === "done").length}/${subs.length}` : ""}`)}
                  <Box sx={{ border: "1px solid #E0E3E7", borderRadius: "12px", overflow: "hidden" }}>
                    {subs.map((s) => {
                      const d = s.status === "done";
                      return (
                        <Box key={s.id} sx={{ display: "flex", alignItems: "center", gap: 0.5, pr: 1, borderBottom: "1px solid #EEF1F4", "&:hover": { bgcolor: "#F8FAFD" } }}>
                          <Checkbox size="small" checked={d} onChange={(e) => ctx.patch(s, { status: e.target.checked ? "done" : "todo" })} slotProps={{ input: { "aria-label": `Selesai: ${s.title}` } }} />
                          <Box component="button" type="button" onClick={() => onOpenTask(s)} sx={{ flex: 1, minWidth: 0, textAlign: "left", border: "none", bgcolor: "transparent", fontFamily: "inherit", cursor: "pointer", py: 1, fontSize: "0.875rem", color: d ? "#5F6368" : "#1F1F1F", textDecoration: d ? "line-through" : "none" }}>
                            {s.title}
                          </Box>
                          <Box sx={{ display: { xs: "none", sm: "inline-flex" }, mr: 0.5 }}>
                            <CommentCount count={ctx.commentCount(s.id)} />
                          </Box>
                          {!d && (
                            <Box sx={{ display: { xs: "none", sm: "inline-flex" } }}>
                              <DueChip due={s.due_date} done={d} compact />
                            </Box>
                          )}
                          <MemberAvatar member={s.assignee_id ? ctx.memberById.get(s.assignee_id) : undefined} size={22} />
                          <Box
                            component="button"
                            type="button"
                            onClick={() => onOpenTask(s)}
                            aria-label={`Lihat detail ${s.title}`}
                            sx={{
                              ml: 1,
                              p: 0,
                              border: "none",
                              bgcolor: "transparent",
                              cursor: "pointer",
                              fontFamily: "inherit",
                              fontSize: "0.8125rem",
                              fontWeight: 600,
                              color: "#0B57D0",
                              whiteSpace: "nowrap",
                              flexShrink: 0,
                              backgroundImage: "linear-gradient(currentColor, currentColor)",
                              backgroundRepeat: "no-repeat",
                              backgroundPosition: "0 100%",
                              backgroundSize: "0% 1.5px",
                              transition: "background-size 320ms cubic-bezier(0.22, 1, 0.36, 1)",
                              "&:hover, &:focus-visible": { backgroundSize: "100% 1.5px" },
                            }}
                          >
                            Lihat Detail
                          </Box>
                          <IconButton
                            size="small"
                            aria-label={`Hapus ${s.title}`}
                            onClick={() => deleteTask(s.id).then(onChanged).catch((e) => toastError((e as Error).message))}
                            sx={{ color: "#5F6368", "&:hover": { color: "#B3261E", bgcolor: "#FCE8E6" } }}
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
            </Box>
          </SwapIn>
        </Box>

        {/* ── Right: comments as chat bubbles ── */}
        <Box sx={{ bgcolor: "#F8FAFD", borderLeft: { md: "1px solid #EEF1F4" }, borderTop: { xs: "1px solid #EEF1F4", md: "none" }, display: "flex", flexDirection: "column", minHeight: { xs: 420, md: 0 } }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 2.25, py: 1.25, borderBottom: "1px solid #EEF1F4", flexShrink: 0 }}>
            <Typography sx={{ fontSize: "0.9375rem", fontWeight: 500 }}>Komentar</Typography>
            {comments.length > 0 && <Typography sx={{ fontSize: "0.8125rem", color: "#5F6368" }}>{comments.length}</Typography>}
            <Box sx={{ flex: 1 }} />
            <Box sx={{ display: "flex" }}>
              {[...new Set(comments.map((c) => c.author_email ?? ""))].slice(0, 5).map((em, i) => (
                <Box key={em || i} sx={{ ml: i ? -0.75 : 0, borderRadius: "50%", boxShadow: "0 0 0 2px #F8FAFD" }}>
                  <MemberAvatar member={memberOf(em, ctx)} size={22} />
                </Box>
              ))}
            </Box>
          </Box>

          <Box ref={feed} sx={{ flex: 1, minHeight: 0, overflowY: "auto", px: 2.25, py: 2, display: "flex", flexDirection: "column", gap: 1.75 }}>
            {live && (
              <Box sx={{ alignSelf: "center", fontSize: "0.75rem", color: "#5F6368", bgcolor: "#EEF1F5", borderRadius: "9999px", px: 1.25, py: 0.4 }}>
                Tugas dibuat · {formatRelative(live.created_at)}
              </Box>
            )}
            {!live && <Typography sx={{ fontSize: "0.8125rem", color: "#80868B", textAlign: "center", mt: 4 }}>Komentar bisa ditulis setelah tugas dibuat.</Typography>}
            {live && comments.length === 0 && <Typography sx={{ fontSize: "0.8125rem", color: "#80868B", textAlign: "center", mt: 2 }}>Belum ada komentar. Mulai diskusi di bawah.</Typography>}
            {comments.map((c) => {
              const mine = !!myEmail && c.author_email === myEmail;
              const cfiles = files.filter((f) => commentIdOf(f) === c.id);
              const { replyId, text: cbody } = splitReply(c.body);
              const quoted = replyId ? comments.find((x) => x.id === replyId) : undefined;
              const onlyFiles = cbody === "Lampiran" && cfiles.length > 0;
              return (
                <Box key={c.id} id={`cmt-${c.id}`} sx={{ display: "flex", gap: 1, flexDirection: mine ? "row-reverse" : "row", borderRadius: "12px", animation: "oc-rise 280ms cubic-bezier(0.22, 1, 0.36, 1) both", transition: "background-color 400ms", "&.flash": { bgcolor: "#E8F0FE" }, "&:hover .c-del": { opacity: 1 } }}>
                  <MemberAvatar member={memberOf(c.author_email, ctx)} size={28} />
                  <Box sx={{ maxWidth: "80%", minWidth: 0, display: "flex", flexDirection: "column", alignItems: mine ? "flex-end" : "flex-start" }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexDirection: mine ? "row-reverse" : "row", mx: 0.5, mb: 0.25 }}>
                      <Typography sx={{ fontSize: "0.6875rem", color: "#80868B" }}>
                        {mine ? "Kamu" : authorName(c.author_email, ctx)} · {formatRelative(c.created_at)}
                      </Typography>
                      <IconButton
                        className="c-del"
                        size="small"
                        aria-label="Balas komentar"
                        onClick={() => {
                          setReplyTo(c);
                          requestAnimationFrame(() => mention.current?.focus());
                        }}
                        sx={{ opacity: { xs: 1, sm: 0 }, p: 0.25, color: "#80868B", "&:hover": { color: "#0B57D0" } }}
                      >
                        <ReplyRounded sx={{ fontSize: 15 }} />
                      </IconButton>
                      <IconButton
                        className="c-del"
                        size="small"
                        aria-label="Hapus komentar"
                        onClick={() => deleteComment(c.id).then(() => { setComments((l) => l.filter((x) => x.id !== c.id)); onChanged(); }).catch((e) => toastError((e as Error).message))}
                        sx={{ opacity: { xs: 1, sm: 0 }, p: 0.25, color: "#80868B" }}
                      >
                        <DeleteRounded sx={{ fontSize: 14 }} />
                      </IconButton>
                    </Box>
                    {(!onlyFiles || replyId) && (
                      <Box
                        sx={{
                          bgcolor: mine ? "#0B57D0" : "#fff",
                          color: mine ? "#fff" : "#1F1F1F",
                          border: mine ? "none" : "1px solid #E8EBEF",
                          borderRadius: mine ? "16px 4px 16px 16px" : "4px 16px 16px 16px",
                          px: 1.5,
                          py: 1,
                          fontSize: "0.875rem",
                          lineHeight: 1.5,
                          whiteSpace: "pre-wrap",
                          overflowWrap: "anywhere",
                          "& a": { color: "inherit !important", textDecorationColor: "currentColor" },
                        }}
                      >
                        {replyId && (
                          <Box
                            component="button"
                            type="button"
                            onClick={() => flashComment(replyId)}
                            sx={{
                              display: "block",
                              width: "100%",
                              textAlign: "left",
                              border: "none",
                              cursor: "pointer",
                              fontFamily: "inherit",
                              mb: onlyFiles ? 0 : 0.75,
                              px: 1,
                              py: 0.5,
                              borderRadius: "8px",
                              borderLeft: "3px solid",
                              borderColor: mine ? "rgba(255,255,255,.7)" : "#0B57D0",
                              bgcolor: mine ? "rgba(255,255,255,.16)" : "#F1F4F9",
                              color: "inherit",
                            }}
                          >
                            <Box sx={{ fontSize: "0.75rem", fontWeight: 600, color: mine ? "#fff" : "#0B57D0" }}>
                              {quoted ? (quoted.author_email && quoted.author_email === myEmail ? "Kamu" : authorName(quoted.author_email, ctx)) : "Komentar"}
                            </Box>
                            <Box sx={{ fontSize: "0.8125rem", opacity: 0.85, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", whiteSpace: "normal" }}>
                              {quoted ? plainComment(quoted.body) : "Komentar sudah dihapus"}
                            </Box>
                          </Box>
                        )}
                        {!onlyFiles && <CommentBody text={cbody} ctx={ctx} onOpenTask={onOpenTask} />}
                      </Box>
                    )}
                    {cfiles.length > 0 && (
                      <Box sx={{ mt: 0.75 }}>
                        <AttachmentGrid files={cfiles} size={72} onOpen={(f) => openPreview(f, cfiles)} onRemove={(f) => void removeFile(f)} />
                      </Box>
                    )}
                  </Box>
                </Box>
              );
            })}
          </Box>

          {live && (
            <Box sx={{ px: 1.75, py: 1.5, borderTop: "1px solid #EEF1F4", flexShrink: 0 }}>
              <DropZone onDrop={(l) => setPending((p) => [...p, ...l])}>
                <Box sx={{ border: "1px solid #DADCE0", borderRadius: "16px", bgcolor: "#fff", transition: "border-color 150ms, box-shadow 150ms", "&:focus-within": { borderColor: "#0B57D0", boxShadow: "0 0 0 1px #0B57D0" } }}>
                  {replyTo && (
                    <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1, m: 1, mb: 0, pl: 1.25, pr: 0.5, py: 0.75, borderRadius: "10px", bgcolor: "#F1F4F9", borderLeft: "3px solid #0B57D0", animation: "oc-rise 220ms cubic-bezier(0.22, 1, 0.36, 1) both" }}>
                      <ReplyRounded sx={{ fontSize: 16, color: "#0B57D0", mt: 0.25 }} />
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{ fontSize: "0.75rem", fontWeight: 600, color: "#0B57D0" }}>
                          Membalas {replyTo.author_email && replyTo.author_email === myEmail ? "komentarmu" : authorName(replyTo.author_email, ctx)}
                        </Typography>
                        <Typography sx={{ fontSize: "0.8125rem", color: "#444746", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{plainComment(replyTo.body)}</Typography>
                      </Box>
                      <IconButton size="small" aria-label="Batal membalas" onClick={() => setReplyTo(null)} sx={{ p: 0.25 }}>
                        <CloseRounded sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Box>
                  )}
                  <PendingFiles files={pending} onRemove={(i) => setPending((p) => p.filter((_, j) => j !== i))} />
                  <Box sx={{ px: 1.5, pt: 0.5 }}>
                    <MentionInput
                      ref={mention}
                      value={comment}
                      onChange={setComment}
                      onSubmit={() => void sendComment()}
                      ctx={ctx}
                      currentTaskId={live.id}
                      placeholder="Tulis komentar… ketik @ untuk tag orang, tugas, atau project"
                    />
                  </Box>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.25, px: 0.75, pb: 0.75 }}>
                    <AttachPicker variant="icon" onPick={(l) => setPending((p) => [...p, ...l])} disabled={!!uploading} />
                    <Box sx={{ flex: 1 }} />
                    <Button
                      size="small"
                      variant="contained"
                      disableElevation
                      endIcon={<SendRounded sx={{ fontSize: "16px !important" }} />}
                      onClick={() => void sendComment()}
                      disabled={(!comment.trim() && pending.length === 0) || !!uploading}
                      sx={{ borderRadius: "9999px", height: 30, px: 1.75, fontSize: "0.8125rem" }}
                    >
                      Kirim
                    </Button>
                  </Box>
                </Box>
              </DropZone>
            </Box>
          )}
        </Box>
      </Box>

      {/* Footer */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 3, py: 1.25, borderTop: "1px solid #E0E3E7", bgcolor: "#fff", flexShrink: 0 }}>
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
      <PreviewDialog file={preview} files={previewSet} onNavigate={setPreview} onClose={() => setPreview(null)} onChanged={() => void reloadFiles()} />
    </Dialog>
  );
}

/** One property line: icon + label on the left, the value (a pill) on the right. */
function PropRow({ icon, label, children }: { icon: React.ReactElement<{ sx?: object }>; label: string; children: React.ReactNode }) {
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: "120px minmax(0, 1fr)", alignItems: "center", minHeight: 40 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, color: "#5F6368", fontSize: "0.8125rem", "& svg": { fontSize: 18, color: "#80868B" } }}>
        {icon}
        {label}
      </Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, flexWrap: "wrap", minWidth: 0 }}>{children}</Box>
    </Box>
  );
}

/** A Select that looks like a pill (status / people / project / priority). */
function pillSx(bg: string, color: string, outlined = false, filled = true) {
  return {
    minWidth: 0,
    maxWidth: "100%",
    "& .MuiSelect-select": {
      display: "inline-flex !important",
      alignItems: "center",
      flexWrap: "wrap",
      gap: 0.75,
      minHeight: "0 !important",
      py: "4px",
      pl: filled && outlined ? 0.5 : 1.25,
      pr: "28px !important",
      borderRadius: "9999px",
      bgcolor: bg,
      color,
      border: outlined ? "1px solid #E0E3E7" : "1px solid transparent",
      fontSize: "0.8125rem",
      fontWeight: 500,
      lineHeight: "20px",
      transition: "filter 150ms, border-color 150ms",
    },
    "&:hover .MuiSelect-select": { filter: "brightness(0.97)", borderColor: outlined ? "#C4C7C5" : "transparent" },
    "& .MuiSelect-icon": { right: 6, fontSize: 18, color },
    "&.Mui-focused .MuiSelect-select": { boxShadow: "0 0 0 2px #A8C7FA" },
  } as const;
}

const dateLabelSx = { fontSize: "0.75rem", color: "#5F6368", whiteSpace: "nowrap" } as const;

/** Brief in read mode: plain text, clamped to ~6 lines with a "Tampilkan semua" toggle (ClickUp-like). */
function BriefText({ text, onEdit, render }: { text: string; onEdit: () => void; render: (t: string) => React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [long, setLong] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el) setLong(el.scrollHeight > el.clientHeight + 2 || open);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);
  return (
    <Box>
      <Box
        ref={ref}
        onDoubleClick={onEdit}
        sx={{
          fontSize: "0.875rem",
          lineHeight: 1.6,
          color: "#1F1F1F",
          whiteSpace: "pre-wrap",
          overflowWrap: "anywhere",
          py: 0.25,
          ...(open ? {} : { display: "-webkit-box", WebkitLineClamp: 6, WebkitBoxOrient: "vertical", overflow: "hidden" }),
        }}
      >
        {render(text)}
      </Box>
      {long && (
        <Box
          component="button"
          type="button"
          onClick={() => setOpen((v) => !v)}
          sx={{ display: "inline-flex", alignItems: "center", gap: 0.25, mt: 0.5, p: 0, border: "none", bgcolor: "transparent", fontFamily: "inherit", fontSize: "0.8125rem", fontWeight: 500, color: "#0B57D0", cursor: "pointer" }}
        >
          {open ? "Tampilkan lebih sedikit" : "Tampilkan semua"}
          <ExpandMoreRounded sx={{ fontSize: 18, transform: open ? "rotate(180deg)" : "none", transition: "transform 200ms" }} />
        </Box>
      )}
    </Box>
  );
}


// A reply is stored in the comment body itself: "[[reply:<comment id>]]" on the first line (no schema change).
const REPLY_RE = /^\[\[reply:([0-9a-f-]{36})\]\]\n?/;
function withReply(text: string, replyId: string | null) {
  return replyId ? `[[reply:${replyId}]]\n${text}` : text;
}
function splitReply(body: string): { replyId: string | null; text: string } {
  const m = REPLY_RE.exec(body);
  return m ? { replyId: m[1], text: body.slice(m[0].length) } : { replyId: null, text: body };
}
/** Comment text for quotes: no reply marker, mentions as "@Name". */
function plainComment(body: string) {
  const t = splitReply(body).text.replace(/@\[([^\]]+)\]\((member|task|project):[0-9a-f-]+\)/g, "@$1");
  return t === "Lampiran" ? "📎 Lampiran" : t;
}
/** Scrolls to a comment and flashes it. */
function flashComment(id: string) {
  const el = document.getElementById(`cmt-${id}`);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  el.classList.add("flash");
  setTimeout(() => el.classList.remove("flash"), 1200);
}

function memberOf(email: string | null, ctx: TasksCtx) {
  return email ? ctx.members.find((x) => x.email === email) : undefined;
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
