"use client";

import { use } from "react";
import Link from "next/link";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import MuiButton from "@mui/material/Button";
import ArrowBackOutlined from "@mui/icons-material/ArrowBackOutlined";
import { VideoFlow } from "@/components/generate/VideoFlow";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";

export default function VideoGeneratorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const handleCompleted = () => {
    window.location.href = `/posts/${id}`;
  };

  return (
    <Box sx={{ maxWidth: 640, mx: "auto", width: "100%", px: 3, py: 4 }}>
      <Box sx={{ mb: 3 }}>
        <MuiButton
          component={Link}
          href={`/posts/${id}`}
          variant="text"
          size="small"
          startIcon={<ArrowBackOutlined />}
          sx={{ ml: -1, mb: 1 }}
        >
          Back to post
        </MuiButton>
        <Typography variant="h5">Video Generator</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          AI news video pipeline: curate, pick, and render in the browser.
        </Typography>
      </Box>

      <Card>
        <CardContent sx={{ p: 3, "&:last-child": { pb: 3 } }}>
          <ErrorBoundary>
            <VideoFlow postId={Number(id)} onCompleted={handleCompleted} />
          </ErrorBoundary>
        </CardContent>
      </Card>
    </Box>
  );
}
