"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import IconButton from "@mui/material/IconButton";
import ArticleOutlined from "@mui/icons-material/ArticleOutlined";
import FilterListOutlined from "@mui/icons-material/FilterListOutlined";
import InboxOutlined from "@mui/icons-material/InboxOutlined";
import DescriptionOutlined from "@mui/icons-material/DescriptionOutlined";
import TouchAppOutlined from "@mui/icons-material/TouchAppOutlined";
import VideocamOutlined from "@mui/icons-material/VideocamOutlined";
import ImageOutlined from "@mui/icons-material/ImageOutlined";
import { StatusBadge, TypeBadge } from "@/components/ui/Badge";
import { PostDetail } from "@/components/posts/PostDetail";
import { useGlobalLoading } from "@/features/content/components/loading-context";
import type { ContentPost } from "@/lib/types";

function CardHeader({
  icon,
  title,
  subtitle,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  action?: React.ReactNode;
}) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 2,
        px: 3,
        py: 2.5,
      }}
    >
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 2, minWidth: 0 }}>
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            bgcolor: "#E8EAED",
            color: "#5F6368",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {icon}
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography
            sx={{
              fontSize: "1.25rem",
              fontWeight: 500,
              lineHeight: "1.75rem",
              color: "#1F1F1F",
            }}
          >
            {title}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {subtitle}
          </Typography>
        </Box>
      </Box>
      {action}
    </Box>
  );
}

function CenteredState({
  icon,
  message,
  minHeight = 280,
}: {
  icon: React.ReactNode;
  message: string;
  minHeight?: number;
}) {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 2,
        py: 6,
        px: 3,
        minHeight,
      }}
    >
      {icon}
      <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center" }}>
        {message}
      </Typography>
    </Box>
  );
}

const HEAD_CELL_SX = {
  fontSize: "0.75rem",
  fontWeight: 500,
  color: "#5F6368",
  textTransform: "uppercase",
  letterSpacing: "0.5px",
  bgcolor: "#fff",
  borderBottom: "1px solid #F1F3F4",
  py: 1.5,
};

const BODY_CELL_SX = {
  borderBottom: "1px solid #F1F3F4",
  py: 2,
};

const CARD_SX = {
  borderRadius: "12px",
  bgcolor: "#fff",
  overflow: "hidden",
} as const;

function MediaIndicator({ post }: { post: ContentPost }) {
  if (post.videoPath) {
    return <VideocamOutlined sx={{ fontSize: 16, color: "#5F6368", flexShrink: 0 }} />;
  }
  if (post.imagePath) {
    return <ImageOutlined sx={{ fontSize: 16, color: "#5F6368", flexShrink: 0 }} />;
  }
  return null;
}

