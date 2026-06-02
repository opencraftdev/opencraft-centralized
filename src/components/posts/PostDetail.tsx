"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import { StatusBadge, TypeBadge } from "@/components/ui/Badge";
import type { ContentPost } from "@/lib/types";

const CAPTION_PLATFORMS = ["instagram", "threads", "x", "tiktok"] as const;

export function mediaUrl(path: string): string {
  return `/api/media/${path
    .replace(/^\//, "")
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
}

function formatDateTime(value: string): string {
  const d = new Date(value);
  return isNaN(d.getTime())
    ? value
    : d.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

function defaultTitle(post: ContentPost): string {
  return post.type === "engage"
    ? "Engage Post"
    : post.type === "educate"
    ? "Educate Post"
    : "Video Post";
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Box>
      <Typography variant="overline" sx={{ display: "block", mb: 0.75, color: "#5F6368" }}>
        {label}
      </Typography>
      {children}
    </Box>
  );
}

/**
 * Detailed, read-only view of a single post: header + content/image/video,
 * captions, hashtags, source, and publish status. Shared by the Posts page
 * preview panel and the calendar event popover.
 */
export function PostDetail({ post }: { post: ContentPost }) {
  const cleanText = post.textContent
    ? post.textContent.replace(/```[\s\S]*?```/g, "").replace(/\n{3,}/g, "\n\n").trim()
    : null;

  const captionPlatforms = CAPTION_PLATFORMS.filter((p) => post.captions?.[p]);

  const hashtags = post.hashtags
    ? Array.from(
        new Set([
          ...(post.hashtags.instagram ?? []),
          ...(post.hashtags.threads ?? []),
          ...(post.hashtags.x ?? []),
          ...(post.hashtags.tiktok ?? []),
        ]),
      )
    : [];

  const hasPublishInfo =
    post.status === "published" ||
    post.status === "scheduled" ||
    (post.publishResults?.length ?? 0) > 0;

  const isEmpty =
    !post.videoPath &&
    !cleanText &&
    !post.imagePath &&
    captionPlatforms.length === 0 &&
    hashtags.length === 0 &&
    !post.source?.videoUrl &&
    !hasPublishInfo;

  return (
    <>
      {/* Header */}
      <Box sx={{ px: 3, py: 2.5, borderBottom: "1px solid #F1F3F4" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1, flexWrap: "wrap" }}>
          <TypeBadge type={post.type} />
          <StatusBadge status={post.status} />
          <Typography variant="caption" color="text.secondary" sx={{ ml: "auto" }}>
            #{post.id}
          </Typography>
        </Box>
        <Typography
          sx={{ fontSize: "1rem", fontWeight: 600, lineHeight: 1.4, color: "#1F1F1F", mb: 0.5 }}
        >
          {post.headline ?? defaultTitle(post)}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {post.dateSlot}
        </Typography>
      </Box>

      <Box sx={{ px: 3, py: 2.5, display: "flex", flexDirection: "column", gap: 2.5 }}>
        {isEmpty && (
          <Typography variant="body2" color="text.secondary">
            No content has been generated for this post yet.
          </Typography>
        )}

        {/* Video — shown prominently for video posts */}
        {post.videoPath && (
          <Section label="Video">
            <video
              controls
              playsInline
              style={{
                display: "block",
                margin: "0 auto",
                width: "100%",
                maxWidth: 260,
                maxHeight: 460,
                borderRadius: 10,
                border: "1px solid #E8EAED",
                background: "#000",
              }}
            >
              <source src={mediaUrl(post.videoPath)} type="video/mp4" />
            </video>
          </Section>
        )}

        {/* Content */}
        {cleanText && (
          <Section label="Content">
            <Typography
              variant="body2"
              sx={{ whiteSpace: "pre-wrap", lineHeight: 1.7, color: "#1F1F1F" }}
            >
              {cleanText}
            </Typography>
          </Section>
        )}

        {/* Image / code card */}
        {post.imagePath && (
          <Section label={post.type === "educate" ? "Code card" : "Image"}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={mediaUrl(post.imagePath)}
              alt="Post"
              style={{ maxWidth: "100%", borderRadius: 8, border: "1px solid #E8EAED" }}
            />
          </Section>
        )}

        {/* Captions */}
        {captionPlatforms.length > 0 && (
          <Section label="Captions">
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.75 }}>
              {captionPlatforms.map((platform) => (
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
                    {post.captions?.[platform]}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Section>
        )}

        {/* Hashtags */}
        {hashtags.length > 0 && (
          <Section label="Hashtags">
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
              {hashtags.map((tag) => (
                <Chip
                  key={tag}
                  label={tag.startsWith("#") ? tag : `#${tag}`}
                  size="small"
                  sx={{
                    bgcolor: "rgba(11,87,208,0.06)",
                    color: "#0B57D0",
                    fontSize: "0.6875rem",
                    height: 22,
                  }}
                />
              ))}
            </Box>
          </Section>
        )}

        {/* Source */}
        {post.source?.videoUrl && (
          <Section label="Source">
            <Box
              component="a"
              href={post.source.videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              sx={{
                color: "#0B57D0",
                fontSize: "0.8125rem",
                wordBreak: "break-word",
                textDecoration: "none",
                "&:hover": { textDecoration: "underline" },
              }}
            >
              {post.source.channelTitle || post.source.videoTitle || post.source.videoUrl}
            </Box>
          </Section>
        )}

        {/* Publish status */}
        {hasPublishInfo && (
          <Section label="Publish status">
            {post.status === "published" && post.publishedAt && (
              <Typography variant="body2" sx={{ color: "#188038", fontWeight: 500, mb: 1 }}>
                Published · {formatDateTime(post.publishedAt)}
              </Typography>
            )}
            {post.status === "scheduled" && post.scheduledAt && (
              <Typography variant="body2" sx={{ color: "#1A73E8", fontWeight: 500, mb: 1 }}>
                Scheduled · {formatDateTime(post.scheduledAt)}
              </Typography>
            )}
            {post.publishResults?.map((r) => (
              <Box key={r.platform} sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 0.5 }}>
                <Typography variant="caption" color="text.secondary" sx={{ width: 72 }}>
                  {r.platform}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{
                    fontWeight: 500,
                    color:
                      r.status === "ok"
                        ? "#188038"
                        : r.status === "skipped"
                        ? "#5F6368"
                        : "#D93025",
                  }}
                >
                  {r.status}
                </Typography>
                {r.error && (
                  <Typography variant="caption" sx={{ color: "#D93025" }} noWrap>
                    {r.error}
                  </Typography>
                )}
              </Box>
            ))}
          </Section>
        )}

        {/* Meta footer */}
        <Box sx={{ pt: 1.5, borderTop: "1px solid #F1F3F4" }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
            Created {formatDateTime(post.createdAt)}
          </Typography>
          {post.updatedAt && post.updatedAt !== post.createdAt && (
            <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
              Updated {formatDateTime(post.updatedAt)}
            </Typography>
          )}
        </Box>
      </Box>
    </>
  );
}
