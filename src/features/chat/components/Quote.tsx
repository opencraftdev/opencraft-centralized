"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import FormatQuoteRounded from "@mui/icons-material/FormatQuoteRounded";
import CloseRounded from "@mui/icons-material/CloseRounded";

// Reply to a piece of an answer, like Claude: select text in an answer → a small "Balas" button floats above the
// selection → the text becomes a quote above the composer and is sent as a Markdown quote ("> …") in front of the
// message. The user bubble shows it as a quote block again.

const MAX_QUOTE = 1500;

/** "> line" for every line of the quote, then a blank line, then the message. A leading "/skill " stays first. */
export function withQuote(full: string, quote: string | null): string {
  if (!quote) return full;
  const block = quote
    .trim()
    .split("\n")
    .map((l) => `> ${l}`)
    .join("\n");
  const m = /^(\/[a-z0-9][a-z0-9-]*\s+)([\s\S]*)$/.exec(full);
  return m ? `${m[1]}${block}\n\n${m[2]}` : `${block}\n\n${full}`;
}

/** Splits leading "> " lines (a quote added by withQuote) off a message. */
export function splitQuote(text: string): { quote: string | null; rest: string } {
  const lines = text.split("\n");
  let i = 0;
  while (i < lines.length && /^> ?/.test(lines[i])) i++;
  if (i === 0) return { quote: null, rest: text };
  return {
    quote: lines
      .slice(0, i)
      .map((l) => l.replace(/^> ?/, ""))
      .join("\n"),
    rest: lines.slice(i).join("\n").replace(/^\n+/, ""),
  };
}

/** The quote inside a sent user bubble. */
export function QuoteBlock({ text }: { text: string }) {
  return (
    <Box
      sx={{
        mb: 1,
        pl: 1.25,
        borderLeft: "3px solid #A8C7FA",
        color: "#444746",
        fontSize: "0.875rem",
        lineHeight: 1.5,
        whiteSpace: "pre-wrap",
        display: "-webkit-box",
        WebkitLineClamp: 4,
        WebkitBoxOrient: "vertical",
        overflow: "hidden",
      }}
    >
      {text}
    </Box>
  );
}

/** The quote waiting above the composer. */
export function QuoteChip({ text, onClear }: { text: string; onClear: () => void }) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "flex-start",
        gap: 1,
        mb: 1,
        pl: 1.5,
        pr: 0.5,
        py: 1,
        bgcolor: "#F0F4F9",
        borderRadius: "14px",
        animation: "oc-rise 240ms cubic-bezier(0.22, 1, 0.36, 1) both",
      }}
    >
      <FormatQuoteRounded sx={{ fontSize: 18, color: "#0B57D0", mt: 0.25, flexShrink: 0 }} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ fontSize: "0.75rem", fontWeight: 500, color: "#0B57D0", mb: 0.25 }}>Membalas</Box>
        <Box
          sx={{
            fontSize: "0.8125rem",
            color: "#444746",
            lineHeight: 1.45,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            whiteSpace: "pre-wrap",
          }}
        >
          {text}
        </Box>
      </Box>
      <IconButton size="small" aria-label="Batalkan balasan" onClick={onClear} sx={{ color: "#444746" }}>
        <CloseRounded sx={{ fontSize: 18 }} />
      </IconButton>
    </Box>
  );
}

/**
 * Watches text selections inside `scope` and, when the selection sits in an answer ([data-answer]), floats a
 * "Balas" button above it.
 */
export function SelectionReply({ scope, onReply }: { scope: React.RefObject<HTMLElement | null>; onReply: (text: string) => void }) {
  const [at, setAt] = useState<{ x: number; y: number; text: string } | null>(null);
  const btn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const read = () => {
      const sel = window.getSelection();
      const root = scope.current;
      if (!sel || sel.isCollapsed || sel.rangeCount === 0 || !root) return setAt(null);
      const text = sel.toString().trim();
      if (!text) return setAt(null);
      const range = sel.getRangeAt(0);
      const node = range.commonAncestorContainer;
      const el = node.nodeType === 1 ? (node as Element) : node.parentElement;
      if (!el || !root.contains(el) || !el.closest("[data-answer]")) return setAt(null);
      const r = range.getBoundingClientRect();
      if (!r.width && !r.height) return setAt(null);
      setAt({ x: r.left + r.width / 2, y: r.top, text: text.slice(0, MAX_QUOTE) });
    };
    // after the mouse/finger lets go (not while dragging), and for keyboard selection
    const later = () => setTimeout(read, 0);
    const onSelChange = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) setAt(null);
    };
    const hide = () => setAt(null);
    document.addEventListener("mouseup", later);
    document.addEventListener("touchend", later);
    document.addEventListener("keyup", later);
    document.addEventListener("selectionchange", onSelChange);
    const root = scope.current;
    root?.addEventListener("scroll", hide, { passive: true });
    window.addEventListener("resize", hide);
    return () => {
      document.removeEventListener("mouseup", later);
      document.removeEventListener("touchend", later);
      document.removeEventListener("keyup", later);
      document.removeEventListener("selectionchange", onSelChange);
      root?.removeEventListener("scroll", hide);
      window.removeEventListener("resize", hide);
    };
  }, [scope]);

  if (!at || typeof document === "undefined") return null;
  const top = Math.max(8, at.y - 44);
  const left = Math.min(Math.max(at.x, 56), window.innerWidth - 56);
  return createPortal(
    <Box sx={{ position: "fixed", top, left, transform: "translateX(-50%)", zIndex: 1500 }}>
    <Box
      ref={btn}
      component="button"
      type="button"
      onMouseDown={(e: React.MouseEvent) => e.preventDefault()} // keep the selection while clicking
      onClick={() => {
        onReply(at.text);
        window.getSelection()?.removeAllRanges();
        setAt(null);
      }}
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 0.75,
        height: 34,
        px: 1.5,
        border: "none",
        borderRadius: "9999px",
        bgcolor: "#1F1F1F",
        color: "#fff",
        fontFamily: "inherit",
        fontSize: "0.8125rem",
        fontWeight: 500,
        cursor: "pointer",
        boxShadow: "0 4px 14px rgba(0,0,0,.2)",
        animation: "oc-pop-in 180ms cubic-bezier(0.22, 1, 0.36, 1) both",
        "&:hover": { bgcolor: "#3C4043" },
        "&:focus-visible": { outline: "2px solid #A8C7FA", outlineOffset: 2 },
      }}
    >
      <FormatQuoteRounded sx={{ fontSize: 18 }} />
      Balas
    </Box>
    </Box>,
    document.body,
  );
}
