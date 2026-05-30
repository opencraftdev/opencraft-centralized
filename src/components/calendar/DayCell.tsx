"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Avatar from "@mui/material/Avatar";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import AddOutlined from "@mui/icons-material/AddOutlined";
import type { PostSummary } from "@/lib/types";
import { PostChip } from "./PostChip";

interface DayCellProps {
  day: number;
  dateStr: string;
  isToday: boolean;
  isCurrentMonth: boolean;
  posts: PostSummary[];
  onAddPost: (dateStr: string) => void;
  onOpenPost: (postId: number) => void;
}

const MAX_VISIBLE = 3;

export function DayCell({
  day,
  dateStr,
  isToday,
  isCurrentMonth,
  posts,
  onAddPost,
  onOpenPost,
}: DayCellProps) {
  const [hovered, setHovered] = useState(false);
  const visible = posts.slice(0, MAX_VISIBLE);
  const overflow = posts.length - MAX_VISIBLE;

  return (
    <Box
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      sx={{
        position: "relative",
        minHeight: 120,
        p: 1.25,
        display: "flex",
        flexDirection: "column",
        gap: 0.5,
        border: 1,
        borderColor: "divider",
        bgcolor: isToday
          ? "rgba(26,115,232,0.04)"
          : isCurrentMonth
          ? "background.paper"
          : "background.default",
        opacity: isCurrentMonth ? 1 : 0.4,
        transition: "border-color 180ms ease, background-color 180ms ease",
        "&:hover": isCurrentMonth ? {
          borderColor: "rgba(26,115,232,0.3)",
          bgcolor: isToday ? "rgba(26,115,232,0.06)" : "rgba(26,115,232,0.02)",
        } : {},
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 0.25 }}>
        {isToday ? (
          <Avatar sx={{ width: 28, height: 28, bgcolor: "primary.main", fontSize: "0.8125rem", fontWeight: 600 }}>
            {day}
          </Avatar>
        ) : (
          <Typography variant="body2" sx={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, color: isCurrentMonth ? "text.primary" : "text.secondary" }}>
            {day}
          </Typography>
        )}

        {isCurrentMonth && (
          <IconButton
            onClick={() => onAddPost(dateStr)}
            size="small"
            title="Add content"
            sx={{
              width: 24,
              height: 24,
              opacity: hovered ? 1 : 0,
              transition: "opacity 200ms",
              color: "text.secondary",
              "&:hover": { color: "#fff", bgcolor: "primary.main" },
            }}
          >
            <AddOutlined sx={{ fontSize: 16 }} />
          </IconButton>
        )}
      </Box>

      <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
        {visible.map((post) => (
          <PostChip key={post.id} post={post} onClick={() => onOpenPost(post.id)} />
        ))}
        {overflow > 0 && (
          <Typography variant="caption" sx={{ px: 0.75, pt: 0.25, fontSize: "0.625rem" }}>
            +{overflow} more
          </Typography>
        )}
      </Box>
    </Box>
  );
}
