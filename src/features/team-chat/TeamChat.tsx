"use client";

import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import InputBase from "@mui/material/InputBase";
import Popover from "@mui/material/Popover";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import ForumRounded from "@mui/icons-material/ForumRounded";
import CloseRounded from "@mui/icons-material/CloseRounded";
import ArrowBackRounded from "@mui/icons-material/ArrowBackRounded";
import SendRounded from "@mui/icons-material/SendRounded";
import EditRounded from "@mui/icons-material/EditRounded";
import DeleteRounded from "@mui/icons-material/DeleteRounded";
import SearchRounded from "@mui/icons-material/SearchRounded";
import ChatBubbleRounded from "@mui/icons-material/ChatBubbleRounded";
import { ConfirmDialog } from "@/features/drive/components/DriveDialogs";
import { formatRelative } from "@/features/drive/format";
import { personFor, useAccount, usePeople } from "@/features/accounts/account";
import { MemberAvatar } from "@/features/tasks/components/bits";
import type { Member, Project, Task } from "@/features/tasks/types";
import { useRouter } from "next/navigation";
import AlternateEmailRounded from "@mui/icons-material/AlternateEmailRounded";
import AssignmentRounded from "@mui/icons-material/AssignmentRounded";
import OpenInNewRounded from "@mui/icons-material/OpenInNewRounded";
import type { TasksCtx } from "@/features/tasks/components/TasksApp";
import { CommentBody, MentionInput, stripFormat, type MentionInputHandle } from "@/features/tasks/components/Mentions";
import { FormatBar } from "@/features/tasks/components/FormatBar";
import { AttachPicker, DropZone } from "@/features/tasks/components/Attachments";
import { fileIdsIn } from "@/features/tasks/components/InlineFiles";
import { uploadOne } from "@/features/tasks/attachments";
import { createClient } from "@/lib/supabase/client";
import { driveContentUrl } from "@/lib/drive/links";
import type { DriveFile } from "@/lib/drive/types";
import ImageRounded from "@mui/icons-material/ImageRounded";
import VideocamRounded from "@mui/icons-material/VideocamRounded";
import DescriptionRounded from "@mui/icons-material/DescriptionRounded";
import AttachFileRounded from "@mui/icons-material/AttachFileRounded";
import { toastError } from "@/components/ui/Toast";
import {
  deleteMessage,
  editMessage,
  isMissingTable,
  listRecent,
  listThread,
  markRead,
  otherOf,
  sendMessage,
  subscribeTeamMessages,
  threadOf,
  type TeamMessage,
} from "./api";

// "Chat Tim": one-to-one chat between teammates. A blue button at the bottom right opens a small panel with the
// people (last message, unread count); a conversation looks like a task's Diskusi. Clicking a person's name in a
// Diskusi opens their profile card with a "Chat" button that jumps straight into that conversation.

interface TeamChatApi {
  openChat: (email?: string) => void;
  close: () => void;
  openProfile: (email: string, anchor: HTMLElement) => void;
}
const Ctx = createContext<TeamChatApi>({ openChat: () => {}, close: () => {}, openProfile: () => {} });
export const useTeamChat = () => useContext(Ctx);

