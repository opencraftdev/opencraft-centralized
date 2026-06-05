"use client";

import { useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import CircularProgress from "@mui/material/CircularProgress";
import CheckCircleOutlined from "@mui/icons-material/CheckCircleOutlined";
import { useCommandPoller } from "@/features/sosmed/hooks/useCommandPoller";
import type { ContentPost } from "@/lib/types";

interface Props {
  post: ContentPost;
  onPostUpdate: (post: ContentPost) => void;
  onAccept: () => void;
}

const THREADS_LIMIT = 490;
const X_LIMIT = 275;

export function EngageGenerator({ post, onPostUpdate, onAccept }: Props) {
  const [commandId, setCommandId] = useState<number | null>(null);
  const [feedback, setFeedback] = useState(post.userFeedback ?? "");
  const [accepting, setAccepting] = useState(false);
  const hasFiredRef = useRef(false);

  const { status: cmdStatus, error: cmdError, isPolling } = useCommandPoller(commandId);

  async function fireGenerate() {
    const res = await fetch("/api/sosmed/command", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        command: "generate",
        platform: "engage",
        context: feedback ? { user_feedback: feedback } : {},
      }),
    });
    const json = await res.json();
    setCommandId(json.command_id);
  }

  // Auto-generate on mount if no content yet
  useEffect(() => {
    if (!post.textContent && !hasFiredRef.current) {
      hasFiredRef.current = true;
      fireGenerate();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-fetch post when command completes
  useEffect(() => {
    if (cmdStatus === "completed" || cmdStatus === "done") {
      setCommandId(null);
      fetch(`/api/posts/${post.id}`)
        .then((r) => r.json())
        .then((data) => { if (data.post) onPostUpdate(data.post); });
    }
  }, [cmdStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleAccept() {
    setAccepting(true);
    try {
      const res = await fetch(`/api/posts/${post.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "accepted" }),
      });
      const data = await res.json();
      if (data.post) onAccept();
    } finally {
      setAccepting(false);
    }
  }

  const charCount = post.textContent?.length ?? 0;
  const overThreads = charCount > THREADS_LIMIT;
  const overX = charCount > X_LIMIT;
  const cleanText = post.textContent?.replace(/```[\s\S]*?```/g, "").trim() ?? null;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
      {/* Spinner while generating */}
      {isPolling && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, py: 2 }}>
          <CircularProgress size={18} />
          <Typography sx={{ fontSize: "0.875rem", color: "#5F6368" }}>Generating post…</Typography>
        </Box>
      )}

      {/* Error */}
      {cmdError && <Typography sx={{ fontSize: "0.875rem", color: "#D93025" }}>{cmdError}</Typography>}

      {/* Text preview */}
      {cleanText && !isPolling && (
        <Box>
          <Typography sx={{ fontSize: "0.8125rem", color: "#5F6368", mb: 0.75 }}>Preview</Typography>
          <Box sx={{ p: 2, bgcolor: "#F8F9FA", borderRadius: "10px", border: "1px solid #E8EAED" }}>
            <Typography sx={{ fontSize: "0.9375rem", lineHeight: 1.7, whiteSpace: "pre-wrap", color: "#1F1F1F" }}>
              {cleanText}
            </Typography>
          </Box>
          <Typography sx={{ mt: 0.75, fontSize: "0.75rem", color: overX ? "#D93025" : overThreads ? "#E37400" : "#5F6368" }}>
            {charCount} chars · Threads ≤{THREADS_LIMIT} · X ≤{X_LIMIT}
          </Typography>
        </Box>
      )}

      {/* Feedback + Regenerate */}
      {(cleanText || cmdStatus === "failed") && !isPolling && (
        <Box sx={{ display: "flex", gap: 1 }}>
          <TextField
            size="small"
            placeholder="Feedback (optional)"
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            sx={{ flex: 1 }}
            slotProps={{ input: { sx: { fontSize: "0.875rem" } } }}
          />
          <Button
            variant="outlined"
            size="small"
            disabled={isPolling}
            onClick={() => {
              setCommandId(null);
              setTimeout(() => fireGenerate(), 0);
            }}
            sx={{ textTransform: "none", whiteSpace: "nowrap" }}
          >
            Regenerate
          </Button>
        </Box>
      )}

      {/* Approve button */}
      {cleanText && !isPolling && (
        <Button
          variant="contained"
          startIcon={accepting ? <CircularProgress size={14} color="inherit" /> : <CheckCircleOutlined />}
          disabled={accepting}
          onClick={handleAccept}
          sx={{ textTransform: "none", borderRadius: "9999px", alignSelf: "flex-start" }}
        >
          Approve &amp; Accept
        </Button>
      )}
    </Box>
  );
}
