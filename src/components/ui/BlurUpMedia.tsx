"use client";

import { useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";

// Loading look for images and videos (option 4, "blur-up"): while the file loads a soft tinted placeholder with
// three bouncing dots shows; the picture fades in blurred and sharpens once it has loaded.

const dots = {
  "@keyframes oc-dot": { "0%,100%": { transform: "translateY(0)", opacity: 0.55 }, "50%": { transform: "translateY(-4px)", opacity: 1 } },
};

export function BlurUpMedia({
  src,
  alt,
  kind = "image",
  fit = "cover",
  lazy = true,
  videoProps,
  showDots = true,
}: {
  src: string;
  alt: string;
  kind?: "image" | "video";
  fit?: "cover" | "contain";
  lazy?: boolean;
  videoProps?: React.VideoHTMLAttributes<HTMLVideoElement>;
  /** small thumbnails (avatars, logos) keep the blur-up fade but skip the dots */
  showDots?: boolean;
}) {
  const [loaded, setLoaded] = useState(false);
  const img = useRef<HTMLImageElement>(null);
  const vid = useRef<HTMLVideoElement>(null);

  // a cached image can finish before React attaches onLoad
  useEffect(() => {
    setLoaded(false);
    if (kind === "image" && img.current?.complete && img.current.naturalWidth) setLoaded(true);
    if (kind === "video" && vid.current && vid.current.readyState >= 2) setLoaded(true);
  }, [src, kind]);

  const mediaSx = {
    width: "100%",
    height: "100%",
    objectFit: fit,
    display: "block",
    filter: loaded ? "none" : "blur(10px)",
    transform: loaded ? "none" : "scale(1.06)",
    opacity: loaded ? 1 : 0.35,
    transition: "filter 600ms cubic-bezier(0.22, 1, 0.36, 1), transform 600ms cubic-bezier(0.22, 1, 0.36, 1), opacity 450ms ease",
  } as const;

  return (
    <Box sx={{ position: "relative", width: "100%", height: "100%", overflow: "hidden", bgcolor: loaded ? "transparent" : "#E3E8EF", backgroundImage: loaded ? "none" : "linear-gradient(135deg, #E9EDF3 0%, #D9E1EC 100%)", transition: "background-color 400ms" }}>
      {kind === "image" ? (
        <Box component="img" ref={img} src={src} alt={alt} loading={lazy ? "lazy" : undefined} onLoad={() => setLoaded(true)} onError={() => setLoaded(true)} sx={mediaSx} />
      ) : (
        <Box component="video" ref={vid} src={src} onLoadedData={() => setLoaded(true)} onError={() => setLoaded(true)} sx={mediaSx} {...videoProps} />
      )}
      {!loaded && showDots && (
        <Box aria-hidden sx={{ position: "absolute", left: "50%", bottom: "12%", transform: "translateX(-50%)", display: "flex", gap: "3px", ...dots }}>
          {[0, 1, 2].map((i) => (
            <Box key={i} sx={{ width: 5, height: 5, borderRadius: "50%", bgcolor: "#fff", boxShadow: "0 0 2px rgba(0,0,0,.25)", animation: `oc-dot 1s ease-in-out ${i * 0.15}s infinite` }} />
          ))}
        </Box>
      )}
    </Box>
  );
}
