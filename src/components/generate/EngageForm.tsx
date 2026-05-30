"use client";

import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import CircularProgress from "@mui/material/CircularProgress";
import { Button } from "@/components/ui/Button";

interface EngageFormProps {
  postId: number;
  initialText?: string | null;
  onApproved: () => void;
}

export function EngageForm({ postId, initialText, onApproved }: EngageFormProps) {
  const [text, setText] = useState(initialText ?? "");
  const [feedback, setFeedback] = useState("");
  const [generating, setGenerating] = useState(!initialText);
  const [approving, setApproving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async (fb?: string) => {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/generate/engage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId, feedback: fb || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Generation failed");
      setText(data.text);
      setFeedback("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setGenerating(false);
    }
  };

  const approve = async () => {
    setApproving(true);
    try {
      await fetch(`/api/posts/${postId}/approve`, { method: "POST" });
      onApproved();
    } finally {
      setApproving(false);
    }
  };

  useEffect(() => {
    if (!initialText) generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Paper variant="outlined" sx={{ p: 2.5, minHeight: 100 }}>
        {generating ? (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <CircularProgress size={16} />
            <Typography variant="body2" color="text.secondary">Generating with Claude…</Typography>
          </Box>
        ) : error ? (
          <Typography variant="body2" color="error">{error}</Typography>
        ) : (
          <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", lineHeight: 1.7 }}>{text}</Typography>
        )}
      </Paper>

      {text && !generating && (
        <Typography variant="caption">
          {text.length} chars · Threads max 490 · X max 275
        </Typography>
      )}

      {!generating && (
        <Box sx={{ display: "flex", gap: 1 }}>
          <TextField
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && feedback) generate(feedback); }}
            placeholder="Revision feedback (or leave blank to regenerate)…"
            fullWidth
          />
          <Button variant="secondary" size="sm" onClick={() => generate(feedback || undefined)} loading={generating}>
            Regenerate
          </Button>
        </Box>
      )}

      <Box sx={{ display: "flex", justifyContent: "flex-end", pt: 1.5, borderTop: 1, borderColor: "divider" }}>
        <Button variant="primary" size="sm" disabled={!text || generating} loading={approving} onClick={approve}>
          Approve & accept
        </Button>
      </Box>
    </Box>
  );
}