export function TeamChatProvider({ children }: { children: React.ReactNode }) {
  const { email: me } = useAccount();
  const pathname = usePathname();
  const raised = pathname.startsWith("/chat"); // keep clear of the AI chat's message box
  const people = usePeople();
  const [open, setOpen] = useState(false);
  const [withEmail, setWithEmail] = useState<string | null>(null);
  const [recent, setRecent] = useState<TeamMessage[]>([]);
  const [missing, setMissing] = useState(false);
  const [profile, setProfile] = useState<{ email: string; anchor: HTMLElement } | null>(null);

  const refresh = useCallback(async () => {
    try {
      setRecent(await listRecent());
      setMissing(false);
    } catch (e) {
      if (isMissingTable((e as Error).message)) setMissing(true);
    }
  }, []);
  useEffect(() => {
    if (!me) return;
    void refresh();
    let t: ReturnType<typeof setTimeout> | null = null;
    const unsub = subscribeTeamMessages(() => {
      if (t) clearTimeout(t);
      t = setTimeout(() => void refresh(), 250);
    });
    const poll = setInterval(() => void refresh(), 60_000);
    return () => {
      unsub();
      clearInterval(poll);
      if (t) clearTimeout(t);
    };
  }, [me, refresh]);

  const unreadList = recent.filter((m) => m.author_email !== me && !m.read_at);
  const unread = unreadList.length;
  const unreadFrom = unreadList[0]?.author_email ?? null; // newest unread sender
  // up to 3 faces: whoever wrote last first, then the most recent conversations, then the rest of the team
  const dockPeople = useMemo(() => {
    const order: string[] = [];
    for (const m of recent) {
      const other = otherOf(m.thread, me);
      if (other !== me && !order.includes(other)) order.push(other);
    }
    if (unreadFrom) {
      const i = order.indexOf(unreadFrom);
      if (i > 0) order.splice(i, 1);
      if (i !== 0) order.unshift(unreadFrom);
    }
    const team = people.filter((p) => p.email && p.email !== me && p.active);
    const byEmail = new Map(team.map((p) => [p.email as string, p]));
    const picked = order.map((e) => byEmail.get(e)).filter((p): p is Member => !!p);
    for (const p of team) if (!picked.includes(p)) picked.push(p);
    return picked.slice(0, 3);
  }, [recent, people, me, unreadFrom]);
  const api = useMemo<TeamChatApi>(
    () => ({
      openChat: (email) => {
        setProfile(null);
        setWithEmail(email && email !== me ? email : null);
        setOpen(true);
      },
      close: () => setOpen(false),
      openProfile: (email, anchor) => setProfile({ email, anchor }),
    }),
    [me],
  );

  return (
    <Ctx.Provider value={api}>
      {children}
      {me && !open && (
        <Box
          component="button"
          type="button"
          aria-label={unread ? `Chat Tim, ${unread} pesan belum dibaca` : "Chat Tim"}
          onClick={() => api.openChat()}
          sx={{
            position: "fixed",
            right: 24,
            bottom: raised ? 116 : 24,
            zIndex: 1200,
            display: "inline-flex",
            alignItems: "center",
            gap: 1,
            height: 44,
            pl: 1.5,
            pr: 0.75,
            border: "1px solid #E3E8F2",
            borderRadius: "9999px",
            bgcolor: "#fff",
            color: "#1F1F1F",
            fontFamily: "inherit",
            fontSize: "0.8125rem",
            fontWeight: 600,
            cursor: "pointer",
            boxShadow: "0 4px 16px rgba(60,64,67,.18)",
            transition: "transform 150ms, box-shadow 150ms",
            "&:hover": { transform: "translateY(-1px)", boxShadow: "0 8px 22px rgba(60,64,67,.24)" },
            animation: "oc-pop-in 260ms cubic-bezier(0.22, 1, 0.36, 1)",
            "@keyframes oc-dock-ring": { "0%": { boxShadow: "0 0 0 0 rgba(11,87,208,.5)" }, "70%": { boxShadow: "0 0 0 9px rgba(11,87,208,0)" }, "100%": { boxShadow: "0 0 0 0 rgba(11,87,208,0)" } },
          }}
        >
          <ForumRounded sx={{ fontSize: 18, color: "#0B57D0" }} />
          Chat Tim
          {/* the team's faces; the person who just wrote comes to the front with a blue ring */}
          <Box component="span" sx={{ display: "inline-flex", ml: 0.5 }}>
            {dockPeople.map((p, i) => {
              const lead = i === 0 && !!unreadFrom;
              return (
                <Box
                  key={p.id}
                  component="span"
                  sx={{
                    display: "inline-flex",
                    ml: i ? "-7px" : 0,
                    position: "relative",
                    zIndex: dockPeople.length - i,
                    borderRadius: "50%",
                    boxShadow: "0 0 0 2px #fff",
                    transition: "transform 300ms cubic-bezier(0.34, 1.56, 0.64, 1)",
                    transform: lead ? "translateY(-5px) scale(1.12)" : "none",
                    animation: lead ? "oc-dock-ring 1.6s ease-out infinite" : "none",
                    "@media (prefers-reduced-motion: reduce)": { animation: "none" },
                  }}
                >
                  <MemberAvatar member={p} size={26} />
                </Box>
              );
            })}
          </Box>
          {unread > 0 && (
            <Box component="span" sx={{ minWidth: 20, height: 20, px: 0.5, borderRadius: "10px", bgcolor: "#D93025", color: "#fff", fontSize: "0.6875rem", fontWeight: 700, display: "grid", placeItems: "center", animation: "oc-pop-in 300ms cubic-bezier(0.34, 1.56, 0.64, 1)" }}>
              {unread > 9 ? "9+" : unread}
            </Box>
          )}
        </Box>
      )}
      {me && open && (
        <Panel
          me={me}
          people={people}
          recent={recent}
          missing={missing}
          withEmail={withEmail}
          setWithEmail={setWithEmail}
          onClose={() => setOpen(false)}
          onChanged={refresh}
        />
      )}
      <ProfileCard target={profile} people={people} me={me} onClose={() => setProfile(null)} onChat={(email) => api.openChat(email)} />
    </Ctx.Provider>
  );
}

