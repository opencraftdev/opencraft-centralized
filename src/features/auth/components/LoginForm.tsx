"use client";

import { useState, useTransition } from "react";
import { login } from "../actions";
import Image from "next/image";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Alert from "@mui/material/Alert";
import MuiButton from "@mui/material/Button";

export function LoginForm() {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await login(formData);
      if (result?.error) {
        setError(result.error);
      }
    });
  }

  return (
    <Card sx={{ width: "100%", maxWidth: 380 }}>
      <CardContent sx={{ p: 4 }}>
        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", mb: 4 }}>
          <Image src="/logo.png" alt="OpenCraft" width={48} height={48} style={{ marginBottom: 16 }} />
          <Typography variant="h5" sx={{ fontWeight: 600 }}>
            <Box component="span" sx={{ color: "primary.main" }}>Open</Box>
            <Box component="span" sx={{ color: "text.primary" }}>Craft</Box>
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Sign in to continue
          </Typography>
        </Box>

        <form action={handleSubmit}>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
            {error && <Alert severity="error" sx={{ fontSize: "0.8125rem" }}>{error}</Alert>}

            <TextField
              id="email"
              name="email"
              type="email"
              label="Email"
              placeholder="you@opencraft.id"
              required
              fullWidth
            />

            <TextField
              id="password"
              name="password"
              type="password"
              label="Password"
              placeholder="••••••••"
              required
              fullWidth
            />

            <MuiButton
              type="submit"
              variant="contained"
              fullWidth
              disabled={isPending}
              sx={{ py: 1.25, mt: 1 }}
            >
              {isPending ? "Signing in…" : "Sign in"}
            </MuiButton>
          </Box>
        </form>
      </CardContent>
    </Card>
  );
}
