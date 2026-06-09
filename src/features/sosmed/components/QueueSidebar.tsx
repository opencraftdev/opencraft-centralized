"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import InboxOutlined from "@mui/icons-material/InboxOutlined";
import { TypeBadge } from "@/components/ui/Badge";
import type { ContentPost } from "@/lib/types";

interface Props {
  refreshKey?: number;
}

export function QueueSidebar({ refreshKey = 0 }: Props) {
  const [posts, setPosts] = useState<ContentPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    fetch("/api/posts?status=draft&limit=50", { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data) => setPosts(data.posts ?? []))
      .catch((err) => {
        if (err.name !== "AbortError") console.error("Failed to load draft queue:", err)
      })
      .finally(() => setLoading(false))
    return () => controller.abort()
  }, [refreshKey]);

  return (
    <Box sx={{ bgcolor: "#fff", borderRadius: "12px", overflow: "hidden", height: "100%", display: "flex", flexDirection: "column" }}>
      <Box sx={{ px: 2.5, py: 2, borderBottom: "1px solid #F1F3F4" }}>
        <Typography sx={{ fontSize: "0.8125rem", fontWeight: 600, color: "#1F1F1F" }}>
          Draft Queue
        </Typography>
      </Box>

      <Box sx={{ flex: 1, overflowY: "auto" }}>
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress size={20} />
          </Box>
        ) : posts.length === 0 ? (
          <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1.5, py: 5, px: 2, textAlign: "center" }}>
            <InboxOutlined sx={{ fontSize: 36, color: "#DADCE0" }} />
            <Typography sx={{ fontSize: "0.8125rem", color: "#9AA0A6" }}>
              No drafts — click a day to create a post
            </Typography>
          </Box>
        ) : (
          <Box component="nav" sx={{ display: "flex", flexDirection: "column" }}>
            {posts.map((post) => {
              const preview = post.headline ?? post.textContent?.slice(0, 60) ?? "Untitled post";
              return (
                <Box
                  key={post.id}
                  component={Link}
                  href={`/posts/${post.id}`}
                  sx={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 0.75,
                    px: 2.5,
                    py: 1.75,
                    borderBottom: "1px solid #F1F3F4",
                    textDecoration: "none",
                    "&:hover": { bgcolor: "rgba(0,0,0,0.02)" },
                    "&:last-child": { borderBottom: "none" },
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <TypeBadge type={post.type} sx={{ fontSize: "0.625rem", height: 18 }} />
                    <Typography sx={{ fontSize: "0.6875rem", color: "#9AA0A6", ml: "auto" }}>
                      {post.dateSlot}
                    </Typography>
                  </Box>
                  <Typography sx={{ fontSize: "0.8125rem", color: "#3C4043", lineHeight: 1.4, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                    {preview}
                  </Typography>
                </Box>
              );
            })}
          </Box>
        )}
      </Box>
    </Box>
  );
}
