"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import type { PostType } from "@/lib/types";

interface Option {
  type: PostType;
  code: string;
  label: string;
  description: string;
  color: string;
}

const OPTIONS: Option[] = [
  { type: "engage", code: "EG", label: "Simple Question", description: "Text-only question for Threads + X", color: "#1A73E8" },
  { type: "educate", code: "ED", label: "Coding Tip", description: "AI/coding tip with optional code card", color: "#188038" },
  { type: "video", code: "VD", label: "AI News Video", description: "Full video pipeline", color: "#5F6368" },
];

interface Props {
  open: boolean;
  dateSlot: string;
  onClose: (created?: boolean) => void;
}

export function NewContentModal({ open, dateSlot, onClose }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<PostType | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setSelected(null)
      setError(null)
    }
  }, [open])

  const handleClose = () => {
    onClose()
  }

  const handleConfirm = async () => {
    if (!selected) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: selected, dateSlot }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? "Failed to create post")
      }
      const { post } = await res.json()
      onClose(true)
      router.push(`/posts/${post.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth
      slotProps={{ paper: { sx: { borderRadius: "16px" } } }}>
      <DialogTitle sx={{ fontSize: "1.125rem", fontWeight: 500, pb: 1 }}>
        New content — {dateSlot}
      </DialogTitle>
      <DialogContent sx={{ pt: 1 }}>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
          {OPTIONS.map((opt) => (
            <Box
              key={opt.type}
              onClick={() => setSelected(opt.type)}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 2,
                p: 2,
                borderRadius: "12px",
                border: "2px solid",
                borderColor: selected === opt.type ? opt.color : "#E8EAED",
                bgcolor: selected === opt.type ? `${opt.color}0D` : "#fff",
                cursor: "pointer",
                transition: "all 140ms",
                "&:hover": { borderColor: opt.color, bgcolor: `${opt.color}08` },
              }}
            >
              <Box sx={{ width: 40, height: 40, borderRadius: "10px", bgcolor: opt.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Typography sx={{ color: "#fff", fontSize: "0.75rem", fontWeight: 700 }}>{opt.code}</Typography>
              </Box>
              <Box>
                <Typography sx={{ fontWeight: 600, fontSize: "0.9375rem", color: "#1F1F1F" }}>{opt.label}</Typography>
                <Typography sx={{ fontSize: "0.8125rem", color: "#5F6368" }}>{opt.description}</Typography>
              </Box>
            </Box>
          ))}
        </Box>
        {error && <Typography sx={{ mt: 1.5, fontSize: "0.8125rem", color: "#D93025" }}>{error}</Typography>}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={handleClose} disabled={loading} sx={{ textTransform: "none" }}>Cancel</Button>
        <Button
          variant="contained"
          disabled={!selected || loading}
          onClick={handleConfirm}
          startIcon={loading ? <CircularProgress size={14} color="inherit" /> : null}
          sx={{ textTransform: "none", borderRadius: "9999px" }}
        >
          Create
        </Button>
      </DialogActions>
    </Dialog>
  );
}