/** A person's card: photo, name, role, email, and "Chat". */
function ProfileCard({ target, people, me, onClose, onChat }: { target: { email: string; anchor: HTMLElement } | null; people: Member[]; me: string; onClose: () => void; onChat: (email: string) => void }) {
  const p = target ? personFor(target.email, people) : null;
  return (
    <Popover
      open={!!target}
      anchorEl={target?.anchor}
      onClose={onClose}
      anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      transformOrigin={{ vertical: "top", horizontal: "center" }}
      slotProps={{ paper: { sx: { mt: 0.75, width: 260, borderRadius: "20px", boxShadow: "0 10px 36px rgba(60,64,67,.22)", animation: "oc-pop-in 200ms cubic-bezier(0.22, 1, 0.36, 1)" } } }}
    >
      {p && target && (
        <Box sx={{ p: 2.5, textAlign: "center" }}>
          <Box sx={{ display: "flex", justifyContent: "center" }}>
            <MemberAvatar member={p} size={72} />
          </Box>
          <Typography sx={{ mt: 1.25, fontSize: "1.0625rem", fontWeight: 600 }}>{p.name}</Typography>
          {p.role && <Typography sx={{ fontSize: "0.8125rem", fontWeight: 600, color: "#444746" }}>{p.role}</Typography>}
          <Typography sx={{ fontSize: "0.75rem", color: "#5F6368", mt: 0.25 }}>{target.email}</Typography>
          {target.email !== me ? (
            <Button variant="contained" disableElevation startIcon={<ChatBubbleRounded sx={{ fontSize: "16px !important" }} />} onClick={() => onChat(target.email)} sx={{ mt: 2, borderRadius: "9999px", px: 3 }}>
              Chat
            </Button>
          ) : (
            <Typography sx={{ fontSize: "0.75rem", color: "#80868B", mt: 1.5 }}>Ini profilmu.</Typography>
          )}
        </Box>
      )}
    </Popover>
  );
}

function Panel({
  me,
  people,
  recent,
  missing,
  withEmail,
  setWithEmail,
  onClose,
  onChanged,
}: {
  me: string;
  people: Member[];
  recent: TeamMessage[];
  missing: boolean;
  withEmail: string | null;
  setWithEmail: (e: string | null) => void;
  onClose: () => void;
  onChanged: () => void;
}) {
  return (
    <Box
      role="dialog"
      aria-label="Chat Tim"
      sx={{
        position: "fixed",
        right: { xs: 8, sm: 24 },
        bottom: { xs: 8, sm: 24 },
        zIndex: 1350, // above task dialogs, so "Chat" from a profile card shows on top
        width: { xs: "calc(100vw - 16px)", sm: 320 },
        height: "min(480px, calc(100dvh - 96px))",
        bgcolor: "#fff",
        borderRadius: "18px",
        boxShadow: "0 16px 48px rgba(60,64,67,.28), 0 2px 8px rgba(60,64,67,.12)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        animation: "oc-pop-in 240ms cubic-bezier(0.22, 1, 0.36, 1)",
        transformOrigin: "bottom right",
      }}
    >
      {missing ? (
        <>
          <Header title="Chat Tim" onClose={onClose} />
          <Box sx={{ p: 3, fontSize: "0.875rem", color: "#5F6368", lineHeight: 1.6 }}>
            Chat Tim belum aktif. Jalankan SQL <b>033_team_messages.sql</b> di Supabase → SQL Editor, lalu buka lagi.
          </Box>
        </>
      ) : withEmail ? (
        <Thread me={me} other={withEmail} people={people} onBack={() => setWithEmail(null)} onClose={onClose} onChanged={onChanged} />
      ) : (
        <People me={me} people={people} recent={recent} onPick={setWithEmail} onClose={onClose} />
      )}
    </Box>
  );
}

