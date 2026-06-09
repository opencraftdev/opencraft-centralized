"use client";

import { useCallback, useRef, useState } from "react";

// Extracted launch + fallback machinery (formerly inline in RecorderDownload.tsx).
// Given a fully-built deep-link url + a downloadUrl, navigate to the url and watch
// for the tab losing focus (the OS launching the desktop app). If neither
// visibilitychange→hidden nor window blur fires within LAUNCH_TIMEOUT_MS, the app
// isn't installed → start the download and surface a "not found" state.
const LAUNCH_TIMEOUT_MS = 1500;

function startDownload(downloadUrl: string) {
  const a = document.createElement("a");
  a.href = downloadUrl;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export interface RecorderLaunch {
  // Fire the deep link; on failure start the download from `downloadUrl`.
  launch: (url: string, downloadUrl: string) => void;
  // True while we wait to learn whether the app opened.
  searching: boolean;
  // True once we've concluded the app isn't installed.
  notFound: boolean;
  // Clear the notFound state (e.g. closing the dialog).
  dismiss: () => void;
  // Re-trigger the download from the dialog ("Download again").
  redownload: () => void;
}

export function useRecorderLaunch(): RecorderLaunch {
  const [searching, setSearching] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const doneRef = useRef(false);
  const downloadRef = useRef<string>("");

  const launch = useCallback((url: string, downloadUrl: string) => {
    setSearching(true);
    setNotFound(false);
    doneRef.current = false;
    downloadRef.current = downloadUrl;

    let timer = 0;
    const teardown = () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("blur", onBlur);
      window.clearTimeout(timer);
    };
    const succeed = () => {
      if (doneRef.current) return;
      doneRef.current = true;
      teardown();
      setSearching(false);
    };
    const onVis = () => {
      if (document.visibilityState === "hidden") succeed();
    };
    const onBlur = () => succeed();

    timer = window.setTimeout(() => {
      if (doneRef.current) return;
      doneRef.current = true;
      teardown();
      setSearching(false);
      setNotFound(true); // not found → surface state + start download
      startDownload(downloadUrl);
    }, LAUNCH_TIMEOUT_MS);

    // Attach listeners BEFORE navigating, so we don't miss the focus change.
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("blur", onBlur);
    window.location.href = url;
  }, []);

  const dismiss = useCallback(() => setNotFound(false), []);
  const redownload = useCallback(() => {
    if (downloadRef.current) startDownload(downloadRef.current);
  }, []);

  return { launch, searching, notFound, dismiss, redownload };
}
