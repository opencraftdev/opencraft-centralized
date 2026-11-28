"use client";

import { BlurUpMedia } from "@/components/ui/BlurUpMedia";
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import Box from "@mui/material/Box";
import ClickAwayListener from "@mui/material/ClickAwayListener";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import InputBase from "@mui/material/InputBase";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import AddRounded from "@mui/icons-material/AddRounded";
import AutoAwesomeRounded from "@mui/icons-material/AutoAwesomeRounded";
import CloseRounded from "@mui/icons-material/CloseRounded";
import PictureAsPdfRounded from "@mui/icons-material/PictureAsPdfRounded";
import ImageRounded from "@mui/icons-material/ImageRounded";
import { toastError } from "@/components/ui/Toast";
import { driveContentUrl } from "@/lib/drive/links";
import { uploadChatImage, withImages, type ChatImage } from "../images";
import SendRounded from "@mui/icons-material/SendRounded";
import StopRounded from "@mui/icons-material/StopRounded";
import type { SkillSummary } from "@/features/skills/api";

// The message box (docs/CHAT.md → "UI" → Composer): auto-grow, Enter sends / Shift+Enter new line (never while an IME
// composes), a draft per chat in localStorage. "/" at the start opens the skill menu (filter as you type, ↑↓ Enter/Tab,
// Esc closes); a chosen skill shows as a chip in front of the text and is sent as "/name " + text. While a run goes,
// Stop shows and Enter still sends (the server queues the message). Looks like Gemini's prompt box (light): a #F0F4F9
// pill with "+" (skill list) on the left, the send button appearing once there is text, Stop while a run goes.

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
        bgcolor: "#D3E3FD",
        color: "#041E49",
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
          sx={{ width: 22, height: 22, color: "inherit", "&:hover": { bgcolor: "rgba(4,30,73,0.1)" } }}
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
  below,
  onPick,
  onHover,
}: {
  hits: SkillSummary[];
  active: number;
  below?: boolean; // open under the box (new chat: the box sits mid-screen) instead of above it
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
    <Box
      sx={{
        position: "absolute",
        left: 0,
        right: 0,
        ...(below ? { top: "calc(100% + 8px)" } : { bottom: "calc(100% + 8px)" }),
        zIndex: 5,
        bgcolor: "#fff",
        borderRadius: "16px",
        boxShadow: "0 1px 2px rgba(0,0,0,.3), 0 2px 6px 2px rgba(0,0,0,.15)",
        p: 1,
        cursor: "default",
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 1.5, pt: 0.5, pb: 1 }}>
        <Typography sx={{ fontSize: "0.875rem", fontWeight: 500, color: "#444746" }}>Skill</Typography>
        <Typography sx={{ display: { xs: "none", sm: "block" }, fontSize: "0.75rem", color: "#5E5E5E" }}>
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
                alignItems: "flex-start",
                gap: 1.5,
                px: 1.5,
                py: 1,
                border: "none",
                borderRadius: "12px",
                bgcolor: i === active ? "#F0F4F9" : "transparent",
                fontFamily: "inherit",
                textAlign: "left",
                cursor: "pointer",
              }}
            >
              <AutoAwesomeRounded sx={{ fontSize: 20, color: "#444746", mt: 0.25, flexShrink: 0 }} />
              <Box component="span" sx={{ display: "flex", flexDirection: "column", gap: 0.25, minWidth: 0, flex: 1 }}>
              <Box component="span" sx={{ display: "flex", alignItems: "baseline", gap: 1, minWidth: 0 }}>
                <Box component="span" sx={{ fontSize: "0.9375rem", fontWeight: 500, color: "#1F1F1F", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {s.title}
                </Box>
                <Box component="span" sx={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: "0.75rem", color: "#5E5E5E", flexShrink: 0 }}>
                  /{s.name}
                </Box>
              </Box>
              <Box
                component="span"
                sx={{
                  fontSize: "0.8125rem",
                  color: "#444746",
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
            </Box>
          </li>
        ))}
      </Box>
      <Box sx={{ px: 1.5, pt: 1, pb: 0.5, borderTop: "1px solid #E3E3E3", mt: 0.5 }}>
        <Typography component={Link} href="/skills" sx={{ fontSize: "0.8125rem", fontWeight: 500, color: "#0B57D0", textDecoration: "none", "&:hover": { textDecoration: "underline" } }}>
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
    menuBelow?: boolean; // the skill menu opens under the box
    onSend: (text: string) => Promise<boolean>;
    onStop?: () => void;
  }
