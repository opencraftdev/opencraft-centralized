"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Popover from "@mui/material/Popover";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { keyframes } from "@mui/material/styles";
import NotificationsRounded from "@mui/icons-material/NotificationsRounded";
import AddRounded from "@mui/icons-material/AddRounded";
import EditRounded from "@mui/icons-material/EditRounded";
import ChatBubbleRounded from "@mui/icons-material/ChatBubbleRounded";
import DeleteRounded from "@mui/icons-material/DeleteRounded";
import CheckRounded from "@mui/icons-material/CheckRounded";
import SyncRounded from "@mui/icons-material/SyncRounded";
import PersonRounded from "@mui/icons-material/PersonRounded";
import AttachFileRounded from "@mui/icons-material/AttachFileRounded";
import PaymentsRounded from "@mui/icons-material/PaymentsRounded";
import TravelExploreRounded from "@mui/icons-material/TravelExploreRounded";
import DescriptionRounded from "@mui/icons-material/DescriptionRounded";
import SmartToyRounded from "@mui/icons-material/SmartToyRounded";
import AlternateEmailRounded from "@mui/icons-material/AlternateEmailRounded";
import { formatRelative } from "@/features/drive/format";
import { personFor, useAccount, usePeople } from "@/features/accounts/account";
import { MemberAvatar } from "@/features/tasks/components/bits";
import { ConfirmDialog } from "@/features/drive/components/DriveDialogs";
import type { Member } from "@/features/tasks/types";
import {
  AREA_LABEL,
  addReadId,
  getClearedAt,
  getLastRead,
  getReadIds,
  listNotifications,
  setClearedAt,
  setLastRead,
  subscribeNotifications,
  type AppNotification,
} from "./api";

// Bell in the top bar. Clicking it opens a small card under the bell (not a side sheet): each line is personal,
// "Raka memperbarui tugas SMM OCRAFT", with the person's photo and a small badge for the kind of change.
// Tabs Semua / Belum dibaca; "Tandai semua dibaca"; "Hapus semua" hides the list so far (per browser).
// docs/NOTIFICATIONS.md.

const halo = keyframes`
  0% { box-shadow: 0 0 0 0 rgba(217,48,37,.55); }
  70% { box-shadow: 0 0 0 9px rgba(217,48,37,0); }
  100% { box-shadow: 0 0 0 0 rgba(217,48,37,0); }
`;
const pop = keyframes`
  0% { transform: scale(0); } 60% { transform: scale(1.3); } 100% { transform: scale(1); }
`;

const PAGE = 20;
const STATUS_WORD: Record<string, string> = { selesai: "Done", "sedang dikerjakan": "Progress", "masuk review": "Review", "belum mulai": "To do" };

