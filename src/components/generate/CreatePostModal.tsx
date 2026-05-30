"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import Chip from "@mui/material/Chip";
import DialogActions from "@mui/material/DialogActions";
import CheckOutlined from "@mui/icons-material/CheckOutlined";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import type { PostType } from "@/lib/types";

interface CreatePostModalProps {
  open: boolean;
  dateStr: string;
  onClose: () => void;
  onCreated: () => void;
}

const CONTENT_TYPES: Array<{
  type: PostType;
  label: string;
  description: string;
  color: string;
}> = [
  { type: "engage", label: "Simple Question", description: "Open-ended AI/tech question for Threads + X. Text only.", color: "#4285f4" },
  { type: "educate", label: "Coding Tip", description: "AI/coding tip with optional code card image. Threads + X.", color: "#34a853" },
  { type: "video", label: "AI News Video", description: "Full video pipeline: curate, draft, render, publish.", color: "#5f6368" },
];

export function CreatePostModal({ open, dateStr, onClose, onCreated }: CreatePostModalProps) {
  const [selected, setSelected] = useState<PostType | null>(null);
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!selected) return;
    setCreating(true);
    try {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: selected, dateSlot: dateStr }),
      });
      const data = await res.json();
      onCreated();
      onClose();
      setSelected(null);
      if (data.post?.id) {
        window.location.href = `/posts/${data.post.id}`;
      }
    } finally {
      setCreating(false);
    }
  };

  const handleClose = () => {
    setSelected(null);
    onClose();
  };

  const displayDate = dateStr
    ? new Date(dateStr + "T00:00:00").toLocaleDateString("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "";

  return (
    <Modal open={open} onClose={handleClose} title="New Content" width="md">
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
        <Typography variant="body2" color="text.secondary">{displayDate}</Typography>

        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {CONTENT_TYPES.map((ct) => (
            <Card
              key={ct.type}
              variant="outlined"
              sx={{
                borderColor: selected === ct.type ? ct.color : "divider",
                bgcolor: selected === ct.type ? `${ct.color}08` : "transparent",
                transition: "border-color 200ms, background-color 200ms",
              }}
            >
              <CardActionArea onClick={() => setSelected(ct.type)} sx={{ px: 2, py: 1.5, display: "flex", alignItems: "center", gap: 2 }}>
                <Chip
                  label={ct.type.charAt(0).toUpperCase() + ct.type.slice(1)}
                  size="small"
                  sx={{
                    bgcolor: selected === ct.type ? `${ct.color}15` : "background.default",
                    color: selected === ct.type ? ct.color : "text.secondary",
                    fontWeight: 600,
                  }}
                />
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>{ct.label}</Typography>
                  <Typography variant="caption">{ct.description}</Typography>
                </Box>
                {selected === ct.type && (
                  <CheckOutlined sx={{ color: ct.color, fontSize: 20 }} />
                )}
              </CardActionArea>
            </Card>
          ))}
        </Box>

        <DialogActions sx={{ px: 0, pb: 0 }}>
          <Button variant="ghost" size="sm" onClick={handleClose}>Cancel</Button>
          <Button variant="primary" size="sm" disabled={!selected} loading={creating} onClick={handleCreate}>
            Create post
          </Button>
        </DialogActions>
      </Box>
    </Modal>
  );
}