>(function Composer({ draftId, skills, placeholder, running, stopping, autoFocus, menuBelow, onSend, onStop }, ref) {
  const [skill, setSkill] = useState<SkillSummary | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [active, setActive] = useState(0);
  const [closedFor, setClosedFor] = useState<string | null>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  // Pictures attached to the next message (uploaded right away; `id` null while uploading).
  const [images, setImages] = useState<{ key: string; name: string; image: ChatImage | null; pdf?: boolean }[]>([]);
  // Files dragged anywhere on the page land here (instead of the browser opening them in a new tab)
  const [dragging, setDragging] = useState(false);
  const addRef = useRef<(f: File[]) => void>(() => {});
  useEffect(() => {
    let depth = 0;
    const hasFiles = (e: DragEvent) => !!e.dataTransfer && Array.from(e.dataTransfer.types).includes("Files");
    const enter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth++;
      setDragging(true);
    };
    const leave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth = Math.max(0, depth - 1);
      if (!depth) setDragging(false);
    };
    const over = (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault();
    };
    const drop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setDragging(false);
      const list = Array.from(e.dataTransfer?.files ?? []);
      if (list.length) addRef.current(list);
    };
    window.addEventListener("dragenter", enter);
    window.addEventListener("dragleave", leave);
    window.addEventListener("dragover", over);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragenter", enter);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("dragover", over);
      window.removeEventListener("drop", drop);
    };
  }, []);
  const fileInput = useRef<HTMLInputElement>(null);
  const addImages = (files: File[]) => {
    const ok = files.filter((f) => f.type.startsWith("image/") || f.type === "application/pdf");
    if (ok.length < files.length) toastError("Hanya gambar dan PDF yang bisa dilampirkan di chat.");
    for (const file of ok) {
      const key = `${Date.now()}-${Math.random()}`;
      setImages((l) => [...l, { key, name: file.name, image: null, pdf: file.type === "application/pdf" }]);
      uploadChatImage(file).then(
        (image) => setImages((l) => l.map((x) => (x.key === key ? { ...x, image } : x))),
        (e: Error) => {
          toastError(`Gagal mengunggah gambar: ${e.message}`);
          setImages((l) => l.filter((x) => x.key !== key));
        },
      );
    }
  };
  const uploading = images.some((x) => !x.image);
  addRef.current = addImages;
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

  const [plus, setPlus] = useState(false); // the "+" button opened the skill list
  const slashHits = useMemo(
    () => (skill || closedFor === text ? null : matchSkills(skills, text)),
    [skill, closedFor, text, skills],
  );
  const hits = slashHits?.length ? slashHits : plus && skills.length ? skills : null;
  const menuOpen = Boolean(hits?.length);
  useEffect(() => setActive(0), [text, plus]);

  const change = (v: string) => {
    setPlus(false);
    // "/name " typed out in full: the skill becomes the chip
    if (!skill) {
      const m = /^\/([a-z0-9][a-z0-9-]*)\s([\s\S]*)$/.exec(v);
      const found = m ? skills.find((s) => s.name === m[1]) : null;
      if (found) return save(found, m![2]);
    }
    save(skill, v);
  };
  const pick = (s: SkillSummary) => {
    // from "/…": the typed filter goes; from "+": the text typed so far stays
    save(s, text.startsWith("/") ? "" : text);
    setPlus(false);
    input.current?.focus();
  };
  const closeMenu = () => {
    setPlus(false);
    setClosedFor(text);
  };

  const canSend = (text.trim().length > 0 || Boolean(skill) || images.length > 0) && !sending && !uploading;
  const send = async () => {
    if (!canSend) return;
    const full = withImages(
      (skill ? `/${skill.name} ${text}` : text).trim(),
      images.flatMap((x) => (x.image ? [x.image] : [])),
    );
    setSending(true);
    try {
      if (await onSend(full)) {
        save(null, "");
        setImages([]);
      }
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
        closeMenu();
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

  const roundBtn = { width: 40, height: 40, flexShrink: 0 } as const;

  return (
    <ClickAwayListener onClickAway={() => menuOpen && closeMenu()}>
      <Box
        onClick={(e) => {
          if (e.target === e.currentTarget) input.current?.focus();
        }}
        sx={{
          position: "relative",
          display: "flex",
          alignItems: "flex-end",
          gap: 0.5,
          minHeight: 64,
          px: 1,
          py: 1.5, // 64 = 12 + 40 + 12: the 40px buttons sit centred while the box is one line
          borderRadius: "32px",
          bgcolor: "#F0F4F9",
          cursor: "text",
          transition: "box-shadow .15s, background-color .15s",
          "&:focus-within": { bgcolor: "#EDF2FA", boxShadow: "0 1px 3px rgba(60,64,67,.12)" },
        }}
      >
        {dragging && (
          <Box sx={{ position: "absolute", inset: -4, zIndex: 5, borderRadius: "34px", border: "2px dashed #0B57D0", bgcolor: "rgba(232,240,254,.92)", display: "grid", placeItems: "center", color: "#0B57D0", fontSize: "0.875rem", fontWeight: 500, pointerEvents: "none" }}>
            Lepas untuk melampirkan gambar atau PDF
          </Box>
        )}
                {menuOpen && hits && <SkillMenu hits={hits} active={active} below={menuBelow} onPick={pick} onHover={setActive} />}
        <Tooltip title={plus ? "" : "Pakai skill"}>
          <span style={{ display: "inline-flex" }}>
            <IconButton
              aria-label="Pakai skill"
              aria-haspopup="listbox"
              aria-expanded={plus}
              disabled={!skills.length}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                if (plus) closeMenu();
                else {
                  setClosedFor(null);
                  setPlus(true);
                  input.current?.focus();
                }
              }}
              sx={{ ...roundBtn, color: "#444746", "&:hover": { bgcolor: "rgba(68,71,70,0.08)" } }}
            >
              <AddRounded sx={{ fontSize: 26 }} />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Lampirkan gambar atau PDF">
          <IconButton
            aria-label="Lampirkan gambar atau PDF"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => fileInput.current?.click()}
            sx={{ ...roundBtn, ml: -0.5, color: "#444746", "&:hover": { bgcolor: "rgba(68,71,70,0.08)" } }}
          >
            <ImageRounded sx={{ fontSize: 22 }} />
          </IconButton>
        </Tooltip>
        <input
          ref={fileInput}
          type="file"
          accept="image/*,application/pdf"
          multiple
          hidden
          onChange={(e) => {
            addImages(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />
        <Box sx={{ flex: 1, minWidth: 0, alignSelf: "center", display: "flex", flexDirection: "column" }}>
          {images.length > 0 && (
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, pt: 0.5, pb: 0.5 }}>
              {images.map((x) => (
                <Box key={x.key} sx={{ position: "relative", width: 56, height: 56, borderRadius: "12px", overflow: "hidden", bgcolor: "#E3E3E3", flexShrink: 0 }} title={x.name}>
                  {x.pdf && x.image ? (
                    <Box sx={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", bgcolor: "#FCE8E6", color: "#D93025", fontSize: "0.5625rem", fontWeight: 700, gap: 0.25 }}>
                      <PictureAsPdfRounded sx={{ fontSize: 22 }} />
                      PDF
                    </Box>
                  ) : x.image ? (
                    <BlurUpMedia src={driveContentUrl(x.image.file_id)} alt={x.name} lazy={false} />
                  ) : (
                    <Box sx={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <CircularProgress size={18} />
                    </Box>
                  )}
                  <IconButton
                    size="small"
                    aria-label={`Hapus ${x.name}`}
                    onClick={() => setImages((l) => l.filter((y) => y.key !== x.key))}
                    sx={{ position: "absolute", top: 2, right: 2, width: 20, height: 20, bgcolor: "rgba(0,0,0,.55)", color: "#fff", "&:hover": { bgcolor: "rgba(0,0,0,.7)" } }}
                  >
                    <CloseRounded sx={{ fontSize: 14 }} />
                  </IconButton>
                </Box>
              ))}
            </Box>
          )}
          {skill && (
            <Box sx={{ pt: 0.5, pb: 0.25, display: "flex" }}>
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
            onPaste={(e) => {
              const files = Array.from(e.clipboardData.files).filter((f) => f.type.startsWith("image/"));
              if (files.length) {
                e.preventDefault();
                addImages(files);
              }
            }}
            placeholder={
              skill ? `Tulis permintaan untuk ${skill.title}…` : running ? "Tulis pesan berikutnya…" : placeholder
            }
            sx={{
              px: 0.5,
              py: "8px", // one line = 40px, the height of the round buttons beside it
              fontSize: "1rem",
              lineHeight: 1.5,
              color: "#1F1F1F",
              "& textarea::placeholder": { color: "#444746", opacity: 1 },
            }}
            inputProps={{
              "aria-label": "Tulis pesan",
              role: "combobox",
              "aria-expanded": menuOpen,
              "aria-autocomplete": "list",
              enterKeyHint: "send",
            }}
          />
        </Box>
        {running && (
          <Tooltip title="Hentikan">
            <span style={{ display: "inline-flex" }}>
              <IconButton
                onClick={onStop}
                disabled={stopping}
                aria-label="Hentikan"
                sx={{
                  ...roundBtn,
                  bgcolor: "#D3E3FD",
                  color: "#041E49",
                  "&:hover": { bgcolor: "#C2D7FA" },
                  "&.Mui-disabled": { bgcolor: "#E3E3E3", color: "#5E5E5E" },
                }}
              >
                {stopping ? <CircularProgress size={16} color="inherit" /> : <StopRounded sx={{ fontSize: 22 }} />}
              </IconButton>
            </span>
          </Tooltip>
        )}
        {(canSend || sending) && (
          <Tooltip title="Kirim (Enter)">
            <span style={{ display: "inline-flex" }}>
              <IconButton
                onClick={() => void send()}
                disabled={!canSend}
                aria-label="Kirim"
                sx={{
                  ...roundBtn,
                  bgcolor: "#0B57D0",
                  color: "#fff",
                  "&:hover": { bgcolor: "#0842A0" },
                  "&.Mui-disabled": { bgcolor: "#0B57D0", color: "#fff", opacity: 0.6 },
                }}
              >
                {sending ? <CircularProgress size={16} color="inherit" /> : <SendRounded sx={{ fontSize: 20, ml: 0.25 }} />}
              </IconButton>
            </span>
          </Tooltip>
        )}
      </Box>
    </ClickAwayListener>
  );
});
