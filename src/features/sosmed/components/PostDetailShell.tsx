"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import DeleteOutlined from "@mui/icons-material/DeleteOutlined";
import ArrowBackOutlined from "@mui/icons-material/ArrowBackOutlined";
import OpenInNewOutlined from "@mui/icons-material/OpenInNewOutlined";
import { TypeBadge, StatusBadge } from "@/components/ui/Badge";
import { PostDetail } from "@/components/posts/PostDetail";
import { EngageGenerator } from "./EngageGenerator";
import { EducateGenerator } from "./EducateGenerator";
import { PublishSection } from "./PublishSection";
import type { ContentPost } from "@/lib/types";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box>
      <Typography
        sx={{
          fontSize: "0.6875rem",
          fontWeight: 600,
          letterSpacing: "0.5px",
          textTransform: "uppercase",
          color: "#5F6368",
          mb: 1.5,
        }}
      >
        {title}
      </Typography>
      {children}
    </Box>
  );
}

export function PostDetailShell({ initialPost }: { initialPost: ContentPost }) {
  const router = useRouter();
  const [post, setPost] = useState<ContentPost>(initialPost);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleDelete() {
    if (!confirm("Delete this post? This cannot be undone.")) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/posts/${post.id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      router.push("/calendar");
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Failed to delete post");
      setDeleting(false);
    }
  }

  const isDraft = post.status === "draft";
  const canPublish =
    post.status === "accepted" ||
    post.status === "scheduled" ||
    post.status === "published";

  // captions is PostCaptions | null; each field is a non-nullable string
  const captions = post.captions;
  const hasCaptions =
    captions &&
    (captions.threads || captions.x || captions.instagram || captions.tiktok);

  return (
    <Box sx={{ maxWidth: 760, mx: "auto", px: 3, pt: "76px", pb: 6 }}>
      {/* Back link */}
      <Box sx={{ mb: 2 }}>
        <Button
          component={Link}
          href="/calendar"
          startIcon={<ArrowBackOutlined />}
          size="small"
          sx={{ textTransform: "none", color: "#5F6368" }}
        >
          Calendar
        </Button>
      </Box>

      {/* Header card */}
      <Box
        sx={{
          bgcolor: "#fff",
          borderRadius: "16px",
          p: 3,
          mb: 2,
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 2,
        }}
      >
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <Box
            sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}
          >
            <TypeBadge type={post.type} />
            <StatusBadge status={post.status} />
            <Typography variant="caption" color="text.secondary">
              #{post.id}
            </Typography>
          </Box>
          <Typography sx={{ fontSize: "1.25rem", fontWeight: 500, color: "#1F1F1F" }}>
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
        <IconButton
          onClick={handleDelete}
          disabled={deleting}
          size="small"
          aria-label="Delete post"
          sx={{ color: "#D93025", flexShrink: 0 }}
        >
          <DeleteOutlined />
        </IconButton>
      </Box>
      {deleteError && (
        <Typography sx={{ fontSize: "0.75rem", color: "#D93025", mt: 0.5 }}>
          {deleteError}
        </Typography>
      )}

      {/* Generation section — only when draft */}
      {isDraft && (
        <Box sx={{ bgcolor: "#fff", borderRadius: "16px", p: 3, mb: 2 }}>
          <Section title="Generation">
            {post.type === "engage" && (
              <EngageGenerator
                post={post}
                onPostUpdate={setPost}
                onAccept={() => setPost((p) => ({ ...p, status: "accepted" }))}
              />
            )}
            {post.type === "educate" && (
              <EducateGenerator
                post={post}
                onPostUpdate={setPost}
                onAccept={() => setPost((p) => ({ ...p, status: "accepted" }))}
              />
            )}
            {post.type === "video" && (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                <Typography sx={{ fontSize: "0.875rem", color: "#5F6368" }}>
                  The video pipeline runs as a multi-step process.
                </Typography>
                <Button
                  component={Link}
                  href={`/posts/${post.id}/video`}
                  variant="outlined"
                  endIcon={<OpenInNewOutlined sx={{ fontSize: 16 }} />}
                  sx={{
                    textTransform: "none",
                    borderRadius: "9999px",
                    alignSelf: "flex-start",
                  }}
                >
                  Go to Video Generator
                </Button>
              </Box>
            )}
          </Section>
        </Box>
      )}

      {/* Read-only content preview — when not draft */}
      {!isDraft && (
        <Box
          sx={{ bgcolor: "#fff", borderRadius: "16px", overflow: "hidden", mb: 2 }}
        >
          <PostDetail post={post} />
        </Box>
      )}

      {/* Captions — if present */}
      {hasCaptions && (
        <Box sx={{ bgcolor: "#fff", borderRadius: "16px", p: 3, mb: 2 }}>
          <Section title="Captions">
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {(["threads", "x", "instagram", "tiktok"] as const).map((platform) => {
                const text = captions[platform];
                if (!text) return null;
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
                      sx={{ lineHeight: 1.6, whiteSpace: "pre-wrap" }}
                    >
                      {text}
                    </Typography>
                  </Box>
                );
              })}
            </Box>
          </Section>
        </Box>
      )}

      {/* Publish section */}
      {canPublish && (
        <>
          <Divider sx={{ my: 2 }} />
          <Box sx={{ bgcolor: "#fff", borderRadius: "16px", p: 3 }}>
            <Section title="Publish">
              <PublishSection post={post} onPostUpdate={setPost} />
            </Section>
          </Box>
        </>
      )}
    </Box>
  );
}
