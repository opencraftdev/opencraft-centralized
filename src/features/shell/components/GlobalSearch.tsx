"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import ClickAwayListener from "@mui/material/ClickAwayListener";
import InputBase from "@mui/material/InputBase";
import CircularProgress from "@mui/material/CircularProgress";
import SearchRounded from "@mui/icons-material/SearchRounded";
import CloseRounded from "@mui/icons-material/CloseRounded";
import AssignmentRounded from "@mui/icons-material/AssignmentRounded";
import FolderRounded from "@mui/icons-material/FolderRounded";
import PersonRounded from "@mui/icons-material/PersonRounded";
import ChatBubbleRounded from "@mui/icons-material/ChatBubbleRounded";
import DescriptionRounded from "@mui/icons-material/DescriptionRounded";
import PaymentsRounded from "@mui/icons-material/PaymentsRounded";
import TravelExploreRounded from "@mui/icons-material/TravelExploreRounded";
import AutoAwesomeRounded from "@mui/icons-material/AutoAwesomeRounded";
import KeyboardReturnRounded from "@mui/icons-material/KeyboardReturnRounded";
import { createClient } from "@/lib/supabase/client";
import { driveContentUrl } from "@/lib/drive/links";

// Search across the dashboard from the top bar: tasks (title + brief), projects, people, chats, documents,
// finance entries, scraper leads and skills. Results come grouped, newest first, up to a few per group.
// Keys: "/" or Ctrl/⌘+K focuses it, ↑ ↓ move, Enter opens, Esc closes.

type Group = "task" | "project" | "person" | "chat" | "doc" | "finance" | "lead" | "skill";
interface Hit {
  group: Group;
  id: string;
  title: string;
  sub: string;
  href: string;
  external?: boolean;
}

const GROUPS: Record<Group, { label: string; Icon: typeof SearchRounded; color: string; bg: string }> = {
  task: { label: "Task", Icon: AssignmentRounded, color: "#0B57D0", bg: "#E8F0FE" },
  project: { label: "Project", Icon: FolderRounded, color: "#E37400", bg: "#FEF0D9" },
  person: { label: "Orang", Icon: PersonRounded, color: "#7B1FA2", bg: "#F3E8FD" },
  chat: { label: "Chat", Icon: ChatBubbleRounded, color: "#0B57D0", bg: "#E8F0FE" },
  doc: { label: "Dokumen & file", Icon: DescriptionRounded, color: "#1A73E8", bg: "#E8F0FE" },
  finance: { label: "Finance", Icon: PaymentsRounded, color: "#188038", bg: "#E6F4EA" },
  lead: { label: "Leads (Scrapers)", Icon: TravelExploreRounded, color: "#00838F", bg: "#E0F7FA" },
  skill: { label: "Skill", Icon: AutoAwesomeRounded, color: "#9334E6", bg: "#F3E8FD" },
};
const ORDER: Group[] = ["task", "project", "chat", "doc", "finance", "person", "lead", "skill"];
const PER_GROUP = 5;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const rupiah = (n: number) => `Rp ${n.toLocaleString("id-ID")}`;
const fmtDate = (iso: string | null) => (iso ? `${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1]}` : "");

