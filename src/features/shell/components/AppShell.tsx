"use client";

import { useCallback, useState } from "react";
import Box from "@mui/material/Box";
import { TopBar } from "./TopBar";
import { Sidebar } from "./Sidebar";
import { LoadingContext } from "./loading-context";

const SIDEBAR_WIDTH = 280;
const TOPBAR_HEIGHT = 64;

export function AppShell({
  userEmail,
  children,
}: {
  userEmail: string;
  children: React.ReactNode;
}) {
  // Counter so concurrent loaders (route transition + page fetch) compose
  // without one clearing another's loading state.
  const [count, setCount] = useState(0);
  const startLoading = useCallback(() => setCount((c) => c + 1), []);
  const stopLoading = useCallback(() => setCount((c) => Math.max(0, c - 1)), []);
  const isLoading = count > 0;

  return (
    <LoadingContext.Provider value={{ isLoading, startLoading, stopLoading }}>
      {/* Shell is exactly one viewport tall and never scrolls itself, so the
          only scroll region is <main>. Short pages therefore never produce a
          scrollbar; tall pages scroll inside <main> only. */}
      <Box sx={{ height: "100dvh", overflow: "hidden", bgcolor: "background.default" }}>
        {/* TopBar stays crisp and carries the loading bar */}
        <TopBar userEmail={userEmail} loading={isLoading} />

        {/* Everything else (sidebar + page) dims to 30% while loading */}
        <Box
          aria-busy={isLoading}
          sx={{
            opacity: isLoading ? 0.3 : 1,
            pointerEvents: isLoading ? "none" : "auto",
            transition: "opacity 180ms ease",
          }}
        >
          <Sidebar userEmail={userEmail} />
          <Box
            component="main"
            sx={{
              ml: `${SIDEBAR_WIDTH}px`,
              mt: `${TOPBAR_HEIGHT}px`,
              height: `calc(100dvh - ${TOPBAR_HEIGHT}px)`,
              minHeight: 0,
              overflowY: "auto",
              overflowX: "hidden",
              bgcolor: "background.default",
            }}
          >
            {children}
          </Box>
        </Box>
      </Box>
    </LoadingContext.Provider>
  );
}
