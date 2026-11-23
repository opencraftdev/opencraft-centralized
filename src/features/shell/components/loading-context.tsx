"use client";

import { createContext, useContext, useEffect } from "react";
import { useLinkStatus } from "next/link";

export interface LoadingContextValue {
  isLoading: boolean;
  startLoading: () => void;
  stopLoading: () => void;
}

export const LoadingContext = createContext<LoadingContextValue | null>(null);

const NOOP: LoadingContextValue = {
  isLoading: false,
  startLoading: () => {},
  stopLoading: () => {},
};

export function useLoading(): LoadingContextValue {
  return useContext(LoadingContext) ?? NOOP;
}

/**
 * Drive the global loading state (dimmed content + TopBar progress bar) from a
 * boolean. Increments the shell's loading counter while `active` is true and
 * decrements on change/unmount — safe to call from any page inside the AppShell.
 */
export function useGlobalLoading(active: boolean): void {
  const { startLoading, stopLoading } = useLoading();
  useEffect(() => {
    if (!active) return;
    startLoading();
    return stopLoading;
  }, [active, startLoading, stopLoading]);
}

/**
 * Rendered inside a Next.js <Link> (e.g. a sidebar nav row). Reports the link's
 * in-flight navigation to the global loading state so route transitions show the
 * dim + progress bar across every page.
 */
export function NavLinkLoading(): null {
  const { pending } = useLinkStatus();
  useGlobalLoading(pending);
  return null;
}
