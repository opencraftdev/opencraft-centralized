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
import { Linkify } from "@/components/ui/Linkify";
import { ConfirmDialog } from "@/features/drive/components/DriveDialogs";
import { formatRelative } from "@/features/drive/format";
import { personFor, useAccount, usePeople } from "@/features/accounts/account";
import { MemberAvatar } from "@/features/tasks/components/bits";
import type { Member } from "@/features/tasks/types";
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
  openProfile: (email: string, anchor: HTMLElement) => void;
}
const Ctx = createContext<TeamChatApi>({ openChat: () => {}, openProfile: () => {} });
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

  const unread = recent.filter((m) => m.author_email !== me && !m.read_at).length;
  const api = useMemo<TeamChatApi>(
    () => ({
      openChat: (email) => {
        setProfile(null);
        setWithEmail(email && email !== me ? email : null);
        setOpen(true);
      },
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
          onClick={() => api.openChat()}
          sx={{
            position: "fixed",
            right: 24,
            bottom: raised ? 116 : 24,
            zIndex: 1200,
            display: "inline-flex",
            alignItems: "center",
            gap: 1,
            height: 48,
            px: 2.25,
            border: "none",
            borderRadius: "9999px",
            bgcolor: "#0B57D0",
            color: "#fff",
            fontFamily: "inherit",
            fontSize: "0.9375rem",
            fontWeight: 500,
            cursor: "pointer",
            boxShadow: "0 6px 18px rgba(11,87,208,.35)",
            transition: "transform 150ms, box-shadow 150ms",
            "&:hover": { transform: "translateY(-1px)", boxShadow: "0 8px 22px rgba(11,87,208,.42)" },
            animation: "oc-pop-in 260ms cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        >
          <ForumRounded sx={{ fontSize: 20 }} />
          Chat Tim
          {unread > 0 && (
            <Box component="span" sx={{ minWidth: 20, height: 20, px: 0.5, borderRadius: "10px", bgcolor: "#D93025", color: "#fff", fontSize: "0.6875rem", fontWeight: 700, display: "grid", placeItems: "center" }}>
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
        width: { xs: "calc(100vw - 16px)", sm: 400 },
        height: "min(620px, calc(100dvh - 96px))",
        bgcolor: "#fff",
        borderRadius: "22px",
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
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 1.5, py: 1.25, borderBottom: "1px solid #EEF1F4", flexShrink: 0 }}>
      {onBack && (
        <IconButton size="small" onClick={onBack} aria-label="Kembali ke daftar">
          <ArrowBackRounded sx={{ fontSize: 20 }} />
        </IconButton>
      )}
      {avatar}
      <Box sx={{ flex: 1, minWidth: 0, pl: onBack ? 0 : 1 }}>
        <Typography noWrap sx={{ fontSize: "0.9375rem", fontWeight: 600 }}>
          {title}
        </Typography>
        {sub && (
          <Typography noWrap sx={{ fontSize: "0.6875rem", color: "#5F6368" }}>
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
      <Box sx={{ px: 1.5, pt: 1.25, pb: 0.5 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, height: 38, px: 1.5, borderRadius: "9999px", bgcolor: "#F1F4F9" }}>
          <SearchRounded sx={{ fontSize: 18, color: "#5F6368" }} />
          <InputBase value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari orang…" sx={{ flex: 1, fontSize: "0.8125rem" }} inputProps={{ "aria-label": "Cari orang" }} />
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
            sx={{ display: "flex", alignItems: "center", gap: 1.25, width: "100%", px: 2, py: 1, border: "none", bgcolor: "transparent", fontFamily: "inherit", textAlign: "left", cursor: "pointer", "&:hover": { bgcolor: "#F6F8FB" } }}
          >
            <MemberAvatar member={p} size={38} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Box sx={{ display: "flex", alignItems: "baseline", gap: 1 }}>
                <Typography noWrap sx={{ flex: 1, minWidth: 0, fontSize: "0.875rem", fontWeight: unread ? 700 : 600 }}>
                  {p.name}
                </Typography>
                {last && (
                  <Typography suppressHydrationWarning sx={{ fontSize: "0.6875rem", color: unread ? "#0B57D0" : "#80868B", flexShrink: 0 }}>
                    {formatRelative(last.created_at)}
                  </Typography>
                )}
              </Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Typography noWrap sx={{ flex: 1, minWidth: 0, fontSize: "0.75rem", color: unread ? "#1F1F1F" : "#5F6368", fontWeight: unread ? 500 : 400 }}>
                  {last ? `${last.author_email === me ? "Kamu: " : ""}${last.body.replace(/\s+/g, " ")}` : p.role || "Mulai chat"}
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

function Thread({ me, other, people, onBack, onClose, onChanged }: { me: string; other: string; people: Member[]; onBack: () => void; onClose: () => void; onChanged: () => void }) {
  const thread = threadOf(me, other);
  const person = personFor(other, people);
  const [msgs, setMsgs] = useState<TeamMessage[] | null>(null);
  const [text, setText] = useState("");
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const [ask, setAsk] = useState<TeamMessage | null>(null);
  const feed = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);

  const load = useCallback(async () => {
    try {
      setMsgs(await listThread(thread));
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
    requestAnimationFrame(() => input.current?.focus());
    return unsub;
  }, [load]);
  useEffect(() => {
    const el = feed.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs?.length]);

  const send = async () => {
    const body = text.trim();
    if (!body) return;
    setText("");
    const temp: TeamMessage = { id: `tmp-${Date.now()}`, thread, author_email: me, body, read_at: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    setMsgs((l) => [...(l ?? []), temp]);
    try {
      await sendMessage(thread, body);
      await load();
    } catch (e) {
      toastError((e as Error).message);
      setMsgs((l) => (l ?? []).filter((m) => m.id !== temp.id));
      setText(body);
    }
  };
  const saveEdit = async () => {
    if (!editing || !editing.text.trim()) return;
    const e = editing;
    setEditing(null);
    setMsgs((l) => (l ?? []).map((m) => (m.id === e.id ? { ...m, body: e.text.trim() } : m)));
    try {
      await editMessage(e.id, e.text.trim());
    } catch (err) {
      toastError((err as Error).message);
      void load();
    }
  };

  return (
    <>
      <Header title={person.name} sub={person.role || other} avatar={<MemberAvatar member={person} size={32} />} onBack={onBack} onClose={onClose} />
      <Box ref={feed} sx={{ flex: 1, minHeight: 0, overflowY: "auto", bgcolor: "#F8FAFD", px: 1.75, py: 1.5, display: "flex", flexDirection: "column", gap: 1.25 }}>
        {msgs === null ? (
          <Typography sx={{ m: "auto", fontSize: "0.8125rem", color: "#80868B" }}>Memuat…</Typography>
        ) : msgs.length === 0 ? (
          <Box sx={{ m: "auto", textAlign: "center", px: 2 }}>
            <Box sx={{ display: "flex", justifyContent: "center", mb: 1 }}>
              <MemberAvatar member={person} size={56} />
            </Box>
            <Typography sx={{ fontSize: "0.8125rem", color: "#5F6368" }}>
              Belum ada chat dengan <b>{person.name}</b>. Sapa duluan di bawah.
            </Typography>
          </Box>
        ) : (
          msgs.map((m) => {
            const mine = m.author_email === me;
            const who = personFor(m.author_email, people);
            return (
              <Box key={m.id} sx={{ display: "flex", gap: 1, flexDirection: mine ? "row-reverse" : "row", "&:hover .tm-act": { opacity: 1 }, animation: "oc-rise 220ms cubic-bezier(0.22, 1, 0.36, 1) both" }}>
                <MemberAvatar member={who} size={26} />
                <Box sx={{ position: "relative", maxWidth: editing?.id === m.id ? "calc(100% - 34px)" : "80%", minWidth: 0, display: "flex", flexDirection: "column", alignItems: mine ? "flex-end" : "flex-start" }}>
                  <Typography suppressHydrationWarning sx={{ fontSize: "0.6875rem", color: "#80868B", mx: 0.5, mb: 0.25 }}>
                    <b style={{ fontWeight: 600, color: "#444746" }}>{who.name}</b> · {formatRelative(m.created_at)}
                    {m.updated_at > m.created_at && m.updated_at !== m.created_at ? " · diedit" : ""}
                  </Typography>
                  {editing?.id === m.id ? (
                    <Box sx={{ width: 300, maxWidth: "100%", border: "1px solid #0B57D0", boxShadow: "0 0 0 1px #0B57D0", borderRadius: "14px", bgcolor: "#fff", px: 1.25, pt: 0.5, pb: 0.75 }}>
                      <InputBase
                        multiline
                        autoFocus
                        maxRows={10}
                        fullWidth
                        value={editing.text}
                        onChange={(e) => setEditing({ ...editing, text: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                            e.preventDefault();
                            void saveEdit();
                          }
                          if (e.key === "Escape") setEditing(null);
                        }}
                        sx={{ fontSize: "0.75rem", lineHeight: 1.45 }}
                      />
                      <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 0.5, mt: 0.5 }}>
                        <Button size="small" onClick={() => setEditing(null)} sx={{ borderRadius: "9999px", color: "#444746", minWidth: 0, px: 1.25, fontSize: "0.75rem" }}>
                          Batal
                        </Button>
                        <Button size="small" variant="contained" disableElevation onClick={() => void saveEdit()} sx={{ borderRadius: "9999px", minWidth: 0, px: 1.5, fontSize: "0.75rem" }}>
                          Simpan
                        </Button>
                      </Box>
                    </Box>
                  ) : (
                    <Box
                      sx={{
                        bgcolor: mine ? "#EAEFF5" : "#F4F6F9",
                        border: "1px solid #E1E6EC",
                        borderRadius: mine ? "14px 4px 14px 14px" : "4px 14px 14px 14px",
                        px: 1.25,
                        py: 0.75,
                        fontSize: "0.75rem",
                        lineHeight: 1.45,
                        color: "#1F1F1F",
                        whiteSpace: "pre-wrap",
                        overflowWrap: "anywhere",
                        opacity: m.id.startsWith("tmp-") ? 0.6 : 1,
                        "& a": { color: "#0B57D0 !important" },
                      }}
                    >
                      <Linkify text={m.body} />
                    </Box>
                  )}
                  {mine && editing?.id !== m.id && !m.id.startsWith("tmp-") && (
                    <Box className="tm-act" sx={{ position: "absolute", top: "50%", transform: "translateY(-50%)", right: "100%", mr: 0.5, display: "flex", flexDirection: "row-reverse", gap: 0.25, opacity: { xs: 1, sm: 0 }, transition: "opacity 150ms" }}>
                      <Tooltip title="Edit">
                        <IconButton size="small" aria-label="Edit pesan" onClick={() => setEditing({ id: m.id, text: m.body })} sx={{ p: 0.4, color: "#80868B", "&:hover": { color: "#0B57D0" } }}>
                          <EditRounded sx={{ fontSize: 15 }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Hapus">
                        <IconButton size="small" aria-label="Hapus pesan" onClick={() => setAsk(m)} sx={{ p: 0.4, color: "#80868B", "&:hover": { color: "#B3261E" } }}>
                          <DeleteRounded sx={{ fontSize: 15 }} />
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
      <Box sx={{ px: 1.5, py: 1.25, borderTop: "1px solid #EEF1F4", flexShrink: 0 }}>
        <Box sx={{ display: "flex", alignItems: "flex-end", gap: 1, border: "1px solid #DADCE0", borderRadius: "16px", bgcolor: "#fff", pl: 1.5, pr: 0.75, py: 0.5, transition: "border-color 150ms, box-shadow 150ms", "&:focus-within": { borderColor: "#0B57D0", boxShadow: "0 0 0 1px #0B57D0" } }}>
          <InputBase
            inputRef={input}
            multiline
            maxRows={6}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                void send();
              }
            }}
            placeholder={`Tulis pesan ke ${person.name}…`}
            sx={{ flex: 1, fontSize: "0.8125rem", py: 0.75 }}
            inputProps={{ "aria-label": `Pesan ke ${person.name}` }}
          />
          <IconButton aria-label="Kirim" onClick={() => void send()} disabled={!text.trim()} sx={{ mb: 0.25, bgcolor: text.trim() ? "#0B57D0" : "transparent", color: text.trim() ? "#fff" : "#9AA0A6", width: 34, height: 34, "&:hover": { bgcolor: "#0842A0" }, "&.Mui-disabled": { color: "#C4C7C5" } }}>
            <SendRounded sx={{ fontSize: 17, ml: 0.25 }} />
          </IconButton>
        </Box>
        <Typography sx={{ fontSize: "0.625rem", color: "#9AA0A6", mt: 0.5, px: 0.5 }}>Enter kirim · Shift+Enter baris baru</Typography>
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