function Header({ title, sub, avatar, onBack, onClose }: { title: string; sub?: string; avatar?: React.ReactNode; onBack?: () => void; onClose: () => void }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, px: 1, py: 0.75, borderBottom: "1px solid #EEF1F4", flexShrink: 0, "& .MuiIconButton-root": { p: 0.5 }, "& .MuiIconButton-root .MuiSvgIcon-root": { fontSize: 18 } }}>
      {onBack && (
        <IconButton size="small" onClick={onBack} aria-label="Kembali ke daftar">
          <ArrowBackRounded sx={{ fontSize: 20 }} />
        </IconButton>
      )}
      {avatar}
      <Box sx={{ flex: 1, minWidth: 0, pl: onBack ? 0 : 1 }}>
        <Typography noWrap sx={{ fontSize: "0.8125rem", fontWeight: 600 }}>
          {title}
        </Typography>
        {sub && (
          <Typography noWrap sx={{ fontSize: "0.625rem", color: "#5F6368" }}>
            {sub}
          </Typography>
        )}
      </Box>
      <IconButton size="small" onClick={onClose} aria-label="Tutup Chat Tim">
        <CloseRounded sx={{ fontSize: 20 }} />
      </IconButton>
    </Box>
  );
}

/** One-line preview of a stored message (no tags / tokens). */
const preview = (b: string, mine = false) =>
  MENTION_RE.test(b) ? (mine ? "Kamu menandai di sebuah task" : "Menandai kamu di sebuah task") : plainPreview(b);
const plainPreview = (b: string) => stripFormat(b.replace(/@\[([^\]]+)\]\((?:member|task|project):[0-9a-f-]+\)/g, "@$1")).replace(/\s+/g, " ").trim() || "📎 Lampiran";