/** "Raka" + "memperbarui tugas" + "SMM OCRAFT" + a sub line, from the trigger's title/body (migration 028). */
function describe(n: AppNotification): { verb: string; obj: string; sub: string } {
  const t = n.title;
  const body = n.body.replace(/^\[\[reply:[0-9a-f-]+\]\]\s*/, "");
  const after = (prefix: string) => (t.startsWith(prefix) ? t.slice(prefix.length) : null);
  const quoted = (s: string) => /"(.*)"/.exec(s)?.[1] ?? s;
  let m: RegExpExecArray | null;
  switch (n.kind) {
    case "task_created":
      if ((m = /^Checklist baru di "(.*)": (.*)$/.exec(t))) return { verb: "menambah checklist", obj: m[2], sub: `di ${m[1]}` };
      return { verb: "membuat tugas", obj: after("Tugas baru: ") ?? t, sub: body };
    case "task_deleted":
      return { verb: "menghapus tugas", obj: after("Tugas dihapus: ") ?? t, sub: body };
    case "task_status":
      if ((m = /^"(.*)" (.*)$/.exec(t))) {
        if (m[2] === "selesai") return { verb: "menyelesaikan", obj: m[1], sub: body };
        return { verb: "memindahkan", obj: m[1], sub: `ke ${STATUS_WORD[m[2]] ?? m[2]}${body ? ` · ${body}` : ""}` };
      }
      break;
    case "task_assigned":
      if ((m = /^(.*) jadi PIC "(.*)"$/.exec(t))) return { verb: `menunjuk ${m[1]} sebagai PIC`, obj: m[2], sub: body };
      break;
    case "task_updated":
      return { verb: "memperbarui tugas", obj: after("Tugas diperbarui: ") ?? t, sub: body };
    case "task_comment":
      return { verb: "berkomentar di", obj: quoted(t), sub: body ? `“${body}”` : "" };
    case "task_attachment":
      return { verb: "melampirkan file di", obj: quoted(t), sub: body };
    case "expense_new":
      return { verb: "menambah biaya", obj: after("Biaya baru: ") ?? t, sub: body };
    case "expense_updated":
      return t.startsWith("Biaya dihentikan: ") ? { verb: "menghentikan biaya", obj: t.slice(18), sub: body } : { verb: "memperbarui biaya", obj: after("Biaya diperbarui: ") ?? t, sub: body };
    case "doc_new":
      return { verb: "mengunggah dokumen", obj: after("Dokumen baru: ") ?? t, sub: body };
    case "doc_ready":
      return { verb: "selesai membuat dokumen", obj: after("Dokumen selesai dibuat: ") ?? t, sub: body };
    case "lead_new":
      return { verb: "menemukan", obj: n.count > 1 ? `${n.count} lead baru` : "1 lead baru", sub: body };
  }
  return { verb: "", obj: t, sub: body };
}

/** Small badge on the photo: what kind of change. */
function kindBadge(n: AppNotification): { Icon: typeof AddRounded; bg: string } {
  switch (n.kind) {
    case "task_created":
      return { Icon: AddRounded, bg: "#0B57D0" };
    case "task_updated":
      return { Icon: EditRounded, bg: "#B06000" };
    case "task_comment":
      return { Icon: ChatBubbleRounded, bg: "#0B57D0" };
    case "task_deleted":
      return { Icon: DeleteRounded, bg: "#B3261E" };
    case "task_status":
      return n.title.endsWith("selesai") ? { Icon: CheckRounded, bg: "#146C2E" } : { Icon: SyncRounded, bg: "#5F6368" };
    case "task_assigned":
      return { Icon: PersonRounded, bg: "#7B1FA2" };
    case "task_attachment":
      return { Icon: AttachFileRounded, bg: "#5F6368" };
    case "expense_new":
    case "expense_updated":
      return { Icon: PaymentsRounded, bg: "#7B1FA2" };
    case "lead_new":
      return { Icon: TravelExploreRounded, bg: "#00838F" };
    default:
      return { Icon: DescriptionRounded, bg: "#1A73E8" };
  }
}

/** Who did it: the person, or the app itself (scrapers, document agent) when there is no actor. */
function actorOf(n: AppNotification, people: Member[]): { name: string; member: Member | null } {
  if (n.actor) {
    const m = personFor(n.actor, people);
    return { name: m.name, member: m };
  }
  if (n.area === "scrapers") return { name: "Scrapers", member: null };
  if (n.area === "documents") return { name: "Agen dokumen", member: null };
  return { name: "Sistem", member: null };
}

