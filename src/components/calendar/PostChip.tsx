"use client";

import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Typography from "@mui/material/Typography";
import type { PostSummary } from "@/lib/types";
import { TypeBadge, StatusBadge } from "@/components/ui/Badge";

interface PostChipProps {
  post: PostSummary;
  onClick?: () => void;
}

const TYPE_BG: Record<string, string> = {
  engage:  "rgba(66,133,244,0.05)",
  educate: "rgba(52,168,83,0.05)",
  video:   "rgba(95,99,104,0.05)",
};

const TYPE_BG_HOVER: Record<string, string> = {
  engage:  "rgba(66,133,244,0.09)",
  educate: "rgba(52,168,83,0.09)",
  video:   "rgba(95,99,104,0.09)",
};

export function PostChip({ post, onClick }: PostChipProps) {
  const preview = post.headline ?? post.textContent?.slice(0, 40) ?? "—";

  return (
    <ButtonBase
      onClick={onClick}
      sx={{
        width: "100%",
        textAlign: "left",
        display: "flex",
        alignItems: "center",
        gap: 0.75,
        px: 1,
        py: 0.5,
        borderRadius: 1,
        bgcolor: TYPE_BG[post.type] ?? "#f1f3f4",
        "&:hover": { bgcolor: TYPE_BG_HOVER[post.type] ?? "#e8eaed" },
        transition: "background-color 200ms",
      }}
    >
      <TypeBadge type={post.type} sx={{ fontSize: "0.5625rem", height: 18, "& .MuiChip-label": { px: 0.75 } }} />
      <Typography
        variant="caption"
        sx={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "text.secondary", lineHeight: 1.3 }}
      >
        {preview}
      </Typography>
      <StatusBadge status={post.status} sx={{ fontSize: "0.5625rem", height: 18, "& .MuiChip-label": { px: 0.75 } }} />
    </ButtonBase>
  );
}
