"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import Tooltip from "@mui/material/Tooltip";
import CheckOutlined from "@mui/icons-material/CheckOutlined";
import CloseOutlined from "@mui/icons-material/CloseOutlined";
import ThumbUpOutlined from "@mui/icons-material/ThumbUpOutlined";
import ChatBubbleOutlineOutlined from "@mui/icons-material/ChatBubbleOutlineOutlined";
import type { ReplyRow } from "@/lib/comment-bot/types";

interface Props {
  replies: ReplyRow[];
}

const PLATFORM_COLOR: Record<string, string> = {
  threads: "#000000",
  x: "#1DA1F2",
};

const MODE_LABEL: Record<string, string> = {
  agree_and_extend: "Agree & Extend",
  polite_contrarian: "Polite Contrarian",
  concrete_example: "Concrete Example",
  ask_sharpening_question: "Sharpening Q",
  translate_to_outcome: "Outcome",
};

function ReplyCard({
  reply,
  onAction,
  loading,
}: {
  reply: ReplyRow;
  onAction: (id: number, action: "approve" | "skip") => void;
  loading: boolean;
}) {
  return (
    <Box
      sx={{
        bgcolor: "#fff",
        borderRadius: "12px",
        border: "1px solid #E8EAED",
        p: 3,
        display: "flex",
        flexDirection: "column",
        gap: 2,
      }}
    >
      {/* Header row */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
        <Chip
          label={reply.platform === "threads" ? "Threads" : "X"}
          size="small"
          sx={{
            bgcolor: PLATFORM_COLOR[reply.platform],
            color: "#fff",
            fontSize: "0.6875rem",
            height: 20,
          }}
        />
        {reply.reply_mode && (
          <Chip
            label={MODE_LABEL[reply.reply_mode] ?? reply.reply_mode}
            size="small"
            variant="outlined"
            sx={{ fontSize: "0.6875rem", height: 20 }}
          />
        )}
        <Typography sx={{ fontSize: "0.75rem", color: "#5f6368", ml: "auto" }}>
          {reply.parent_author ? `@${reply.parent_author}` : "Unknown author"}
        </Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, color: "#9AA0A6" }}>
          {reply.parent_likes != null && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <ThumbUpOutlined sx={{ fontSize: 14 }} />
              <Typography sx={{ fontSize: "0.75rem" }}>
                {reply.parent_likes.toLocaleString()}
              </Typography>
            </Box>
          )}
          {reply.parent_replies != null && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <ChatBubbleOutlineOutlined sx={{ fontSize: 14 }} />
              <Typography sx={{ fontSize: "0.75rem" }}>
                {reply.parent_replies.toLocaleString()}
              </Typography>
            </Box>
          )}
        </Box>
      </Box>

      {/* Parent post */}
      {reply.parent_post_text && (
        <Box
          sx={{
            bgcolor: "#F8F9FA",
            borderRadius: "8px",
            p: 2,
            borderLeft: "3px solid #DADCE0",
          }}
        >
          <Typography
            sx={{
              fontSize: "0.875rem",
              color: "#3C4043",
              lineHeight: 1.6,
              display: "-webkit-box",
              WebkitLineClamp: 4,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {reply.parent_post_text}
          </Typography>
          {reply.parent_post_url && (
            <Typography
              component="a"
              href={reply.parent_post_url}
              target="_blank"
              rel="noopener noreferrer"
              sx={{
                fontSize: "0.75rem",
                color: "#1A73E8",
                textDecoration: "none",
                mt: 0.5,
                display: "block",
                "&:hover": { textDecoration: "underline" },
              }}
            >
              View original post →
            </Typography>
          )}
        </Box>
      )}

      <Divider />

      {/* Draft reply */}
      <Box>
        <Typography sx={{ fontSize: "0.75rem", fontWeight: 500, color: "#5f6368", mb: 1 }}>
          Draft reply
        </Typography>
        <Typography
          sx={{
            fontSize: "0.9375rem",
            color: "#1F1F1F",
            lineHeight: 1.65,
            whiteSpace: "pre-wrap",
          }}
        >
          {reply.draft_text ?? "No draft yet."}
        </Typography>
      </Box>

      {/* Actions */}
      <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end", mt: 0.5 }}>
        <Button
          variant="outlined"
          size="small"
          color="error"
          startIcon={loading ? <CircularProgress size={14} /> : <CloseOutlined />}
          disabled={loading}
          onClick={() => onAction(reply.id, "skip")}
        >
          Skip
        </Button>
        <Button
          variant="contained"
          size="small"
          startIcon={loading ? <CircularProgress size={14} color="inherit" /> : <CheckOutlined />}
          disabled={loading}
          onClick={() => onAction(reply.id, "approve")}
        >
          Approve
        </Button>
      </Box>
    </Box>
  );
}

export function ReplyQueue({ replies: initialReplies }: Props) {
  const router = useRouter();
  const [replies, setReplies] = useState(initialReplies);
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function callAction(body: Record<string, unknown>) {
    const res = await fetch("/api/comment-bot/queue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      throw new Error(json.error ?? "Request failed");
    }
  }

  async function handleAction(id: number, action: "approve" | "skip") {
    setLoadingId(id);
    setError(null);
    try {
      await callAction({ action, id });
      setReplies((prev) => prev.filter((r) => r.id !== id));
      startTransition(() => router.refresh());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoadingId(null);
    }
  }

  async function handleBulk(action: "approve_all" | "skip_all") {
    const ids = replies.map((r) => r.id);
    if (ids.length === 0) return;
    setBulkLoading(true);
    setError(null);
    try {
      await callAction({ action, ids });
      setReplies([]);
      startTransition(() => router.refresh());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBulkLoading(false);
    }
  }

  if (replies.length === 0) {
    return (
      <Box
        sx={{
          bgcolor: "#fff",
          borderRadius: "12px",
          border: "1px solid #E8EAED",
          p: 4,
          textAlign: "center",
        }}
      >
        <Typography sx={{ fontSize: "0.875rem", color: "#9AA0A6" }}>
          No replies waiting for review. Run a scrape + draft cycle to populate the queue.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {/* Bulk actions bar */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Typography sx={{ fontSize: "0.875rem", color: "#5f6368" }}>
          {replies.length} {replies.length === 1 ? "reply" : "replies"} waiting
        </Typography>
        <Box sx={{ display: "flex", gap: 1 }}>
          <Button
            variant="outlined"
            size="small"
            color="error"
            disabled={bulkLoading}
            startIcon={bulkLoading ? <CircularProgress size={14} /> : <CloseOutlined />}
            onClick={() => handleBulk("skip_all")}
          >
            Skip All
          </Button>
          <Button
            variant="contained"
            size="small"
            disabled={bulkLoading}
            startIcon={
              bulkLoading ? <CircularProgress size={14} color="inherit" /> : <CheckOutlined />
            }
            onClick={() => handleBulk("approve_all")}
          >
            Approve All
          </Button>
        </Box>
      </Box>

      {error && (
        <Typography sx={{ fontSize: "0.8125rem", color: "#D93025" }}>{error}</Typography>
      )}

      {replies.map((reply) => (
        <ReplyCard
          key={reply.id}
          reply={reply}
          onAction={handleAction}
          loading={loadingId === reply.id || bulkLoading}
        />
      ))}
    </Box>
  );
}
