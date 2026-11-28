"use client";

import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import MuiButton from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import { createClient } from "@/lib/supabase/client";
import { LogoMark } from "./LogoMark";

// Error codes set by /auth/callback and the middleware (docs/DRIVE.md → "Login: Google only").
const MESSAGES: Record<string, string> = {
  not_allowed:
    "Akun Google ini tidak punya akses ke OpenCraft Internal. Silakan masuk dengan akun Google yang sudah terdaftar.",
  auth_failed: "Gagal masuk dengan Google. Silakan coba lagi.",
  no_code: "Proses masuk dengan Google tidak selesai. Silakan coba lagi.",
};

function messageFor(code: string | null, description?: string | null): string | null {
  if (!code) return null;
  // The Supabase "Before User Created" hook rejects other accounts; its message comes back as description.
  if (description && /tidak diizinkan|not allowed|signups? not allowed/i.test(description)) return MESSAGES.not_allowed;
  return MESSAGES[code] ?? MESSAGES.auth_failed;
}

function GoogleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

export function LoginForm({ error: initialError, next }: { error?: string | null; next?: string | null }) {
  const [error, setError] = useState<string | null>(messageFor(initialError ?? null));
  const [pending, setPending] = useState(false);

  // Supabase may report OAuth errors in the URL fragment (#error=...&error_description=...).
  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const code = hash.get("error");
    if (code) {
      setError(messageFor(code, hash.get("error_description")));
      history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  }, []);

  async function signIn() {
    setError(null);
    setPending(true);
    // where to land after Google (e.g. a shared task link); read by /auth/callback
    const safe = next && next.startsWith("/") && !next.startsWith("//") ? next : "";
    document.cookie = safe ? `oc_next=${encodeURIComponent(safe)}; path=/; max-age=900; samesite=lax` : "oc_next=; path=/; max-age=0";
    const { error } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { prompt: "select_account" },
      },
    });
    if (error) {
      setError(MESSAGES.auth_failed);
      setPending(false);
    }
    // On success the browser is redirected to Google.
  }

  return (
    <Box sx={{ width: "100%", maxWidth: 400, bgcolor: "#fff", borderRadius: "28px", px: { xs: 3, sm: 4.5 }, pt: 5, pb: 3.5, textAlign: "center" }}>
      <Box sx={{ display: "flex", justifyContent: "center" }}>
        <LogoMark size={64} />
      </Box>
      <Typography component="h1" sx={{ fontSize: "1.5rem", fontWeight: 400, color: "#1F1F1F", mt: 2.5, mb: 0.75 }}>
        Masuk ke{" "}
        <Box component="span" sx={{ fontWeight: 500 }}>
          <Box component="span" sx={{ color: "#0B57D0" }}>Open</Box>Craft
        </Box>
      </Typography>
      <Typography sx={{ fontSize: "0.875rem", color: "#444746", mb: 3.5 }}>Dashboard internal tim OpenCraft</Typography>

      {error && (
        <Alert severity="error" sx={{ fontSize: "0.8125rem", mb: 2, textAlign: "left", borderRadius: "14px" }}>
          {error}
        </Alert>
      )}
      <MuiButton
        variant="contained"
        disableElevation
        fullWidth
        onClick={signIn}
        disabled={pending}
        startIcon={
          <Box component="span" sx={{ width: 22, height: 22, borderRadius: "50%", bgcolor: "#fff", display: "grid", placeItems: "center" }}>
            {pending ? <CircularProgress size={12} /> : <GoogleIcon />}
          </Box>
        }
        sx={{ height: 44, borderRadius: "9999px", textTransform: "none", fontWeight: 500, fontSize: "0.9375rem", bgcolor: "#0B57D0", "&:hover": { bgcolor: "#0A4FBE" } }}
      >
        {pending ? "Mengalihkan ke Google…" : "Masuk dengan Google"}
      </MuiButton>
      <Typography sx={{ fontSize: "0.75rem", color: "#5F6368", mt: 2.5, lineHeight: 1.5 }}>Hanya akun Google yang terdaftar yang bisa masuk.</Typography>
    </Box>
  );
}
