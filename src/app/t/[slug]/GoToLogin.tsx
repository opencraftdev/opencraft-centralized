"use client";

import { useEffect } from "react";

/** Sends a signed-out visitor to the login, remembering where to come back to. */
export function GoToLogin({ next }: { next: string }) {
  useEffect(() => {
    window.location.replace(`/login?next=${encodeURIComponent(next)}`);
  }, [next]);
  return <p style={{ fontFamily: "system-ui, sans-serif", textAlign: "center", marginTop: "40vh", color: "#5F6368" }}>Membuka task…</p>;
}
