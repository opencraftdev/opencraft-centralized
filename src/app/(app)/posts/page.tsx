"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import IconButton from "@mui/material/IconButton";
import CircularProgress from "@mui/material/CircularProgress";
import MuiButton from "@mui/material/Button";
import ArticleOutlined from "@mui/icons-material/ArticleOutlined";
import FilterListOutlined from "@mui/icons-material/FilterListOutlined";
import InboxOutlined from "@mui/icons-material/InboxOutlined";
import DescriptionOutlined from "@mui/icons-material/DescriptionOutlined";
import OpenInNewOutlined from "@mui/icons-material/OpenInNewOutlined";
import TouchAppOutlined from "@mui/icons-material/TouchAppOutlined";
import { StatusBadge, TypeBadge } from "@/components/ui/Badge";
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

function DetailPanel({ post }: { post: ContentPost }) {
  const cleanText = post.textContent
    ? post.textContent.replace(/```[\s\S]*?```/g, "").replace(/\n{3,}/g, "\n\n").trim()
    : null;

  return (
    <>
      <Box sx={{ px: 3, py: 2.5, borderBottom: "1px solid #F1F3F4" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1, flexWrap: "wrap" }}>
          <TypeBadge type={post.type} />
          <StatusBadge status={post.status} />
          <Typography variant="caption" color="text.secondary" sx={{ ml: "auto" }}>
            #{post.id}
          </Typography>
        </Box>
        <Typography
          sx={{
            fontSize: "1rem",
            fontWeight: 600,
            lineHeight: 1.4,
            color: "#1F1F1F",
            mb: 0.5,
          }}
        >
          {post.headline ??
            (post.type === "engage"
              ? "Engage Post"
              : post.type === "educate"
              ? "Educate Post"
              : "Video Post")}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {post.dateSlot}
        </Typography>
      </Box>

      <Box sx={{ px: 3, py: 2.5, display: "flex", flexDirection: "column", gap: 2.5 }}>
        {cleanText && (
          <Box>
            <Typography
              variant="overline"
              sx={{ display: "block", mb: 0.75, color: "#5F6368" }}
            >
              Content
            </Typography>
            <Typography
              variant="body2"
              sx={{ whiteSpace: "pre-wrap", lineHeight: 1.7, color: "#1F1F1F" }}
            >
              {cleanText.length > 320 ? `${cleanText.slice(0, 320)}…` : cleanText}
            </Typography>
          </Box>
        )}

        {post.imagePath && (
          <Box>
            <Typography
              variant="overline"
              sx={{ display: "block", mb: 0.75, color: "#5F6368" }}
            >
              Image
            </Typography>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/media/${post.imagePath
                .replace(/^\//, "")
                .split("/")
                .map(encodeURIComponent)
                .join("/")}`}
              alt="Post"
              style={{
                maxWidth: "100%",
                borderRadius: 8,
                border: "1px solid #E8EAED",
              }}
            />
          </Box>
        )}

        {post.videoPath && (
          <Box>
            <Typography
              variant="overline"
              sx={{ display: "block", mb: 0.75, color: "#5F6368" }}
            >
              Video
            </Typography>
            <video
              controls
              style={{
                width: "100%",
                borderRadius: 8,
                border: "1px solid #E8EAED",
                maxHeight: 360,
              }}
            >
              <source
                src={`/api/media/${post.videoPath
                  .replace(/^\//, "")
                  .split("/")
                  .map(encodeURIComponent)
                  .join("/")}`}
                type="video/mp4"
              />
            </video>
          </Box>
        )}

        {post.captions && (
          <Box>
            <Typography
              variant="overline"
              sx={{ display: "block", mb: 0.75, color: "#5F6368" }}
            >
              Captions
            </Typography>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
              {(["threads", "x", "instagram"] as const).map((platform) => {
                const caption = post.captions?.[platform];
                if (!caption) return null;
                return (
                  <Box key={platform}>
                    <Typography
                      variant="caption"
                      sx={{
                        display: "block",
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                        color: "#5F6368",
                        mb: 0.25,
                      }}
                    >
                      {platform}
                    </Typography>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ lineHeight: 1.6 }}
                    >
                      {caption.length > 200 ? `${caption.slice(0, 200)}…` : caption}
                    </Typography>
                  </Box>
                );
              })}
            </Box>
          </Box>
        )}

        <MuiButton
          component={Link}
          href={`/posts/${post.id}`}
          variant="contained"
          size="small"
          endIcon={<OpenInNewOutlined sx={{ fontSize: "16px !important" }} />}
          sx={{
            alignSelf: "flex-start",
            textTransform: "none",
            fontWeight: 500,
            boxShadow: "none",
          }}
        >
          Open full editor
        </MuiButton>
      </Box>
    </>
  );
}

export default function PostsPage() {
  const [posts, setPosts] = useState<ContentPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);

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
            gridTemplateColumns: { xs: "1fr", md: "minmax(0, 1fr) 380px" },
            gap: 2,
            alignItems: "start",
          }}
        >
          {/* Left — table */}
          <Box sx={CARD_SX}>
            <CardHeader
              icon={<ArticleOutlined sx={{ fontSize: 22 }} />}
              title="All posts"
              subtitle="Drafts and history of agentic content you've created"
              action={
                <IconButton size="small" sx={{ color: "#5F6368" }} aria-label="Filter">
                  <FilterListOutlined sx={{ fontSize: 22 }} />
                </IconButton>
              }
            />
            <Box sx={{ height: "1px", bgcolor: "#F1F3F4" }} />

            {loading ? (
              <CenteredState
                icon={<CircularProgress size={28} sx={{ color: "#9AA0A6" }} />}
                message="Loading posts…"
              />
            ) : posts.length === 0 ? (
              <CenteredState
                icon={<InboxOutlined sx={{ fontSize: 56, color: "#9AA0A6" }} />}
                message="No posts yet — create one from the Calendar."
              />
            ) : (
              <TableContainer component={Box} sx={{ bgcolor: "transparent" }}>
                <Table sx={{ bgcolor: "transparent" }}>
                  <TableHead sx={{ bgcolor: "transparent" }}>
                    <TableRow sx={{ bgcolor: "transparent" }}>
                      <TableCell sx={{ ...HEAD_CELL_SX, pl: 3 }}>Type</TableCell>
                      <TableCell sx={HEAD_CELL_SX}>Status</TableCell>
                      <TableCell sx={HEAD_CELL_SX}>Date</TableCell>
                      <TableCell sx={{ ...HEAD_CELL_SX, pr: 3 }}>
                        Headline / Content
                      </TableCell>
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
                            <Typography
                              variant="body2"
                              sx={{
                                color: "text.primary",
                                fontWeight: isSelected ? 500 : 400,
                              }}
                            >
                              {post.headline ?? post.textContent?.slice(0, 60) ?? "—"}
                            </Typography>
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
          <Box sx={{ ...CARD_SX, position: { md: "sticky" }, top: { md: 92 } }}>
            {selectedPost ? (
              <DetailPanel post={selectedPost} />
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
