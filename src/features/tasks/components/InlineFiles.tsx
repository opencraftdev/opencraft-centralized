"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Tooltip from "@mui/material/Tooltip";
import PlayArrowRounded from "@mui/icons-material/PlayArrowRounded";
import PictureAsPdfRounded from "@mui/icons-material/PictureAsPdfRounded";
import InsertDriveFileRounded from "@mui/icons-material/InsertDriveFileRounded";
import { BlurUpMedia } from "@/components/ui/BlurUpMedia";
import { driveContentUrl } from "@/lib/drive/links";
import { formatBytes } from "@/features/drive/format";
import type { DriveFile } from "@/lib/drive/types";

// Files placed inside a brief or comment, where they were attached: stored in the text as "[[file:<drive_files id>]]".
// Files next to each other sit in one row. Images and videos show large (max 180px tall), documents as a tile.

export const FILE_RE = /\[\[file:([0-9a-f-]{36})\]\]/g;
export const fileIdsIn = (text: string) => [...text.matchAll(FILE_RE)].map((m) => m[1]);

const isImage = (m: string | null | undefined) => !!m && /^image\/(png|jpeg|gif|webp|avif|bmp)/.test(m);
const isVideo = (m: string | null | undefined) => !!m && m.startsWith("video/");
const MEDIA_H = 180;

// ---- Read view (React) ---------------------------------------------------------------------

export function FileRow({ ids, files, onOpen }: { ids: string[]; files: Map<string, DriveFile>; onOpen?: (f: DriveFile) => void }) {
  const list = ids.map((id) => files.get(id)).filter((f): f is DriveFile => !!f);
  if (!list.length) return null;
  return (
    <Box component="span" sx={{ display: "flex", flexWrap: "wrap", gap: 1, my: 0.75, whiteSpace: "normal" }}>
      {list.map((f) => (
        <FileBlock key={f.id} f={f} onOpen={onOpen} />
      ))}
    </Box>
  );
}

