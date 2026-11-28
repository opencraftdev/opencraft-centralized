// In-app notifications (docs/NOTIFICATIONS.md). Rows come from database triggers (migration 028); the browser only
// reads them. "Read" is remembered per browser (localStorage), because the team may share one login.
import { createClient } from "@/lib/supabase/client";

export type NotifArea = "tasks" | "finance" | "scrapers" | "documents";

export interface AppNotification {
  id: string;
  area: NotifArea;
  kind: string;
  title: string;
  body: string;
  link: string;
  actor: string | null;
  ref_id: string | null;
  count: number;
  created_at: string;
  updated_at: string;
}

const sb = () => createClient();
const LS_READ = "notif.lastReadAt";

export async function listNotifications(limit = 50): Promise<AppNotification[] | null> {
  const { data, error } = await sb().from("app_notifications").select("*").order("updated_at", { ascending: false }).limit(limit);
  if (error) return null; // table missing (migration 028 not applied) or offline: show nothing
  return (data ?? []) as AppNotification[];
}

export function getLastRead(): string {
  try {
    return localStorage.getItem(LS_READ) ?? new Date(0).toISOString();
  } catch {
    return new Date(0).toISOString();
  }
}

export function setLastRead(iso = new Date().toISOString()) {
  try {
    localStorage.setItem(LS_READ, iso);
  } catch {
    /* ignore */
  }
}

/** Calls onChange on every new/updated notification. Returns unsubscribe. */
export function subscribeNotifications(onChange: () => void): () => void {
  const c = sb();
  const ch = c
    .channel("app-notifications")
    .on("postgres_changes", { event: "*", schema: "public", table: "app_notifications" }, onChange)
    .subscribe();
  return () => {
    void c.removeChannel(ch);
  };
}

export const AREA_LABEL: Record<NotifArea, string> = {
  tasks: "Task Management",
  finance: "Finance",
  scrapers: "Scrapers",
  documents: "Document",
};

/** Emoji + tint per kind. */
export function notifIcon(n: AppNotification): { emoji: string; tint: string } {
  switch (n.kind) {
    case "task_comment":
      return { emoji: "💬", tint: "#E8F0FE" };
    case "task_status":
      return n.title.endsWith("selesai") ? { emoji: "✅", tint: "#E6F4EA" } : { emoji: "🔄", tint: "#E8F0FE" };
    case "task_assigned":
      return { emoji: "👤", tint: "#FCE8E6" };
    case "task_created":
      return { emoji: "🆕", tint: "#E8F0FE" };
    case "task_updated":
      return { emoji: "✏️", tint: "#F1F3F4" };
    case "task_deleted":
      return { emoji: "🗑️", tint: "#F1F3F4" };
    case "task_attachment":
      return { emoji: "📎", tint: "#F1F3F4" };
    case "lead_new":
      return { emoji: "🧭", tint: "#E0F7FA" };
    case "expense_new":
    case "expense_updated":
      return { emoji: "💳", tint: "#FFF0D6" };
    case "doc_new":
    case "doc_ready":
      return { emoji: "📄", tint: "#F1F3F4" };
    default:
      return { emoji: "🔔", tint: "#F1F3F4" };
  }
}

// Per-item "read" (quick action "Tandai dibaca"), per browser.
const LS_IDS = "notif.readIds";
export function getReadIds(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(LS_IDS) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}
export function addReadId(id: string): Set<string> {
  const ids = getReadIds();
  ids.add(id);
  const list = [...ids].slice(-300);
  try {
    localStorage.setItem(LS_IDS, JSON.stringify(list));
  } catch {
    /* ignore */
  }
  return new Set(list);
}

// "Hapus semua notifikasi": hides everything up to now from this list (per browser), new ones still show.
const LS_CLEARED = "notif.clearedAt";
export function getClearedAt(): string {
  try {
    return localStorage.getItem(LS_CLEARED) ?? new Date(0).toISOString();
  } catch {
    return new Date(0).toISOString();
  }
}
export function setClearedAt(iso = new Date().toISOString()) {
  try {
    localStorage.setItem(LS_CLEARED, iso);
  } catch {
    /* ignore */
  }
}

/** Notifications hidden one by one with the trash icon (per browser, like "Hapus semua"). */
const LS_HIDDEN = "notif.hiddenIds";
export function getHiddenIds(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(LS_HIDDEN) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}
export function addHiddenId(id: string): Set<string> {
  const ids = getHiddenIds();
  ids.add(id);
  try {
    localStorage.setItem(LS_HIDDEN, JSON.stringify([...ids].slice(-500)));
  } catch {
    /* ignore */
  }
  return ids;
}
