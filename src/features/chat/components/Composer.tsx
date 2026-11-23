"use client";

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import InputBase from "@mui/material/InputBase";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import ArrowUpwardRounded from "@mui/icons-material/ArrowUpwardRounded";
import AutoAwesomeRounded from "@mui/icons-material/AutoAwesomeRounded";
import CloseRounded from "@mui/icons-material/CloseRounded";
import StopRounded from "@mui/icons-material/StopRounded";
import type { SkillSummary } from "@/features/skills/api";

// The message box (docs/CHAT.md → "UI" → Composer): auto-grow, Enter sends / Shift+Enter new line (never while an IME
// composes), a draft per chat in localStorage. "/" at the start opens the skill menu (filter as you type, ↑↓ Enter/Tab,
// Esc closes); a chosen skill shows as a chip in front of the text and is sent as "/name " + text. While a run goes,
// Stop shows and Enter still sends (the server queues the message).

// ── storage (every access guarded: private mode, blocked storage) ──
function readDraft(key: string): string {
  try {
    return window.localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}
function writeDraft(key: string, value: string) {
  try {
    if (value) window.localStorage.setItem(key, value);
    else window.localStorage.removeItem(key);
  } catch {
    /* storage unavailable: the draft lives in memory only */
  }
}
export const draftKey = (chatId: string) => `chat:draft:${chatId}`;

// ── skills ──
/** "/name rest" with a known skill → { skill, text: rest }; else the whole thing is text. */
export function splitSkill(full: string, skills: SkillSummary[]): { skill: SkillSummary | null; text: string } {
  const m = /^\/([a-z0-9][a-z0-9-]*)(?:\s+|$)([\s\S]*)$/.exec(full);
  const skill = m ? skills.find((s) => s.name === m[1]) ?? null : null;
  return skill ? { skill, text: m![2] } : { skill: null, text: full };
}

/** The skills that fit what is typed after "/" (null: not a skill command). Name starts first. */
function matchSkills(skills: SkillSummary[], text: string): SkillSummary[] | null {
  if (!text.startsWith("/") || text.includes("\n") || text.includes(" ")) return null;
  const q = text.slice(1).toLowerCase();
  const hits = skills.filter((s) => s.name.includes(q) || s.title.toLowerCase().includes(q));
  return hits.sort((a, b) => Number(!a.name.startsWith(q)) - Number(!b.name.startsWith(q)));
}

export function SkillChip({ skill, onRemove }: { skill: SkillSummary; onRemove?: () => void }) {
  return (
    <Box
      component="span"
      title={`/${skill.name}`}
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 0.5,
        maxWidth: "100%",
        height: 26,
        pl: 1,
        pr: onRemove ? 0.25 : 1.25,
        borderRadius: "9999px",
        bgcolor: "#EADDFF",
        color: "#4F378B",
        fontSize: "0.8125rem",
        fontWeight: 500,
        flexShrink: 0,
      }}
    >
      <AutoAwesomeRounded sx={{ fontSize: 14 }} />
      <Box component="span" sx={{ minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {skill.title}
      </Box>
      {onRemove && (
        <IconButton
          size="small"
          aria-label={`Lepas skill ${skill.title}`}
          onClick={onRemove}
          sx={{ width: 22, height: 22, color: "inherit", "&:hover": { bgcolor: "rgba(79,55,139,0.12)" } }}
        >
          <CloseRounded sx={{ fontSize: 14 }} />
        </IconButton>
      )}
    </Box>
  );
}

function SkillMenu({
  hits,
  active,
  onPick,
  onHover,
}: {
  hits: SkillSummary[];
  active: number;
  onPick: (s: SkillSummary) => void;
  onHover: (i: number) => void;
}) {
  const list = useRef<HTMLUListElement>(null);
  const pointer = useRef<{ x: number; y: number } | null>(null);
  // keep the chosen row in sight: only the list scrolls, never the page
  useEffect(() => {
    const el = list.current;
    const row = el?.children[active] as HTMLElement | undefined;
    if (!el || !row) return;
    if (row.offsetTop < el.scrollTop) el.scrollTop = row.offsetTop;
    else if (row.offsetTop + row.offsetHeight > el.scrollTop + el.clientHeight)
      el.scrollTop = row.offsetTop + row.offsetHeight - el.clientHeight;
  }, [active, hits]);

  return (
    <Box sx={{ px: 1, pt: 1, borderBottom: "1px solid #E0E3E7", pb: 0.5 }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 1, pb: 0.5 }}>
        <Typography sx={{ display: "flex", alignItems: "center", gap: 0.5, fontSize: "0.75rem", fontWeight: 600, color: "#444746" }}>
          <AutoAwesomeRounded sx={{ fontSize: 14, color: "#8E5CF5" }} /> Skill
        </Typography>
        <Typography sx={{ display: { xs: "none", sm: "block" }, fontSize: "0.6875rem", color: "#9AA0A6" }}>
          ↑↓ pilih · Enter pakai · Esc tutup
        </Typography>
      </Box>
      <Box
        component="ul"
        ref={list}
        role="listbox"
        aria-label="Skill"
        sx={{ position: "relative", m: 0, p: 0, listStyle: "none", maxHeight: "min(16rem, 40dvh)", overflowY: "auto", overscrollBehavior: "contain" }}
      >
        {hits.map((s, i) => (
          <li key={s.name} role="option" aria-selected={i === active}>
            <Box
              component="button"
              type="button"
              onMouseDown={(e) => e.preventDefault()} // keep the focus in the box
              onClick={() => onPick(s)}
              onMouseMove={(e) => {
                const p = pointer.current;
                if (p && p.x === e.clientX && p.y === e.clientY) return;
                pointer.current = { x: e.clientX, y: e.clientY };
                if (i !== active) onHover(i);
              }}
              sx={{
                width: "100%",
                display: "flex",
                flexDirection: "column",
                alignItems: "stretch",
                gap: 0.125,
                px: 1,
                py: 0.75,
                border: "none",
                borderRadius: "10px",
                bgcolor: i === active ? "#E9EEF6" : "transparent",
                fontFamily: "inherit",
                textAlign: "left",
                cursor: "pointer",
              }}
            >
              <Box component="span" sx={{ display: "flex", alignItems: "baseline", gap: 1, minWidth: 0 }}>
                <Box component="span" sx={{ fontSize: "0.875rem", fontWeight: 500, color: "#1F1F1F", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {s.title}
                </Box>
                <Box component="span" sx={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: "0.75rem", color: "#5F6368", flexShrink: 0 }}>
                  /{s.name}
                </Box>
              </Box>
              <Box
                component="span"
                sx={{
                  fontSize: "0.75rem",
                  color: "#5F6368",
                  lineHeight: 1.45,
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {s.description}
              </Box>
            </Box>
          </li>
        ))}
      </Box>
      <Box sx={{ px: 1, pt: 0.5 }}>
        <Typography component={Link} href="/skills" sx={{ fontSize: "0.75rem", color: "#0B57D0", textDecoration: "none", "&:hover": { textDecoration: "underline" } }}>
          Kelola skill
        </Typography>
      </Box>
    </Box>
  );
}

// ── composer ──
export interface ComposerHandle {
  focus: () => void;
  /** Replaces the box's content ("/name " becomes the skill chip). */
  setValue: (full: string) => void;
}

export const Composer = forwardRef<
  ComposerHandle,
  {
    draftId: string; // draft key: chat id, or "new"
    skills: SkillSummary[];
    placeholder: string;
    running?: boolean; // a run is in progress: Stop shows; sends still go (server queue)
    stopping?: boolean;
    autoFocus?: boolean;
    onSend: (text: string) => Promise<boolean>;
    onStop?: () => void;
  }
>(function Composer({ draftId, skills, placeholder, running, stopping, autoFocus, onSend, onStop }, ref) {
  const [skill, setSkill] = useState<SkillSummary | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [active, setActive] = useState(0);
  const [closedFor, setClosedFor] = useState<string | null>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const skillsRef = useRef(skills);
  skillsRef.current = skills;

  const apply = (full: string, save = true) => {
    const s = splitSkill(full, skillsRef.current);
    setSkill(s.skill);
    setText(s.text);
    if (save) writeDraft(draftKey(draftId), full);
  };
  const save = (sk: SkillSummary | null, t: string) => {
    setSkill(sk);
    setText(t);
    writeDraft(draftKey(draftId), sk ? `/${sk.name} ${t}` : t);
  };

  useImperativeHandle(
    ref,
    () => ({
      focus: () => input.current?.focus(),
      setValue: (full: string) => {
        apply(full);
        requestAnimationFrame(() => {
          const el = input.current;
          if (!el) return;
          el.focus();
          el.setSelectionRange(el.value.length, el.value.length);
        });
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [draftId],
  );

  // draft per chat
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => apply(readDraft(draftKey(draftId)), false), [draftId]);

  const hits = useMemo(
    () => (skill || closedFor === text ? null : matchSkills(skills, text)),
    [skill, closedFor, text, skills],
  );
  const menuOpen = Boolean(hits?.length);
  useEffect(() => setActive(0), [text]);

  const change = (v: string) => {
    // "/name " typed out in full: the skill becomes the chip
    if (!skill) {
      const m = /^\/([a-z0-9][a-z0-9-]*)\s([\s\S]*)$/.exec(v);
      const found = m ? skills.find((s) => s.name === m[1]) : null;
      if (found) return save(found, m![2]);
    }
    save(skill, v);
  };
  const pick = (s: SkillSummary) => {
    save(s, "");
    input.current?.focus();
  };

  const canSend = (text.trim().length > 0 || Boolean(skill)) && !sending;
  const send = async () => {
    if (!canSend) return;
    const full = (skill ? `/${skill.name} ${text}` : text).trim();
    setSending(true);
    try {
      if (await onSend(full)) save(null, "");
    } finally {
      setSending(false);
      input.current?.focus();
    }
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const composing = e.nativeEvent.isComposing || e.keyCode === 229;
    if (composing) return;
    if (menuOpen && hits) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        setActive((i) => (i + (e.key === "ArrowDown" ? 1 : hits.length - 1)) % hits.length);
        return;
      }
      if ((e.key === "Enter" && !e.shiftKey) || e.key === "Tab") {
        e.preventDefault();
        pick(hits[active] ?? hits[0]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setClosedFor(text);
        return;
      }
    }
    if (e.key === "Backspace" && skill && !text && (e.currentTarget as HTMLTextAreaElement).selectionStart === 0) {
      e.preventDefault();
      save(null, "");
      return;
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  return (
    <Box
      onClick={(e) => {
        if (e.target === e.currentTarget) input.current?.focus();
      }}
      sx={{
        display: "flex",
        flexDirection: "column",
        borderRadius: "24px",
        border: "1px solid #C4C7C5",
        bgcolor: "#fff",
        cursor: "text",
        overflow: "hidden",
        transition: "border-color .15s",
        "&:focus-within": { borderColor: "#0B57D0" },
      }}
    >
      {menuOpen && hits && <SkillMenu hits={hits} active={active} onPick={pick} onHover={setActive} />}
      {skill && (
        <Box sx={{ px: 1.5, pt: 1.25, display: "flex" }}>
          <SkillChip
            skill={skill}
            onRemove={() => {
              save(null, text);
              input.current?.focus();
            }}
          />
        </Box>
      )}
      <InputBase
        multiline
        minRows={1}
        maxRows={10}
        autoFocus={autoFocus}
        inputRef={input}
        value={text}
        onChange={(e) => change(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={
          skill ? `Tulis permintaan untuk ${skill.title}…` : running ? "Tulis pesan berikutnya — dikirim setelah jawaban selesai" : placeholder
        }
        sx={{ px: 2.25, pt: skill ? 0.75 : 1.5, pb: 0.5, fontSize: "0.9375rem", lineHeight: 1.5 }}
        inputProps={{
          "aria-label": "Tulis pesan",
          role: "combobox",
          "aria-expanded": menuOpen,
          "aria-autocomplete": "list",
          enterKeyHint: "send",
        }}
      />
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, px: 1, pb: 1 }}>
        <Typography sx={{ flex: 1, minWidth: 0, pl: 1.25, fontSize: "0.6875rem", color: "#9AA0A6", display: { xs: "none", sm: "block" } }}>
          {skills.length ? "Ketik / untuk memakai skill" : ""}
        </Typography>
        <Box sx={{ flex: 1, display: { xs: "block", sm: "none" } }} />
        {running && (
          <Tooltip title="Hentikan">
            <span>
              <IconButton
                onClick={onStop}
                disabled={stopping}
                aria-label="Hentikan"
                sx={{
                  width: 36,
                  height: 36,
                  bgcolor: "#1F1F1F",
                  color: "#fff",
                  "&:hover": { bgcolor: "#444746" },
                  "&.Mui-disabled": { bgcolor: "#E3E3E3", color: "#9AA0A6" },
                }}
              >
                {stopping ? <CircularProgress size={16} color="inherit" /> : <StopRounded sx={{ fontSize: 20 }} />}
              </IconButton>
            </span>
          </Tooltip>
        )}
        {(!running || canSend) && (
          <Tooltip title="Kirim (Enter)">
            <span>
              <IconButton
                onClick={() => void send()}
                disabled={!canSend}
                aria-label="Kirim"
                sx={{
                  width: 36,
                  height: 36,
                  bgcolor: "#0B57D0",
                  color: "#fff",
                  "&:hover": { bgcolor: "#0842A0" },
                  "&.Mui-disabled": { bgcolor: "#E3E3E3", color: "#9AA0A6" },
                }}
              >
                {sending ? <CircularProgress size={16} color="inherit" /> : <ArrowUpwardRounded sx={{ fontSize: 20 }} />}
              </IconButton>
            </span>
          </Tooltip>
        )}
      </Box>
    </Box>
  );
});