function FileBlock({ f, onOpen }: { f: DriveFile; onOpen?: (f: DriveFile) => void }) {
  const [ratio, setRatio] = useState<number | null>(null);
  const base = { p: 0, border: "1px solid #E0E3E7", borderRadius: "12px", overflow: "hidden", cursor: "pointer", bgcolor: "#F0F4F9", position: "relative", fontFamily: "inherit", flexShrink: 0, maxWidth: "100%", "&:hover": { borderColor: "#A8C7FA" } } as const;
  const title = `${f.name}${f.size_bytes ? ` · ${formatBytes(f.size_bytes)}` : ""}`;
  if (isImage(f.mime_type)) {
    // width follows the picture's shape once known; until then a 4:3 box
    const w = Math.min(360, Math.round(MEDIA_H * (ratio ?? 4 / 3)));
    return (
      <Tooltip title={title}>
        <Box component="button" type="button" onClick={() => onOpen?.(f)} aria-label={`Buka ${f.name}`} sx={{ ...base, display: "block", width: w, height: MEDIA_H }}>
          <BlurUpMedia src={driveContentUrl(f.id)} alt={f.name} />
          <Box component="img" src={driveContentUrl(f.id)} alt="" aria-hidden onLoad={(e) => { const i = e.currentTarget; if (i.naturalWidth) setRatio(i.naturalWidth / i.naturalHeight); }} sx={{ display: "none" }} />
        </Box>
      </Tooltip>
    );
  }
  if (isVideo(f.mime_type))
    return (
      <Tooltip title={title}>
        <Box component="button" type="button" onClick={() => onOpen?.(f)} aria-label={`Putar ${f.name}`} sx={{ ...base, display: "grid", placeItems: "center", width: 240, height: MEDIA_H - 20 }}>
          <Box sx={{ position: "absolute", inset: 0 }}>
            <BlurUpMedia kind="video" src={`${driveContentUrl(f.id)}#t=0.1`} alt={f.name} videoProps={{ muted: true, preload: "metadata", playsInline: true }} />
          </Box>
          <Box sx={{ position: "relative", width: 40, height: 40, borderRadius: "50%", bgcolor: "rgba(0,0,0,.55)", display: "grid", placeItems: "center" }}>
            <PlayArrowRounded sx={{ color: "#fff", fontSize: 26 }} />
          </Box>
        </Box>
      </Tooltip>
    );
  return (
    <Tooltip title={title}>
      <Box component="button" type="button" onClick={() => onOpen?.(f)} aria-label={`Buka ${f.name}`} sx={{ ...base, display: "flex", alignItems: "center", gap: 1, width: 220, height: 56, px: 1.25, bgcolor: "#fff", textAlign: "left" }}>
        <Box sx={{ width: 34, height: 34, borderRadius: "8px", bgcolor: "#F0F4F9", display: "grid", placeItems: "center", flexShrink: 0 }}>
          {f.mime_type === "application/pdf" ? <PictureAsPdfRounded sx={{ fontSize: 20, color: "#D93025" }} /> : <InsertDriveFileRounded sx={{ fontSize: 20, color: "#5A86C2" }} />}
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Box sx={{ fontSize: "0.8125rem", fontWeight: 500, color: "#1F1F1F", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</Box>
          <Box sx={{ fontSize: "0.6875rem", color: "#80868B" }}>{f.size_bytes ? formatBytes(f.size_bytes) : (f.mime_type ?? "File")}</Box>
        </Box>
      </Box>
    </Tooltip>
  );
}

// ---- Live editor (plain DOM, inside the contentEditable box) ------------------------------------

const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const PDF_SVG = '<svg viewBox="0 0 24 24" width="20" height="20" fill="#D93025"><path d="M20 2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8.5 7.5c0 .83-.67 1.5-1.5 1.5H9v2H7.5V7H10c.83 0 1.5.67 1.5 1.5v1zm5 2c0 .83-.67 1.5-1.5 1.5h-2.5V7H15c.83 0 1.5.67 1.5 1.5v3zm4-3H19v1h1.5V11H19v2h-1.5V7h3v1.5zM9 9.5h1v-1H9v1zM4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm10 5.5h1v-3h-1v3z"/></svg>';
const FILE_SVG = '<svg viewBox="0 0 24 24" width="20" height="20" fill="#5A86C2"><path d="M6 2c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6H6zm7 7V3.5L18.5 9H13z"/></svg>';
const PLAY_SVG = '<svg viewBox="0 0 24 24" width="24" height="24" fill="#fff"><path d="M8 5v14l11-7z"/></svg>';
const X_SVG = '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>';

/** A file block for the editor. Unknown id (deleted / not loaded yet) → a small "File tidak tersedia" tile. */
export function buildBlock(id: string, f: DriveFile | undefined): HTMLElement {
  const el = document.createElement("span");
  el.contentEditable = "false";
  el.dataset.file = id;
  const name = f?.name ?? "File tidak tersedia";
  let inner: string;
  if (f && isImage(f.mime_type)) {
    el.className = "ocf ocf-img";
    inner = `<img src="${driveContentUrl(f.id)}" alt="${esc(name)}" draggable="false">`;
  } else if (f && isVideo(f.mime_type)) {
    el.className = "ocf ocf-vid";
    inner = `<video src="${driveContentUrl(f.id)}#t=0.1" muted preload="metadata" playsinline></video><span class="ocf-play">${PLAY_SVG}</span>`;
  } else {
    el.className = "ocf ocf-doc" + (f ? "" : " ocf-missing");
    inner = `<span class="ocf-ic">${f?.mime_type === "application/pdf" ? PDF_SVG : FILE_SVG}</span><span class="ocf-meta"><span class="ocf-name">${esc(name)}</span><span class="ocf-sub">${f?.size_bytes ? esc(formatBytes(f.size_bytes)) : f ? "File" : "Sudah dihapus"}</span></span>`;
  }
  el.innerHTML = `${inner}<button type="button" class="ocf-x" data-x="${id}" aria-label="Hapus ${esc(name)}" title="Hapus file">${X_SVG}</button>`;
  el.title = name;
  // blur-up while the picture / first video frame loads
  const media = el.querySelector("img, video") as HTMLImageElement | HTMLVideoElement | null;
  if (media) {
    el.classList.add("ocf-loading");
    // the node may be moved into another block (upload placeholder), so look the block up at load time
    const box = () => (media.closest(".ocf") as HTMLElement | null) ?? el;
    const done = () => box().classList.remove("ocf-loading");
    if (media instanceof HTMLImageElement) {
      media.onload = () => {
        if (media.naturalWidth) box().style.width = `${Math.min(360, Math.round((MEDIA_H * media.naturalWidth) / media.naturalHeight))}px`;
        done();
      };
      media.onerror = done;
    } else {
      media.onloadeddata = done;
      media.onerror = done;
    }
  }
  return el;
}

/** A placeholder while a file uploads: name + progress bar. */
export function uploadHtml(tempId: string, name: string) {
  return `<span class="ocf ocf-up" contenteditable="false" data-temp="${tempId}"><span class="ocf-name">${esc(name)}</span><span class="ocf-bar"><i style="width:0%"></i></span><span class="ocf-pct">0%</span></span>`;
}

/** Styles for the blocks inside the editor (spread into its sx). */
export const editorFileSx = {
  "& .ocf": { position: "relative", display: "inline-flex", verticalAlign: "top", m: "4px 8px 4px 0", borderRadius: "12px", border: "1px solid #E0E3E7", overflow: "hidden", bgcolor: "#F0F4F9", userSelect: "none", cursor: "pointer", maxWidth: "100%", whiteSpace: "normal", transition: "border-color 150ms" },
  "& .ocf:hover": { borderColor: "#A8C7FA" },
  "& .ocf-img": { height: MEDIA_H, width: 240 },
  "& .ocf-img img, & .ocf-vid video": { width: "100%", height: "100%", objectFit: "cover", display: "block", transition: "filter 600ms cubic-bezier(0.22, 1, 0.36, 1), transform 600ms cubic-bezier(0.22, 1, 0.36, 1), opacity 450ms" },
  "& .ocf-loading": { backgroundImage: "linear-gradient(135deg, #E9EDF3 0%, #D9E1EC 100%)" },
  "& .ocf-loading img, & .ocf-loading video": { filter: "blur(10px)", transform: "scale(1.06)", opacity: 0.35 },
  "& .ocf-vid": { height: MEDIA_H - 20, width: 240, alignItems: "center", justifyContent: "center" },
  "& .ocf-vid video": { position: "absolute", inset: 0 },
  "& .ocf-play": { position: "relative", width: 40, height: 40, borderRadius: "50%", bgcolor: "rgba(0,0,0,.55)", display: "grid", placeItems: "center" },
  "& .ocf-doc": { alignItems: "center", gap: "8px", width: 220, height: 56, px: "10px", bgcolor: "#fff" },
  "& .ocf-missing": { opacity: 0.6 },
  "& .ocf-ic": { width: 34, height: 34, borderRadius: "8px", bgcolor: "#F0F4F9", display: "grid", placeItems: "center", flexShrink: 0 },
  "& .ocf-meta": { display: "flex", flexDirection: "column", minWidth: 0, lineHeight: 1.35 },
  "& .ocf-name": { fontSize: "0.8125rem", fontWeight: 500, color: "#1F1F1F", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  "& .ocf-sub": { fontSize: "0.6875rem", color: "#80868B" },
  "& .ocf-x": { position: "absolute", top: 6, right: 6, width: 24, height: 24, borderRadius: "50%", border: "1px solid #E0E3E7", bgcolor: "#fff", color: "#444746", display: "grid", placeItems: "center", p: 0, cursor: "pointer", opacity: 0, transition: "opacity 150ms", "&:hover": { bgcolor: "#FCE8E6", color: "#B3261E" } },
  "& .ocf:hover .ocf-x": { opacity: 1 },
  "@media (hover: none)": { "& .ocf-x": { opacity: 1 } },
  "& .ocf-up": { flexDirection: "column", justifyContent: "center", gap: "6px", width: 220, height: 56, px: "12px", bgcolor: "#fff", cursor: "default" },
  "& .ocf-bar": { display: "block", height: 4, borderRadius: 4, bgcolor: "#E3E6EA", overflow: "hidden" },
  "& .ocf-bar i": { display: "block", height: "100%", bgcolor: "#0B57D0", transition: "width 200ms" },
  "& .ocf-pct": { position: "absolute", top: 8, right: 10, fontSize: "0.6875rem", color: "#5F6368", fontVariantNumeric: "tabular-nums" },
  "& .ocf-up .ocf-name": { pr: "36px" },
} as const;
