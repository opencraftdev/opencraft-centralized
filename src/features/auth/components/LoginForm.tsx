"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import MuiButton from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import { createClient } from "@/lib/supabase/client";

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
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
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
    <Card sx={{ width: "100%", maxWidth: 380 }}>
      <CardContent sx={{ p: 4 }}>
        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", mb: 4 }}>
          <Image src="/logo.svg" alt="OpenCraft" width={57} height={48} style={{ marginBottom: 16 }} />
          <Typography variant="h5" sx={{ fontWeight: 600 }}>
            <Box component="span" sx={{ color: "primary.main" }}>Open</Box>
            <Box component="span" sx={{ color: "text.primary" }}>Craft</Box>
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Masuk untuk melanjutkan
          </Typography>
        </Box>

        <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
          {error && (
            <Alert severity="error" sx={{ fontSize: "0.8125rem" }}>
              {error}
            </Alert>
          )}
          <MuiButton
            variant="outlined"
            fullWidth
            onClick={signIn}
            disabled={pending}
            startIcon={pending ? <CircularProgress size={16} /> : <GoogleIcon />}
            sx={{ py: 1.25, textTransform: "none", fontWeight: 500 }}
          >
            {pending ? "Mengalihkan ke Google…" : "Masuk dengan Google"}
          </MuiButton>
          <Typography variant="caption" color="text.secondary" sx={{ textAlign: "center" }}>
            Hanya akun Google yang terdaftar yang bisa masuk.
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
}