function People({ me, people, recent, onPick, onClose }: { me: string; people: Member[]; recent: TeamMessage[]; onPick: (email: string) => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const rows = people
    .filter((p) => p.email && p.email !== me && p.active)
    .map((p) => {
      const t = threadOf(me, p.email!);
      const msgs = recent.filter((m) => m.thread === t);
      return { p, last: msgs[0] ?? null, unread: msgs.filter((m) => m.author_email !== me && !m.read_at).length };
    })
    .filter((r) => !q.trim() || r.p.name.toLowerCase().includes(q.toLowerCase()) || (r.p.role ?? "").toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (b.last?.created_at ?? "").localeCompare(a.last?.created_at ?? "") || a.p.name.localeCompare(b.p.name));
  return (
    <>
      <Header title="Chat Tim" sub="Pilih orang untuk mulai chat" onClose={onClose} />
      <Box sx={{ px: 1, pt: 0.75, pb: 0.25 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, height: 30, px: 1.25, borderRadius: "9999px", bgcolor: "#F1F4F9" }}>
          <SearchRounded sx={{ fontSize: 15, color: "#5F6368" }} />
          <InputBase value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari orang…" sx={{ flex: 1, fontSize: "0.75rem" }} inputProps={{ "aria-label": "Cari orang" }} />
        </Box>
      </Box>
      <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", py: 0.5 }}>
        {rows.length === 0 && <Typography sx={{ textAlign: "center", color: "#80868B", fontSize: "0.8125rem", py: 5, px: 3 }}>Belum ada teman yang terhubung ke akun login. Hubungkan lewat Tim & project.</Typography>}
        {rows.map(({ p, last, unread }) => (
          <Box
            key={p.id}
            component="button"
            type="button"
            onClick={() => onPick(p.email!)}
            sx={{ display: "flex", alignItems: "center", gap: 1, width: "100%", px: 1.5, py: 0.75, border: "none", bgcolor: "transparent", fontFamily: "inherit", textAlign: "left", cursor: "pointer", "&:hover": { bgcolor: "#F6F8FB" } }}
          >
            <MemberAvatar member={p} size={30} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Box sx={{ display: "flex", alignItems: "baseline", gap: 1 }}>
                <Typography noWrap sx={{ flex: 1, minWidth: 0, fontSize: "0.8125rem", fontWeight: unread ? 700 : 600 }}>
                  {p.name}
                </Typography>
                {last && (
                  <Typography suppressHydrationWarning sx={{ fontSize: "0.625rem", color: unread ? "#0B57D0" : "#80868B", flexShrink: 0 }}>
                    {formatRelative(last.created_at)}
                  </Typography>
                )}
              </Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Typography noWrap sx={{ flex: 1, minWidth: 0, fontSize: "0.6875rem", color: unread ? "#1F1F1F" : "#5F6368", fontWeight: unread ? 500 : 400 }}>
                  {last ? `${last.author_email === me ? "Kamu: " : ""}${preview(last.body, last.author_email === me)}` : p.role || "Mulai chat"}
                </Typography>
                {unread > 0 && (
                  <Box component="span" sx={{ minWidth: 18, height: 18, px: 0.5, borderRadius: "9px", bgcolor: "#0B57D0", color: "#fff", fontSize: "0.625rem", fontWeight: 700, display: "grid", placeItems: "center", flexShrink: 0 }}>
                    {unread}
                  </Box>
                )}
              </Box>
            </Box>
          </Box>
        ))}
      </Box>
    </>
  );
}

/** The bits of the task-management context the Diskusi editor/renderer need, built from the people list. */
function chatCtx(people: Member[], tasks: Task[], projects: Project[]): TasksCtx {
  return { members: people, memberById: new Map(people.map((p) => [p.id, p])), all: tasks, projects, projectById: new Map(projects.map((p) => [p.id, p])) } as unknown as TasksCtx;
}

/** Tasks and projects, for "@task" in Chat Tim and for task chips/cards in messages. */
function useTaskLite() {
  const [data, setData] = useState<{ tasks: Task[]; projects: Project[] }>({ tasks: [], projects: [] });
  useEffect(() => {
    const sb = createClient();
    Promise.all([sb.from("tasks").select("*").order("updated_at", { ascending: false }).limit(400), sb.from("task_projects").select("*")]).then(
      ([t, p]) => setData({ tasks: (t.data ?? []) as Task[], projects: (p.data ?? []) as Project[] }),
      () => {},
    );
  }, []);
  return data;
}

const MENTION_RE = /^\[\[mention:([0-9a-f-]{36})\]\]\n?/;

function Thread({ me, other, people, onBack, onClose, onChanged }: { me: string; other: string; people: Member[]; onBack: () => void; onClose: () => void; onChanged: () => void }) {
  const thread = threadOf(me, other);
  const person = personFor(other, people);
  const lite = useTaskLite();
  const ctx = useMemo(() => chatCtx(people, lite.tasks, lite.projects), [people, lite]);
  const router = useRouter();
  const openTask = (t: { id: string }) => router.push(`/tasks?task=${t.id}`);
  const [msgs, setMsgs] = useState<TeamMessage[] | null>(null);
  const [files, setFiles] = useState<Map<string, DriveFile>>(new Map());
  const [text, setText] = useState("");
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const [ask, setAsk] = useState<TeamMessage | null>(null);
  const [busy, setBusy] = useState(0);
  const feed = useRef<HTMLDivElement>(null);
  const composer = useRef<MentionInputHandle>(null);
  const editRef = useRef<MentionInputHandle>(null);

  const load = useCallback(async () => {
    try {
      const list = await listThread(thread);
      setMsgs(list);
      // files placed in the messages
      const ids = [...new Set(list.flatMap((m) => fileIdsIn(m.body)))];
      if (ids.length) {
        const { data } = await createClient().from("drive_files").select("*").in("id", ids);
        setFiles((prev) => {
          const next = new Map(prev);
          for (const f of (data ?? []) as DriveFile[]) next.set(f.id, f);
          return next;
        });
      }
      await markRead(thread, me);
      onChanged();
    } catch (e) {
      toastError((e as Error).message);
      setMsgs([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thread, me]);
  useEffect(() => {
    setMsgs(null);
    void load();
    const unsub = subscribeTeamMessages(() => void load());
    requestAnimationFrame(() => composer.current?.focus());
    return unsub;
  }, [load]);
  useEffect(() => {
    const el = feed.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs?.length]);

  const upload = async (ref: React.RefObject<MentionInputHandle | null>, picked: File[]) => {
    if (!picked.length) return;
    const temps = picked.map((f) => ({ tempId: Math.random().toString(36).slice(2), name: f.name }));
    ref.current?.insertUploads(temps);
    setBusy((b) => b + 1);
    try {
      for (let i = 0; i < picked.length; i++) {
        try {
          const df = await uploadOne(picked[i], { kind: "team_chat", thread }, (pct) => ref.current?.progress(temps[i].tempId, pct));
          setFiles((m) => new Map(m).set(df.id, df));
          ref.current?.resolveUpload(temps[i].tempId, df);
        } catch (e) {
          toastError(`Upload ${picked[i].name} gagal: ${(e as Error).message}`);
          ref.current?.resolveUpload(temps[i].tempId, null);
        }
      }
    } finally {
      setBusy((b) => b - 1);
    }
  };

  const send = async () => {
    const body = (composer.current?.serialize() ?? text).trim();
    if (!body || busy) return;
    setText("");
    composer.current?.reset();
    const temp: TeamMessage = { id: `tmp-${Date.now()}`, thread, author_email: me, body, read_at: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    setMsgs((l) => [...(l ?? []), temp]);
    try {
      await sendMessage(thread, body);
      await load();
    } catch (e) {
      toastError((e as Error).message);
      setMsgs((l) => (l ?? []).filter((m) => m.id !== temp.id));
      composer.current?.load(body);
    }
  };
  const startEdit = (m: TeamMessage) => {
    setEditing({ id: m.id, text: m.body });
    requestAnimationFrame(() => {
      editRef.current?.load(m.body);
      editRef.current?.focus();
    });
  };
  const saveEdit = async () => {
    if (!editing) return;
    const body = (editRef.current?.serialize() ?? editing.text).trim();
    if (!body) return;
    const id = editing.id;
    setEditing(null);
    setMsgs((l) => (l ?? []).map((m) => (m.id === id ? { ...m, body } : m)));
    try {
      await editMessage(id, body);
    } catch (err) {
      toastError((err as Error).message);
      void load();
    }
  };
  const openFile = (f: DriveFile) => window.open(driveContentUrl(f.id), "_blank", "noopener");
  const removeBlock = (ref: React.RefObject<MentionInputHandle | null>) => (id: string) => ref.current?.removeFile(id);

  return (
    <>
      <Header title={person.name} sub={person.role || other} avatar={<MemberAvatar member={person} size={26} />} onBack={onBack} onClose={onClose} />
      <Box ref={feed} sx={{ flex: 1, minHeight: 0, overflowY: "auto", bgcolor: "#F8FAFD", px: 1.25, py: 1.25, display: "flex", flexDirection: "column", gap: 1 }}>
        {msgs === null ? (
          <Typography sx={{ m: "auto", fontSize: "0.75rem", color: "#80868B" }}>Memuat…</Typography>
        ) : msgs.length === 0 ? (
          <Box sx={{ m: "auto", textAlign: "center", px: 2 }}>
            <Box sx={{ display: "flex", justifyContent: "center", mb: 1 }}>
              <MemberAvatar member={person} size={44} />
            </Box>
            <Typography sx={{ fontSize: "0.75rem", color: "#5F6368" }}>
              Belum ada chat dengan <b>{person.name}</b>. Sapa duluan di bawah.
            </Typography>
          </Box>
        ) : (
          msgs.map((m) => {
            const mine = m.author_email === me;
            const who = personFor(m.author_email, people);
            const isEditing = editing?.id === m.id;
            return (
              <Box key={m.id} sx={{ display: "flex", gap: 0.75, flexDirection: mine ? "row-reverse" : "row", "&:hover .tm-act": { opacity: 1 }, animation: "oc-rise 220ms cubic-bezier(0.22, 1, 0.36, 1) both" }}>
                <MemberAvatar member={who} size={22} />
                <Box sx={{ position: "relative", maxWidth: isEditing ? "calc(100% - 28px)" : "82%", minWidth: 0, display: "flex", flexDirection: "column", alignItems: mine ? "flex-end" : "flex-start" }}>
                  <Typography suppressHydrationWarning sx={{ fontSize: "0.625rem", color: "#80868B", mx: 0.5, mb: 0.25 }}>
                    <b style={{ fontWeight: 600, color: "#444746" }}>{who.name}</b> · {formatRelative(m.created_at)}
                    {m.updated_at !== m.created_at ? " · diedit" : ""}
                  </Typography>
                  {MENTION_RE.test(m.body) ? (
                    <MentionCard body={m.body} mine={mine} who={who.name} other={person.name} ctx={ctx} onOpen={openTask} />
                  ) : isEditing ? (
                    <Box sx={{ width: 240, maxWidth: "100%", border: "1px solid #0B57D0", boxShadow: "0 0 0 1px #0B57D0", borderRadius: "12px", bgcolor: "#fff", px: 1, pt: 0.25, pb: 0.5 }}>
                      <MentionInput
                        ref={editRef}
                        value={editing.text}
                        onChange={(v) => setEditing((e) => (e ? { ...e, text: v } : e))}
                        onSubmit={() => void saveEdit()}
                        ctx={ctx}
                        files={files}
                        onFiles={(l) => void upload(editRef, l)}
                        onRemoveFile={removeBlock(editRef)}
                        maxRows={10}
                        kinds={["task"]}
                        ariaLabel="Edit pesan"
                        inputSx={{ fontSize: "0.6875rem", lineHeight: 1.45 }}
                      />
                      <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 0.5 }}>
                        <Button size="small" onClick={() => setEditing(null)} sx={{ borderRadius: "9999px", color: "#444746", minWidth: 0, px: 1, fontSize: "0.6875rem" }}>
                          Batal
                        </Button>
                        <Button size="small" variant="contained" disableElevation onClick={() => void saveEdit()} sx={{ borderRadius: "9999px", minWidth: 0, px: 1.25, py: 0.25, fontSize: "0.6875rem" }}>
                          Simpan
                        </Button>
                      </Box>
                    </Box>
                  ) : (
                    <Box
                      sx={{
                        bgcolor: mine ? "#EAEFF5" : "#F4F6F9",
                        border: "1px solid #E1E6EC",
                        borderRadius: mine ? "12px 4px 12px 12px" : "4px 12px 12px 12px",
                        px: 1,
                        py: 0.625,
                        fontSize: "0.6875rem",
                        lineHeight: 1.45,
                        color: "#1F1F1F",
                        whiteSpace: "pre-wrap",
                        overflowWrap: "anywhere",
                        opacity: m.id.startsWith("tmp-") ? 0.6 : 1,
                        "& a": { color: "#0B57D0 !important" },
                      }}
                    >
                      <CommentBody text={m.body} ctx={ctx} onOpenTask={openTask} files={files} onOpenFile={openFile} />
                    </Box>
                  )}
                  {mine && !isEditing && !m.id.startsWith("tmp-") && !MENTION_RE.test(m.body) && (
                    <Box className="tm-act" sx={{ position: "absolute", top: "calc(50% + 8px)", transform: "translateY(-50%)", right: "100%", mr: 0.25, display: "flex", flexDirection: "row-reverse", opacity: { xs: 1, sm: 0 }, transition: "opacity 150ms" }}>
                      <Tooltip title="Edit">
                        <IconButton size="small" aria-label="Edit pesan" onClick={() => startEdit(m)} sx={{ p: 0.3, color: "#80868B", "&:hover": { color: "#0B57D0" } }}>
                          <EditRounded sx={{ fontSize: 13 }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Hapus">
                        <IconButton size="small" aria-label="Hapus pesan" onClick={() => setAsk(m)} sx={{ p: 0.3, color: "#80868B", "&:hover": { color: "#B3261E" } }}>
                          <DeleteRounded sx={{ fontSize: 13 }} />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  )}
                </Box>
              </Box>
            );
          })
        )}
      </Box>
      {/* Composer: the same as a task's Diskusi (formatting, @tag, files, "- " bullets) */}
      <Box sx={{ px: 1, py: 1, borderTop: "1px solid #EEF1F4", flexShrink: 0 }}>
        <DropZone onDrop={(l) => void upload(composer, l)}>
          <Box sx={{ border: "1px solid #DADCE0", borderRadius: "14px", bgcolor: "#fff", transition: "border-color 150ms, box-shadow 150ms", "&:focus-within": { borderColor: "#0B57D0", boxShadow: "0 0 0 1px #0B57D0" } }}>
            <Box sx={{ px: 1.25, pt: 0.25 }}>
              <MentionInput
                ref={composer}
                value={text}
                onChange={setText}
                onSubmit={() => void send()}
                ctx={ctx}
                files={files}
                onFiles={(l) => void upload(composer, l)}
                onRemoveFile={removeBlock(composer)}
                maxRows={6}
                ariaLabel={`Pesan ke ${person.name}`}
                placeholder={`Tulis pesan ke ${person.name}… ketik @ untuk tag task`}
                kinds={["task"]}
                inputSx={{ fontSize: "0.75rem", lineHeight: 1.45 }}
              />
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", px: 0.25, pb: 0.25, "& .MuiIconButton-root": { p: 0.625 }, "& .MuiSvgIcon-root": { fontSize: "17px !important" } }}>
              <AttachPicker variant="icon" accept="image/*" label="Lampirkan gambar" icon={<ImageRounded />} onPick={(l) => void upload(composer, l)} />
              <AttachPicker variant="icon" accept="video/*" label="Lampirkan video" icon={<VideocamRounded />} onPick={(l) => void upload(composer, l)} />
              <AttachPicker variant="icon" accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.ppt,.pptx,.txt" label="Lampirkan dokumen" icon={<DescriptionRounded />} onPick={(l) => void upload(composer, l)} />
              <AttachPicker variant="icon" label="Lampirkan file lain" icon={<AttachFileRounded />} onPick={(l) => void upload(composer, l)} />
              <Box sx={{ width: "1px", height: 16, bgcolor: "#E0E3E7", mx: 0.25 }} />
              <FormatBar target={composer} />
              <Box sx={{ flex: 1 }} />
              <IconButton aria-label="Kirim" onClick={() => void send()} disabled={!text.trim() || busy > 0} sx={{ bgcolor: text.trim() ? "#0B57D0" : "transparent", color: "#fff", width: 28, height: 28, mr: 0.25, "&:hover": { bgcolor: "#0842A0" }, "&.Mui-disabled": { color: "#C4C7C5", bgcolor: "transparent" } }}>
                <SendRounded sx={{ fontSize: "15px !important", ml: 0.25 }} />
              </IconButton>
            </Box>
          </Box>
        </DropZone>
      </Box>
      <ConfirmDialog
        open={!!ask}
        title="Hapus pesan?"
        body="Pesan ini akan dihapus untuk kalian berdua. Tindakan ini tidak bisa dibatalkan."
        confirmLabel="Hapus"
        zIndex={1400}
        onClose={() => setAsk(null)}
        onConfirm={async () => {
          const m = ask;
          setAsk(null);
          if (!m) return;
          setMsgs((l) => (l ?? []).filter((x) => x.id !== m.id));
          try {
            await deleteMessage(m.id);
            onChanged();
          } catch (e) {
            toastError((e as Error).message);
            void load();
          }
        }}
      />
    </>
  );
}

/** "Bagas menandai kamu di [task]": a tag from a task's Diskusi, shown in Chat Tim (migration 035). */
function MentionCard({ body, mine, who, other, ctx, onOpen }: { body: string; mine: boolean; who: string; other: string; ctx: TasksCtx; onOpen: (t: { id: string }) => void }) {
  const m = MENTION_RE.exec(body);
  const taskId = m?.[1] ?? "";
  const quote = body.slice(m?.[0].length ?? 0).trim();
  const t = (ctx.all as Task[]).find((x) => x.id === taskId);
  return (
    <Box sx={{ maxWidth: 250, bgcolor: "#F1F4F9", border: "1px solid #E3E8F2", borderRadius: "12px", px: 1, py: 0.75, fontSize: "0.6875rem", lineHeight: 1.45, color: "#1F1F1F" }}>
      <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 0.5 }}>
        <AlternateEmailRounded sx={{ fontSize: 13, color: "#D93025" }} />
        <b>{mine ? `Kamu menandai ${other}` : `${who} menandai kamu`}</b> di task
      </Box>
      <Box sx={{ mt: 0.5 }}>
        <Box component="button" type="button" onClick={() => onOpen({ id: taskId })} sx={{ display: "inline-flex", alignItems: "center", gap: 0.4, height: 18, px: 0.75, border: "none", borderRadius: "9999px", bgcolor: "#EEF4FE", color: "#0B57D0", fontFamily: "inherit", fontSize: "0.625rem", fontWeight: 600, cursor: "pointer", maxWidth: "100%", "&:hover": { bgcolor: "#D3E3FD" } }}>
          <AssignmentRounded sx={{ fontSize: 11 }} />
          <Box component="span" sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t?.title ?? "task"}</Box>
        </Box>
      </Box>
      {quote && <Box sx={{ color: "#5F6368", mt: 0.5, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>“{quote}”</Box>}
      <Box component="button" type="button" onClick={() => onOpen({ id: taskId })} sx={{ display: "inline-flex", alignItems: "center", gap: 0.4, mt: 0.75, px: 1, py: 0.4, border: "none", borderRadius: "9999px", bgcolor: "#fff", color: "#0B57D0", fontFamily: "inherit", fontSize: "0.625rem", fontWeight: 600, cursor: "pointer", "&:hover": { bgcolor: "#EEF4FE" } }}>
        <OpenInNewRounded sx={{ fontSize: 12 }} /> Buka task
      </Box>
    </Box>
  );
}
