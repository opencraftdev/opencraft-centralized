"use client";

import { useEffect, useState, useCallback } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import Divider from "@mui/material/Divider";
import Chip from "@mui/material/Chip";
import MuiButton from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import { StatusBadge, TypeBadge } from "@/components/ui/Badge";
import type { ContentPost } from "@/lib/types";

interface PostReviewPanelProps {
  onOpenPost: (id: number) => void;
  refreshKey?: number;
}

export function PostReviewPanel({ onOpenPost, refreshKey }: PostReviewPanelProps) {
  const [posts, setPosts] = useState<ContentPost[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/posts?status=draft&limit=20");
      const data = await res.json();
      setPosts(data.posts ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load, refreshKey]);

  return (
    <Box sx={{ width: 256, flexShrink: 0, borderLeft: 1, borderColor: "divider", bgcolor: "background.paper", display: "flex", flexDirection: "column" }}>
      <Box sx={{ px: 2.5, pt: 2.5, pb: 2, borderBottom: 1, borderColor: "divider" }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Queue</Typography>
          {posts.length > 0 && (
            <Chip
              label={`${posts.length} draft${posts.length !== 1 ? "s" : ""}`}
              size="small"
              sx={{ bgcolor: "rgba(227,116,0,0.08)", color: "#e37400", fontWeight: 600, height: 20, fontSize: "0.6875rem" }}
            />
          )}
        </Box>
        <Typography variant="caption" sx={{ mt: 0.25, display: "block" }}>Pending review</Typography>
      </Box>

      <Box sx={{ flex: 1, overflowY: "auto" }}>
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress size={18} />
          </Box>
        ) : posts.length === 0 ? (
          <Box sx={{ px: 2.5, py: 5, textAlign: "center" }}>
            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>All clear</Typography>
            <Typography variant="caption">No drafts pending review</Typography>
          </Box>
        ) : (
          <List disablePadding>
            {posts.map((post, i) => (
              <Box key={post.id}>
                {i > 0 && <Divider />}
                <ListItemButton
                  onClick={() => onOpenPost(post.id)}
                  sx={{ px: 2.5, py: 1.5, flexDirection: "column", alignItems: "stretch" }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 0.5 }}>
                    <Typography variant="caption">{post.dateSlot}</Typography>
                    <Box sx={{ display: "flex", gap: 0.5 }}>
                      <TypeBadge type={post.type} sx={{ fontSize: "0.5625rem", height: 18, "& .MuiChip-label": { px: 0.75 } }} />
                      <StatusBadge status={post.status} sx={{ fontSize: "0.5625rem", height: 18, "& .MuiChip-label": { px: 0.75 } }} />
                    </Box>
                  </Box>
                  <Typography
                    variant="caption"
                    sx={{
                      color: "text.secondary",
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                      lineHeight: 1.5,
                    }}
                  >
                    {post.headline ?? post.textContent?.slice(0, 80) ?? "—"}
                  </Typography>
                </ListItemButton>
              </Box>
            ))}
          </List>
        )}
      </Box>

      <Box sx={{ px: 2.5, py: 1.5, borderTop: 1, borderColor: "divider" }}>
        <MuiButton variant="text" size="small" onClick={load} fullWidth sx={{ fontSize: "0.6875rem" }}>
          Refresh
        </MuiButton>
      </Box>
    </Box>
  );
}
