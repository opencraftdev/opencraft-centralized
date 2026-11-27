"use client";

import { useRef, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import AttachFileRounded from "@mui/icons-material/AttachFileRounded";
import CloseRounded from "@mui/icons-material/CloseRounded";
import InsertDriveFileRounded from "@mui/icons-material/InsertDriveFileRounded";
import PictureAsPdfRounded from "@mui/icons-material/PictureAsPdfRounded";
import PlayArrowRounded from "@mui/icons-material/PlayArrowRounded";
import { driveContentUrl } from "@/lib/drive/links";
import { formatBytes } from "@/features/drive/format";
import type { DriveFile } from "@/lib/drive/types";

// Thumbnails for attachments: images and videos show themselves, other files a typed tile. Click → preview.

const isImage = (m: string | null) => !!m && /^image\/(png|jpeg|gif|webp|avif|bmp)/.test(m);
const isVideo = (m: string | null) => !!m && m.startsWith("video/");

export function AttachmentGrid({
  files,
  size = 88,
  onOpen,
  onRemove,
}: {
  files: DriveFile[];
  size?: number;
  onOpen: (f: DriveFile) => void;
  onRemove?: (f: DriveFile) => void;
}) {
  if (files.length === 0) return null;
  return (
    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
      {files.map((f) => (
        <Box key={f.id} sx={{ position: "relative", "&:hover .att-x": { opacity: 1 } }}>
          <Tooltip title={`${f.name}${f.size_bytes ? ` · ${formatBytes(f.size_bytes)}` : ""}`}>
            <Box
              component="button"
              type="button"
              onClick={() => onOpen(f)}
              aria-label={`Buka ${f.name}`}
              sx={{
                width: size,
                height: size,
                p: 0,
                border: "1px solid #E0E3E7",
                borderRadius: "12px",
                overflow: "hidden",
                cursor: "pointer",
                bgcolor: "#F0F4F9",
                position: "relative",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "inherit",
                "&:hover": { borderColor: "#A8C7FA" },
              }}
            >
              {isImage(f.mime_type) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={driveContentUrl(f.id)} alt={f.name} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : isVideo(f.mime_type) ? (
                <>
                  <video src={`${driveContentUrl(f.id)}#t=0.1`} muted preload="metadata" playsInline style={{ width: "100%", height: "100%", objectFit: "cover", background: "#1F1F1F" }} />
                  <Box sx={{ position: "absolute", width: 30, height: 30, borderRadius: "50%", bgcolor: "rgba(0,0,0,.55)", display: "grid", placeItems: "center" }}>
                    <PlayArrowRounded sx={{ color: "#fff", fontSize: 22 }} />
                  </Box>
                </>
              ) : (
                <>
                  {f.mime_type === "application/pdf" ? (
                    <PictureAsPdfRounded sx={{ fontSize: 28, color: "#D93025" }} />
                  ) : (
                    <InsertDriveFileRounded sx={{ fontSize: 28, color: "#5A86C2" }} />
                  )}
                  <Typography sx={{ fontSize: "0.6875rem", color: "#444746", px: 0.75, mt: 0.5, width: "100%", textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {f.name}
                  </Typography>
                </>
              )}
            </Box>
          </Tooltip>
          {onRemove && (
            <IconButton
              className="att-x"
              size="small"
              aria-label={`Hapus lampiran ${f.name}`}
              onClick={() => onRemove(f)}
              sx={{ position: "absolute", top: -8, right: -8, width: 24, height: 24, bgcolor: "#fff", border: "1px solid #E0E3E7", opacity: { xs: 1, sm: 0 }, transition: "opacity 150ms", "&:hover": { bgcolor: "#FCE8E6", color: "#B3261E" } }}
            >
              <CloseRounded sx={{ fontSize: 14 }} />
            </IconButton>
          )}
        </Box>
      ))}
    </Box>
  );
}

/** Files picked but not uploaded yet (comment composer), as removable chips. */
export function PendingFiles({ files, onRemove }: { files: File[]; onRemove: (i: number) => void }) {
  if (files.length === 0) return null;
  return (
    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, px: 1.5, pt: 1 }}>
      {files.map((f, i) => (
        <Box key={`${f.name}-${i}`} sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, pl: 1, pr: 0.25, height: 28, borderRadius: "9999px", bgcolor: "#EEF4FE", color: "#0B57D0", fontSize: "0.75rem", maxWidth: 220 }}>
          <AttachFileRounded sx={{ fontSize: 14 }} />
          <Box component="span" sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {f.name}
          </Box>
          <IconButton size="small" aria-label={`Batal lampirkan ${f.name}`} onClick={() => onRemove(i)} sx={{ p: 0.25, color: "inherit" }}>
            <CloseRounded sx={{ fontSize: 14 }} />
          </IconButton>
        </Box>
      ))}
    </Box>
  );
}

/** Hidden file input + trigger. `variant="button"` = labelled button, `"icon"` = paperclip icon. */
export function AttachPicker({
  onPick,
  variant = "button",
  disabled,
  accept,
  icon,
  label = "Lampirkan file, gambar, atau video",
}: {
  onPick: (files: File[]) => void;
  variant?: "button" | "icon";
  disabled?: boolean;
  accept?: string; // e.g. "image/*"
  icon?: React.ReactNode; // the icon variant's glyph (default: paperclip)
  label?: string; // tooltip / aria-label of the icon variant
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={input}
        type="file"
        multiple
        hidden
        accept={accept}
        onChange={(e) => {
          const list = Array.from(e.target.files ?? []);
          e.target.value = "";
          if (list.length) onPick(list);
        }}
      />
      {variant === "icon" ? (
        <Tooltip title={label}>
          <span style={{ display: "inline-flex" }}>
            <IconButton aria-label={label} disabled={disabled} onClick={() => input.current?.click()} sx={{ color: "#444746" }}>
              {icon ?? <AttachFileRounded sx={{ fontSize: 20 }} />}
            </IconButton>
          </span>
        </Tooltip>
      ) : (
        <Button size="small" disabled={disabled} startIcon={<AttachFileRounded sx={{ fontSize: 16 }} />} onClick={() => input.current?.click()} sx={{ borderRadius: "9999px", color: "#0B57D0" }}>
          Tambah lampiran
        </Button>
      )}
    </>
  );
}

/** Wraps an area so files can be dropped onto it. */
export function DropZone({ onDrop, children, disabled }: { onDrop: (files: File[]) => void; children: React.ReactNode; disabled?: boolean }) {
  const [over, setOver] = useState(false);
  return (
    <Box
      onDragOver={(e) => {
        if (disabled || !e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        if (disabled) return;
        e.preventDefault();
        setOver(false);
        const list = Array.from(e.dataTransfer.files ?? []);
        if (list.length) onDrop(list);
      }}
      sx={{ position: "relative", borderRadius: "12px", outline: over ? "2px dashed #0B57D0" : "none", outlineOffset: 4, transition: "outline-color 120ms" }}
    >
      {children}
    </Box>
  );
}
