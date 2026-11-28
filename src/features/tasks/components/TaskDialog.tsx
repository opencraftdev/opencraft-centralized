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
import Tooltip from "@mui/material/Tooltip";
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
import CategoryRounded from "@mui/icons-material/CategoryRounded";
import StarRounded from "@mui/icons-material/StarRounded";
import AssignmentRounded from "@mui/icons-material/AssignmentRounded";
import Menu from "@mui/material/Menu";
import Collapse from "@mui/material/Collapse";
import { diffDays, todayISO } from "../dates";
import { taskPath } from "../slug";
import ShareRounded from "@mui/icons-material/ShareRounded";
import LinkRounded from "@mui/icons-material/LinkRounded";
import WhatsApp from "@mui/icons-material/WhatsApp";
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
import { addComment, createTask, deleteComment, updateComment, deleteTask, listComments, saveMember, saveProject, updateTask } from "../api";
import { picsOf, projectsOf, type Task, type TaskComment, type TaskInput } from "../types";
import { PRIORITIES, STATUSES } from "../types";
import type { TasksCtx } from "./TasksApp";
import { CommentCount, DueChip, MemberAvatar } from "./bits";
import { PROJECT_COLORS } from "./TeamDialog";
import { AttachmentGrid, AttachPicker, DropZone } from "./Attachments";
import { fileIdsIn } from "./InlineFiles";
import { commentIdOf, isDraft, linkToComment, listAttachments, removeAttachment, uploadOne } from "../attachments";
import { SwapIn } from "@/components/ui/AutoHeight";
import { DatePill } from "./DatePicker";
import { ConfirmDialog } from "@/features/drive/components/DriveDialogs";
import { CommentBody, MentionInput, stripFormat, type MentionInputHandle } from "./Mentions";
import { FormatBar } from "./FormatBar";
import { SoftTransition } from "@/components/ui/SoftTransition";
import { useTeamChat } from "@/features/team-chat/TeamChat";
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
  pic_ids: [],
  project_ids: [],
  start_date: null,
  due_date: null,
  is_milestone: false,
  is_optional: false,
};

function toForm(t: Task): Form {
  const { project_id, parent_id, title, description, status, priority, assignee_id, helper_ids, start_date, due_date, is_milestone, is_optional } = t;
  return { project_id, parent_id, title, description, status, priority, assignee_id, helper_ids, pic_ids: picsOf(t), project_ids: projectsOf(t), start_date, due_date, is_milestone, is_optional };
}

