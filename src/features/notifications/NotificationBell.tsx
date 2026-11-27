"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { keyframes } from "@mui/material/styles";
import NotificationsRounded from "@mui/icons-material/NotificationsRounded";
import CloseRounded from "@mui/icons-material/CloseRounded";
import InputBase from "@mui/material/InputBase";
import SendRounded from "@mui/icons-material/SendRounded";
import { formatRelative } from "@/features/drive/format";
import { driveContentUrl } from "@/lib/drive/links";
import { toastError, toastSuccess } from "@/components/ui/Toast";
import { addComment, updateTask } from "@/features/tasks/api";
import {
  AREA_LABEL,
  addReadId,
  getLastRead,
  getReadIds,
  listNotifications,
  notifIcon,
  setLastRead,
  subscribeNotifications,
  type AppNotification,
  type NotifArea,
} from "./api";

// Bell in the top bar (option 2: the badge pulses while something is unread; the list opens as a sheet from the
// right; new items flash blue for a moment). docs/NOTIFICATIONS.md.

const halo = keyframes`
  0% { box-shadow: 0 0 0 0 rgba(217,48,37,.55); }
  70% { box-shadow: 0 0 0 9px rgba(217,48,37,0); }
  100% { box-shadow: 0 0 0 0 rgba(217,48,37,0); }
`;
const pop = keyframes`
  0% { transform: scale(0); } 60% { transform: scale(1.3); } 100% { transform: scale(1); }
`;
const flash = keyframes`
  from { background-color: #E8F0FE; } to { background-color: transparent; }
`;
const rise = keyframes`
  from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; }
`;

type Filter = "all" | NotifArea;
const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "Semua" },
  { key: "tasks", label: "Task" },
  { key: "finance", label: "Finance" },
  { key: "scrapers", label: "Scrapers" },
  { key: "documents", label: "Document" },
];

