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
import ExpandMoreRounded from "@mui/icons-material/ExpandMoreRounded";
import EventRounded from "@mui/icons-material/EventRounded";
import { createClient } from "@/lib/supabase/client";
import { formatRelative } from "@/features/drive/format";
import { personFor, useAccount, usePeople } from "@/features/accounts/account";
import { MemberAvatar } from "@/features/tasks/components/bits";
import { ConfirmDialog } from "@/features/drive/components/DriveDialogs";
import type { Member } from "@/features/tasks/types";
import {
  AREA_LABEL,
  addReadId,
  addHiddenId,
  getHiddenIds,
  getClearedAt,
  getLastRead,
  getReadIds,
  listNotifications,
  setClearedAt,
  setLastRead,
  subscribeNotifications,
  type AppNotification,
} from "./api";

// Bell in the top bar. A small card under the bell with two accordions (open by default):
//  · Untukmu — you were @-tagged, or made PIC.
//  · Lainnya — comments / status / deadline on tasks you are PIC or helper of; new tasks; finance; scraper leads.
// Not shown: your own actions, task edits, deleted tasks, checklist items, attachments, documents.
// "Tandai dibaca"; "Hapus semua" hides the list so far (per browser). docs/NOTIFICATIONS.md.

const halo = keyframes`
  0% { box-shadow: 0 0 0 0 rgba(217,48,37,.55); }
  70% { box-shadow: 0 0 0 9px rgba(217,48,37,0); }
  100% { box-shadow: 0 0 0 0 rgba(217,48,37,0); }
`;
const pop = keyframes`
  0% { transform: scale(0); } 60% { transform: scale(1.3); } 100% { transform: scale(1); }
`;

const MORE = 8; // "Lainnya" rows before "+ N lainnya"
const STATUS_WORD: Record<string, string> = { selesai: "Done", "sedang dikerjakan": "Progress", "masuk review": "Review", "belum mulai": "To do" };