/** PICs go out as pic_ids (all) + assignee_id (the first); without migration 034 only assignee_id is sent. */
function withPics<T extends Record<string, unknown>>(payload: T, supports: boolean): T {
  const pics = (payload.pic_ids as string[] | undefined) ?? [];
  const projects = (payload.project_ids as string[] | undefined) ?? [];
  const out: Record<string, unknown> = { ...payload, assignee_id: pics[0] ?? null, project_id: projects[0] ?? null };
  if (!supports) {
    delete out.pic_ids;
    delete out.project_ids;
  }
  return out as T;
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
  // One confirm modal for every delete in this dialog (checklist item, comment, attachment)
  const [ask, setAsk] = useState<{ title: string; body: React.ReactNode; label: string; run: () => Promise<void> } | null>(null);
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [comment, setComment] = useState("");
  const [replyTo, setReplyTo] = useState<TaskComment | null>(null); // WhatsApp-style reply to one comment
  const [editing, setEditing] = useState<{ id: string; replyId: string | null; text: string } | null>(null);
  const editRef = useRef<MentionInputHandle>(null);
  const [newSub, setNewSub] = useState("");
  const [newPerson, setNewPerson] = useState<string | null>(null); // typing a new member's name
  const [newProject, setNewProject] = useState<string | null>(null); // typing a new project's name
  const [files, setFiles] = useState<DriveFile[]>([]); // attachments of this task and its comments
  const [busy, setBusy] = useState(0); // inline uploads running
  const draftIds = useRef<Set<string>>(new Set()); // files uploaded into the comment box, not sent yet
  const briefIds = useRef<Set<string>>(new Set()); // files in the brief when editing started (+ uploaded while editing)
  const briefBefore = useRef(""); // the brief before editing, for "Batalkan"
  const [preview, setPreview] = useState<DriveFile | null>(null);
  const [previewSet, setPreviewSet] = useState<DriveFile[]>([]); // the files ‹ › move through (brief, or one comment)
  const openPreview = (f: DriveFile, set: DriveFile[]) => {
    setPreviewSet(set);
    setPreview(f);
  };
  const [editingNote, setEditingNote] = useState(false);
  const [openBrief, setOpenBrief] = useState(true); // Brief / Checklist accordions, open by default
  const [openCheck, setOpenCheck] = useState(true);
  const mention = useRef<MentionInputHandle>(null);
  const brief = useRef<MentionInputHandle>(null);
  const { email: myEmail } = useAccount();
  const teamChat = useTeamChat();
  // opening a task tucks the Chat Tim panel away (it can be opened again from a profile card)
  useEffect(() => {
    if (open) teamChat.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, task?.id]);

  // The live copy (realtime / checkbox changes) of the task being edited.
  const live = task ? ctx.all.find((x) => x.id === task.id) ?? task : null;
  const taskId = task?.id ?? null;
  // Slide direction: into a checklist item = forward, back to its parent = back.
  const prevTask = useRef<Task | null>(null);
  const swapDir: 1 | -1 | 0 = !task || !prevTask.current ? 0 : task.parent_id === prevTask.current.id ? 1 : prevTask.current.parent_id === task.id ? -1 : 0;
  useEffect(() => {
    prevTask.current = open ? task : null;
  }, [open, task]);

  const formFor = useRef<string | null>(null); // which task the form holds (guards autosave while switching)
  useEffect(() => {
    if (!open) return;
    formFor.current = task?.id ?? null;
    setForm(() => {
      if (task) return toForm(task);
      const f = { ...EMPTY, ...defaults };
      return { ...f, pic_ids: f.pic_ids?.length ? f.pic_ids : f.assignee_id ? [f.assignee_id] : [], project_ids: f.project_ids?.length ? f.project_ids : f.project_id ? [f.project_id] : [] };
    });
    setConfirmDelete(false);
    setComment("");
    setReplyTo(null);
    setNewSub("");
    setNewPerson(null);
    setNewProject(null);
    setComments([]);
    setFiles([]);
    setBusy(0);
    draftIds.current = new Set();
    setEditingNote(!task);
    if (task) {
      listComments(task.id).then(setComments).catch(() => setComments([]));
      listAttachments(task.id).then(setFiles).catch(() => setFiles([]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, taskId]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));
  const startBrief = () => {
    // files attached before inline files existed join the brief at the bottom
    const inText = new Set(fileIdsIn(form.description));
    const loose = files.filter((f) => !commentIdOf(f) && !isDraft(f) && !inText.has(f.id));
    const text = loose.length ? `${form.description.replace(/\s+$/, "")}${form.description.trim() ? "\n" : ""}${loose.map((f) => `[[file:${f.id}]]`).join("")}\n` : form.description;
    briefBefore.current = form.description;
    briefIds.current = new Set(fileIdsIn(text));
    setEditingNote(true);
    requestAnimationFrame(() => {
      brief.current?.load(text);
      brief.current?.focus();
    });
  };
  const cancelBrief = () => {
    set("description", briefBefore.current);
    setEditingNote(false);
  };
  // "Selesai" saves the brief right away (no separate Simpan needed)
  const finishBrief = () => {
    const description = brief.current ? brief.current.serialize() : form.description;
    set("description", description);
    setEditingNote(false);
    if (live && description !== live.description) {
      ctx.patch(live, { description });
      toastSuccess("Brief disimpan");
    }
    // files taken out of the brief (Backspace / cut): delete them for good, after a confirm
    const now = new Set(fileIdsIn(description));
    const gone = files.filter((f) => briefIds.current.has(f.id) && !now.has(f.id));
    if (gone.length)
      setAsk({
        title: gone.length > 1 ? `Hapus ${gone.length} lampiran?` : "Hapus lampiran?",
        body: (
          <>
            <b>{gone.map((f) => f.name).join(", ")}</b> sudah kamu hapus dari brief. Hapus juga filenya secara permanen? Kalau tidak, file tetap tersimpan di bawah brief.
          </>
        ),
        label: "Hapus permanen",
        run: async () => {
          for (const f of gone) await removeFile(f);
        },
      });
  };
  const dirty = live ? JSON.stringify(toForm(live)) !== JSON.stringify(form) : form.title.trim() !== "";
  const parent = form.parent_id ? ctx.all.find((x) => x.id === form.parent_id) : undefined;
  const subs = taskId ? ctx.childrenOf.get(taskId) ?? [] : [];
  const supportsPics = ctx.all.some((t) => "pic_ids" in t); // migration 034 has run
  const pics = form.pic_ids ?? [];
  const projs = form.project_ids ?? [];
  const dateError = form.start_date && form.due_date && form.start_date > form.due_date ? "Mulai harus sebelum deadline" : "";

  const addPerson = async () => {
    const name = (newPerson ?? "").trim();
    if (!name) return;
    try {
      const id = await saveMember({ name, initials: initialsOf(name), sort: ctx.members.length + 1 });
      setForm((f) => ({ ...f, pic_ids: [...(f.pic_ids ?? []), id], helper_ids: f.helper_ids.filter((x) => x !== id) }));
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
      setForm((f) => ({ ...f, project_ids: [...(f.project_ids ?? []), id] }));
      setNewProject(null);
      toastSuccess(`Project ${name} dibuat.`);
      onChanged();
    } catch (e) {
      toastError((e as Error).message);
    }
  };

  const save = async () => {
    if (!form.title.trim()) return toastError("Judul task wajib diisi.");
    if (dateError) return toastError(dateError);
    setSaving(true);
    try {
      const description = editingNote && brief.current ? brief.current.serialize() : form.description;
      const payload = withPics({ ...form, description, title: form.title.trim(), due_date: form.is_milestone ? form.start_date ?? form.due_date : form.due_date }, supportsPics);
      if (form.is_milestone && payload.due_date) payload.start_date = payload.due_date;
      if (live) {
        await updateTask(live.id, payload);
        toastSuccess("Task disimpan.");
        onChanged();
        onClose();
      } else {
        // a new task stays open, now as itself, so the brief, files, checklist and comments can follow right away
        const created = await createTask({ ...payload, sort: Date.now() / 1000 });
        toastSuccess("Task dibuat.");
        onChanged();
        onOpenTask(created);
      }
    } catch (e) {
      toastError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  // An existing task saves itself: changes are written shortly after you stop typing (and when the dialog closes).
  const autoPayload = (): Partial<TaskInput> | null => {
    if (!live || formFor.current !== live.id || !form.title.trim() || dateError) return null;
    const payload: Record<string, unknown> = withPics({ ...form, title: form.title.trim(), due_date: form.is_milestone ? form.start_date ?? form.due_date : form.due_date }, supportsPics);
    if (form.is_milestone && payload.due_date) payload.start_date = payload.due_date;
    if (editingNote) delete payload.description; // the brief saves on "Selesai"
    const diff: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(payload)) if (JSON.stringify(v ?? null) !== JSON.stringify((live as unknown as Record<string, unknown>)[k] ?? null)) diff[k] = v;
    return Object.keys(diff).length ? (diff as Partial<TaskInput>) : null;
  };
  const flushRef = useRef<() => void>(() => {});
  flushRef.current = () => {
    const d = autoPayload();
    if (d && live) ctx.patch(live, d);
  };
  useEffect(() => {
    if (!live || !dirty) return;
    const t = setTimeout(() => flushRef.current(), 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, dirty]);
  const close = () => {
    if (editingNote && live) finishBrief();
    flushRef.current();
    onClose();
  };

  const remove = async () => {
    if (!live) return;
    try {
      await deleteTask(live.id);
      toastSuccess("Task dihapus.");
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
        ...(supportsPics ? { pic_ids: picsOf(live), project_ids: projectsOf(live) } : {}),
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

  // Files go where the caret is (brief, comment box, or a comment being edited): an uploading block shows the
  // progress, then becomes the file.
  const uploadInline = async (where: "brief" | "comment" | "edit", picked: File[]) => {
    if (!live || picked.length === 0) return;
    if (where === "brief" && !editingNote) {
      startBrief();
      await new Promise((r) => setTimeout(r, 120));
    }
    const ref = where === "brief" ? brief : where === "comment" ? mention : editRef;
    const meta: Record<string, unknown> = where === "brief" ? { task_id: live.id } : where === "comment" ? { task_id: live.id, draft: true } : { task_id: live.id, comment_id: editing?.id };
    const temps = picked.map((f) => ({ tempId: Math.random().toString(36).slice(2), name: f.name }));
    ref.current?.insertUploads(temps);
    setBusy((b) => b + 1);
    try {
      for (let i = 0; i < picked.length; i++) {
        try {
          const df = await uploadOne(picked[i], meta, (pct) => ref.current?.progress(temps[i].tempId, pct));
          setFiles((l) => [...l, df]);
          if (where === "comment") draftIds.current.add(df.id);
          if (where === "brief") briefIds.current.add(df.id);
          ref.current?.resolveUpload(temps[i].tempId, df);
        } catch (e) {
          toastError(`Upload ${picked[i].name} gagal: ${(e as Error).message}`);
          ref.current?.resolveUpload(temps[i].tempId, null);
        }
      }
    } finally {
      setBusy((b) => b - 1);
      void reloadFiles();
    }
  };
  /** The × on a file block: confirm, then delete the file and its block. */
  const askRemoveInline = (id: string, ref: React.RefObject<MentionInputHandle | null>) => {
    const f = files.find((x) => x.id === id);
    if (!f) return ref.current?.removeFile(id);
    setAsk({
      title: "Hapus lampiran?",
      body: (
        <>
          <b>{f.name}</b> akan dihapus permanen. Tindakan ini tidak bisa dibatalkan.
        </>
      ),
      label: "Hapus lampiran",
      run: async () => {
        ref.current?.removeFile(id);
        draftIds.current.delete(id);
        await removeFile(f);
      },
    });
  };

  const sendComment = async () => {
    const text = (mention.current?.serialize() ?? comment).trim();
    if (!text || !live || busy) return;
    const reply = replyTo;
    const used = fileIdsIn(text);
    const unused = [...draftIds.current].filter((id) => !used.includes(id));
    draftIds.current = new Set();
    setComment("");
    setReplyTo(null);
    mention.current?.reset();
    try {
      const id = await addComment(live.id, withReply(text, reply?.id ?? null));
      await linkToComment(used, live.id, id);
      for (const u of unused) void removeAttachment(u).catch(() => {});
      setComments(await listComments(live.id));
      await reloadFiles();
      onChanged();
    } catch (e) {
      toastError((e as Error).message);
    }
  };

  const startEdit = (c: TaskComment) => {
    const { replyId, text } = splitReply(c.body);
    setEditing({ id: c.id, replyId, text });
    requestAnimationFrame(() => {
      editRef.current?.load(text);
      editRef.current?.focus();
    });
  };
  const saveEdit = async () => {
    const e = editing;
    if (!e) return;
    const text = (editRef.current?.serialize() ?? e.text).trim();
    if (!text) return;
    const body = withReply(text, e.replyId);
    setEditing(null);
    setComments((l) => l.map((x) => (x.id === e.id ? { ...x, body } : x)));
    try {
      await updateComment(e.id, body);
    } catch (err) {
      toastError((err as Error).message);
      if (live) setComments(await listComments(live.id).catch(() => comments));
    }
  };

  const askRemoveFile = (f: DriveFile) =>
    setAsk({
      title: "Hapus lampiran?",
      body: (
        <>
          <b>{f.name}</b> akan dihapus dari task ini. Tindakan ini tidak bisa dibatalkan.
        </>
      ),
      label: "Hapus lampiran",
      run: () => removeFile(f),
    });
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
  const taskFiles = files.filter((f) => !commentIdOf(f) && !isDraft(f));
  const fileMap = new Map(files.map((f) => [f.id, f]));
  const briefRefs = new Set(fileIdsIn(form.description));
  const looseBriefFiles = taskFiles.filter((f) => !briefRefs.has(f.id)); // attached before inline files, or kept after removal
  const openBriefFile = (f: DriveFile) => openPreview(f, taskFiles);
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
      onClose={close}
      fullScreen={mobile}
      maxWidth="lg"
      fullWidth
      slots={{ transition: SoftTransition }}
      slotProps={{ paper: { sx: { borderRadius: mobile ? 0 : "20px", height: mobile ? "100%" : "min(780px, 92vh)", display: "flex", flexDirection: "column", ...SEQ_SX } } }}
    >
      {/* Top bar */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 2, pt: 1.5, pb: 0.5, flexShrink: 0 }}>
        {parent ? (
          <Button size="small" startIcon={<ArrowBackRounded sx={{ fontSize: 16 }} />} onClick={() => onOpenTask(parent)} sx={{ color: "#444746", borderRadius: "9999px", textTransform: "none", maxWidth: "70%", justifyContent: "flex-start" }}>
            <Box component="span" sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Bagian dari: {parent.title}</Box>
          </Button>
        ) : (
          <Typography sx={{ fontSize: "0.8125rem", color: "#5F6368", pl: 1 }}>{live ? "Detail task" : "Task baru"}</Typography>
        )}
        <Box sx={{ flex: 1 }} />
        {live && <ShareTask task={live} ctx={ctx} />}
        <IconButton onClick={close} aria-label="Tutup">
          <CloseRounded />
        </IconButton>
      </Box>

      <Box sx={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: { xs: "1fr", md: "minmax(0, 1.35fr) minmax(320px, 1fr)" }, overflowY: { xs: "auto", md: "hidden" } }}>
        {/* ── Left: title, properties, brief (+ files), checklist ── */}
        <Box sx={{ overflowY: { md: "auto" }, minHeight: 0 }}>
          <SwapIn id={taskId ?? "new"} dir={swapDir}>
            <Box className="oc-seq" sx={{ px: 3, pt: 0.5, pb: 3 }}>
              <InputBase
                autoFocus={!live}
                fullWidth
                multiline
                value={form.title}
                onChange={(e) => set("title", e.target.value.replace(/\n/g, " "))}
                placeholder="Judul task"
                sx={{ fontSize: "1.375rem", fontWeight: 500, color: "#1F1F1F", mb: 1 }}
                inputProps={{ "aria-label": "Judul task" }}
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
                      multiple
                      displayEmpty
                      value={pics}
                      onChange={(e) => {
                        const v = typeof e.target.value === "string" ? e.target.value.split(",") : e.target.value;
                        if (v.includes("__new")) return setNewPerson("");
                        setForm((f) => ({ ...f, pic_ids: v, helper_ids: f.helper_ids.filter((x) => !v.includes(x)) }));
                      }}
                      variant="standard" input={<InputBase />}
                      renderValue={(ids) =>
                        ids.length ? (
                          ids.map((id) => (
                            <Box key={id} component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}>
                              <MemberAvatar member={ctx.memberById.get(id)} size={20} />
                              {ctx.memberById.get(id)?.name}
                            </Box>
                          ))
                        ) : (
                          <Box component="span" sx={{ color: "#80868B" }}>Pilih orang</Box>
                        )
                      }
                      sx={pillSx("#fff", "#1F1F1F", true, pics.length > 0)}
                      inputProps={{ "aria-label": "PIC" }}
                    >
                      {ctx.members.filter((m) => m.active || pics.includes(m.id)).map((m) => (
                        <MenuItem key={m.id} value={m.id}>
                          <Checkbox size="small" checked={pics.includes(m.id)} sx={{ p: 0.5, mr: 1 }} />
                          <MemberAvatar member={m} size={20} />
                          <Box component="span" sx={{ ml: 1 }}>{m.name}</Box>
                        </MenuItem>
                      ))}
                      <MenuItem value="__new" sx={{ color: "#0B57D0", borderTop: "1px solid #EEF1F4" }}>
                        <AddRounded sx={{ fontSize: 18, mr: 1 }} /> Tambah orang baru…
                      </MenuItem>
                    </Select>
                  )}
                </PropRow>

                {!supportsPics && pics.length > 1 && (
                  <Typography sx={{ fontSize: "0.75rem", color: "#B06000", pl: "120px", mt: -0.5 }}>Jalankan SQL 034 dulu supaya PIC ke-2 dan seterusnya ikut tersimpan.</Typography>
                )}
                <PropRow icon={<GroupRounded />} label="Dibantu oleh">
                  <Select
                    multiple
                    displayEmpty
                    value={form.helper_ids}
                    onChange={(e) => set("helper_ids", (typeof e.target.value === "string" ? e.target.value.split(",") : e.target.value).filter((id) => !pics.includes(id)))}
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
                    {ctx.members.filter((m) => m.active && !pics.includes(m.id)).map((m) => (
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
                      multiple
                      displayEmpty
                      value={projs}
                      onChange={(e) => {
                        const v = typeof e.target.value === "string" ? e.target.value.split(",") : e.target.value;
                        if (v.includes("__new")) return setNewProject("");
                        if (v.includes("__manage")) return ctx.openTeam("projects");
                        setForm((f) => ({ ...f, project_ids: v }));
                      }}
                      variant="standard" input={<InputBase />}
                      renderValue={(ids) =>
                        ids.length ? (
                          ids.map((id) => (
                            <Box key={id} component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}>
                              <ProjectMark project={ctx.projectById.get(id)} size={14} />
                              {ctx.projectById.get(id)?.name}
                            </Box>
                          ))
                        ) : (
                          <Box component="span" sx={{ color: "#80868B" }}>Tanpa project</Box>
                        )
                      }
                      sx={pillSx("#fff", "#1F1F1F", true, projs.length > 0)}
                      inputProps={{ "aria-label": "Project" }}
                    >
                      {ctx.projects.filter((p) => p.status !== "parked" || projs.includes(p.id)).map((p) => (
                        <MenuItem key={p.id} value={p.id}>
                          <Checkbox size="small" checked={projs.includes(p.id)} sx={{ p: 0.5, mr: 1 }} />
                          <Box sx={{ width: 18, display: "grid", placeItems: "center", mr: 1 }}>
                            <ProjectMark project={p} size={16} />
                          </Box>
                          {p.name}
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

                {!supportsPics && projs.length > 1 && (
                  <Typography sx={{ fontSize: "0.75rem", color: "#B06000", pl: "120px", mt: -0.5 }}>Jalankan SQL 034 dulu supaya project ke-2 dan seterusnya ikut tersimpan.</Typography>
                )}
                <PropRow icon={<EventRounded />} label="Tanggal">
                  {!form.is_milestone && (
                    <>
                      <Box component="span" sx={dateLabelSx}>Start Date</Box>
                      <DatePill label="Start Date" value={form.start_date} max={form.due_date} other={form.due_date} onChange={(v) => set("start_date", v)} />
                      <ArrowForwardRounded sx={{ fontSize: 16, color: "#80868B", mx: 0.25 }} />
                    </>
                  )}
                  <Box component="span" sx={dateLabelSx}>{form.is_milestone ? "Tanggal" : "End Date"}</Box>
                  <DatePill label="End Date" value={form.due_date} min={form.is_milestone ? null : form.start_date} other={form.is_milestone ? null : form.start_date} onChange={(v) => set("due_date", v)} strong error={!!dateError} />
                  <DueHint due={form.due_date} done={form.status === "done"} />
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

                {/* Jenis: a normal task, a one-day milestone (golden star on the timeline), or "kalau perlu" (striped) */}
                <PropRow icon={<CategoryRounded />} label="Jenis">
                  <Select
                    value={form.is_milestone ? "milestone" : form.is_optional ? "optional" : "task"}
                    onChange={(e) => {
                      const v = e.target.value as "task" | "milestone" | "optional";
                      setForm((f) => ({ ...f, is_milestone: v === "milestone", is_optional: v === "optional", ...(v === "milestone" ? { start_date: f.due_date ?? f.start_date, due_date: f.due_date ?? f.start_date } : {}) }));
                    }}
                    variant="standard" input={<InputBase />}
                    renderValue={(v) => {
                      const k = KINDS.find((x) => x.value === v) ?? KINDS[0];
                      return (
                        <>
                          {k.icon}
                          {k.label}
                        </>
                      );
                    }}
                    sx={pillSx(form.is_milestone ? "#FFF4D1" : "#F1F3F4", form.is_milestone ? "#8A5A00" : "#444746")}
                    inputProps={{ "aria-label": "Jenis task" }}
                  >
                    {KINDS.map((k) => (
                      <MenuItem key={k.value} value={k.value}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                          {k.icon}
                          <Box>
                            <Box sx={{ fontSize: "0.875rem" }}>{k.label}</Box>
                            <Box sx={{ fontSize: "0.6875rem", color: "#80868B" }}>{k.hint}</Box>
                          </Box>
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </PropRow>
              </Box>

              {/* Brief: plain text that expands (read); "Edit Brief" opens a blue-outlined editor with @mentions and attach icons */}
              <Box sx={{ display: "flex", alignItems: "center", mb: 0.5 }}>
                <SectionToggle open={openBrief} onClick={() => setOpenBrief((v) => !v)}>
                  Brief{taskFiles.length ? ` · ${taskFiles.length} lampiran` : ""}
                </SectionToggle>
                <Box sx={{ flex: 1 }} />
                {!editingNote && (
                  <Button
                    size="small"
                    startIcon={<EditRounded sx={{ fontSize: "15px !important" }} />}
                    onClick={() => {
                      setOpenBrief(true);
                      startBrief();
                    }}
                    sx={{ borderRadius: "9999px", py: 0.25, px: 1.25, fontSize: "0.75rem", fontWeight: 500, color: "#0B57D0" }}
                  >
                    Edit Brief
                  </Button>
                )}
              </Box>
              <Collapse in={openBrief || editingNote} timeout={220}>
              <DropZone onDrop={(l) => void uploadInline("brief", l)} disabled={!live}>
                <Box sx={editingNote ? undefined : { bgcolor: "#FAFBFC", border: "1px solid #E3E6EA", borderRadius: "12px", px: 1.5, py: 1.25 }}>
                  {editingNote ? (
                    <Box sx={{ position: "relative", zIndex: 3, border: "1px solid #A8C7FA", borderRadius: "12px", bgcolor: "#fff", transition: "border-color 150ms, box-shadow 150ms", "&:focus-within": { borderColor: "#0B57D0", boxShadow: "0 0 0 1px #0B57D0" }, animation: "oc-rise 200ms cubic-bezier(0.22, 1, 0.36, 1) both" }}>
                      <Box sx={{ px: 1.5, pt: 0.5 }}>
                        <MentionInput
                          ref={brief}
                          files={fileMap}
                          onFiles={live ? (l) => void uploadInline("brief", l) : undefined}
                          onRemoveFile={(id) => askRemoveInline(id, brief)}
                          onOpenFile={(id) => { const f = fileMap.get(id); if (f) openBriefFile(f); }}
                          value={form.description}
                          onChange={(v) => set("description", v)}
                          onSubmit={() => {}}
                          newlineOnEnter
                          popupBelow
                          minRows={3}
                          ctx={ctx}
                          currentTaskId={live?.id}
                          ariaLabel="Brief"
                          placeholder="Tulis brief: tujuan, detail, link, atau hasil yang diharapkan… ketik @ untuk tag orang, task, atau project"
                          inputSx={{ lineHeight: 1.6 }}
                        />
                      </Box>
                      <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 0.25, px: 0.5, pb: 0.5, borderTop: "1px solid #F1F3F4" }}>
                        {live ? (
                          <>
                            <AttachPicker variant="icon" accept="image/*" label="Lampirkan gambar" icon={<ImageRounded sx={{ fontSize: 20 }} />} onPick={(l) => void uploadInline("brief", l)} />
                            <AttachPicker variant="icon" accept="video/*" label="Lampirkan video" icon={<VideocamRounded sx={{ fontSize: 20 }} />} onPick={(l) => void uploadInline("brief", l)} />
                            <AttachPicker
                              variant="icon"
                              accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.ppt,.pptx,.txt"
                              label="Lampirkan dokumen (PDF, Word, Excel, PPT)"
                              icon={<DescriptionRounded sx={{ fontSize: 20 }} />}
                              onPick={(l) => void uploadInline("brief", l)}
                            />
                            <AttachPicker variant="icon" label="Lampirkan file lain" icon={<AttachFileRounded sx={{ fontSize: 20 }} />} onPick={(l) => void uploadInline("brief", l)} />
                            <Box sx={{ width: "1px", height: 20, bgcolor: "#E0E3E7", mx: 0.5 }} />
                            <FormatBar target={brief} />
                          </>
                        ) : (
                          <>
                            <FormatBar target={brief} />
                            <Typography sx={{ fontSize: "0.75rem", color: "#80868B", px: 1, py: 0.75 }}>Buat task-nya dulu, lalu file bisa dilampirkan.</Typography>
                          </>
                        )}
                        <Box sx={{ flex: 1 }} />
                        {live && (
                          <Button size="small" onClick={cancelBrief} sx={{ borderRadius: "9999px", py: 0.25, px: 1.25, fontSize: "0.75rem", fontWeight: 500, color: "#B3261E", "&:hover": { bgcolor: "#FCE8E6" } }}>
                            Batalkan
                          </Button>
                        )}
                        <Button
                          size="small"
                          disabled={busy > 0}
                          startIcon={<CheckRounded sx={{ fontSize: "16px !important" }} />}
                          onClick={finishBrief}
                          sx={{ borderRadius: "9999px", py: 0.25, px: 1.25, mr: 0.5, fontSize: "0.75rem", fontWeight: 500, color: "#0B57D0" }}
                        >
                          Selesai
                        </Button>
                      </Box>
                    </Box>
                  ) : form.description.trim() ? (
                    <BriefText text={form.description} onEdit={startBrief} render={(t) => <CommentBody text={t} ctx={ctx} onOpenTask={onOpenTask} files={fileMap} onOpenFile={openBriefFile} />} />
                  ) : (
                    <Box component="button" type="button" onClick={startBrief} sx={{ display: "block", width: "100%", textAlign: "left", border: "none", bgcolor: "transparent", fontFamily: "inherit", p: 0, py: 0.5, fontSize: "0.875rem", color: "#9AA0A6", cursor: "text" }}>
                      Belum ada brief. Klik untuk menulis tujuan, detail, atau hasil yang diharapkan.
                    </Box>
                  )}
                  {!editingNote && looseBriefFiles.length > 0 && (
                    <Box sx={{ pt: 1.25 }}>
                      <AttachmentGrid files={looseBriefFiles} size={72} onOpen={openBriefFile} onRemove={askRemoveFile} />
                    </Box>
                  )}
                </Box>
              </DropZone>
              </Collapse>

              {/* Checklist (main task only) */}
              {live && !live.parent_id && (
                <Box sx={{ mt: openBrief || editingNote ? 2 : 0.5 }}>
                  <Box sx={{ mb: 0.75 }}>
                    <SectionToggle open={openCheck} onClick={() => setOpenCheck((v) => !v)}>
                      {`Checklist${subs.length ? ` · ${subs.filter((s) => s.status === "done").length}/${subs.length}` : ""}`}
                    </SectionToggle>
                  </Box>
                  <Collapse in={openCheck} timeout={220}>
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
                            onClick={() =>
                              setAsk({
                                title: "Hapus item checklist?",
                                body: (
                                  <>
                                    <b>{s.title}</b> beserta diskusi dan lampirannya akan dihapus. Tindakan ini tidak bisa dibatalkan.
                                  </>
                                ),
                                label: "Hapus",
                                run: () => deleteTask(s.id).then(onChanged).catch((e) => toastError((e as Error).message)),
                              })
                            }
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
                  </Collapse>
                </Box>
              )}
            </Box>
          </SwapIn>
        </Box>

        {/* ── Right: comments as chat bubbles ── */}
        <Box className="oc-seq-panel" sx={{ bgcolor: "#F8FAFD", borderLeft: { md: "1px solid #EEF1F4" }, borderTop: { xs: "1px solid #EEF1F4", md: "none" }, display: "flex", flexDirection: "column", minHeight: { xs: 420, md: 0 } }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 2.25, py: 1.25, borderBottom: "1px solid #EEF1F4", flexShrink: 0 }}>
            <Typography sx={{ fontSize: "0.9375rem", fontWeight: 500 }}>Diskusi</Typography>
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

          <Box ref={feed} sx={{ flex: 1, minHeight: 0, overflowY: "auto", px: 2.25, py: 2, display: "flex", flexDirection: "column", gap: 1.25 }}>
            {live && (
              <Box sx={{ alignSelf: "center", fontSize: "0.75rem", color: "#80868B" }}>
                Task dibuat · {formatRelative(live.created_at)}
              </Box>
            )}
            {!live && <Typography sx={{ fontSize: "0.8125rem", color: "#80868B", textAlign: "center", mt: 4 }}>Diskusi bisa dimulai setelah task dibuat.</Typography>}
            {live && comments.length === 0 && <Typography sx={{ fontSize: "0.8125rem", color: "#80868B", textAlign: "center", my: "auto" }}>Belum ada diskusi. Mulai di bawah.</Typography>}
            {comments.map((c) => {
              const mine = !!myEmail && c.author_email === myEmail;
              const cfiles = files.filter((f) => commentIdOf(f) === c.id);
              const { replyId, text: cbody } = splitReply(c.body);
              const quoted = replyId ? comments.find((x) => x.id === replyId) : undefined;
              const onlyFiles = cbody === "Lampiran" && cfiles.length > 0;
              return (
                <Box key={c.id} id={`cmt-${c.id}`} sx={{ display: "flex", gap: 1, flexDirection: mine ? "row-reverse" : "row", borderRadius: "12px", animation: "oc-rise 280ms cubic-bezier(0.22, 1, 0.36, 1) both", transition: "background-color 400ms", "&.flash": { bgcolor: "#E8F0FE" }, "&:hover .c-del": { opacity: 1 } }}>
                  <Box component="button" type="button" aria-label={`Profil ${authorName(c.author_email, ctx)}`} onClick={(e) => c.author_email && teamChat.openProfile(c.author_email, e.currentTarget)} sx={{ border: "none", bgcolor: "transparent", p: 0, cursor: "pointer", alignSelf: "flex-start", borderRadius: "50%", height: 28 }}>
                    <MemberAvatar member={memberOf(c.author_email, ctx)} size={28} />
                  </Box>
                  <Box sx={{ position: "relative", maxWidth: editing?.id === c.id ? "calc(100% - 36px)" : "80%", minWidth: 0, display: "flex", flexDirection: "column", alignItems: mine ? "flex-end" : "flex-start" }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexDirection: mine ? "row-reverse" : "row", mx: 0.5, mb: 0.25 }}>
                      <Typography sx={{ fontSize: "0.6875rem", color: "#80868B" }}>
                        <Box component="button" type="button" onClick={(e) => c.author_email && teamChat.openProfile(c.author_email, e.currentTarget)} sx={{ border: "none", bgcolor: "transparent", p: 0, fontFamily: "inherit", fontSize: "inherit", fontWeight: 600, color: "#444746", cursor: c.author_email ? "pointer" : "default", "&:hover": { color: "#0B57D0", textDecoration: "underline" } }}>
                          {authorName(c.author_email, ctx)}
                        </Box>{" "}
                        · {formatRelative(c.created_at)}
                      </Typography>
                    </Box>
                    {editing?.id === c.id ? (
                      <Box sx={{ width: { xs: 300, sm: 460 }, maxWidth: "100%", border: "1px solid #0B57D0", boxShadow: "0 0 0 1px #0B57D0", borderRadius: "14px", bgcolor: "#fff", px: 1.25, pt: 0.25, pb: 0.75 }}>
                        <MentionInput
                          ref={editRef}
                          files={fileMap}
                          onFiles={(l) => void uploadInline("edit", l)}
                          onRemoveFile={(id) => askRemoveInline(id, editRef)}
                          onOpenFile={(id) => { const f = fileMap.get(id); if (f) openPreview(f, [f]); }}
                          value={editing.text}
                          onChange={(v) => setEditing((e) => (e ? { ...e, text: v } : e))}
                          onSubmit={() => void saveEdit()}
                          ctx={ctx}
                          currentTaskId={live?.id}
                          ariaLabel="Edit pesan"
                          maxRows={12}
                          inputSx={{ fontSize: "0.75rem", lineHeight: 1.45 }}
                          placeholder="Edit pesan…"
                        />
                        <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 0.5, mt: 0.25 }}>
                          <Button size="small" onClick={() => setEditing(null)} sx={{ borderRadius: "9999px", color: "#444746", minWidth: 0, px: 1.25, fontSize: "0.75rem" }}>
                            Batal
                          </Button>
                          <Button size="small" variant="contained" disableElevation disabled={!editing.text.trim()} onClick={() => void saveEdit()} sx={{ borderRadius: "9999px", minWidth: 0, px: 1.5, fontSize: "0.75rem" }}>
                            Simpan
                          </Button>
                        </Box>
                      </Box>
                    ) : (!onlyFiles || replyId) && (
                      <Box
                        sx={{
                          // soft grey-white for everyone (mine a touch deeper so it still reads as "me")
                          bgcolor: mine ? "#EAEFF5" : "#F4F6F9",
                          color: "#1F1F1F",
                          border: "1px solid #E1E6EC",
                          borderRadius: mine ? "14px 4px 14px 14px" : "4px 14px 14px 14px",
                          px: 1.25,
                          py: 0.75,
                          fontSize: "0.75rem",
                          lineHeight: 1.45,
                          whiteSpace: "pre-wrap",
                          overflowWrap: "anywhere",
                          "& a": { color: "#0B57D0 !important" },
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
                              borderColor: "#0B57D0",
                              bgcolor: "rgba(11,87,208,.06)",
                              color: "inherit",
                            }}
                          >
                            <Box sx={{ fontSize: "0.75rem", fontWeight: 600, color: "#0B57D0" }}>
                              {quoted ? (authorName(quoted.author_email, ctx)) : "Pesan"}
                            </Box>
                            <Box sx={{ fontSize: "0.8125rem", opacity: 0.85, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", whiteSpace: "normal" }}>
                              {quoted ? plainComment(quoted.body) : "Pesan sudah dihapus"}
                            </Box>
                          </Box>
                        )}
                        {!onlyFiles && <CommentBody text={cbody} ctx={ctx} onOpenTask={onOpenTask} files={fileMap} onOpenFile={(f) => openPreview(f, cfiles)} />}
                      </Box>
                    )}
                    {cfiles.some((f) => !cbody.includes(f.id)) && (
                      <Box sx={{ mt: 0.75 }}>
                        <AttachmentGrid files={cfiles.filter((f) => !cbody.includes(f.id))} size={72} onOpen={(f) => openPreview(f, cfiles)} onRemove={askRemoveFile} />
                      </Box>
                    )}
                    {editing?.id !== c.id && (
                      // beside the bubble on hover (takes no room); under it on touch screens
                      <Box sx={{ display: "flex", gap: 0.25, alignSelf: "flex-end", mt: { xs: 0.25, sm: 0 }, position: { xs: "static", sm: "absolute" }, top: { sm: "calc(50% + 9px)" }, transform: { sm: "translateY(-50%)" }, ...(mine ? { right: "100%", mr: { sm: 0.5 }, flexDirection: "row-reverse" } : { left: "100%", ml: { sm: 0.5 } }) }}>
                        <CommentAction label="Balas" onClick={() => { setReplyTo(c); requestAnimationFrame(() => mention.current?.focus()); }}>
                          <ReplyRounded sx={{ fontSize: 15 }} />
                        </CommentAction>
                        {mine && !onlyFiles && (
                          <CommentAction label="Edit" onClick={() => startEdit(c)}>
                            <EditRounded sx={{ fontSize: 14 }} />
                          </CommentAction>
                        )}
                        <CommentAction
                          label="Hapus"
                          danger
                          onClick={() =>
                            setAsk({
                              title: "Hapus pesan?",
                              body: <>Pesan ini{cfiles.length ? ` dan ${cfiles.length} lampirannya` : ""} akan dihapus untuk semua orang. Tindakan ini tidak bisa dibatalkan.</>,
                              label: "Hapus pesan",
                              run: () =>
                                deleteComment(c.id)
                                  .then(() => {
                                    setComments((l) => l.filter((x) => x.id !== c.id));
                                    onChanged();
                                  })
                                  .catch((e) => toastError((e as Error).message)),
                            })
                          }
                        >
                          <DeleteRounded sx={{ fontSize: 14 }} />
                        </CommentAction>
                      </Box>
                    )}
                  </Box>
                </Box>
              );
            })}
          </Box>

          {live && (
            <Box sx={{ px: 1.75, py: 1.5, borderTop: "1px solid #EEF1F4", flexShrink: 0 }}>
              <DropZone onDrop={(l) => void uploadInline("comment", l)}>
                <Box sx={{ border: "1px solid #DADCE0", borderRadius: "16px", bgcolor: "#fff", transition: "border-color 150ms, box-shadow 150ms", "&:focus-within": { borderColor: "#0B57D0", boxShadow: "0 0 0 1px #0B57D0" } }}>
                  {replyTo && (
                    <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1, m: 1, mb: 0, pl: 1.25, pr: 0.5, py: 0.75, borderRadius: "10px", bgcolor: "#F1F4F9", borderLeft: "3px solid #0B57D0", animation: "oc-rise 220ms cubic-bezier(0.22, 1, 0.36, 1) both" }}>
                      <ReplyRounded sx={{ fontSize: 16, color: "#0B57D0", mt: 0.25 }} />
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{ fontSize: "0.75rem", fontWeight: 600, color: "#0B57D0" }}>
                          Membalas {replyTo.author_email && replyTo.author_email === myEmail ? "pesanmu" : authorName(replyTo.author_email, ctx)}
                        </Typography>
                        <Typography sx={{ fontSize: "0.8125rem", color: "#444746", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{plainComment(replyTo.body)}</Typography>
                      </Box>
                      <IconButton size="small" aria-label="Batal membalas" onClick={() => setReplyTo(null)} sx={{ p: 0.25 }}>
                        <CloseRounded sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Box>
                  )}
                  <Box sx={{ px: 1.5, pt: 0.5 }}>
                    <MentionInput
                      ref={mention}
                      files={fileMap}
                      onFiles={(l) => void uploadInline("comment", l)}
                      onRemoveFile={(id) => askRemoveInline(id, mention)}
                      onOpenFile={(id) => { const f = fileMap.get(id); if (f) openPreview(f, [f]); }}
                      value={comment}
                      onChange={setComment}
                      onSubmit={() => void sendComment()}
                      ctx={ctx}
                      currentTaskId={live.id}
                      placeholder="Tulis di diskusi… ketik @ untuk tag orang, task, atau project"
                    />
                  </Box>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.25, px: 0.75, pb: 0.75 }}>
                    <AttachPicker variant="icon" accept="image/*" label="Lampirkan gambar" icon={<ImageRounded sx={{ fontSize: 20 }} />} onPick={(l) => void uploadInline("comment", l)} />
                    <AttachPicker variant="icon" accept="video/*" label="Lampirkan video" icon={<VideocamRounded sx={{ fontSize: 20 }} />} onPick={(l) => void uploadInline("comment", l)} />
                    <AttachPicker variant="icon" accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.ppt,.pptx,.txt" label="Lampirkan dokumen (PDF, Word, Excel, PPT)" icon={<DescriptionRounded sx={{ fontSize: 20 }} />} onPick={(l) => void uploadInline("comment", l)} />
                    <AttachPicker variant="icon" label="Lampirkan file lain" icon={<AttachFileRounded sx={{ fontSize: 20 }} />} onPick={(l) => void uploadInline("comment", l)} />
                    <Box sx={{ width: "1px", height: 20, bgcolor: "#E0E3E7", mx: 0.5 }} />
                    <FormatBar target={mention} />
                    <Box sx={{ flex: 1 }} />
                    <Button
                      size="small"
                      variant="contained"
                      disableElevation
                      endIcon={<SendRounded sx={{ fontSize: "16px !important" }} />}
                      onClick={() => void sendComment()}
                      disabled={!comment.trim() || busy > 0}
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

      {/* Footer: an existing task saves itself, so only Hapus is left (on the right); a new one still needs "Buat tugas". */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 3, py: 1.25, borderTop: "1px solid #E0E3E7", bgcolor: "#fff", flexShrink: 0 }}>
        {live ? (
          <>
            <Typography sx={{ fontSize: "0.75rem", color: "#80868B", display: "flex", alignItems: "center", gap: 0.5 }}>
              <CheckRounded sx={{ fontSize: 14 }} /> {dirty ? "Menyimpan…" : "Perubahan tersimpan otomatis"}
            </Typography>
            <Box sx={{ flex: 1 }} />
            <Button size="small" color="error" startIcon={<DeleteRounded />} onClick={() => setConfirmDelete(true)} sx={{ borderRadius: "9999px" }}>
              Hapus
            </Button>
          </>
        ) : (
          <>
            <Box sx={{ flex: 1 }} />
            <Button onClick={onClose} sx={{ borderRadius: "9999px", color: "#444746" }}>
              Batal
            </Button>
            <Button variant="contained" disableElevation disabled={saving || !dirty || !form.title.trim()} onClick={() => void save()} sx={{ borderRadius: "9999px" }}>
              Buat task
            </Button>
          </>
        )}
      </Box>
      <ConfirmDialog
        open={confirmDelete}
        title={parent ? "Hapus item checklist?" : "Hapus task?"}
        body={
          <>
            <b>{live?.title}</b>
            {subs.length ? ` beserta ${subs.length} item checklist-nya` : ""}, diskusi, dan lampirannya akan dihapus. Tindakan ini tidak bisa dibatalkan.
          </>
        }
        confirmLabel="Hapus"
        onClose={() => setConfirmDelete(false)}
        onConfirm={async () => {
          setConfirmDelete(false);
          await remove();
        }}
      />
      <ConfirmDialog
        open={Boolean(ask)}
        title={ask?.title ?? ""}
        body={ask?.body ?? null}
        confirmLabel={ask?.label ?? "Hapus"}
        onClose={() => setAsk(null)}
        onConfirm={async () => {
          const a = ask;
          setAsk(null);
          if (a) await a.run();
        }}
      />
      <PreviewDialog file={preview} files={previewSet} onNavigate={setPreview} onClose={() => setPreview(null)} onChanged={() => void reloadFiles()} />
    </Dialog>
  );
}