/** The comment text with "@MyName" highlighted. */
function highlightMe(text: string, name: string): React.ReactNode {
  if (!name) return text;
  const parts = text.split(new RegExp(`(@${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "i"));
  return parts.map((p, i) =>
    i % 2 ? (
      <Box key={i} component="span" sx={{ px: 0.5, borderRadius: "4px", bgcolor: "#EBD5F5", color: "#6A1B9A", fontWeight: 600 }}>
        {p}
      </Box>
    ) : (
      p
    ),
  );
}

export function NotificationBell() {
  const router = useRouter();
  const people = usePeople();
  const { email: myEmail, me } = useAccount();
  const [items, setItems] = useState<AppNotification[] | null>(null);
  const [lastRead, setLastReadState] = useState<string>(() => new Date().toISOString());
  const [clearedAt, setClearedState] = useState<string>(() => new Date(0).toISOString());
  const [readIds, setReadIds] = useState<Set<string>>(() => new Set());
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [tab, setTab] = useState<"all" | "unread" | "mention">("all");
  const [limit, setLimit] = useState(PAGE);
  const [confirmClear, setConfirmClear] = useState(false);
  const [bump, setBump] = useState(0);
  const prevUnread = useRef(0);

  const refresh = useCallback(async () => {
    setItems(await listNotifications(60));
  }, []);

  useEffect(() => {
    setLastReadState(getLastRead());
    setClearedState(getClearedAt());
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

  const visible = useMemo(() => (items ?? []).filter((n) => n.updated_at > clearedAt), [items, clearedAt]);
  const isUnread = useCallback((n: AppNotification) => n.updated_at > lastRead && !readIds.has(n.id), [lastRead, readIds]);
  // "@Raka" in a comment (the trigger turns mention tokens into "@Name") when I am Raka, written by someone else.
  const mentionsMe = useCallback(
    (n: AppNotification) => {
      const name = me?.name?.trim();
      if (!name || n.kind !== "task_comment" || (n.actor && n.actor === myEmail)) return false;
      const esc = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return new RegExp(`@${esc}(?![\\p{L}\\p{N}])`, "iu").test(n.body);
    },
    [me?.name, myEmail],
  );
  const mentionCount = useMemo(() => visible.filter((n) => mentionsMe(n) && isUnread(n)).length, [visible, mentionsMe, isUnread]);
  const unread = useMemo(() => visible.filter(isUnread).length, [visible, isUnread]);
  useEffect(() => {
    if (unread > prevUnread.current) setBump((b) => b + 1);
    prevUnread.current = unread;
  }, [unread]);

  if (items === null) return null; // not set up yet (migration 028) or offline

  const shown = visible.filter((n) => (tab === "all" ? true : tab === "unread" ? isUnread(n) : mentionsMe(n)));
  const markAll = () => {
    const stamp = new Date().toISOString();
    setLastRead(stamp);
    setLastReadState(stamp);
  };
  const go = (n: AppNotification) => {
    setReadIds(addReadId(n.id));
    setAnchor(null);
    if (n.link) router.push(n.link);
  };

  return (
    <>
      <Tooltip title={anchor ? "" : "Notifikasi"} disableInteractive>
        <IconButton
          aria-label={unread ? `Notifikasi, ${unread} belum dibaca` : "Notifikasi"}
          aria-haspopup="dialog"
          onClick={(e) => {
            setAnchor(anchor ? null : e.currentTarget);
            setLimit(PAGE);
            void refresh();
          }}
          sx={{ position: "relative", width: 44, height: 44, color: "#444746", bgcolor: anchor ? "#E3EAF5" : "transparent" }}
        >
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

      <Popover
        open={Boolean(anchor)}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{
          paper: {
            sx: {
              mt: 1.25,
              width: "min(400px, calc(100vw - 16px))",
              borderRadius: "18px",
              overflow: "visible",
              boxShadow: "0 10px 36px rgba(60,64,67,.24), 0 2px 6px rgba(60,64,67,.12)",
              animation: "oc-pop-in 220ms cubic-bezier(0.22, 1, 0.36, 1)",
              // little tail pointing at the bell
              "&::before": { content: '""', position: "absolute", top: -6, right: 16, width: 14, height: 14, bgcolor: "#fff", transform: "rotate(45deg)", borderRadius: "3px 0 0 0" },
            },
          },
        }}
      >
        <Box sx={{ position: "relative", borderRadius: "18px", overflow: "hidden", bgcolor: "#fff", display: "flex", flexDirection: "column", maxHeight: "min(620px, calc(100vh - 90px))" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, pl: 2, pr: 1, pt: 1.5, pb: 0.75 }}>
            <Typography sx={{ flex: 1, fontSize: "1rem", fontWeight: 500 }}>Notifikasi</Typography>
            <Button size="small" onClick={markAll} disabled={unread === 0} sx={{ borderRadius: "9999px", fontSize: "0.75rem", px: 1, minWidth: 0 }}>
              Tandai semua dibaca
            </Button>
            <Button size="small" onClick={() => setConfirmClear(true)} disabled={visible.length === 0} sx={{ borderRadius: "9999px", fontSize: "0.75rem", px: 1, minWidth: 0, color: "#B3261E" }}>
              Hapus semua
            </Button>
          </Box>
          <Box sx={{ display: "flex", gap: 0.5, px: 1.5, pb: 1 }}>
            {(["all", "unread", "mention"] as const).map((k) => (
              <Box
                key={k}
                component="button"
                type="button"
                onClick={() => setTab(k)}
                sx={{
                  border: "none",
                  fontFamily: "inherit",
                  fontSize: "0.8125rem",
                  px: 1.5,
                  py: 0.6,
                  borderRadius: "9999px",
                  cursor: "pointer",
                  bgcolor: tab === k ? "#D3E3FD" : "transparent",
                  color: tab === k ? "#041E49" : "#444746",
                  fontWeight: tab === k ? 500 : 400,
                  transition: "background-color 150ms",
                  "&:hover": { bgcolor: tab === k ? "#D3E3FD" : "#F0F4F9" },
                }}
              >
                {k === "all" ? "Semua" : k === "unread" ? `Belum dibaca${unread ? ` ${unread}` : ""}` : (
                  <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.4 }}>
                    <AlternateEmailRounded sx={{ fontSize: 14 }} />
                    Disebut
                    {mentionCount > 0 && (
                      <Box component="span" sx={{ minWidth: 16, height: 16, px: 0.5, borderRadius: "8px", bgcolor: "#7B1FA2", color: "#fff", fontSize: "0.625rem", fontWeight: 700, display: "inline-grid", placeItems: "center" }}>
                        {mentionCount}
                      </Box>
                    )}
                  </Box>
                )}
              </Box>
            ))}
          </Box>

          <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", borderTop: "1px solid #EEF1F4" }}>
            {shown.length === 0 ? (
              <Typography sx={{ textAlign: "center", color: "#5F6368", fontSize: "0.8125rem", py: 5, px: 2 }}>
                {tab === "unread" ? "Semua sudah dibaca 🎉" : tab === "mention" ? "Belum ada yang menyebut kamu." : "Belum ada notifikasi."}
              </Typography>
            ) : (
              shown.slice(0, limit).map((n, i) => {
                const who = actorOf(n, people);
                const tagged = mentionsMe(n);
                const d = tagged ? { ...describe(n), verb: "menyebut kamu di" } : describe(n);
                const k = tagged ? { Icon: AlternateEmailRounded, bg: "#7B1FA2" } : kindBadge(n);
                const fresh = isUnread(n);
                return (
                  <Box
                    key={n.id}
                    component="button"
                    type="button"
                    onClick={() => go(n)}
                    sx={{
                      display: "flex",
                      gap: 1.5,
                      width: "100%",
                      textAlign: "left",
                      border: "none",
                      fontFamily: "inherit",
                      cursor: "pointer",
                      px: 2,
                      py: 1.25,
                      position: "relative",
                      bgcolor: tagged && fresh ? "#F6EEFB" : "transparent",
                      boxShadow: tagged ? "inset 3px 0 0 #7B1FA2" : "none",
                      transition: "background-color 150ms",
                      animation: `oc-rise 260ms cubic-bezier(0.22, 1, 0.36, 1) ${Math.min(i, 8) * 25}ms both`,
                      "&:hover": { bgcolor: tagged ? "#F1E4F8" : "#F8FAFD" },
                      "&:focus-visible": { outline: "2px solid #0B57D0", outlineOffset: -2 },
                    }}
                  >
                    <Box sx={{ position: "relative", flexShrink: 0, alignSelf: "flex-start", width: 36, height: 36 }}>
                      {who.member ? (
                        <MemberAvatar member={who.member} size={36} />
                      ) : (
                        <Box sx={{ width: 36, height: 36, borderRadius: "50%", bgcolor: "#E8EAED", color: "#5F6368", display: "grid", placeItems: "center" }}>
                          <SmartToyRounded sx={{ fontSize: 20 }} />
                        </Box>
                      )}
                      <Box sx={{ position: "absolute", right: -4, bottom: -4, width: 18, height: 18, borderRadius: "50%", bgcolor: k.bg, color: "#fff", border: "2px solid #fff", display: "grid", placeItems: "center" }}>
                        <k.Icon sx={{ fontSize: 10 }} />
                      </Box>
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontSize: "0.8438rem", lineHeight: 1.45, color: "#1F1F1F", overflowWrap: "anywhere" }}>
                        <b style={{ fontWeight: 500 }}>{who.name}</b> {d.verb} <b style={{ fontWeight: 500 }}>{d.obj}</b>
                        {n.count > 1 && n.kind !== "lead_new" && <span style={{ color: "#5F6368" }}> · {n.count}×</span>}
                      </Typography>
                      {d.sub && tagged ? (
                        <Box sx={{ mt: 0.5, px: 1.25, py: 0.75, borderRadius: "4px 12px 12px 12px", bgcolor: "#fff", border: "1px solid #E7D3F1", fontSize: "0.78rem", color: "#1F1F1F", lineHeight: 1.45, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden", overflowWrap: "anywhere" }}>
                          {highlightMe(d.sub.replace(/^“|”$/g, ""), me?.name ?? "")}
                        </Box>
                      ) : d.sub && (
                        <Typography sx={{ fontSize: "0.78rem", color: "#5F6368", mt: 0.25, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", overflowWrap: "anywhere" }}>{d.sub}</Typography>
                      )}
                      <Typography suppressHydrationWarning sx={{ fontSize: "0.7188rem", color: "#80868B", mt: 0.4, display: "flex", alignItems: "center", gap: 0.75 }}>
                        {tagged && (
                          <Box component="span" sx={{ px: 0.75, height: 18, borderRadius: "9999px", bgcolor: "#7B1FA2", color: "#fff", fontSize: "0.625rem", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 0.25 }}>
                            <AlternateEmailRounded sx={{ fontSize: 11 }} /> Kamu disebut
                          </Box>
                        )}
                        {formatRelative(n.updated_at)} · {AREA_LABEL[n.area]}
                      </Typography>
                    </Box>
                    <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: fresh ? (tagged ? "#7B1FA2" : "#0B57D0") : "transparent", flexShrink: 0, mt: 0.75 }} />
                  </Box>
                );
              })
            )}
          </Box>

          {shown.length > limit && (
            <Box sx={{ borderTop: "1px solid #EEF1F4", py: 0.75, textAlign: "center" }}>
              <Button size="small" onClick={() => setLimit((l) => l + PAGE)} sx={{ borderRadius: "9999px", fontSize: "0.8125rem" }}>
                Lihat semua notifikasi ({shown.length})
              </Button>
            </Box>
          )}
        </Box>
      </Popover>

      <ConfirmDialog
        open={confirmClear}
        title="Hapus semua notifikasi?"
        body="Semua notifikasi yang ada sekarang akan dihapus dari daftarmu. Notifikasi baru tetap muncul seperti biasa."
        confirmLabel="Hapus semua"
        onClose={() => setConfirmClear(false)}
        onConfirm={async () => {
          setConfirmClear(false);
          const stamp = new Date().toISOString();
          setClearedAt(stamp);
          setClearedState(stamp);
          setLastRead(stamp);
          setLastReadState(stamp);
        }}
      />
    </>
  );
}
