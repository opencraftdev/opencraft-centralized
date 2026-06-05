"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Tooltip from "@mui/material/Tooltip";
import ThumbUpOutlined from "@mui/icons-material/ThumbUpOutlined";
import ChatBubbleOutlineOutlined from "@mui/icons-material/ChatBubbleOutlineOutlined";
import OpenInNewOutlined from "@mui/icons-material/OpenInNewOutlined";
import type { ReplyRow } from "@/lib/comment-bot/types";

interface Props {
  posts: ReplyRow[];
}

const PLATFORM_COLOR: Record<string, string> = {
  threads: "#000000",
  x: "#1DA1F2",
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function ScrapedPosts({ posts }: Props) {
  if (posts.length === 0) {
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
          No scraped posts yet. Trigger a scrape from the quick actions above.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
      {posts.map((post) => (
        <Box
          key={post.id}
          sx={{
            bgcolor: "#fff",
            borderRadius: "12px",
            border: "1px solid #E8EAED",
            p: 2.5,
            display: "flex",
            gap: 2,
            alignItems: "flex-start",
          }}
        >
          {/* Platform badge */}
          <Chip
            label={post.platform === "threads" ? "Threads" : "X"}
            size="small"
            sx={{
              bgcolor: PLATFORM_COLOR[post.platform],
              color: "#fff",
              fontSize: "0.6875rem",
              height: 20,
              flexShrink: 0,
              mt: 0.25,
            }}
          />

          {/* Post content */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5, flexWrap: "wrap" }}>
              <Typography sx={{ fontSize: "0.8125rem", fontWeight: 500, color: "#3C4043" }}>
                {post.parent_author ? `@${post.parent_author}` : "Unknown"}
              </Typography>
              {post.note && (
                <Typography sx={{ fontSize: "0.75rem", color: "#9AA0A6" }}>
                  · {post.note}
                </Typography>
              )}
              <Typography sx={{ fontSize: "0.75rem", color: "#9AA0A6", ml: "auto" }}>
                {timeAgo(post.scraped_at)}
              </Typography>
            </Box>

            <Typography
              sx={{
                fontSize: "0.875rem",
                color: "#1F1F1F",
                lineHeight: 1.6,
                display: "-webkit-box",
                WebkitLineClamp: 3,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {post.parent_post_text ?? "—"}
            </Typography>
          </Box>

          {/* Engagement + link */}
          <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 0.75, flexShrink: 0 }}>
            <Box sx={{ display: "flex", gap: 1.5, color: "#9AA0A6" }}>
              {post.parent_likes != null && (
                <Tooltip title="Likes">
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                    <ThumbUpOutlined sx={{ fontSize: 13 }} />
                    <Typography sx={{ fontSize: "0.75rem" }}>
                      {post.parent_likes.toLocaleString()}
                    </Typography>
                  </Box>
                </Tooltip>
              )}
              {post.parent_replies != null && (
                <Tooltip title="Replies">
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                    <ChatBubbleOutlineOutlined sx={{ fontSize: 13 }} />
                    <Typography sx={{ fontSize: "0.75rem" }}>
                      {post.parent_replies.toLocaleString()}
                    </Typography>
                  </Box>
                </Tooltip>
              )}
            </Box>
            {post.parent_post_url && (
              <Tooltip title="View original post">
                <Box
                  component="a"
                  href={post.parent_post_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={{ color: "#1A73E8", display: "inline-flex" }}
                >
                  <OpenInNewOutlined sx={{ fontSize: 15 }} />
                </Box>
              </Tooltip>
            )}
          </Box>
        </Box>
      ))}
    </Box>
  );
}
