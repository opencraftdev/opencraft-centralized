"use client";

import { useEffect, useState, useCallback, use } from "react";
import Link from "next/link";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import TextField from "@mui/material/TextField";
import CircularProgress from "@mui/material/CircularProgress";
import ArrowBackOutlined from "@mui/icons-material/ArrowBackOutlined";
import MuiButton from "@mui/material/Button";
import { StatusBadge, TypeBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EngageForm } from "@/components/generate/EngageForm";
import { EducateForm } from "@/components/generate/EducateForm";
import type { ContentPost } from "@/lib/types";

export default function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [post, setPost] = useState<ContentPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [scheduleTime, setScheduleTime] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [publishMsg, setPublishMsg] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [recoverMsg, setRecoverMsg] = useState<string | null>(null);

  const loadPost = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/posts/${id}`);
      if (res.status === 404) { setNotFound(true); return; }
      const data = await res.json();
      setPost(data.post);
      if (data.post?.scheduledAt) {
        const local = new Date(data.post.scheduledAt);
        const hh = String(local.getHours()).padStart(2, "0");
        const mm = String(local.getMinutes()).padStart(2, "0");
        setScheduleTime(`${hh}:${mm}`);
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { loadPost(); }, [loadPost]);

  const handleApproved = () => loadPost();

  const handleSchedule = async () => {
    if (!scheduleTime || !post) return;
    setScheduling(true);
    try {
      const iso = new Date(`${post.dateSlot}T${scheduleTime}:00`).toISOString();
      await fetch(`/api/posts/${id}/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduledAt: iso }),
      });
      await loadPost();
    } finally {
      setScheduling(false);
    }
  };

  const handlePublishNow = async () => {
    if (!confirm("Publish this post now to all platforms?")) return;
    setPublishing(true);
    setPublishMsg(null);
    try {
      const res = await fetch(`/api/posts/${id}/publish`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setPublishMsg(`Error: ${data.error}`);
      } else {
        setPublishMsg("Published successfully!");
        await loadPost();
      }
    } finally {
      setPublishing(false);
    }
  };

  const handleRecover = async () => {
    setRecovering(true);
    setRecoverMsg(null);
    try {
      const res = await fetch(`/api/posts/${id}/recover`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setRecoverMsg(`Error: ${data.error}`);
      } else {
        setRecoverMsg(`Recovered from ${data.recoveredFrom?.split("/").pop()}`);
        await loadPost();
      }
    } finally {
      setRecovering(false);
    }
  };

  const handleDelete = async () => {
    const hasScheduled = post?.publishResults?.some((r) => r.status === "ok" && r.uri.startsWith("zernio://"));
    const msg = hasScheduled
      ? "Delete this post? This will also cancel it on Zernio."
      : "Delete this post? This cannot be undone.";
    if (!confirm(msg)) return;
    setDeleting(true);
    try {
      await fetch(`/api/posts/${id}`, { method: "DELETE" });
      window.location.href = "/calendar";
    } finally {
      setDeleting(false);
    }
  };

  const isEditable = post ? ["draft"].includes(post.status) : false;
  const isPublishable = post ? ["accepted", "scheduled"].includes(post.status) : false;
  const hasContent = post ? !!(post.textContent || post.imagePath || post.videoPath) : false;
  const isPast = post ? post.dateSlot < new Date().toISOString().slice(0, 10) : false;
  const displayStatus = (isPast && post?.status === "published") ? "posted" : post?.status;

  const handleApprove = async () => {
    try {
      const res = await fetch(`/api/posts/${id}/approve`, { method: "POST" });
      if (res.ok) await loadPost();
    } catch { /* silent */ }
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "a" || e.key === "A") {
        if (isEditable && hasContent && !publishing) { e.preventDefault(); handleApprove(); }
      }
      if (e.key === "p" || e.key === "P") {
        if (isPublishable && !publishing) { e.preventDefault(); handlePublishNow(); }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditable, isPublishable, hasContent, publishing]);

  if (loading) {
    return (
      <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  if (notFound || !post) {
    return (
      <Box sx={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2 }}>
        <Typography variant="body2" color="text.secondary">Post not found.</Typography>
        <MuiButton component={Link} href="/calendar" variant="text" size="small">
          Back to calendar
        </MuiButton>
      </Box>
    );
  }

  return (
    <Box sx={{ flex: 1, maxWidth: 720, mx: "auto", width: "100%", px: 3, py: 4 }}>
      {/* Post header */}
      <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", mb: 3 }}>
        <Box>
          <MuiButton
            component={Link}
            href="/calendar"
            variant="text"
            size="small"
            startIcon={<ArrowBackOutlined />}
            sx={{ mb: 1, ml: -1 }}
          >
            Back
          </MuiButton>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
            <TypeBadge type={post.type} />
            <StatusBadge status={displayStatus!} />
            <Typography variant="caption">#{post.id}</Typography>
          </Box>
          <Typography variant="h5" sx={{ lineHeight: 1.3 }}>
            {post.headline ?? (post.type === "engage" ? "Engage Post" : post.type === "educate" ? "Educate Post" : "Video Post")}
          </Typography>
          <Typography variant="caption" sx={{ display: "block", mt: 0.5 }}>{post.dateSlot}</Typography>
        </Box>
        <Button variant="danger" size="sm" onClick={handleDelete} loading={deleting} disabled={isPast}>
          Delete
        </Button>
      </Box>

      {/* Generation section */}
      {post.status === "draft" && (
        <Card sx={{ mb: 3 }}>
          <CardContent sx={{ p: 3, "&:last-child": { pb: 3 } }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
              {post.type === "video" ? "Video Pipeline" : "Generate Content"}
            </Typography>

            {post.type === "engage" && (
              <EngageForm postId={post.id} initialText={post.textContent} onApproved={handleApproved} />
            )}
            {post.type === "educate" && (
              <EducateForm postId={post.id} initialText={post.textContent} initialImagePath={post.imagePath} onApproved={handleApproved} />
            )}
            {post.type === "video" && (
              <Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  The video pipeline runs yt-dlp + ffmpeg + Remotion (5 to 10 min). Use the generate flow below.
                </Typography>
                <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                  <MuiButton component={Link} href={`/posts/${post.id}/video`} variant="contained" size="small">
                    Open video generator
                  </MuiButton>
                  {!post.videoPath && (
                    <Button variant="secondary" size="sm" loading={recovering} onClick={handleRecover}>
                      Recover from state
                    </Button>
                  )}
                </Box>
                {recoverMsg && (
                  <Typography variant="body2" sx={{ mt: 1, color: recoverMsg.startsWith("Error") ? "error.main" : "success.main" }}>
                    {recoverMsg}
                  </Typography>
                )}
                {post.videoPath && (
                  <Box sx={{ pt: 2, mt: 2, borderTop: 1, borderColor: "divider", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <Typography variant="body2" color="text.secondary">
                      Video ready. Approve to enable scheduling and publishing.
                    </Typography>
                    <MuiButton variant="contained" size="small" onClick={handleApprove}>
                      Approve & accept
                    </MuiButton>
                  </Box>
                )}
              </Box>
            )}
          </CardContent>
        </Card>
      )}

      {/* Content preview */}
      {post.textContent && post.status !== "draft" && (
        <Card sx={{ mb: 3 }}>
          <CardContent sx={{ p: 3, "&:last-child": { pb: 3 } }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>Content</Typography>
            <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", lineHeight: 1.7 }}>
              {post.textContent.replace(/```[\s\S]*?```/g, "").replace(/\n{3,}/g, "\n\n").trim()}
            </Typography>
            {post.imagePath && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="caption" sx={{ display: "block", mb: 1 }}>Code card</Typography>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/media/${post.imagePath.replace(/^\//, "").split("/").map(encodeURIComponent).join("/")}`}
                  alt="Code card"
                  style={{ maxWidth: "100%", borderRadius: 8, border: "1px solid #dadce0" }}
                />
              </Box>
            )}
          </CardContent>
        </Card>
      )}

      {/* Video preview */}
      {post.videoPath && (
        <Card sx={{ mb: 3 }}>
          <CardContent sx={{ p: 3, "&:last-child": { pb: 3 } }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>Video</Typography>
            <video controls style={{ width: "100%", maxWidth: 360, margin: "0 auto", display: "block", borderRadius: 8, border: "1px solid #dadce0", maxHeight: 480 }}>
              <source
                src={`/api/media/${post.videoPath.replace(/^\//, "").split("/").map(encodeURIComponent).join("/")}`}
                type="video/mp4"
              />
            </video>
            {post.headline && (
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mt: 2 }}>{post.headline}</Typography>
            )}
          </CardContent>
        </Card>
      )}

      {/* Captions preview */}
      {post.captions && (
        <Card sx={{ mb: 3 }}>
          <CardContent sx={{ p: 3, "&:last-child": { pb: 3 } }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>Captions</Typography>
            {(["threads", "x", "instagram"] as const).map((platform) => {
              const caption = post.captions?.[platform];
              if (!caption) return null;
              return (
                <Box key={platform} sx={{ mb: 2, "&:last-child": { mb: 0 } }}>
                  <Typography variant="overline" sx={{ display: "block", mb: 0.5 }}>{platform}</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
                    {caption}
                  </Typography>
                </Box>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Scheduling + Publish */}
      {["accepted", "scheduled", "published"].includes(post.status) && (
        <Card sx={{ mb: 3 }}>
          <CardContent sx={{ p: 3, "&:last-child": { pb: 3 } }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>Publish</Typography>

            {post.status === "published" ? (
              <Box>
                <Typography variant="body2" sx={{ color: "success.main", fontWeight: 500, mb: 1 }}>
                  Published at {post.publishedAt}
                </Typography>
                {post.publishResults?.map((r) => (
                  <Box key={r.platform} sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 0.5 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ width: 64 }}>{r.platform}</Typography>
                    <Typography variant="caption" sx={{ color: r.status === "ok" ? "success.main" : r.status === "skipped" ? "text.secondary" : "error.main" }}>
                      {r.status}
                    </Typography>
                    {r.error && <Typography variant="caption" color="error">{r.error.slice(0, 60)}</Typography>}
                  </Box>
                ))}
              </Box>
            ) : (
              <>
                <Box sx={{ display: "flex", gap: 2, alignItems: "flex-end" }}>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="caption" sx={{ display: "block", mb: 0.75, fontWeight: 500 }}>
                      Publish time on <Box component="span" sx={{ color: "text.primary" }}>{post.dateSlot}</Box>
                    </Typography>
                    <TextField
                      type="time"
                      value={scheduleTime}
                      onChange={(e) => setScheduleTime(e.target.value)}
                      fullWidth
                    />
                  </Box>
                  <Button variant="secondary" size="sm" loading={scheduling} onClick={handleSchedule} disabled={!scheduleTime}>
                    Set schedule
                  </Button>
                </Box>

                {post.scheduledAt && (
                  <Typography variant="body2" sx={{ mt: 1.5, color: "info.main", fontWeight: 500 }}>
                    Scheduled for {new Date(post.scheduledAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} on {post.dateSlot}
                  </Typography>
                )}

                {post.publishResults && post.publishResults.length > 0 && (
                  <Box sx={{ pt: 2 }}>
                    <Typography variant="overline" sx={{ display: "block", mb: 1 }}>Zernio response</Typography>
                    {post.publishResults.map((r) => (
                      <Box key={r.platform} sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 0.5 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ width: 64 }}>{r.platform}</Typography>
                        <Typography variant="caption" sx={{ color: r.status === "ok" ? "success.main" : r.status === "skipped" ? "text.secondary" : "error.main" }}>
                          {r.status}
                        </Typography>
                        {r.error && <Typography variant="caption" color="error" noWrap sx={{ maxWidth: 200 }}>{r.error}</Typography>}
                      </Box>
                    ))}
                  </Box>
                )}

                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", pt: 2, mt: 2, borderTop: 1, borderColor: "divider" }}>
                  <Typography variant="body2" color="text.secondary">Or publish immediately</Typography>
                  <Button variant="primary" size="sm" loading={publishing} onClick={handlePublishNow} disabled={isPast}>
                    Publish now
                  </Button>
                </Box>

                {publishMsg && (
                  <Typography variant="body2" sx={{ mt: 1, fontWeight: 500, color: publishMsg.startsWith("Error") ? "error.main" : "success.main" }}>
                    {publishMsg}
                  </Typography>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