/** "Raka" + "memperbarui tugas" + "SMM OCRAFT" + a sub line, from the trigger's title/body (migration 028). */
function describe(n: AppNotification): { verb: string; obj: string; sub: string } {
  const t = n.title;
  const body = n.body.replace(/^\[\[reply:[0-9a-f-]+\]\]\s*/, "").replace(/\[(?:\/?(?:b|i|u|c)|c=#[0-9a-fA-F]{6})\]/g, "").replace(/\[\[file:[0-9a-f-]{36}\]\]/g, "📎 ").trim();
  const after = (prefix: string) => (t.startsWith(prefix) ? t.slice(prefix.length) : null);
  const quoted = (s: string) => /"(.*)"/.exec(s)?.[1] ?? s;
  let m: RegExpExecArray | null;
  switch (n.kind) {
    case "task_created":
      if ((m = /^Checklist baru di "(.*)": (.*)$/.exec(t))) return { verb: "menambah checklist", obj: m[2], sub: `di ${m[1]}` };
      return { verb: "membuat task", obj: after("Tugas baru: ") ?? t, sub: body };
    case "task_deleted":
      return { verb: "menghapus task", obj: after("Tugas dihapus: ") ?? t, sub: body };
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
      return { verb: "memperbarui task", obj: after("Tugas diperbarui: ") ?? t, sub: body };
    case "task_comment":
      return { verb: "menulis di diskusi", obj: quoted(t), sub: body ? `“${body}”` : "" };
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
      <Box key={i} component="span" sx={{ px: 0.5, borderRadius: "4px", bgcolor: "#FCE8E6", color: "#C5221F", fontWeight: 600 }}>
        {p}
      </Box>
    ) : (
      p
    ),
  );
}

type Involve = { id: string; parent_id: string | null; assignee_id: string | null; helper_ids: string[] | null; pic_ids?: string[] | null };

/** Which notifications this person sees at all (see the header). */
function kindOf(n: AppNotification): "hidden" | "related" | "all" {
  switch (n.kind) {
    case "task_assigned":
    case "task_comment":
    case "task_status":
      return "related";
    case "task_updated":
      return /^Deadline /.test(n.body) ? "related" : "hidden"; // only deadline changes
    case "task_created":
      return n.title.startsWith("Checklist baru") ? "hidden" : "all";
    case "expense_new":
    case "income_new":
    case "expense_updated":
    case "lead_new":
      return "all";
    default:
      return "hidden"; // task_deleted, task_attachment, doc_new, doc_ready
  }
}

const cleanBody = (b: string) =>
  b
    .replace(/^\[\[reply:[0-9a-f-]+\]\]\s*/, "")
    .replace(/\[(?:\/?(?:b|i|u|c)|c=#[0-9a-fA-F]{6})\]/g, "")
    .replace(/\[\[file:[0-9a-f-]{36}\]\]/g, "📎 ")
    .trim();

export function NotificationBell() {
  const router = useRouter();
  const people = usePeople();
  const { email: myEmail, me } = useAccount();
  const [items, setItems] = useState<AppNotification[] | null>(null);
  const [lastRead, setLastReadState] = useState<string>(() => new Date().toISOString());
  const [clearedAt, setClearedState] = useState<string>(() => new Date(0).toISOString());
  const [readIds, setReadIds] = useState<Set<string>>(() => new Set());
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(() => new Set());
  const [askHide, setAskHide] = useState<AppNotification | null>(null);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [openMine, setOpenMine] = useState(true);
  const [openOther, setOpenOther] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [bump, setBump] = useState(0);
  const [tasks, setTasks] = useState<Map<string, Involve> | null>(null);
  const prevUnread = useRef(0);

  const refresh = useCallback(async () => {
    setItems(await listNotifications(80));
  }, []);

  useEffect(() => {
    setLastReadState(getLastRead());
    setClearedState(getClearedAt());
    setReadIds(getReadIds());
    setHiddenIds(getHiddenIds());
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

  // PIC / helper of the tasks the notifications are about (and of their parent task, for checklist items)
  const refKey = useMemo(() => [...new Set((items ?? []).filter((n) => n.area === "tasks" && n.ref_id).map((n) => n.ref_id as string))].sort().join(","), [items]);
  useEffect(() => {
    if (!refKey) {
      setTasks(new Map());
      return;
    }
    let off = false;
    (async () => {
      const sb = createClient();
      const cols = "*"; // pic_ids only exists after migration 033
      const { data } = await sb.from("tasks").select(cols).in("id", refKey.split(","));
      const map = new Map<string, Involve>((data ?? []).map((r) => [r.id as string, r as Involve]));
      const parents = [...new Set([...map.values()].map((r) => r.parent_id).filter((x): x is string => !!x && !map.has(x)))];
      if (parents.length) {
        const { data: more } = await sb.from("tasks").select(cols).in("id", parents);
        for (const r of more ?? []) map.set(r.id as string, r as Involve);
      }
      if (!off) setTasks(map);
    })().catch(() => !off && setTasks(new Map()));
    return () => {
      off = true;
    };
  }, [refKey]);

  const mentionsMe = useCallback(
    (n: AppNotification) => {
      const name = me?.name?.trim();
      if (!name || n.kind !== "task_comment") return false;
      const esc = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return new RegExp(`@${esc}(?![\\p{L}\\p{N}])`, "iu").test(n.body);
    },
    [me?.name],
  );
  const madeMePic = useCallback((n: AppNotification) => n.kind === "task_assigned" && !!me?.name && n.title.startsWith(`${me.name} jadi PIC`), [me?.name]);
  const involved = useCallback(
    (n: AppNotification) => {
      if (!me) return true; // no profile linked to this login: show everything rather than nothing
      const t = n.ref_id ? tasks?.get(n.ref_id) : undefined;
      if (!t) return false;
      const isMine = (x: Involve | undefined) => !!x && (x.assignee_id === me.id || (x.pic_ids ?? []).includes(me.id) || (x.helper_ids ?? []).includes(me.id));
      return isMine(t) || isMine(t.parent_id ? tasks?.get(t.parent_id) : undefined);
    },
    [me, tasks],
  );

  const visible = useMemo(
    () =>
      (items ?? []).filter((n) => {
        if (n.updated_at <= clearedAt || hiddenIds.has(n.id)) return false;
        if (n.actor && myEmail && n.actor === myEmail) return false; // never my own actions
        if (mentionsMe(n) || madeMePic(n)) return true;
        const k = kindOf(n);
        if (k === "hidden") return false;
        if (k === "related") return tasks !== null && involved(n);
        return true;
      }),
    [items, clearedAt, hiddenIds, myEmail, mentionsMe, madeMePic, involved, tasks],
  );
  const mine = visible.filter((n) => mentionsMe(n) || madeMePic(n));
  const other = visible.filter((n) => !mentionsMe(n) && !madeMePic(n));
  const isUnread = useCallback((n: AppNotification) => n.updated_at > lastRead && !readIds.has(n.id), [lastRead, readIds]);
  const unread = useMemo(() => visible.filter(isUnread).length, [visible, isUnread]);
  useEffect(() => {
    if (unread > prevUnread.current) setBump((b) => b + 1);
    prevUnread.current = unread;
  }, [unread]);

  if (items === null) return null; // not set up yet (migration 028) or offline

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

  const rowSx = (fresh: boolean, i: number) => ({
    display: "flex",
    alignItems: "flex-start",
    gap: 1.25,
    width: "100%",
    textAlign: "left" as const,
    border: "none",
    fontFamily: "inherit",
    cursor: "pointer",
    px: 2,
    py: 1.125,
    bgcolor: fresh ? "#F8FAFE" : "transparent",
    borderTop: "1px solid #F4F5F7",
    transition: "background-color 150ms",
    animation: `oc-rise 260ms cubic-bezier(0.22, 1, 0.36, 1) ${Math.min(i, 8) * 25}ms both`,
    "&:hover": { bgcolor: "#F1F4F9" },
    "&:focus-visible": { outline: "2px solid #0B57D0", outlineOffset: -2 },
  });
  const time = (n: AppNotification, fresh: boolean) => (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, flexShrink: 0, mt: "2px" }}>
      <Typography suppressHydrationWarning sx={{ fontSize: "0.6875rem", color: "#80868B", whiteSpace: "nowrap" }}>
        {formatRelative(n.updated_at)}
      </Typography>
      <Box sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: fresh ? "#0B57D0" : "transparent" }} />
      {/* the row is a button, so this is a span with button behaviour (no button inside a button) */}
      <Tooltip title="Hapus notifikasi" disableInteractive>
        <Box
          component="span"
          role="button"
          tabIndex={0}
          aria-label="Hapus notifikasi ini"
          onClick={(e) => {
            e.stopPropagation();
            setAskHide(n);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              e.stopPropagation();
              setAskHide(n);
            }
          }}
          sx={{ display: "grid", placeItems: "center", width: 24, height: 24, mr: -0.5, borderRadius: "50%", color: "#9AA0A6", cursor: "pointer", transition: "color 150ms, background-color 150ms", "&:hover": { color: "#B3261E", bgcolor: "#FCE8E6" }, "&:focus-visible": { outline: "2px solid #0B57D0" } }}
        >
          <DeleteRounded sx={{ fontSize: 16 }} />
        </Box>
      </Tooltip>
    </Box>
  );
  const avatar = (n: AppNotification, size: number, badge?: { Icon: typeof AddRounded; bg: string }) => {
    const who = actorOf(n, people);
    return (
      <Box sx={{ position: "relative", flexShrink: 0, width: size, height: size }}>
        {who.member ? (
          <MemberAvatar member={who.member} size={size} />
        ) : (
          <Box sx={{ width: size, height: size, borderRadius: "50%", bgcolor: "#E8EAED", color: "#5F6368", display: "grid", placeItems: "center" }}>
            <SmartToyRounded sx={{ fontSize: size * 0.55 }} />
          </Box>
        )}
        {badge && (
          <Box sx={{ position: "absolute", right: -4, bottom: -4, width: 17, height: 17, borderRadius: "50%", bgcolor: badge.bg, color: "#fff", border: "2px solid #fff", display: "grid", placeItems: "center" }}>
            <badge.Icon sx={{ fontSize: 10 }} />
          </Box>
        )}
      </Box>
    );
  };
  const B = ({ children }: { children: React.ReactNode }) => <b style={{ fontWeight: 600 }}>{children}</b>;

  /** One short line for "Lainnya". */
  const shortLine = (n: AppNotification): React.ReactNode => {
    const who = actorOf(n, people).name;
    const body = cleanBody(n.body);
    const q = (s: string) => /"(.*)"/.exec(s)?.[1] ?? s;
    let m: RegExpExecArray | null;
    switch (n.kind) {
      case "task_status":
        if ((m = /^"(.*)" (.*)$/.exec(n.title))) return <><B>{m[1]}</B> → {STATUS_WORD[m[2]] ?? m[2]}</>;
        break;
      case "task_updated":
        return <><B>{n.title.replace(/^Tugas diperbarui: /, "")}</B> {body.replace(/^Deadline/, "deadline")}</>;
      case "task_comment":
        return <><B>{who}</B> di <B>{q(n.title)}</B>{body && <span style={{ color: "#5F6368" }}>: “{body}”</span>}</>;
      case "task_assigned":
        if ((m = /^(.*) jadi PIC "(.*)"$/.exec(n.title))) return <><B>{m[1]}</B> jadi PIC <B>{m[2]}</B></>;
        break;
      case "task_created":
        return <>Task baru <B>{n.title.replace(/^Tugas baru: /, "")}</B>{body && <span style={{ color: "#5F6368" }}> · {body}</span>}</>;
      case "lead_new":
        return <><B>{n.count > 1 ? `${n.count} lead baru` : "1 lead baru"}</B> dari Scrapers</>;
      case "income_new":
      case "expense_new":
      case "expense_updated": {
        const [label, ...rest] = n.title.split(": ");
        return <>{label} <B>{rest.join(": ")}</B>{body && <span style={{ color: "#5F6368" }}> · {body.split(" · ").slice(0, 2).join(" · ")}</span>}</>;
      }
    }
    return n.title;
  };
  const smallIcon = (n: AppNotification) => (n.kind === "task_updated" ? { Icon: EventRounded, bg: "#E37400" } : kindBadge(n));

  const section = (label: string, count: number, open: boolean, toggle: () => void) => (
    <Box
      component="button"
      type="button"
      onClick={toggle}
      aria-expanded={open}
      sx={{ display: "flex", alignItems: "center", gap: 0.5, width: "100%", border: "none", bgcolor: "transparent", fontFamily: "inherit", cursor: "pointer", px: 2, pt: 1.25, pb: 0.75, textAlign: "left", "&:hover .sec-l": { color: "#1F1F1F" } }}
    >
      <Typography className="sec-l" sx={{ fontSize: "0.6875rem", fontWeight: 700, letterSpacing: ".04em", color: "#80868B", transition: "color 150ms" }}>
        {label}
      </Typography>
      {count > 0 && <Typography sx={{ fontSize: "0.6875rem", fontWeight: 600, color: "#80868B" }}>· {count}</Typography>}
      <Box sx={{ flex: 1 }} />
      <ExpandMoreRounded sx={{ fontSize: 18, color: "#80868B", transform: open ? "none" : "rotate(-90deg)", transition: "transform 220ms cubic-bezier(0.22, 1, 0.36, 1)" }} />
    </Box>
  );
  const otherShown = showAll ? other : other.slice(0, MORE);

  return (
    <>
      <Tooltip title={anchor ? "" : "Notifikasi"} disableInteractive>
        <IconButton
          aria-label={unread ? `Notifikasi, ${unread} belum dibaca` : "Notifikasi"}
          aria-haspopup="dialog"
          onClick={(e) => {
            setAnchor(anchor ? null : e.currentTarget);
            setShowAll(false);
            setOpenMine(true);
            setOpenOther(true);
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
              width: "min(380px, calc(100vw - 16px))",
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
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.25, pl: 2, pr: 1, pt: 1.5, pb: 0.5 }}>
            <Typography sx={{ flex: 1, fontSize: "1rem", fontWeight: 500 }}>Notifikasi</Typography>
            <Button size="small" onClick={markAll} disabled={unread === 0} sx={{ borderRadius: "9999px", fontSize: "0.75rem", px: 1, minWidth: 0 }}>
              Tandai dibaca
            </Button>
            <Button size="small" onClick={() => setConfirmClear(true)} disabled={visible.length === 0} sx={{ borderRadius: "9999px", fontSize: "0.75rem", px: 1, minWidth: 0, color: "#B3261E" }}>
              Hapus semua
            </Button>
          </Box>

          <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", pb: 0.75 }}>
            {visible.length === 0 ? (
              <Typography sx={{ textAlign: "center", color: "#5F6368", fontSize: "0.8125rem", py: 5, px: 2 }}>Belum ada notifikasi untukmu.</Typography>
            ) : (
              <>
                {section("UNTUKMU", mine.length, openMine, () => setOpenMine((v) => !v))}
                {openMine &&
                  (mine.length === 0 ? (
                    <Typography sx={{ fontSize: "0.75rem", color: "#80868B", px: 2, pb: 1 }}>Tidak ada yang menandai atau menunjukmu.</Typography>
                  ) : (
                    mine.map((n, i) => {
                      const fresh = isUnread(n);
                      const tagged = mentionsMe(n);
                      const task = /"(.*)"/.exec(n.title)?.[1] ?? "";
                      return (
                        <Box key={n.id} component="button" type="button" onClick={() => go(n)} sx={rowSx(fresh, i)}>
                          {avatar(n, 32, tagged ? { Icon: AlternateEmailRounded, bg: "#D93025" } : { Icon: PersonRounded, bg: "#0B57D0" })}
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography sx={{ fontSize: "0.8125rem", lineHeight: 1.45, color: "#1F1F1F", overflowWrap: "anywhere" }}>
                              {tagged ? (
                                <>
                                  <B>{actorOf(n, people).name}</B> menandai kamu di task
                                </>
                              ) : (
                                <>Kamu jadi PIC di task</>
                              )}
                            </Typography>
                            <Typography sx={{ fontSize: "0.8125rem", fontWeight: 600, lineHeight: 1.4, color: "#1F1F1F", overflowWrap: "anywhere" }}>{task}</Typography>
                            {tagged && cleanBody(n.body) && (
                              <Box sx={{ mt: 0.5, px: 1.25, py: 0.625, borderRadius: "4px 12px 12px 12px", bgcolor: "#F1F4F9", fontSize: "0.8125rem", color: "#1F1F1F", lineHeight: 1.45, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden", overflowWrap: "anywhere" }}>
                                {highlightMe(cleanBody(n.body), me?.name ?? "")}
                              </Box>
                            )}
                          </Box>
                          {time(n, fresh)}
                        </Box>
                      );
                    })
                  ))}

                {section("LAINNYA", other.length, openOther, () => setOpenOther((v) => !v))}
                {openOther &&
                  (other.length === 0 ? (
                    <Typography sx={{ fontSize: "0.75rem", color: "#80868B", px: 2, pb: 1 }}>Tidak ada kabar lain.</Typography>
                  ) : (
                    <>
                      {otherShown.map((n, i) => {
                        const fresh = isUnread(n);
                        return (
                          <Box key={n.id} component="button" type="button" onClick={() => go(n)} sx={{ ...rowSx(fresh, i), alignItems: "center", py: 0.875 }}>
                            {avatar(n, 24, smallIcon(n))}
                            <Typography sx={{ flex: 1, minWidth: 0, fontSize: "0.78rem", lineHeight: 1.4, color: "#1F1F1F", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{shortLine(n)}</Typography>
                            {time(n, fresh)}
                          </Box>
                        );
                      })}
                      {other.length > MORE && (
                        <Box component="button" type="button" onClick={() => setShowAll((v) => !v)} sx={{ border: "none", bgcolor: "transparent", fontFamily: "inherit", cursor: "pointer", px: 2, pt: 1, pb: 0.5, fontSize: "0.75rem", fontWeight: 500, color: "#0B57D0" }}>
                          {showAll ? "Tampilkan lebih sedikit" : `+ ${other.length - MORE} lainnya`}
                        </Box>
                      )}
                    </>
                  ))}
              </>
            )}
          </Box>
        </Box>
      </Popover>

      <ConfirmDialog
        open={!!askHide}
        title="Hapus notifikasi ini?"
        body="Notifikasi ini akan dihapus dari daftarmu. Yang lain tidak berubah."
        confirmLabel="Hapus"
        onClose={() => setAskHide(null)}
        onConfirm={async () => {
          if (askHide) setHiddenIds(addHiddenId(askHide.id));
          setAskHide(null);
        }}
      />
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
