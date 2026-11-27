"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { MotionConfig, motion } from "motion/react";
import Box from "@mui/material/Box";
import useMediaQuery from "@mui/material/useMediaQuery";
import { EASE_OUT, EASE_OUT_CSS } from "@/components/ui/motion";
import { TopBar } from "./TopBar";
import { Sidebar, SIDEBAR_MINI_WIDTH, SIDEBAR_WIDTH } from "./Sidebar";
import { LoadingContext } from "./loading-context";

const TOPBAR_HEIGHT = 64;
const LS_MINI = "shell.sidebarMini";

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
  const [navOpen, setNavOpen] = useState(false);
  const [mini, setMini] = useState(false);
  const desktop = useMediaQuery("(min-width:900px)");
  const pathname = usePathname();

  // Remember the collapsed (icon-only) sidebar.
  useEffect(() => {
    try {
      setMini(localStorage.getItem(LS_MINI) === "1");
    } catch {
      /* ignore */
    }
  }, []);

  // Hamburger: desktop → collapse/expand to icons; mobile → open/close the drawer.
  const onMenu = () => {
    if (!desktop) return setNavOpen((o) => !o);
    setMini((m) => {
      try {
        localStorage.setItem(LS_MINI, m ? "0" : "1");
      } catch {
        /* ignore */
      }
      return !m;
    });
  };

  const sidebarW = mini ? SIDEBAR_MINI_WIDTH : SIDEBAR_WIDTH;

  return (
    <MotionConfig reducedMotion="user">
      <LoadingContext.Provider value={{ isLoading, startLoading, stopLoading }}>
        {/* Shell is exactly one viewport tall and never scrolls itself, so the
            only scroll region is <main>. Short pages therefore never produce a
            scrollbar; tall pages scroll inside <main> only.
            --sidebar-w: current sidebar width, for pages with fixed headers. */}
        <Box
          sx={{
            height: "100dvh",
            overflow: "hidden",
            bgcolor: "background.default",
            "--sidebar-w": { xs: "0px", md: `${sidebarW}px` },
          }}
        >
          {/* TopBar stays crisp and carries the loading bar */}
          <TopBar userEmail={userEmail} loading={isLoading} onMenu={onMenu} menuExpanded={desktop ? !mini : navOpen} />

          {/* Everything else (sidebar + page) dims to 30% while loading */}
          <Box
            aria-busy={isLoading}
            sx={{
              opacity: isLoading ? 0.3 : 1,
              pointerEvents: isLoading ? "none" : "auto",
              transition: "opacity 180ms ease",
            }}
          >
            <Sidebar userEmail={userEmail} mini={mini} mobileOpen={navOpen} onMobileClose={() => setNavOpen(false)} />
            <Box
              component="main"
              sx={{
                ml: "var(--sidebar-w)",
                mt: `${TOPBAR_HEIGHT}px`,
                height: `calc(100dvh - ${TOPBAR_HEIGHT}px)`,
                minHeight: 0,
                overflowY: "auto",
                overflowX: "hidden",
                bgcolor: "background.default",
                transition: `margin-left 280ms ${EASE_OUT_CSS}`,
              }}
            >
              {/* Each page rises in softly when you switch sections */}
              <motion.div
                key={pathname.split("/")[1] ?? ""}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.36, ease: EASE_OUT }}
                style={{ height: "100%" }}
              >
                {children}
              </motion.div>
            </Box>
          </Box>
        </Box>
      </LoadingContext.Provider>
    </MotionConfig>
  );
}
