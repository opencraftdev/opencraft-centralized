"use client";

import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from "react";
import Box from "@mui/material/Box";
import InputBase from "@mui/material/InputBase";
import Typography from "@mui/material/Typography";
import AssignmentRounded from "@mui/icons-material/AssignmentRounded";
import { Linkify } from "@/components/ui/Linkify";
import type { Task } from "../types";
import type { TasksCtx } from "./TasksApp";
import { MemberAvatar, ProjectMark } from "./bits";

// "@" in a comment: pick a person, another task or a project. Stored in the comment body as
// @[Label](member|task|project:<uuid>) and shown as a chip; the text box itself shows plain "@Label".

type Kind = "member" | "task" | "project";
type Option = { kind: Kind; id: string; label: string; sub?: string };

const TOKEN_RE = /@\[([^\]\n]{1,120})\]\((member|task|project):([0-9a-f-]{36})\)/g;

/** Renders a comment body: mention chips + clickable links. */
export function CommentBody({ text, ctx, onOpenTask }: { text: string; ctx: TasksCtx; onOpenTask: (t: Task) => void }) {
  const out: React.ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(TOKEN_RE)) {
    const start = m.index ?? 0;
    if (start > last) out.push(<Linkify key={`t${last}`} text={text.slice(last, start)} />);
    const [, label, kind, id] = m;
    out.push(<Chip key={`m${start}`} kind={kind as Kind} id={id} label={label} ctx={ctx} onOpenTask={onOpenTask} />);
    last = start + m[0].length;
  }
  if (last < text.length) out.push(<Linkify key={`t${last}`} text={text.slice(last)} />);
  return <>{out}</>;
}

function Chip({ kind, id, label, ctx, onOpenTask }: { kind: Kind; id: string; label: string; ctx: TasksCtx; onOpenTask: (t: Task) => void }) {
  const base = { display: "inline-flex", alignItems: "center", gap: 0.5, verticalAlign: "bottom", px: 0.75, mx: "1px", height: 22, borderRadius: "9999px", fontSize: "0.8125rem", fontWeight: 600, border: "none", fontFamily: "inherit", maxWidth: "100%" } as const;
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
      <MemberAvatar member={m} size={18} />@{m?.name ?? label}
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
}

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
}>(function MentionInput({ value, onChange, onSubmit, ctx, currentTaskId, placeholder, minRows, newlineOnEnter, popupBelow, inputSx, ariaLabel }, ref) {
  const input = useRef<HTMLTextAreaElement | null>(null);
  const [picked, setPicked] = useState<Option[]>([]);
  const [query, setQuery] = useState<{ text: string; start: number } | null>(null);
  const [active, setActive] = useState(0);

  useImperativeHandle(ref, () => ({
    focus: () => input.current?.focus(),
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
      let s = value;
      for (const o of picked) {
        const plain = `@${o.label}`;
        const i = s.indexOf(plain);
        if (i >= 0) s = s.slice(0, i) + `@[${o.label.replace(/[\]\n]/g, " ")}](${o.kind}:${o.id})` + s.slice(i + plain.length);
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

  // Look for "@word" right before the caret.
  const detect = (text: string, caret: number) => {
    const before = text.slice(0, caret);
    const m = before.match(/(^|\s)@([^\s@][^@\n]{0,40})?$/);
    if (!m) return setQuery(null);
    const q = m[2] ?? "";
    setQuery({ text: q, start: caret - q.length - 1 });
    setActive(0);
  };

  const choose = (o: Option) => {
    if (!query) return;
    const caret = input.current?.selectionStart ?? value.length;
    const insert = `@${o.label} `;
    const next = value.slice(0, query.start) + insert + value.slice(caret);
    onChange(next);
    setPicked((p) => [...p.filter((x) => !(x.kind === o.kind && x.id === o.id)), o]);
    setQuery(null);
    const pos = query.start + insert.length;
    requestAnimationFrame(() => {
      input.current?.focus();
      input.current?.setSelectionRange(pos, pos);
    });
  };

  const open = query !== null && options.length > 0;
  const groupTitle: Record<Kind, string> = { member: "Orang", task: "Tugas", project: "Project" };

  return (
    <Box sx={{ position: "relative", flex: 1, minWidth: 0 }}>
      <InputBase
        inputRef={input}
        fullWidth
        multiline
        maxRows={newlineOnEnter ? 24 : 6}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          detect(e.target.value, e.target.selectionStart ?? e.target.value.length);
        }}
        onClick={(e) => detect(value, (e.target as HTMLTextAreaElement).selectionStart ?? value.length)}
        onBlur={() => setTimeout(() => setQuery(null), 150)}
        onKeyDown={(e) => {
          if (open) {
            if (e.key === "ArrowDown") return (e.preventDefault(), setActive((a) => (a + 1) % options.length));
            if (e.key === "ArrowUp") return (e.preventDefault(), setActive((a) => (a - 1 + options.length) % options.length));
            if ((e.key === "Enter" || e.key === "Tab") && !e.nativeEvent.isComposing) return (e.preventDefault(), choose(options[active]));
            if (e.key === "Escape") return (e.preventDefault(), e.stopPropagation(), setQuery(null));
          }
          if (!newlineOnEnter && e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            onSubmit();
          }
        }}
        placeholder={placeholder}
        minRows={minRows}
        sx={{ fontSize: "0.875rem", py: 0.75, ...inputSx }}
        inputProps={{ "aria-label": ariaLabel ?? "Tulis komentar", "aria-autocomplete": "list", "aria-expanded": open }}
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
