"use client";

import { useEffect, useState } from "react";
import Popover from "@mui/material/Popover";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import InputBase from "@mui/material/InputBase";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import CloseOutlined from "@mui/icons-material/CloseOutlined";
import DragHandleOutlined from "@mui/icons-material/DragHandleOutlined";
import EventOutlined from "@mui/icons-material/EventOutlined";
import LabelOutlined from "@mui/icons-material/LabelOutlined";
import NotesOutlined from "@mui/icons-material/NotesOutlined";
import type { PostType } from "@/lib/types";

const TYPES: Array<{ type: PostType; label: string; color: string }> = [
  { type: "engage", label: "Engage", color: "#1A73E8" },
  { type: "educate", label: "Educate", color: "#188038" },
  { type: "video", label: "Video", color: "#5F6368" },
];

interface QuickCreatePostPopoverProps {
  open: boolean;
  anchorEl: HTMLElement | null;
  anchorPosition?: { top: number; left: number } | null;
  dateStr: string;
  onClose: () => void;
  onCreated: (postId?: number) => void;
  onMoreOptions: () => void;
}

export function QuickCreatePostPopover({
  open,
  anchorEl,
  anchorPosition,
  dateStr,
  onClose,
  onCreated,
  onMoreOptions,
}: QuickCreatePostPopoverProps) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState<PostType>("engage");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle("");
      setType("engage");
    }
  }, [open]);

  const displayDate = dateStr
    ? new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      })
    : "";

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          dateSlot: dateStr,
          headline: title.trim() || null,
        }),
      });
      const data = await res.json();
      onCreated(data.post?.id);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Popover
      open={open}
      anchorEl={anchorPosition ? undefined : anchorEl}
      anchorReference={anchorPosition ? "anchorPosition" : "anchorEl"}
      anchorPosition={anchorPosition ?? undefined}
      onClose={onClose}
      anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
      transformOrigin={{ vertical: "top", horizontal: "left" }}
      slotProps={{
        paper: {
          sx: {
            mt: 0.5,
            width: 448,
            borderRadius: "16px",
            bgcolor: "#F0F4F9",
            boxShadow: "0 4px 24px rgba(0,0,0,0.16)",
            overflow: "hidden",
          },
        },
      }}
    >
      {/* Top bar: drag handle + close */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          px: 1.5,
          pt: 1,
        }}
      >
        <IconButton size="small" sx={{ color: "#5F6368", cursor: "grab" }} disabled>
          <DragHandleOutlined sx={{ fontSize: 18 }} />
        </IconButton>
        <IconButton
          size="small"
          onClick={onClose}
          sx={{ color: "#5F6368", "&:hover": { bgcolor: "rgba(68,71,70,0.08)" } }}
        >
          <CloseOutlined sx={{ fontSize: 20 }} />
        </IconButton>
      </Box>

      {/* Title field */}
      <Box sx={{ px: 3, pt: 0.5 }}>
        <InputBase
          autoFocus
          fullWidth
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Add title"
          sx={{
            fontSize: "1.375rem",
            fontWeight: 400,
            color: "#1F1F1F",
            pb: 0.5,
            borderBottom: "2px solid #0B57D0",
            "& input::placeholder": { color: "#80868B", opacity: 1 },
          }}
        />
      </Box>

      {/* Type selector pills */}
      <Box sx={{ px: 3, mt: 2, display: "flex", gap: 0.5 }}>
        {TYPES.map((t) => {
          const active = type === t.type;
          return (
            <Box
              key={t.type}
              component="button"
              type="button"
              onClick={() => setType(t.type)}
              sx={{
                px: 1.5,
                py: 0.75,
                borderRadius: "9999px",
                border: "none",
                bgcolor: active ? "#C2E7FF" : "transparent",
                color: active ? "#0B57D0" : "#3C4043",
                fontSize: "0.875rem",
                fontWeight: 500,
                cursor: "pointer",
                fontFamily: "inherit",
                transition: "background-color 150ms",
                "&:hover": { bgcolor: active ? "#B4DEFB" : "rgba(60,64,67,0.06)" },
              }}
            >
              {t.label}
            </Box>
          );
        })}
      </Box>

      {/* Detail rows */}
      <Box sx={{ px: 3, mt: 2, display: "flex", flexDirection: "column", gap: 1.5 }}>
        <Row icon={<EventOutlined sx={{ fontSize: 20 }} />}>
          <Box>
            <Typography sx={{ fontSize: "0.875rem", color: "#1F1F1F" }}>
              {displayDate}
            </Typography>
            <Typography sx={{ fontSize: "0.75rem", color: "#5F6368", mt: 0.25 }}>
              All day · Does not repeat
            </Typography>
          </Box>
        </Row>

        <Row icon={<LabelOutlined sx={{ fontSize: 20 }} />}>
          <Typography sx={{ fontSize: "0.875rem", color: "#1F1F1F" }}>
            {TYPES.find((t) => t.type === type)?.label} post
          </Typography>
        </Row>

        <Row icon={<NotesOutlined sx={{ fontSize: 20 }} />}>
          <Typography sx={{ fontSize: "0.875rem", color: "#5F6368" }}>
            Add description in More options
          </Typography>
        </Row>
      </Box>

      {/* Footer */}
      <Box
        sx={{
          mt: 2.5,
          px: 2.5,
          py: 1.5,
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: 1.5,
        }}
      >
        <Button
          variant="text"
          size="small"
          onClick={onMoreOptions}
          sx={{
            color: "#0B57D0",
            textTransform: "none",
            fontWeight: 500,
            fontSize: "0.875rem",
          }}
        >
          More options
        </Button>
        <Button
          variant="contained"
          size="small"
          onClick={handleSave}
          disabled={saving}
          startIcon={saving ? <CircularProgress size={14} thickness={5} sx={{ color: "#fff" }} /> : undefined}
          sx={{
            borderRadius: "9999px",
            bgcolor: "#0B57D0",
            textTransform: "none",
            fontWeight: 500,
            fontSize: "0.875rem",
            px: 2.5,
            "&:hover": { bgcolor: "#0A4FB5" },
          }}
        >
          Save
        </Button>
      </Box>
    </Popover>
  );
}

function Row({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Box sx={{ display: "flex", alignItems: "flex-start", gap: 2 }}>
      <Box sx={{ color: "#5F6368", pt: 0.25 }}>{icon}</Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>{children}</Box>
    </Box>
  );
}
