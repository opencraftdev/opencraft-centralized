"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import type { VideoSuggestItem } from "@/lib/sosmed/types";

interface Props {
  items: VideoSuggestItem[];
  selectedVideoId: string | null;
  onSelect: (videoId: string) => void;
}

export function SuggestList({ items, selectedVideoId, onSelect }: Props) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
      {items.map((item) => {
        const isSelected = item.videoId === selectedVideoId;
        return (
          <Box
            key={item.videoId}
            onClick={() => onSelect(item.videoId)}
            sx={{
              display: "flex",
              gap: 2,
              p: 2,
              borderRadius: "12px",
              border: "2px solid",
              borderColor: isSelected ? "#0B57D0" : "#E8EAED",
              bgcolor: isSelected ? "rgba(11,87,208,0.04)" : "#fff",
              cursor: "pointer",
              transition: "all 140ms",
              "&:hover": { borderColor: "#0B57D0" },
            }}
          >
            {item.thumbnailUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.thumbnailUrl}
                alt={item.title}
                style={{ width: 120, height: 68, objectFit: "cover", borderRadius: 8, flexShrink: 0 }}
              />
            )}
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontSize: "0.9375rem", fontWeight: 500, color: "#1F1F1F", mb: 0.5, lineHeight: 1.4, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                {item.title}
              </Typography>
              <Typography sx={{ fontSize: "0.8125rem", color: "#5F6368", mb: 0.75 }}>{item.channelTitle}</Typography>
              <Chip label={item.duration} size="small" sx={{ fontSize: "0.6875rem", height: 20 }} />
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}
