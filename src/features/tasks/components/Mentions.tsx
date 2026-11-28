"use client";

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import AssignmentRounded from "@mui/icons-material/AssignmentRounded";
import { Linkify } from "@/components/ui/Linkify";
import type { Task } from "../types";
import type { TasksCtx } from "./TasksApp";
import { MemberAvatar, ProjectMark } from "./bits";
import { FileRow, buildBlock, editorFileSx, fileIdsIn, uploadHtml } from "./InlineFiles";
import type { DriveFile } from "@/lib/drive/types";

// "@" in a comment: pick a person, another task or a project. Stored in the comment body as
// @[Label](member|task|project:<uuid>) and shown as a chip; the text box itself shows plain "@Label".

type Kind = "member" | "task" | "project";
type Option = { kind: Kind; id: string; label: string; sub?: string };

const TOKEN_RE = /@\[([^\]\n]{1,120})\]\((member|task|project):([0-9a-f-]{36})\)/g;

/** Renders a comment body: [b]/[i]/[u]/[c=#hex] formatting, mention chips + clickable links. */
export function CommentBody({ text, ctx, onOpenTask, files, onOpenFile }: { text: string; ctx: TasksCtx; onOpenTask: (t: Task) => void; files?: Map<string, DriveFile>; onOpenFile?: (f: DriveFile) => void }) {
  const plain = (t: string, k: string) => {
    // file blocks sit on their own line(s): one row per run of neighbouring files
    if (!files || !t.includes("[[file:")) return renderPlain(t, k, ctx, onOpenTask);
    const out: React.ReactNode[] = [];
    let last = 0;
    for (const m of t.matchAll(FILE_GROUP_RE)) {
      const start = m.index ?? 0;
      if (start > last) out.push(...renderPlain(t.slice(last, start), `${k}g${last}`, ctx, onOpenTask));
      out.push(<FileRow key={`${k}f${start}`} ids={fileIdsIn(m[1])} files={files} onOpen={onOpenFile} />);
      last = start + m[0].length;
    }
    if (last < t.length) out.push(...renderPlain(t.slice(last), `${k}g${last}`, ctx, onOpenTask));
    return out;
  };
  return <>{renderRich(text, plain, "r")}</>;
}

const FILE_GROUP_RE = /\n?((?:\[\[file:[0-9a-f-]{36}\]\][ \t]*)+)\n?/g;

function renderPlain(text: string, keyBase: string, ctx: TasksCtx, onOpenTask: (t: Task) => void) {
  const out: React.ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(TOKEN_RE)) {
    const start = m.index ?? 0;
    if (start > last) out.push(<Linkify key={`${keyBase}t${last}`} text={text.slice(last, start)} />);
    const [, label, kind, id] = m;
    out.push(<Chip key={`${keyBase}m${start}`} kind={kind as Kind} id={id} label={label} ctx={ctx} onOpenTask={onOpenTask} />);
    last = start + m[0].length;
  }
  if (last < text.length) out.push(<Linkify key={`${keyBase}t${last}`} text={text.slice(last)} />);
  return out;
}

// ---- Text formatting -------------------------------------------------------------------------
// Stored as light tags so plain text stays readable: [b]tebal[/b], [i]miring[/i], [u]garis bawah[/u],
// [c=#D93025]warna[/c]. Tags can nest; an unmatched tag is shown as typed.