export function NotificationBell() {
  const router = useRouter();
  const [items, setItems] = useState<AppNotification[] | null>(null);
  const [lastRead, setLastReadState] = useState<string>(() => new Date().toISOString());
  const [open, setOpen] = useState(false);
  const [seenAtOpen, setSeenAtOpen] = useState<string>(""); // what counted as "new" when the sheet opened
  const [filter, setFilter] = useState<Filter>("all");
  const [now, setNow] = useState(() => Date.now());
  const [bump, setBump] = useState(0); // replays the badge pop when the count goes up
  const prevUnread = useRef(0);
  const [expanded, setExpanded] = useState<string | null>(null); // item showing its quick actions
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [readIds, setReadIds] = useState<Set<string>>(() => new Set());

  const refresh = useCallback(async () => {
    setItems(await listNotifications());
    setNow(Date.now());
  }, []);

  useEffect(() => {
    setLastReadState(getLastRead());
    setReadIds(getReadIds());
    void refresh();
    let t: ReturnType<typeof setTimeout> | null = null;
    const unsub = subscribeNotifications(() => {
      if (t) clearTimeout(t);
      t = setTimeout(() => void refresh(), 300);
    });
    const poll = setInterval(() => void refresh(), 60_000);
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      unsub();
      clearInterval(poll);
      window.removeEventListener("focus", onFocus);
      if (t) clearTimeout(t);
    };
  }, [refresh]);

  const unread = useMemo(() => (items ?? []).filter((n) => n.updated_at > lastRead).length, [items, lastRead]);
  useEffect(() => {
    if (unread > prevUnread.current) setBump((b) => b + 1);
    prevUnread.current = unread;
  }, [unread]);

  const openSheet = () => {
    setSeenAtOpen(lastRead);
    setOpen(true);
    const stamp = new Date().toISOString();
    setLastRead(stamp);
    setLastReadState(stamp);
    void refresh();
  };

  const go = (n: AppNotification) => {
    setOpen(false);
    if (n.link) router.push(n.link);
  };
  const markRead = (n: AppNotification) => {
    setReadIds(addReadId(n.id));
    setExpanded(null);
  };
  const sendReply = async (n: AppNotification) => {
    const text = reply.trim();
    if (!text || !n.ref_id) return;
    try {
      await addComment(n.ref_id, text);
      setReply("");
      setReplyTo(null);
      markRead(n);
      toastSuccess("Balasan terkirim.");
    } catch (e) {
      toastError((e as Error).message);
    }
  };
  const finishTask = async (n: AppNotification) => {
    if (!n.ref_id) return;
    try {
      await updateTask(n.ref_id, { status: "done" });
      markRead(n);
      toastSuccess("Tugas ditandai selesai.");
    } catch (e) {
      toastError((e as Error).message);
    }
  };

  /** Quick actions per kind (option 5): act right in the sheet, or open the page. */
  const actions = (n: AppNotification): { label: string; primary?: boolean; run: () => void }[] => {
    const open = { label: "Buka", run: () => go(n) };
    const read = { label: "Tandai dibaca", run: () => markRead(n) };
    switch (n.kind) {
      case "task_comment":
        return [{ label: "Balas", primary: true, run: () => { setReplyTo(n.id); setReply(""); } }, read, open];
      case "task_assigned":
      case "task_created":
      case "task_updated":
        return [{ label: "Buka tugas", primary: true, run: () => go(n) }, { label: "Tandai selesai", run: () => void finishTask(n) }, read];
      case "task_status":
      case "task_attachment":
        return [{ label: "Buka tugas", primary: true, run: () => go(n) }, read];
      case "lead_new":
        return [{ label: n.count > 1 ? `Lihat ${n.count} lead` : "Lihat lead", primary: true, run: () => go(n) }, read];
      case "expense_new":
      case "expense_updated":
        return [{ label: "Lihat di Finance", primary: true, run: () => go(n) }, { label: "Oke", run: () => markRead(n) }];
      case "doc_new":
      case "doc_ready":
        return [
          { label: "Unduh", primary: true, run: () => { if (n.ref_id) window.open(driveContentUrl(n.ref_id, true), "_blank", "noopener"); markRead(n); } },
          open,
        ];
      default:
        return [{ label: "Oke", primary: true, run: () => markRead(n) }];
    }
  };

  if (items === null) return null; // not set up yet (migration 028) or offline

  const shown = items.filter((n) => filter === "all" || n.area === filter);

  return (
    <>
      <Tooltip title="Notifikasi" open={open ? false : undefined} disableInteractive>
        <IconButton aria-label={unread ? `Notifikasi, ${unread} belum dibaca` : "Notifikasi"} onClick={openSheet} sx={{ position: "relative", width: 44, height: 44, color: "#444746" }}>
          <NotificationsRounded sx={{ fontSize: 24 }} />
          {unread > 0 && (
            <Box
              key={bump}
              component="span"
              sx={{
                position: "absolute",
                top: 5,
                right: 3,
                minWidth: 18,
                height: 18,
                px: "4px",
                borderRadius: "9px",
                bgcolor: "#D93025",
                color: "#fff",
                fontSize: "0.625rem",
                fontWeight: 700,
                lineHeight: "14px",
                textAlign: "center",
                border: "2px solid #F0F4F9",
                boxSizing: "border-box",
                fontVariantNumeric: "tabular-nums",
                animation: `${pop} 450ms cubic-bezier(0.34,1.56,0.64,1), ${halo} 1.8s ease-out 450ms infinite`,
              }}
            >
              {unread > 9 ? "9+" : unread}
            </Box>
          )}
        </IconButton>
      </Tooltip>

      <Drawer
        anchor="right"
        open={open}
        onClose={() => setOpen(false)}
        slotProps={{
          paper: { sx: { width: { xs: "100%", sm: 400 }, borderRadius: { xs: 0, sm: "18px 0 0 18px" }, bgcolor: "#fff" } },
          backdrop: { sx: { bgcolor: "rgba(32,33,36,.18)" } },
        }}
        transitionDuration={{ enter: 360, exit: 240 }}
        sx={{ zIndex: (t) => t.zIndex.modal + 2 }}
      >
        <Box sx={{ display: "flex", alignItems: "center", px: 2.5, pt: 2, pb: 1 }}>
          <Typography component="h2" sx={{ fontSize: "1.25rem", flex: 1 }}>
            Notifikasi
          </Typography>
          <IconButton aria-label="Tutup" onClick={() => setOpen(false)}>
            <CloseRounded />
          </IconButton>
        </Box>
        <Box sx={{ display: "flex", gap: 0.75, px: 2.5, pb: 1.5, overflowX: "auto", scrollbarWidth: "none" }}>
          {FILTERS.map((f) => {
            const on = f.key === filter;
            return (
              <Box
                key={f.key}
                component="button"
                type="button"
                onClick={() => setFilter(f.key)}
                aria-pressed={on}
                sx={{ border: "1px solid", borderColor: on ? "#0B57D0" : "#C4C7C5", bgcolor: on ? "#D3E3FD" : "transparent", color: on ? "#0B57D0" : "#444746", borderRadius: "9999px", px: 1.5, height: 30, fontSize: "0.8125rem", fontWeight: on ? 600 : 500, fontFamily: "inherit", cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}
              >
                {f.label}
              </Box>
            );
          })}
        </Box>
        <Box sx={{ flex: 1, overflowY: "auto", borderTop: "1px solid #EEF1F4" }}>
          {shown.length === 0 ? (
            <Typography sx={{ color: "#5F6368", fontSize: "0.875rem", textAlign: "center", py: 6, px: 3 }}>
              Belum ada notifikasi. Update dari Task Management, Finance, Scrapers, dan Document akan muncul di sini.
            </Typography>
          ) : (
            shown.map((n, i) => {
              const isNew = !!seenAtOpen && n.updated_at > seenAtOpen && !readIds.has(n.id);
              const ic = notifIcon(n);
              return (
                <Box
                  key={n.id}
                  role="button"
                  tabIndex={0}
                  aria-expanded={expanded === n.id}
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest("[data-qa]")) return;
                    setExpanded((x) => (x === n.id ? null : n.id));
                    setReplyTo(null);
                  }}
                  onKeyDown={(e) => {
                    if ((e.key === "Enter" || e.key === " ") && e.target === e.currentTarget) {
                      e.preventDefault();
                      setExpanded((x) => (x === n.id ? null : n.id));
                    }
                  }}
                  sx={{
                    position: "relative",
                    display: "flex",
                    gap: 1.5,
                    alignItems: "flex-start",
                    width: "100%",
                    textAlign: "left",
                    border: "none",
                    borderBottom: "1px solid #F1F3F4",
                    bgcolor: "transparent",
                    px: 2.5,
                    py: 1.5,
                    cursor: "pointer",
                    "&:focus-visible": { outline: "2px solid #0B57D0", outlineOffset: -2 },
                    fontFamily: "inherit",
                    animation: `${rise} 320ms cubic-bezier(0.22,1,0.36,1) ${Math.min(i, 10) * 30}ms both${isNew ? `, ${flash} 2.4s ease-out 300ms both` : ""}`,
                    "&:hover": { bgcolor: "#F8FAFD" },
                  }}
                >
                  {isNew && <Box component="span" sx={{ position: "absolute", left: 10, top: 26, width: 6, height: 6, borderRadius: "50%", bgcolor: "#0B57D0" }} />}
                  <Box component="span" sx={{ width: 36, height: 36, borderRadius: "11px", bgcolor: ic.tint, display: "grid", placeItems: "center", flexShrink: 0, fontSize: 18, fontFamily: '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif' }}>
                    {ic.emoji}
                  </Box>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography sx={{ fontSize: "0.875rem", color: "#1F1F1F", fontWeight: isNew ? 600 : 400, lineHeight: 1.35, overflowWrap: "anywhere" }}>{n.title}</Typography>
                    {n.body && (
                      <Typography sx={{ fontSize: "0.8125rem", color: "#444746", mt: 0.25, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", overflowWrap: "anywhere" }}>{n.body}</Typography>
                    )}
                    <Typography suppressHydrationWarning sx={{ fontSize: "0.75rem", color: "#5F6368", mt: 0.25 }}>
                      {AREA_LABEL[n.area]} · {formatRelative(n.updated_at, now)}
                    </Typography>
                    {expanded === n.id && (
                      <Box data-qa sx={{ mt: 1, animation: `${rise} 240ms cubic-bezier(0.22,1,0.36,1) both`, cursor: "default" }}>
                        {replyTo === n.id ? (
                          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, border: "1px solid #C4C7C5", borderRadius: "9999px", pl: 1.5, pr: 0.5 }}>
                            <InputBase
                              autoFocus
                              fullWidth
                              value={reply}
                              onChange={(e) => setReply(e.target.value)}
                              onKeyDown={(e) => {
                                e.stopPropagation();
                                if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                                  e.preventDefault();
                                  void sendReply(n);
                                }
                                if (e.key === "Escape") setReplyTo(null);
                              }}
                              placeholder="Tulis balasan…"
                              sx={{ fontSize: "0.8125rem", py: 0.5 }}
                              inputProps={{ "aria-label": "Balas komentar" }}
                            />
                            <IconButton size="small" aria-label="Kirim balasan" disabled={!reply.trim()} onClick={() => void sendReply(n)} sx={{ color: "#0B57D0" }}>
                              <SendRounded sx={{ fontSize: 18 }} />
                            </IconButton>
                          </Box>
                        ) : (
                          <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap" }}>
                            {actions(n).map((a) => (
                              <Box
                                key={a.label}
                                component="button"
                                type="button"
                                onClick={a.run}
                                sx={{
                                  border: a.primary ? "none" : "1px solid #C4C7C5",
                                  bgcolor: a.primary ? "#0B57D0" : "#fff",
                                  color: a.primary ? "#fff" : "#444746",
                                  borderRadius: "9999px",
                                  px: 1.5,
                                  height: 30,
                                  fontSize: "0.8125rem",
                                  fontWeight: 600,
                                  fontFamily: "inherit",
                                  cursor: "pointer",
                                  transition: "transform 160ms cubic-bezier(0.22,1,0.36,1), background-color 150ms",
                                  "&:hover": { bgcolor: a.primary ? "#0A4DBA" : "#F0F4F9" },
                                  "&:active": { transform: "scale(0.97)" },
                                }}
                              >
                                {a.label}
                              </Box>
                            ))}
                          </Box>
                        )}
                      </Box>
                    )}
                  </Box>
                </Box>
              );
            })
          )}
        </Box>
        <Box sx={{ px: 2.5, py: 1.25, borderTop: "1px solid #EEF1F4", display: "flex", justifyContent: "flex-end" }}>
          <Button size="small" onClick={() => setOpen(false)} sx={{ borderRadius: "9999px" }}>
            Tutup
          </Button>
        </Box>
      </Drawer>
    </>
  );
}
