"use client";

import { useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { TimePicker } from "@mui/x-date-pickers/TimePicker";
import CheckCircleOutlined from "@mui/icons-material/CheckCircleOutlined";
import { useCommandPoller } from "@/features/sosmed/hooks/useCommandPoller";
import type { ContentPost } from "@/lib/types";

interface Props {
  post: ContentPost;
  onPostUpdate: (post: ContentPost) => void;
}

function formatDateTime(value: string): string {
  const d = new Date(value);
  return isNaN(d.getTime()) ? value : d.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

export function PublishSection({ post, onPostUpdate }: Props) {
  const [publishCommandId, setPublishCommandId] = useState<number | null>(null);
  const [scheduledTime, setScheduledTime] = useState<Date | null>(
    post.scheduledAt ? new Date(post.scheduledAt) : null,
  );
  const [savingTime, setSavingTime] = useState(false);
  const onPostUpdateRef = useRef(onPostUpdate);
  useEffect(() => { onPostUpdateRef.current = onPostUpdate; });

  const { status: cmdStatus, error: cmdError, isPolling } = useCommandPoller(publishCommandId);

  useEffect(() => {
    if (cmdStatus !== "completed" && cmdStatus !== "done") return;
    let alive = true;
    const ctrl = new AbortController();
    setPublishCommandId(null);
    fetch(`/api/posts/${post.id}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((data) => { if (alive && data.post) onPostUpdateRef.current(data.post); })
      .catch(() => {});
    return () => { alive = false; ctrl.abort(); };
  }, [cmdStatus, post.id]);

  async function handleTimeChange(date: Date | null) {
    setScheduledTime(date);
    if (!date) return;
    setSavingTime(true);
    try {
      const base = new Date(`${post.dateSlot}T00:00:00`);
      base.setHours(date.getHours(), date.getMinutes(), 0, 0);
      await fetch(`/api/posts/${post.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduledAt: base.toISOString(), status: "scheduled" }),
      });
    } finally {
      setSavingTime(false);
    }
  }

  async function handlePublishNow() {
    try {
      const res = await fetch("/api/sosmed/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: "publish", platform: post.type, context: { postId: post.id } }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (typeof json.command_id !== "number") throw new Error("missing command_id");
      setPublishCommandId(json.command_id);
    } catch {
      // cmdError from poller will surface errors; silently fail here
    }
  }

  if (post.status === "published") {
    return (
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
        <Typography sx={{ color: "#188038", fontWeight: 500, fontSize: "0.9375rem", display: "flex", alignItems: "center", gap: 0.75 }}>
          <CheckCircleOutlined sx={{ fontSize: 18 }} />
          Published {post.publishedAt ? `· ${formatDateTime(post.publishedAt)}` : ""}
        </Typography>
        {post.publishResults?.map((r) => (
          <Box key={r.platform} sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Typography variant="caption" color="text.secondary" sx={{ width: 80 }}>{r.platform}</Typography>
            <Typography variant="caption" sx={{ fontWeight: 500, color: r.status === "ok" ? "#188038" : r.status === "skipped" ? "#5F6368" : "#D93025" }}>
              {r.status}
            </Typography>
            {r.error && <Typography variant="caption" sx={{ color: "#D93025" }} noWrap>{r.error}</Typography>}
          </Box>
        ))}
      </Box>
    );
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {post.status === "scheduled" && post.scheduledAt && (
          <Typography sx={{ fontSize: "0.875rem", color: "#1A73E8", fontWeight: 500 }}>
            Scheduled · {formatDateTime(post.scheduledAt)}
          </Typography>
        )}
        <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
          <TimePicker
            label="Schedule time"
            value={scheduledTime}
            onChange={handleTimeChange}
            slotProps={{ textField: { size: "small", sx: { width: 160 } } }}
          />
          {savingTime && <CircularProgress size={16} />}
        </Box>
        {cmdError && <Typography sx={{ fontSize: "0.8125rem", color: "#D93025" }}>{cmdError}</Typography>}
        <Button
          variant="contained"
          disabled={isPolling}
          onClick={handlePublishNow}
          startIcon={isPolling ? <CircularProgress size={14} color="inherit" /> : null}
          sx={{ textTransform: "none", borderRadius: "9999px", alignSelf: "flex-start" }}
        >
          {isPolling ? "Publishing…" : "Publish Now"}
        </Button>
      </Box>
    </LocalizationProvider>
  );
}