const OPEN_RE = /(?<!@)\[(b|i|u|c=#[0-9a-fA-F]{6})\]/g;

export const TEXT_COLORS = [
  { c: "#000000", n: "Hitam" },
  { c: "#D93025", n: "Merah" },
  { c: "#E37400", n: "Oranye" },
  { c: "#188038", n: "Hijau" },
  { c: "#0B57D0", n: "Biru" },
  { c: "#9334E6", n: "Ungu" },
  { c: "#5F6368", n: "Abu" },
];

/** Text without formatting tags (for one-line previews and notifications). */
export function stripFormat(s: string) {
  return s.replace(/\[\[file:[0-9a-f-]{36}\]\]/g, "📎 ").replace(/(?<!@)\[(?:\/?(?:b|i|u|c)|c=#[0-9a-fA-F]{6})\]/g, "");
}

type RichNode = string | { tag: "b" | "i" | "u" | "c"; color?: string; kids: RichNode[] };

function parseRich(text: string): RichNode[] {
  const out: RichNode[] = [];
  let pos = 0;
  let m: RegExpExecArray | null;
  const re = new RegExp(OPEN_RE.source, "g");
  while ((m = re.exec(text))) {
    const tag = (m[1].startsWith("c=") ? "c" : m[1]) as "b" | "i" | "u" | "c";
    // find the matching close, counting nested tags of the same kind
    const openRe = tag === "c" ? /\[c=#[0-9a-fA-F]{6}\]/g : new RegExp(`\\[${tag}\\]`, "g");
    const close = `[/${tag}]`;
    let depth = 1;
    let i = m.index + m[0].length;
    let end = -1;
    while (i <= text.length) {
      const c = text.indexOf(close, i);
      if (c < 0) break;
      openRe.lastIndex = i;
      const o = openRe.exec(text);
      if (o && o.index < c) {
        depth++;
        i = o.index + o[0].length;
        continue;
      }
      depth--;
      if (depth === 0) {
        end = c;
        break;
      }
      i = c + close.length;
    }
    if (end < 0) continue; // unmatched: leave it as text
    if (m.index > pos) out.push(text.slice(pos, m.index));
    out.push({ tag, color: tag === "c" ? m[1].slice(2) : undefined, kids: parseRich(text.slice(m.index + m[0].length, end)) });
    pos = end + close.length;
    re.lastIndex = pos;
  }
  if (pos < text.length) out.push(text.slice(pos));
  return out;
}

const FMT_STYLE = (n: Exclude<RichNode, string>): React.CSSProperties =>
  n.tag === "b" ? { fontWeight: 700 } : n.tag === "i" ? { fontStyle: "italic" } : n.tag === "u" ? { textDecoration: "underline", textUnderlineOffset: 2 } : { color: n.color };

function renderRich(text: string, plain: (t: string, key: string) => React.ReactNode[], key: string): React.ReactNode[] {
  const walk = (nodes: RichNode[], k: string): React.ReactNode[] =>
    nodes.flatMap<React.ReactNode>((n, i) =>
      typeof n === "string"
        ? plain(n, `${k}p${i}`)
        : [
            <span key={`${k}f${i}`} style={FMT_STYLE(n)}>
              {walk(n.kids, `${k}-${i}`)}
            </span>,
          ],
    );
  return walk(parseRich(text), key);
}

// ---- Editor <-> stored text -------------------------------------------------------------------

const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>");

/** Stored text → HTML for the live editor. */
function toHtml(text: string): string {
  const walk = (nodes: RichNode[]): string =>
    nodes
      .map((n) => {
        if (typeof n === "string") return n.split(/(\[\[file:[0-9a-f-]{36}\]\])/).map((part) => (part.startsWith("[[file:") ? `<span data-file="${part.slice(7, -2)}"></span>` : esc(part))).join("");
        const inner = walk(n.kids);
        if (n.tag === "c") return `<font color="${n.color}">${inner}</font>`;
        return `<${n.tag}>${inner}</${n.tag}>`;
      })
      .join("");
  return walk(parseRich(text));
}

function toHex(c: string): string | null {
  if (/^#[0-9a-f]{6}$/i.test(c)) return c.toUpperCase();
  if (/^#[0-9a-f]{3}$/i.test(c)) return ("#" + c.slice(1).split("").map((x) => x + x).join("")).toUpperCase();
  const m = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!m) return null;
  return "#" + [m[1], m[2], m[3]].map((x) => Number(x).toString(16).padStart(2, "0")).join("").toUpperCase();
}

/** Live editor DOM → stored text with [b]/[i]/[u]/[c=] tags. */
function fromDom(node: Node): string {
  let out = "";
  node.childNodes.forEach((n) => {
    if (n.nodeType === Node.TEXT_NODE) {
      out += (n.nodeValue ?? "").replace(/ /g, " ").replace(/​/g, "");
      return;
    }
    if (n.nodeType !== Node.ELEMENT_NODE) return;
    const el = n as HTMLElement;
    if (el.dataset.file) {
      out += `[[file:${el.dataset.file}]]`;
      return;
    }
    if (el.dataset.temp) return; // still uploading
    const tag = el.tagName;
    if (tag === "BR") {
      out += "\n";
      return;
    }
    let inner = fromDom(el);
    const st = el.style;
    const color = el.getAttribute("color") || st.color;
    const hex = color ? toHex(color) : null;
    if (hex && hex !== "#1F1F1F") inner = `[c=${hex}]${inner}[/c]`;
    if (tag === "U" || (st.textDecorationLine || st.textDecoration || "").includes("underline")) inner = `[u]${inner}[/u]`;
    if (tag === "I" || tag === "EM" || st.fontStyle === "italic") inner = `[i]${inner}[/i]`;
    if (tag === "B" || tag === "STRONG" || st.fontWeight === "bold" || Number(st.fontWeight) >= 600) inner = `[b]${inner}[/b]`;
    if (tag === "DIV" || tag === "P") {
      if (out && !out.endsWith("\n")) out += "\n";
      out += inner === "\n" ? "" : inner;
      if (!out.endsWith("\n")) out += "\n";
      return;
    }
    out += inner;
  });
  return out;
}

/** Drops empty pairs like [b][/b] left behind by toggling. */
const tidy = (s: string) => {
  let prev;
  do {
    prev = s;
    s = s.replace(/\[(b|i|u)\]\[\/\1\]|\[c=#[0-9A-Fa-f]{6}\]\[\/c\]/g, "");
  } while (s !== prev);
  return s.replace(/\n$/, "");
};

function Chip({ kind, id, label, ctx, onOpenTask }: { kind: Kind; id: string; label: string; ctx: TasksCtx; onOpenTask: (t: Task) => void }) {
  const base = { display: "inline-flex", alignItems: "center", gap: 0.5, verticalAlign: "bottom", px: 0.75, mx: "1px", height: 20, borderRadius: "9999px", fontSize: "0.75rem", fontWeight: 600, border: "none", fontFamily: "inherit", maxWidth: "100%" } as const;
  if (kind === "task") {
    const t = ctx.all.find((x) => x.id === id);
    return (
      <Box component="button" type="button" onClick={() => t && onOpenTask(t)} disabled={!t} sx={{ ...base, bgcolor: "#EEF4FE", color: "#0B57D0", cursor: t ? "pointer" : "default", "&:hover": { bgcolor: "#D3E3FD" } }}>
        <AssignmentRounded sx={{ fontSize: 14 }} />
        <Box component="span" sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t?.title ?? label}</Box>
      </Box>
    );
  }
  if (kind === "project") {
    const p = ctx.projectById.get(id);
    return (
      <Box component="span" sx={{ ...base, bgcolor: `${p?.color ?? "#5F6368"}1A`, color: p?.color ?? "#5F6368" }}>
        <ProjectMark project={p} size={13} />
        {p?.name ?? label}
      </Box>
    );
  }
  const m = ctx.memberById.get(id);
  return (
    <Box component="span" sx={{ ...base, pl: 0.25, bgcolor: "#EEF4FE", color: "#0B57D0" }}>
      <MemberAvatar member={m} size={16} />@{m?.name ?? label}
    </Box>
  );
}

export interface MentionInputHandle {
  /** The text with picked "@Label"s turned into stored mention tokens. */
  serialize: () => string;
  reset: () => void;
  focus: () => void;
  /** Starts editing a stored text: tokens become plain "@Label" again (and are remembered for serialize). */
  load: (stored: string) => void;
  /** Applies formatting to the selection: bold / italic / underline / a text colour. */
  exec: (cmd: "bold" | "italic" | "underline" | "color", color?: string) => void;
  /** Puts "uploading" blocks at the caret (new line), with the caret on a fresh line after them. */
  insertUploads: (items: { tempId: string; name: string }[]) => void;
  progress: (tempId: string, pct: number) => void;
  /** Swaps an uploading block for the file (or drops it when the upload failed). */
  resolveUpload: (tempId: string, file: DriveFile | null) => void;
  removeFile: (id: string) => void;
}

// The box is a rich editor (formatting shows live). Its value is the stored text format: [b]…[/b] etc. and
// plain "@Label" for picked mentions.
export const MentionInput = forwardRef<MentionInputHandle, {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  ctx: TasksCtx;
  currentTaskId?: string;
  placeholder?: string;
  minRows?: number;
  newlineOnEnter?: boolean; // Enter adds a line (brief) instead of sending (comment)
  popupBelow?: boolean; // the @ list opens under the box
  inputSx?: object;
  ariaLabel?: string;
  maxRows?: number; // how tall the box grows before it scrolls
  files?: Map<string, DriveFile>; // for showing [[file:id]] blocks
  onFiles?: (files: File[]) => void; // pasted / dropped files
  onRemoveFile?: (id: string) => void; // the × on a block
  onOpenFile?: (id: string) => void;
}>(function MentionInput({ value, onChange, onSubmit, ctx, currentTaskId, placeholder, minRows, newlineOnEnter, popupBelow, inputSx, ariaLabel, maxRows, files, onFiles, onRemoveFile, onOpenFile }, ref) {
  const root = useRef<HTMLDivElement | null>(null);
  const emitted = useRef<string | null>(null); // last value this editor produced
  const saved = useRef<Range | null>(null); // selection kept while toolbar popovers have focus
  const [picked, setPicked] = useState<Option[]>([]);
  const [query, setQuery] = useState<{ text: string } | null>(null);
  const [active, setActive] = useState(0);
  const [hasBlocks, setHasBlocks] = useState(false);
  const filesRef = useRef(files);
  filesRef.current = files;

  // [[file:id]] placeholders → real blocks (and blocks for files that were not known yet)
  const hydrate = () => {
    const el = root.current;
    if (!el) return;
    el.querySelectorAll<HTMLElement>("[data-file]").forEach((b) => {
      const id = b.dataset.file!;
      const f = filesRef.current?.get(id);
      if (b.classList.contains("ocf") && !(b.classList.contains("ocf-missing") && f)) return;
      b.replaceWith(buildBlock(id, f));
    });
    setHasBlocks(!!el.querySelector(".ocf"));
  };
  useEffect(hydrate, [files]);

  // Outside changes (load, clear after send) rewrite the editor; our own typing doesn't.
  useEffect(() => {
    const el = root.current;
    if (!el || value === emitted.current) return;
    el.innerHTML = toHtml(value);
    hydrate();
    emitted.current = value;
    if (document.activeElement === el) caretToEnd(el);
  }, [value]);

  // remember the selection inside the editor
  useEffect(() => {
    const onSel = () => {
      const sel = window.getSelection();
      if (sel && sel.rangeCount && root.current?.contains(sel.anchorNode)) saved.current = sel.getRangeAt(0).cloneRange();
    };
    document.addEventListener("selectionchange", onSel);
    return () => document.removeEventListener("selectionchange", onSel);
  }, []);

  const emit = () => {
    const el = root.current;
    if (!el) return;
    const v = tidy(fromDom(el));
    setHasBlocks(!!el.querySelector(".ocf"));
    emitted.current = v;
    onChange(v);
    detect();
  };

  const restore = () => {
    const el = root.current;
    if (!el) return;
    const sel = window.getSelection();
    // still typing in the box: its live caret wins over the remembered one
    if (document.activeElement === el && sel?.rangeCount && el.contains(sel.anchorNode)) return;
    el.focus();
    if (saved.current && sel) {
      sel.removeAllRanges();
      sel.addRange(saved.current);
    }
  };

  // Look for "@word" right before the caret.
  // Text of the current line up to the caret (for "- " bullets).
  const lineBefore = (): string | null => {
    const el = root.current;
    const sel = window.getSelection();
    if (!el || !sel?.rangeCount || !el.contains(sel.anchorNode) || !sel.isCollapsed) return null;
    const r = document.createRange();
    r.selectNodeContents(el);
    r.setEnd(sel.anchorNode!, sel.anchorOffset);
    const t = fromDom(r.cloneContents());
    return t.slice(t.lastIndexOf("\n") + 1);
  };
  const deleteBack = (n: number) => {
    const sel = window.getSelection() as Selection & { modify?: (a: string, d: string, g: string) => void };
    if (!sel?.modify) return;
    for (let i = 0; i < n; i++) sel.modify("extend", "backward", "character");
    document.execCommand("delete");
  };

  const detect = () => {
    const el = root.current;
    const sel = window.getSelection();
    if (!el || !sel || !sel.rangeCount || !el.contains(sel.anchorNode)) return setQuery(null);
    const r = document.createRange();
    r.selectNodeContents(el);
    r.setEnd(sel.anchorNode!, sel.anchorOffset);
    const before = stripFormat(fromDom(r.cloneContents()));
    const m = before.match(/(^|\s)@([^\s@][^@\n]{0,40})?$/);
    if (!m) return setQuery(null);
    setQuery({ text: m[2] ?? "" });
    setActive(0);
  };

  useImperativeHandle(ref, () => ({
    insertUploads: (items) => {
      const el = root.current;
      if (!el || !items.length) return;
      restore();
      const sel = window.getSelection();
      if (!saved.current || !sel?.rangeCount || !el.contains(sel.anchorNode)) caretToEnd(el);
      // start on a new line unless the caret already is at the start of one
      const r = document.createRange();
      r.selectNodeContents(el);
      const cur = window.getSelection()!;
      r.setEnd(cur.anchorNode!, cur.anchorOffset);
      const before = fromDom(r.cloneContents());
      const lead = before && !before.endsWith("\n") ? "<br>" : "";
      document.execCommand("insertHTML", false, lead + items.map((i) => uploadHtml(i.tempId, i.name)).join("") + "<br>");
      // caret on the fresh line under the files (a <br> at the very end needs a second one to show that line)
      const last = el.querySelector(`[data-temp="${items[items.length - 1].tempId}"]`);
      if (last) {
        let br = last.nextSibling;
        if (!br || br.nodeName !== "BR") {
          br = document.createElement("br");
          last.after(br);
        }
        if (!br.nextSibling) br.after(document.createElement("br"));
        const c = document.createRange();
        c.setStartAfter(br);
        c.collapse(true);
        const sel2 = window.getSelection();
        sel2?.removeAllRanges();
        sel2?.addRange(c);
        saved.current = c.cloneRange();
      }
      setHasBlocks(true);
      emit();
    },
    progress: (tempId, pct) => {
      const b = root.current?.querySelector<HTMLElement>(`[data-temp="${tempId}"]`);
      if (!b) return;
      (b.querySelector(".ocf-bar i") as HTMLElement).style.width = `${pct}%`;
      (b.querySelector(".ocf-pct") as HTMLElement).textContent = `${pct}%`;
    },
    resolveUpload: (tempId, f) => {
      const b = root.current?.querySelector<HTMLElement>(`[data-temp="${tempId}"]`);
      if (!b) return;
      // morph the same node, so a caret next to it doesn't jump
      const sel = window.getSelection();
      const caret = document.activeElement === root.current && sel?.rangeCount ? sel.getRangeAt(0).cloneRange() : null;
      if (f) {
        const nb = buildBlock(f.id, f);
        b.removeAttribute("data-temp");
        b.className = nb.className;
        b.dataset.file = f.id;
        b.title = nb.title;
        b.replaceChildren(...Array.from(nb.childNodes));
      } else b.remove();
      if (caret && sel) {
        sel.removeAllRanges();
        sel.addRange(caret);
      }
      emit();
    },
    removeFile: (id) => {
      root.current?.querySelectorAll(`[data-file="${id}"]`).forEach((b) => b.remove());
      emit();
    },
    focus: () => {
      const el = root.current;
      if (!el) return;
      el.focus();
      caretToEnd(el);
    },
    exec: (cmd, color) => {
      restore();
      document.execCommand("styleWithCSS", false, "false");
      if (cmd === "color") document.execCommand("foreColor", false, color);
      else document.execCommand(cmd);
      emit();
    },
    load: (stored: string) => {
      const opts: Option[] = [];
      const plain = stored.replace(TOKEN_RE, (_m, label: string, kind: Kind, id: string) => {
        opts.push({ kind, id, label });
        return `@${label}`;
      });
      setPicked(opts);
      setQuery(null);
      onChange(plain);
    },
    serialize: () => {
      // every "@Label" of a picked person/task/project becomes a token (the same person can be tagged twice);
      // longer labels first so "@Raka Putra" wins over "@Raka"
      let s = value;
      for (const o of [...picked].sort((a, b) => b.label.length - a.label.length)) {
        const plain = `@${o.label}`;
        const token = `@[${o.label.replace(/[\]\n]/g, " ")}](${o.kind}:${o.id})`;
        let from = 0;
        for (;;) {
          const i = s.indexOf(plain, from);
          if (i < 0) break;
          const next = s[i + plain.length] ?? "";
          if (/[\p{L}\p{N}]/u.test(next) || s[i - 1] === "[") {
            from = i + plain.length;
            continue;
          }
          s = s.slice(0, i) + token + s.slice(i + plain.length);
          from = i + token.length;
        }
      }
      return s;
    },
    reset: () => {
      setPicked([]);
      setQuery(null);
    },
  }));

  const options = useMemo<Option[]>(() => {
    if (!query) return [];
    const q = query.text.toLowerCase();
    const hit = (s: string) => s.toLowerCase().includes(q);
    const people = ctx.members.filter((m) => m.active && hit(m.name)).slice(0, 5).map((m) => ({ kind: "member" as const, id: m.id, label: m.name, sub: m.role }));
    const tasks = ctx.all
      .filter((t) => t.id !== currentTaskId && hit(t.title))
      .slice(0, 5)
      .map((t) => ({ kind: "task" as const, id: t.id, label: t.title, sub: t.parent_id ? ctx.all.find((x) => x.id === t.parent_id)?.title : ctx.projectById.get(t.project_id ?? "")?.name }));
    const projects = ctx.projects.filter((p) => p.status !== "parked" && hit(p.name)).slice(0, 3).map((p) => ({ kind: "project" as const, id: p.id, label: p.name }));
    return [...people, ...tasks, ...projects];
  }, [query, ctx, currentTaskId]);

  const choose = (o: Option) => {
    if (!query) return;
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const r = sel.getRangeAt(0);
    const len = query.text.length + 1;
    if (r.startContainer.nodeType === Node.TEXT_NODE && r.startOffset >= len) {
      const rr = document.createRange();
      rr.setStart(r.startContainer, r.startOffset - len);
      rr.setEnd(r.startContainer, r.startOffset);
      sel.removeAllRanges();
      sel.addRange(rr);
    }
    document.execCommand("insertText", false, `@${o.label} `);
    setPicked((p) => [...p.filter((x) => !(x.kind === o.kind && x.id === o.id)), o]);
    emit();
    setQuery(null);
  };

  const open = query !== null && options.length > 0;
  const groupTitle: Record<Kind, string> = { member: "Orang", task: "Task", project: "Project" };
  const empty = !stripFormat(value).trim() && !hasBlocks;
  const lineH = 1.5;

  return (
    <Box sx={{ position: "relative", flex: 1, minWidth: 0 }}>
      {empty && placeholder && (
        <Box aria-hidden sx={{ position: "absolute", inset: 0, py: 0.75, fontSize: "0.875rem", lineHeight: lineH, color: "#80868B", pointerEvents: "none", overflow: "hidden", ...inputSx }}>
          {placeholder}
        </Box>
      )}
      <Box
        ref={root}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline
        aria-label={ariaLabel ?? "Tulis komentar"}
        aria-autocomplete="list"
        aria-expanded={open}
        onInput={emit}
        onClick={(e) => {
          const t = e.target as HTMLElement;
          const x = t.closest<HTMLElement>("[data-x]");
          if (x) {
            e.preventDefault();
            return onRemoveFile?.(x.dataset.x!);
          }
          const b = t.closest<HTMLElement>("[data-file]");
          if (b) return onOpenFile?.(b.dataset.file!);
          detect();
        }}
        onDragOver={(e) => {
          if (onFiles && e.dataTransfer.types.includes("Files")) e.preventDefault();
        }}
        onDrop={(e) => {
          const list = Array.from(e.dataTransfer.files ?? []);
          if (!onFiles || !list.length) return;
          e.preventDefault();
          e.stopPropagation();
          // drop where the pointer is
          const d = document as Document & { caretRangeFromPoint?: (x: number, y: number) => Range | null };
          const r = d.caretRangeFromPoint?.(e.clientX, e.clientY);
          if (r && root.current?.contains(r.startContainer)) saved.current = r;
          onFiles(list);
        }}
        onKeyUp={(e) => {
          if (!["ArrowDown", "ArrowUp", "Enter", "Tab", "Escape"].includes(e.key)) detect();
        }}
        onBlur={() => setTimeout(() => setQuery(null), 150)}
        onPaste={(e) => {
          e.preventDefault();
          const pasted = Array.from(e.clipboardData.files ?? []);
          if (pasted.length && onFiles) return onFiles(pasted);
          const t = e.clipboardData.getData("text/plain");
          document.execCommand("insertHTML", false, esc(t));
          emit();
        }}
        onKeyDown={(e) => {
          if (open) {
            if (e.key === "ArrowDown") return (e.preventDefault(), setActive((a) => (a + 1) % options.length));
            if (e.key === "ArrowUp") return (e.preventDefault(), setActive((a) => (a - 1 + options.length) % options.length));
            if ((e.key === "Enter" || e.key === "Tab") && !e.nativeEvent.isComposing) return (e.preventDefault(), choose(options[active]));
            if (e.key === "Escape") return (e.preventDefault(), e.stopPropagation(), setQuery(null));
          }
          if ((e.ctrlKey || e.metaKey) && !e.altKey && ["b", "i", "u"].includes(e.key.toLowerCase())) {
            e.preventDefault();
            const k = e.key.toLowerCase();
            document.execCommand(k === "b" ? "bold" : k === "i" ? "italic" : "underline");
            return emit();
          }
          // "- " at the start of a line becomes a bullet "• "
          if (e.key === " " && !e.nativeEvent.isComposing && lineBefore() === "-") {
            e.preventDefault();
            deleteBack(1);
            document.execCommand("insertText", false, "• ");
            return emit();
          }
          if (e.key === "Enter" && !e.nativeEvent.isComposing) {
            if (!newlineOnEnter && !e.shiftKey) {
              e.preventDefault();
              return onSubmit();
            }
            e.preventDefault();
            const line = lineBefore();
            if (line !== null && line.startsWith("• ")) {
              // an empty bullet ends the list; otherwise the next line gets a bullet too
              if (line.trim() === "•") {
                deleteBack(2);
                return emit();
              }
              document.execCommand("insertLineBreak");
              document.execCommand("insertText", false, "• ");
              return emit();
            }
            document.execCommand("insertLineBreak");
            emit();
          }
        }}
        sx={{
          fontSize: "0.875rem",
          lineHeight: lineH,
          py: 0.75,
          outline: "none",
          whiteSpace: "pre-wrap",
          overflowWrap: "anywhere",
          color: "#1F1F1F",
          minHeight: `${(minRows ?? 1) * lineH}em`,
          maxHeight: `${(maxRows ?? (newlineOnEnter ? 24 : 6)) * lineH}em`,
          overflowY: "auto",
          boxSizing: "content-box",
          cursor: "text",
          "& font, & b, & i, & u": { fontFamily: "inherit" },
          ...editorFileSx,
          ...inputSx,
        }}
      />
      {open && (
        <Box
          role="listbox"
          sx={{ position: "absolute", left: -8, ...(popupBelow ? { top: "calc(100% + 6px)" } : { bottom: "calc(100% + 10px)" }), width: "min(360px, 90vw)", maxHeight: 300, overflowY: "auto", bgcolor: "#fff", borderRadius: "14px", boxShadow: "0 4px 24px rgba(60,64,67,.22)", py: 0.75, zIndex: 10, animation: "oc-pop-in 200ms cubic-bezier(0.22, 1, 0.36, 1)" }}
        >
          {options.map((o, i) => (
            <Box key={`${o.kind}-${o.id}`}>
              {(i === 0 || options[i - 1].kind !== o.kind) && (
                <Typography sx={{ fontSize: "0.6875rem", fontWeight: 600, color: "#5F6368", px: 1.75, pt: i ? 1 : 0.25, pb: 0.25 }}>{groupTitle[o.kind]}</Typography>
              )}
              <Box
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(o);
                }}
                onMouseEnter={() => setActive(i)}
                sx={{ display: "flex", alignItems: "center", gap: 1.25, px: 1.75, py: 0.75, cursor: "pointer", bgcolor: i === active ? "#EEF4FE" : "transparent" }}
              >
                {o.kind === "member" ? (
                  <MemberAvatar member={ctx.memberById.get(o.id)} size={24} />
                ) : o.kind === "project" ? (
                  <Box sx={{ width: 24, display: "grid", placeItems: "center" }}>
                    <ProjectMark project={ctx.projectById.get(o.id)} size={16} />
                  </Box>
                ) : (
                  <AssignmentRounded sx={{ fontSize: 20, color: "#5A86C2", width: 24 }} />
                )}
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontSize: "0.875rem", color: "#1F1F1F", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.label}</Typography>
                  {o.sub && <Typography sx={{ fontSize: "0.6875rem", color: "#5F6368", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.sub}</Typography>}
                </Box>
              </Box>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
});

function caretToEnd(el: HTMLElement) {
  const r = document.createRange();
  r.selectNodeContents(el);
  r.collapse(false);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(r);
}
