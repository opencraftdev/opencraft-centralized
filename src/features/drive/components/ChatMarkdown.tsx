"use client";

import { memo } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import Box from "@mui/material/Box";

// The agent's replies are Markdown (docs/DRIVE.md → "Chat v2": short paragraphs, numbered lists, **bold**, tables).
// Rendered with react-markdown + remark-gfm (no raw HTML). Links open in a new tab; wide tables scroll sideways.

const components: Components = {
  a: ({ node: _node, href, children, ...rest }) => (
    <a {...rest} href={href} target="_blank" rel="noopener noreferrer nofollow">
      {children}
    </a>
  ),
  table: ({ node: _node, children, ...rest }) => (
    <Box className="md-table" sx={{ overflowX: "auto", my: 1.5, border: "1px solid #E0E3E7", borderRadius: "10px" }}>
      <table {...rest}>{children}</table>
    </Box>
  ),
};

const remarkPlugins = [remarkGfm];

export const ChatMarkdown = memo(function ChatMarkdown({ text }: { text: string }) {
  return (
    <Box
      sx={{
        color: "#1F1F1F",
        fontSize: "0.9375rem",
        lineHeight: 1.7,
        wordBreak: "break-word",
        overflowWrap: "anywhere",
        "& > :first-of-type": { mt: 0 },
        "& > :last-child": { mb: 0 },
        "& p": { my: 1.25 },
        "& h1, & h2, & h3, & h4, & h5, & h6": { fontWeight: 600, lineHeight: 1.35, mt: 2.5, mb: 1, color: "#1F1F1F" },
        "& h1": { fontSize: "1.375rem" },
        "& h2": { fontSize: "1.1875rem" },
        "& h3": { fontSize: "1.0625rem" },
        "& h4, & h5, & h6": { fontSize: "0.9375rem" },
        "& ul, & ol": { my: 1.25, pl: 3 },
        "& li": { my: 0.5, pl: 0.25 },
        "& li > p": { my: 0.5 },
        "& li > ul, & li > ol": { my: 0.5 },
        "& ol > li::marker": { color: "#5F6368" },
        "& ul > li::marker": { color: "#5F6368" },
        "& strong": { fontWeight: 600 },
        "& a": { color: "#0B57D0", textDecoration: "underline", textUnderlineOffset: "2px", textDecorationColor: "rgba(11,87,208,0.4)" },
        "& a:hover": { textDecorationColor: "#0B57D0" },
        "& hr": { border: 0, borderTop: "1px solid #E0E3E7", my: 2.5 },
        "& blockquote": { m: 0, my: 1.5, pl: 2, borderLeft: "3px solid #D3E3FD", color: "#444746" },
        "& code": {
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
          fontSize: "0.85em",
          bgcolor: "#F0F4F9",
          borderRadius: "6px",
          px: 0.6,
          py: 0.15,
        },
        "& pre": {
          my: 1.5,
          p: 1.5,
          bgcolor: "#F6F8FA",
          border: "1px solid #E0E3E7",
          borderRadius: "10px",
          overflowX: "auto",
          lineHeight: 1.55,
        },
        "& pre code": { bgcolor: "transparent", p: 0, fontSize: "0.8125rem", whiteSpace: "pre" },
        "& .md-table table": { borderCollapse: "collapse", width: "100%", fontSize: "0.875rem", lineHeight: 1.5 },
        "& .md-table th, & .md-table td": {
          textAlign: "left",
          px: 1.5,
          py: 1,
          borderBottom: "1px solid #E0E3E7",
          verticalAlign: "top",
          whiteSpace: "nowrap",
          overflowWrap: "normal",
          wordBreak: "normal",
        },
        "& .md-table td": { whiteSpace: "normal", minWidth: 96 },
        "& .md-table th": { bgcolor: "#F8FAFD", fontWeight: 600, color: "#444746" },
        "& .md-table tr:last-child td": { borderBottom: 0 },
        "& input[type=checkbox]": { mr: 0.75, verticalAlign: "middle" },
      }}
    >
      <ReactMarkdown remarkPlugins={remarkPlugins} components={components}>
        {text}
      </ReactMarkdown>
    </Box>
  );
});
