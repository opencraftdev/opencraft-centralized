"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Popover from "@mui/material/Popover";
import Tooltip from "@mui/material/Tooltip";
import FormatBoldRounded from "@mui/icons-material/FormatBoldRounded";
import FormatItalicRounded from "@mui/icons-material/FormatItalicRounded";
import FormatUnderlinedRounded from "@mui/icons-material/FormatUnderlinedRounded";
import FormatColorTextRounded from "@mui/icons-material/FormatColorTextRounded";
import { TEXT_COLORS, type MentionInputHandle } from "./Mentions";

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
const mod = isMac ? "⌘" : "Ctrl+";

/** Bold / italic / underline / colour buttons for a MentionInput. Keeps the text selection while clicking. */
export function FormatBar({ target, disabled }: { target: React.RefObject<MentionInputHandle | null>; disabled?: boolean }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const btn = { p: 0.625, color: "#444746", borderRadius: "8px", "&:hover": { bgcolor: "#F1F3F4" } } as const;
  const keep = (e: React.MouseEvent) => e.preventDefault(); // don't steal focus from the text box
  const wrap = (cmd: "bold" | "italic" | "underline") => target.current?.exec(cmd);

  return (
    <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.125 }}>
      <Tooltip title={`Tebal (${mod}B)`}>
        <IconButton size="small" aria-label="Tebal" disabled={disabled} onMouseDown={keep} onClick={() => wrap("bold")} sx={btn}>
          <FormatBoldRounded sx={{ fontSize: 20 }} />
        </IconButton>
      </Tooltip>
      <Tooltip title={`Miring (${mod}I)`}>
        <IconButton size="small" aria-label="Miring" disabled={disabled} onMouseDown={keep} onClick={() => wrap("italic")} sx={btn}>
          <FormatItalicRounded sx={{ fontSize: 20 }} />
        </IconButton>
      </Tooltip>
      <Tooltip title={`Garis bawah (${mod}U)`}>
        <IconButton size="small" aria-label="Garis bawah" disabled={disabled} onMouseDown={keep} onClick={() => wrap("underline")} sx={btn}>
          <FormatUnderlinedRounded sx={{ fontSize: 20 }} />
        </IconButton>
      </Tooltip>
      <Tooltip title="Warna teks">
        <IconButton size="small" aria-label="Warna teks" disabled={disabled} onMouseDown={keep} onClick={(e) => setAnchor(e.currentTarget)} sx={btn}>
          <FormatColorTextRounded sx={{ fontSize: 20 }} />
        </IconButton>
      </Tooltip>
      <Popover
        open={!!anchor}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        disableRestoreFocus
        disableAutoFocus
        disableEnforceFocus
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
        transformOrigin={{ vertical: "bottom", horizontal: "center" }}
        slotProps={{ paper: { sx: { mt: -1, p: 1, borderRadius: "12px", boxShadow: "0 4px 20px rgba(60,64,67,.2)" } } }}
      >
        <Box sx={{ display: "flex", gap: 0.75 }}>
          {TEXT_COLORS.map(({ c, n }) => (
            <Tooltip key={c} title={n}>
              <Box
                component="button"
                type="button"
                aria-label={`Warna ${n}`}
                onMouseDown={keep}
                onClick={() => {
                  setAnchor(null);
                  target.current?.exec("color", c);
                }}
                sx={{ width: 22, height: 22, borderRadius: "50%", bgcolor: c, border: "2px solid #fff", boxShadow: "0 0 0 1px #DADCE0", cursor: "pointer", p: 0, transition: "transform 120ms", "&:hover": { transform: "scale(1.15)" } }}
              />
            </Tooltip>
          ))}
        </Box>
      </Popover>
    </Box>
  );
}