/** Stored brief text → plain words (no mention tokens, tags, file blocks). */
const plain = (s: string) =>
  s
    .replace(/@\[([^\]]+)\]\((?:member|task|project):[0-9a-f-]+\)/g, "@$1")
    .replace(/\[\[(?:file|reply):[0-9a-f-]+\]\]/g, " ")
    .replace(/\[(?:\/?(?:b|i|u|c)|c=#[0-9a-fA-F]{6})\]/g, "")
    .replace(/\s+/g, " ")
    .trim();

/** A short piece of `text` around the first match. */
function around(text: string, q: string, n = 70) {
  const t = plain(text);
  const i = t.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return t.slice(0, n);
  const start = Math.max(0, i - 20);
  return `${start > 0 ? "…" : ""}${t.slice(start, start + n)}${start + n < t.length ? "…" : ""}`;
}

async function searchAll(q: string): Promise<Hit[]> {
  const sb = createClient();
  const like = `%${q.replace(/[%_,()*\\"]/g, " ").trim()}%`;
  const or = (...cols: string[]) => cols.map((c) => `${c}.ilike."${like}"`).join(",");
  const safe = <T,>(p: PromiseLike<{ data: T[] | null }>) => Promise.resolve(p).then((r) => r.data ?? [], () => [] as T[]);
  type TaskRow = { id: string; title: string; description: string | null; parent_id: string | null; due_date: string | null; status: string };
  const [tasks, projects, people, chats, docs, finance, leads, skills] = await Promise.all([
    safe<TaskRow>(sb.from("tasks").select("id,title,description,parent_id,due_date,status").or(or("title", "description")).order("updated_at", { ascending: false }).limit(12)),
    safe<{ id: string; name: string; label: string | null }>(sb.from("task_projects").select("id,name,label").ilike("name", like).limit(PER_GROUP)),
    safe<{ id: string; name: string; role: string | null }>(sb.from("task_members").select("id,name,role").or(or("name", "role")).limit(PER_GROUP)),
    safe<{ id: string; title: string; updated_at: string }>(sb.from("chats").select("id,title,updated_at").is("trashed_at", null).ilike("title", like).order("updated_at", { ascending: false }).limit(PER_GROUP)),
    safe<{ id: string; name: string; mime_type: string | null; metadata: Record<string, unknown> | null; updated_at: string }>(
      sb.from("drive_files").select("id,name,mime_type,metadata,updated_at").is("trashed_at", null).ilike("name", like).order("updated_at", { ascending: false }).limit(12),
    ),
    safe<{ id: string; kind: string; description: string; category: string; amount: number; entry_date: string }>(
      sb.from("finance_entries").select("id,kind,description,category,amount,entry_date").or(or("description", "category", "note")).order("entry_date", { ascending: false }).limit(PER_GROUP),
    ),
    safe<{ id: string; business_name: string; address: string | null; category: string }>(sb.from("scraper_leads").select("id,business_name,address,category").ilike("business_name", like).limit(PER_GROUP)),
    safe<{ id: string; name: string; title: string; description: string }>(sb.from("skills").select("id,name,title,description").or(or("title", "name", "description")).limit(PER_GROUP)),
  ]);

  const parentTitle = new Map(tasks.map((t) => [t.id, t.title]));
  const hits: Hit[] = [];
  for (const t of tasks.slice(0, PER_GROUP)) {
    const inTitle = t.title.toLowerCase().includes(q.toLowerCase());
    const bits = [t.parent_id ? `Checklist di ${parentTitle.get(t.parent_id) ?? "task"}` : null, t.due_date ? `Deadline ${fmtDate(t.due_date)}` : null, t.status === "done" ? "Selesai" : null];
    hits.push({ group: "task", id: t.id, title: t.title, sub: inTitle ? bits.filter(Boolean).join(" · ") : `Brief: ${around(t.description ?? "", q)}`, href: `/tasks?task=${t.id}` });
  }
  for (const p of projects) hits.push({ group: "project", id: p.id, title: p.name, sub: p.label ?? "Project", href: "/tasks" });
  for (const c of chats) hits.push({ group: "chat", id: c.id, title: c.title, sub: `Terakhir ${fmtDate(c.updated_at.slice(0, 10))}`, href: `/chat/${c.id}` });
  // logos and profile photos are not documents
  for (const d of docs.filter((d) => !["project_logo", "member_photo"].includes(String(d.metadata?.kind ?? ""))).slice(0, PER_GROUP)) {
    const where = d.metadata?.task_id ? "Lampiran task" : d.metadata?.kind === "chat_image" ? "Lampiran chat" : "Document";
    hits.push({ group: "doc", id: d.id, title: d.name, sub: where, href: driveContentUrl(d.id), external: true });
  }
  for (const f of finance)
    hits.push({ group: "finance", id: f.id, title: f.description, sub: `${f.kind === "income" ? "Pemasukan" : "Pengeluaran"} · ${rupiah(Number(f.amount))} · ${fmtDate(f.entry_date)}`, href: `/finance?m=${f.entry_date.slice(0, 7)}` });
  for (const m of people) hits.push({ group: "person", id: m.id, title: m.name, sub: m.role ?? "Tim", href: "/tasks" });
  for (const l of leads) hits.push({ group: "lead", id: l.id, title: l.business_name, sub: l.address ?? l.category, href: "/scrapers" });
  for (const s of skills) hits.push({ group: "skill", id: s.id, title: s.title, sub: `/${s.name}`, href: "/skills" });
  return ORDER.flatMap((g) => hits.filter((h) => h.group === g));
}

function Mark({ text, q }: { text: string; q: string }) {
  const i = q ? text.toLowerCase().indexOf(q.toLowerCase()) : -1;
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <Box component="mark" sx={{ bgcolor: "#FEEFC3", color: "inherit", borderRadius: "3px", px: "1px" }}>
        {text.slice(i, i + q.length)}
      </Box>
      {text.slice(i + q.length)}
    </>
  );
}

export function GlobalSearch() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hits, setHits] = useState<Hit[]>([]);
  const [active, setActive] = useState(0);
  const [isMac, setIsMac] = useState(false);
  const seq = useRef(0);

  useEffect(() => setIsMac(/Mac|iPhone|iPad/.test(navigator.platform)), []);

  // "/" or Ctrl/⌘+K focuses the search from anywhere (not while typing elsewhere)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null;
      const typing = !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) {
        e.preventDefault();
        input.current?.focus();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setHits([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const my = ++seq.current;
    const t = setTimeout(() => {
      searchAll(term).then((r) => {
        if (my !== seq.current) return;
        setHits(r);
        setActive(0);
        setLoading(false);
      });
    }, 220);
    return () => clearTimeout(t);
  }, [q]);

  const go = useCallback(
    (h: Hit) => {
      setOpen(false);
      input.current?.blur();
      if (h.external) window.open(h.href, "_blank", "noopener");
      else router.push(h.href);
    },
    [router],
  );

  useEffect(() => {
    list.current?.querySelector(`[data-i="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const term = q.trim();
  const groups = useMemo(() => ORDER.filter((g) => hits.some((h) => h.group === g)), [hits]);
  const show = open && term.length > 0;

  return (
    <ClickAwayListener onClickAway={() => setOpen(false)}>
      <Box sx={{ position: "relative", mx: "auto", flex: 1, minWidth: 0, maxWidth: 720 }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            height: 48,
            bgcolor: show ? "#fff" : "#E2ECFC",
            borderRadius: show ? "24px 24px 0 0" : "24px",
            boxShadow: show ? "0 4px 24px rgba(60,64,67,.18)" : "none",
            pl: 2,
            pr: 1.25,
            position: "relative",
            zIndex: 1301,
            transition: "background-color 150ms",
            "&:focus-within": { bgcolor: show ? "#fff" : "#D8E5FB" },
          }}
        >
          <SearchRounded sx={{ fontSize: 20, color: "#474747", flexShrink: 0 }} />
          <InputBase
            inputRef={input}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setOpen(false);
                input.current?.blur();
              } else if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => Math.min(a + 1, hits.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(a - 1, 0));
              } else if (e.key === "Enter" && hits[active]) {
                e.preventDefault();
                go(hits[active]);
              }
            }}
            placeholder="Cari task, dokumen, chat, transaksi, lead…"
            inputProps={{ "aria-label": "Cari di dashboard", role: "combobox", "aria-expanded": show, "aria-autocomplete": "list" }}
            sx={{ flex: 1, minWidth: 0, fontSize: "1rem", color: "#1F1F1F", "& ::placeholder": { color: "#474747", opacity: 0.65 } }}
          />
          {loading && <CircularProgress size={16} sx={{ color: "#80868B" }} />}
          {q ? (
            <Box component="button" type="button" aria-label="Hapus pencarian" onClick={() => { setQ(""); input.current?.focus(); }} sx={{ border: "none", bgcolor: "transparent", cursor: "pointer", color: "#5F6368", display: "grid", placeItems: "center", p: 0.5, borderRadius: "50%", "&:hover": { bgcolor: "rgba(68,71,70,.08)" } }}>
              <CloseRounded sx={{ fontSize: 18 }} />
            </Box>
          ) : (
            <Box component="kbd" sx={{ display: { xs: "none", md: "inline-flex" }, fontFamily: "inherit", fontSize: "0.6875rem", color: "#5F6368", bgcolor: "rgba(255,255,255,.7)", border: "1px solid #C9D7F0", borderRadius: "6px", px: 0.75, py: "1px" }}>
              {isMac ? "⌘ K" : "Ctrl K"}
            </Box>
          )}
        </Box>

        {show && (
          <Box
            ref={list}
            role="listbox"
            sx={{
              position: "absolute",
              left: 0,
              right: 0,
              top: 48,
              zIndex: 1300,
              bgcolor: "#fff",
              borderRadius: "0 0 20px 20px",
              borderTop: "1px solid #EEF1F4",
              boxShadow: "0 12px 28px rgba(60,64,67,.18)",
              maxHeight: "min(520px, calc(100vh - 120px))",
              overflowY: "auto",
              py: 0.75,
              animation: "oc-rise 180ms cubic-bezier(0.22, 1, 0.36, 1)",
            }}
          >
            {term.length < 2 ? (
              <Box sx={{ px: 2.5, py: 2, fontSize: "0.8125rem", color: "#80868B" }}>Ketik minimal 2 huruf. Bisa mencari judul & brief task, project, orang, chat, nama file, transaksi Finance, lead, dan skill.</Box>
            ) : loading && hits.length === 0 ? (
              <Box sx={{ px: 2.5, py: 2, fontSize: "0.8125rem", color: "#80868B" }}>Mencari “{term}”…</Box>
            ) : hits.length === 0 ? (
              <Box sx={{ px: 2.5, py: 3, textAlign: "center", fontSize: "0.875rem", color: "#5F6368" }}>
                Tidak ada hasil untuk <b>“{term}”</b>.
                <Box sx={{ fontSize: "0.75rem", color: "#80868B", mt: 0.5 }}>Coba kata lain, misalnya nama klien, judul task, atau nama file.</Box>
              </Box>
            ) : (
              groups.map((g) => {
                const meta = GROUPS[g];
                return (
                  <Box key={g} sx={{ "& + &": { borderTop: "1px solid #F1F3F4", mt: 0.5, pt: 0.5 } }}>
                    <Box sx={{ px: 2.5, pt: 1, pb: 0.5, fontSize: "0.6875rem", fontWeight: 700, letterSpacing: ".04em", color: "#80868B" }}>{meta.label.toUpperCase()}</Box>
                    {hits.map((h, i) =>
                      h.group !== g ? null : (
                        <Box
                          key={`${h.group}-${h.id}`}
                          data-i={i}
                          role="option"
                          aria-selected={i === active}
                          onMouseEnter={() => setActive(i)}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => go(h)}
                          sx={{ display: "flex", alignItems: "center", gap: 1.5, mx: 1, px: 1.5, py: 0.875, borderRadius: "12px", cursor: "pointer", bgcolor: i === active ? "#F1F4F9" : "transparent" }}
                        >
                          <Box sx={{ width: 32, height: 32, borderRadius: "10px", bgcolor: meta.bg, color: meta.color, display: "grid", placeItems: "center", flexShrink: 0 }}>
                            <meta.Icon sx={{ fontSize: 18 }} />
                          </Box>
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Box sx={{ fontSize: "0.875rem", fontWeight: 500, color: "#1F1F1F", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              <Mark text={h.title} q={term} />
                            </Box>
                            {h.sub && (
                              <Box sx={{ fontSize: "0.75rem", color: "#5F6368", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                <Mark text={h.sub} q={term} />
                              </Box>
                            )}
                          </Box>
                          {i === active && <KeyboardReturnRounded sx={{ fontSize: 16, color: "#80868B", flexShrink: 0 }} />}
                        </Box>
                      ),
                    )}
                  </Box>
                );
              })
            )}
            {hits.length > 0 && (
              <Box sx={{ display: { xs: "none", sm: "flex" }, gap: 2, px: 2.5, pt: 1, pb: 0.5, mt: 0.5, borderTop: "1px solid #F1F3F4", fontSize: "0.6875rem", color: "#80868B" }}>
                <span>↑ ↓ pilih</span>
                <span>Enter buka</span>
                <span>Esc tutup</span>
              </Box>
            )}
          </Box>
        )}
      </Box>
    </ClickAwayListener>
  );
}
