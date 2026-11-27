"use client";

import { Fragment } from "react";

// Plain text with URLs turned into links (opened in a new tab). Text stays text: nothing is parsed as HTML.

const URL_RE = /(https?:\/\/[^\s<>"]+|www\.[^\s<>"]+)/gi;
const TRAILING = /[.,;:!?)\]}'"]+$/;

export function Linkify({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(URL_RE)) {
    const start = m.index ?? 0;
    let url = m[0];
    // Leave sentence punctuation after a link outside it ("lihat https://x.com/a.").
    const trail = url.match(TRAILING)?.[0] ?? "";
    if (trail && !(trail.startsWith(")") && url.includes("("))) url = url.slice(0, url.length - trail.length);
    if (start > last) parts.push(text.slice(last, start));
    const href = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    parts.push(
      <a
        key={start}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        style={{ color: "#0B57D0", textDecoration: "underline", textUnderlineOffset: 2, overflowWrap: "anywhere" }}
      >
        {url}
      </a>,
    );
    last = start + url.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <Fragment>{parts}</Fragment>;
}