/** One property line: icon + label on the left, the value (a pill) on the right. */
// Opening: each block of the task (title, properties, brief, checklist) and the Diskusi panel rise in from below,
// one after another; closing: they sink back a touch as the card tucks away. CSS only (transform + opacity).
const SEQ_EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
const SEQ_SX = {
  "& .oc-seq > *": { animation: `oc-seq-in 420ms ${SEQ_EASE} both` },
  ...Object.fromEntries(Array.from({ length: 8 }, (_, i) => [`& .oc-seq > *:nth-of-type(${i + 1})`, { animationDelay: `${40 + i * 35}ms` }])),
  "& .oc-seq-panel": { animation: `oc-seq-in 460ms ${SEQ_EASE} 110ms both` },
  "[data-tstate='exiting'] & .oc-seq > *, [data-tstate='exiting'] & .oc-seq-panel": {
    animation: "none",
    opacity: 0,
    transform: "translateY(10px)",
    transition: "opacity 160ms ease-in, transform 200ms cubic-bezier(0.4, 0, 1, 1)",
  },
} as const;

const KINDS = [
  { value: "task", label: "Task", hint: "Punya tanggal mulai dan deadline", icon: <AssignmentRounded sx={{ fontSize: 16, color: "#5A86C2" }} /> },
  { value: "milestone", label: "Milestone", hint: "Satu hari penting, mis. rapat/keputusan", icon: <StarRounded sx={{ fontSize: 17, color: "#F2A600" }} /> },
  { value: "optional", label: "Kalau perlu", hint: "Opsional, tampil bergaris di timeline", icon: <Box component="span" sx={{ width: 16, height: 10, borderRadius: "3px", backgroundImage: "repeating-linear-gradient(135deg, #5A86C255 0 3px, #5A86C222 3px 6px)", display: "inline-block" }} /> },
] as const;