function PostsPageInner() {
  const searchParams = useSearchParams();
  const initialParam = searchParams.get("post");

  const [posts, setPosts] = useState<ContentPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(
    initialParam ? Number(initialParam) : null,
  );

  useGlobalLoading(loading);

  useEffect(() => {
    fetch("/api/posts?limit=50")
      .then((r) => r.json())
      .then((data) => setPosts(data.posts ?? []))
      .finally(() => setLoading(false));
  }, []);

  const selectedPost = useMemo(
    () => posts.find((p) => p.id === selectedId) ?? null,
    [posts, selectedId],
  );

  return (
    <Box sx={{ minHeight: "100%", bgcolor: "#F0F4F9" }}>
      <Box
        sx={{
          position: "fixed",
          top: 64,
          left: 280,
          right: 0,
          zIndex: 10,
          height: 60,
          bgcolor: "#F0F4F9",
          borderBottom: "1px solid #E8EAED",
          display: "flex",
          alignItems: "center",
        }}
      >
        <Box sx={{ maxWidth: 1200, mx: "auto", px: 3, width: "100%" }}>
          <Typography
            component="h1"
            sx={{
              fontSize: "1.375rem",
              fontWeight: 400,
              lineHeight: "1.75rem",
              color: "#1F1F1F",
            }}
          >
            Posts
          </Typography>
        </Box>
      </Box>

      <Box sx={{ maxWidth: 1200, mx: "auto", px: 3, pt: "76px", pb: 4 }}>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "minmax(0, 1fr) 400px" },
            gap: 2,
            alignItems: "start",
          }}
        >
          {/* Left — table */}
          <Box sx={CARD_SX}>
            <CardHeader
              icon={<ArticleOutlined sx={{ fontSize: 22 }} />}
              title="All posts"
              subtitle="Content the automation agent has produced"
              action={
                <IconButton size="small" sx={{ color: "#5F6368" }} aria-label="Filter">
                  <FilterListOutlined sx={{ fontSize: 22 }} />
                </IconButton>
              }
            />
            <Box sx={{ height: "1px", bgcolor: "#F1F3F4" }} />

            {loading ? (
              <Box sx={{ minHeight: 280 }} />
            ) : posts.length === 0 ? (
              <CenteredState
                icon={<InboxOutlined sx={{ fontSize: 56, color: "#9AA0A6" }} />}
                message="No posts yet — the agent hasn't published any content."
              />
            ) : (
              <TableContainer component={Box} sx={{ bgcolor: "transparent" }}>
                <Table sx={{ bgcolor: "transparent" }}>
                  <TableHead sx={{ bgcolor: "transparent" }}>
                    <TableRow sx={{ bgcolor: "transparent" }}>
                      <TableCell sx={{ ...HEAD_CELL_SX, pl: 3 }}>Type</TableCell>
                      <TableCell sx={HEAD_CELL_SX}>Status</TableCell>
                      <TableCell sx={HEAD_CELL_SX}>Date</TableCell>
                      <TableCell sx={{ ...HEAD_CELL_SX, pr: 3 }}>Headline / Content</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {posts.map((post) => {
                      const isSelected = post.id === selectedId;
                      return (
                        <TableRow
                          key={post.id}
                          hover
                          onClick={() => setSelectedId(post.id)}
                          sx={{
                            cursor: "pointer",
                            bgcolor: isSelected ? "rgba(11,87,208,0.06)" : "transparent",
                            "&:hover": {
                              bgcolor: isSelected
                                ? "rgba(11,87,208,0.08)"
                                : "rgba(0,0,0,0.02)",
                            },
                          }}
                        >
                          <TableCell sx={{ ...BODY_CELL_SX, pl: 3 }}>
                            <TypeBadge type={post.type} />
                          </TableCell>
                          <TableCell sx={BODY_CELL_SX}>
                            <StatusBadge status={post.status} />
                          </TableCell>
                          <TableCell sx={BODY_CELL_SX}>
                            <Typography variant="body2" color="text.secondary">
                              {post.dateSlot}
                            </Typography>
                          </TableCell>
                          <TableCell sx={{ ...BODY_CELL_SX, pr: 3 }}>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 0 }}>
                              <MediaIndicator post={post} />
                              <Typography
                                variant="body2"
                                sx={{
                                  color: "text.primary",
                                  fontWeight: isSelected ? 500 : 400,
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {post.headline ?? post.textContent?.slice(0, 60) ?? "—"}
                              </Typography>
                            </Box>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Box>

          {/* Right — detail panel */}
          <Box
            sx={{
              ...CARD_SX,
              position: { md: "sticky" },
              top: { md: 92 },
              maxHeight: { md: "calc(100vh - 116px)" },
              display: "flex",
              flexDirection: "column",
            }}
          >
            {selectedPost ? (
              <Box sx={{ overflowY: "auto" }}>
                <PostDetail post={selectedPost} />
              </Box>
            ) : (
              <>
                <CardHeader
                  icon={<DescriptionOutlined sx={{ fontSize: 22 }} />}
                  title="Preview"
                  subtitle="Select a post to see its content"
                />
                <Box sx={{ height: "1px", bgcolor: "#F1F3F4" }} />
                <CenteredState
                  icon={<TouchAppOutlined sx={{ fontSize: 48, color: "#9AA0A6" }} />}
                  message="Click any row in the table to preview the post here."
                  minHeight={320}
                />
              </>
            )}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

export default function PostsPage() {
  return (
    <Suspense fallback={null}>
      <PostsPageInner />
    </Suspense>
  );
}
