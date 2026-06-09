"use client";

import { useEffect, useRef, useState } from "react";
import type { SosmedCommandStatus } from "@/lib/sosmed/types";

export interface CommandPollState {
  status: SosmedCommandStatus | null;
  logText: string | null;
  error: string | null;
  isPolling: boolean;
}

/**
 * Polls /api/sosmed/command/[id] every 2s until status is completed or failed.
 * Pass null to stop polling (e.g. after re-firing a new command).
 */
export function useCommandPoller(commandId: number | null): CommandPollState {
  const [state, setState] = useState<CommandPollState>({
    status: null,
    logText: null,
    error: null,
    isPolling: false,
  });

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (commandId === null) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setState({ status: null, logText: null, error: null, isPolling: false });
      return;
    }

    setState((prev) => ({ ...prev, isPolling: true }));

    const controller = new AbortController();

    async function poll() {
      try {
        const res = await fetch(`/api/sosmed/command/${commandId}`, { signal: controller.signal });
        if (!res.ok || controller.signal.aborted) return;
        const json = await res.json();
        if (controller.signal.aborted) return;
        const cmd = json.command;
        setState({
          status: cmd.status,
          logText: cmd.log_text ?? null,
          error: cmd.error ?? null,
          isPolling: cmd.status === "pending" || cmd.status === "processing" || cmd.status === "running",
        });
        if (cmd.status === "completed" || cmd.status === "done" || cmd.status === "failed") {
          if (intervalRef.current) clearInterval(intervalRef.current);
        }
      } catch {
        // network error or abort — keep polling on network, exit on abort
      }
    }

    poll();
    intervalRef.current = setInterval(poll, 2000);

    return () => {
      controller.abort();
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [commandId]);

  return state;
}