/** A section label that opens/closes its section (Brief, Checklist). */
function SectionToggle({ open, onClick, children }: { open: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <Box component="button" type="button" onClick={onClick} aria-expanded={open} sx={{ display: "inline-flex", alignItems: "center", gap: 0.25, ml: -0.5, pl: 0.25, pr: 0.75, py: 0.25, border: "none", bgcolor: "transparent", borderRadius: "6px", fontFamily: "inherit", fontSize: "0.75rem", fontWeight: 600, color: "#5F6368", cursor: "pointer", "&:hover": { bgcolor: "#F1F3F4", color: "#1F1F1F" } }}>
      <ExpandMoreRounded sx={{ fontSize: 18, transform: open ? "none" : "rotate(-90deg)", transition: "transform 200ms cubic-bezier(0.22, 1, 0.36, 1)" }} />
      {children}
    </Box>
  );
}

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
const BRIEF_MAX = 220;

function BriefText({ text, onEdit, render }: { text: string; onEdit: () => void; render: (t: string) => React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [long, setLong] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  // re-measure whenever the content grows (files and pictures load after the text)
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setLong(el.scrollHeight > BRIEF_MAX + 2);
    measure();
    const ro = new ResizeObserver(measure);
    for (const c of Array.from(el.children)) ro.observe(c);
    ro.observe(el);
    const imgs = Array.from(el.querySelectorAll("img, video"));
    imgs.forEach((m) => m.addEventListener("load", measure));
    return () => {
      ro.disconnect();
      imgs.forEach((m) => m.removeEventListener("load", measure));
    };
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
          ...(open ? {} : { maxHeight: BRIEF_MAX, overflow: "hidden", maskImage: long ? "linear-gradient(180deg, #000 75%, transparent)" : "none" }),
        }}
      >
        {render(text)}
      </Box>
      {long && (
        <Box
          component="button"
          type="button"
          onClick={() => setOpen((v) => !v)}
          sx={{ display: "inline-flex", alignItems: "center", gap: 0.25, mt: 0.5, p: 0, border: "none", bgcolor: "transparent", fontFamily: "inherit", fontSize: "0.8125rem", fontWeight: 500, color: "#5F6368", cursor: "pointer", "&:hover": { color: "#1F1F1F" } }}
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
  const t = stripFormat(splitReply(body).text).replace(/@\[([^\]]+)\]\((member|task|project):[0-9a-f-]+\)/g, "@$1");
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


/** Small action under a comment bubble (shows on hover; always on touch screens). */
function CommentAction({ label, onClick, danger, children }: { label: string; onClick: () => void; danger?: boolean; children: React.ReactNode }) {
  return (
    <Tooltip title={label}>
      <IconButton
        className="c-del"
        size="small"
        aria-label={`${label} pesan`}
        onClick={onClick}
        sx={{ opacity: { xs: 1, sm: 0 }, p: 0.4, color: "#80868B", transition: "opacity 150ms, color 150ms", "&:hover": { color: danger ? "#B3261E" : "#0B57D0" } }}
      >
        {children}
      </IconButton>
    </Tooltip>
  );
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

/** "Besok" / "3 hari lagi" / "Terlambat 2 hari" next to the deadline: red when close, orange this week, grey later. */
function DueHint({ due, done }: { due: string | null; done: boolean }) {
  if (!due || done) return null;
  const d = diffDays(todayISO(), due);
  const label = d < 0 ? `Terlambat ${-d} hari` : d === 0 ? "Hari ini" : d === 1 ? "Besok" : d < 7 ? `${d} hari lagi` : d < 14 ? "1 minggu lagi" : d < 60 ? `${Math.round(d / 7)} minggu lagi` : `${Math.round(d / 30)} bulan lagi`;
  const color = d <= 1 ? "#C5221F" : d < 7 ? "#E37400" : "#80868B";
  return <Box component="span" sx={{ fontSize: "0.75rem", fontWeight: 600, color, ml: 0.25, whiteSpace: "nowrap" }}>{label}</Box>;
}

/** "Share Task": copy the readable link (/t/BuatNIB) or send it to WhatsApp. */
function ShareTask({ task, ctx }: { task: Task; ctx: TasksCtx }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const url = () => `${window.location.origin}${taskPath(task, ctx.all)}`;
  const copy = async () => {
    setAnchor(null);
    try {
      await navigator.clipboard.writeText(url());
      toastSuccess("Link task disalin");
    } catch {
      toastError("Tidak bisa menyalin. Salin manual: " + url());
    }
  };
  const wa = () => {
    setAnchor(null);
    window.open(`https://wa.me/?text=${encodeURIComponent(`${task.title}\n${url()}`)}`, "_blank", "noopener");
  };
  return (
    <>
      <Button
        variant="contained"
        disableElevation
        size="small"
        startIcon={<ShareRounded sx={{ fontSize: "16px !important" }} />}
        onClick={(e) => setAnchor(e.currentTarget)}
        sx={{ borderRadius: "9999px", px: 1.75, mr: 0.5, fontSize: "0.8125rem" }}
      >
        Share Task
      </Button>
      <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)} anchorOrigin={{ vertical: "bottom", horizontal: "right" }} transformOrigin={{ vertical: "top", horizontal: "right" }} slotProps={{ paper: { sx: { mt: 0.75, borderRadius: "14px", minWidth: 230 } } }}>
        <Box sx={{ px: 2, pt: 0.75, pb: 1, fontSize: "0.75rem", color: "#5F6368", maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{taskPath(task, ctx.all).replace("/t/", "internal.ocraft.id/t/")}</Box>
        <MenuItem onClick={() => void copy()} sx={{ gap: 1.25, fontSize: "0.875rem" }}>
          <LinkRounded sx={{ fontSize: 18, color: "#444746" }} /> Salin link
        </MenuItem>
        <MenuItem onClick={wa} sx={{ gap: 1.25, fontSize: "0.875rem" }}>
          <WhatsApp sx={{ fontSize: 18, color: "#25D366" }} /> Bagikan ke WhatsApp
        </MenuItem>
      </Menu>
    </>
  );
}
