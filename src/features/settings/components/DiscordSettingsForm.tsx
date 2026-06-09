"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Switch from "@mui/material/Switch";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import ChatOutlined from "@mui/icons-material/ChatBubbleOutlineOutlined";
import CheckCircleOutlined from "@mui/icons-material/CheckCircleOutlined";

interface DiscordSettings {
  enabled: boolean;
  sources: string[] | null;
  hasWebhook: boolean;
  webhookHint: string | null;
}

const CARD_SX = {
  bgcolor: "#fff",
  borderRadius: "12px",
  border: "1px solid #E8EAED",
} as const;

type Flash = { kind: "success" | "error"; text: string } | null;

export function DiscordSettingsForm({ initial }: { initial: DiscordSettings }) {
  const [settings, setSettings] = useState<DiscordSettings>(initial);
  const [webhook, setWebhook] = useState(""); // blank = keep existing
  const [enabled, setEnabled] = useState(initial.enabled);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [flash, setFlash] = useState<Flash>(null);

  async function save() {
    setSaving(true);
    setFlash(null);
    try {
      const body: Record<string, unknown> = { enabled };
      if (webhook.trim()) body.webhookUrl = webhook.trim();
      const res = await fetch("/api/integrations/discord", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error ?? "Failed to save");
      setSettings(json.settings as DiscordSettings);
      setWebhook("");
      setFlash({ kind: "success", text: "Settings saved." });
    } catch (err) {
      setFlash({ kind: "error", text: err instanceof Error ? err.message : "Failed to save" });
    } finally {
      setSaving(false);
    }
  }

  async function sendTest() {
    setTesting(true);
    setFlash(null);
    try {
      const res = await fetch("/api/integrations/discord/test", { method: "POST" });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error ?? "Failed to send test");
      setFlash({ kind: "success", text: "Test message sent — check your Discord channel." });
    } catch (err) {
      setFlash({ kind: "error", text: err instanceof Error ? err.message : "Failed to send test" });
    } finally {
      setTesting(false);
    }
  }

  return (
    <Box sx={{ ...CARD_SX, p: { xs: 2.5, md: 3 } }}>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 0.5 }}>
        <ChatOutlined sx={{ fontSize: 22, color: "#5865F2" }} />
        <Typography sx={{ fontSize: "1.0625rem", fontWeight: 500, color: "#1F1F1F" }}>
          Discord — blog published alerts
        </Typography>
        {settings.hasWebhook && (
          <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, ml: 0.5 }}>
            <CheckCircleOutlined sx={{ fontSize: 16, color: "#188038" }} />
            <Typography sx={{ fontSize: "0.75rem", fontWeight: 600, color: "#188038" }}>
              Connected
            </Typography>
          </Box>
        )}
      </Box>
      <Typography sx={{ fontSize: "0.8125rem", color: "#5f6368", mb: 2.5 }}>
        When the blog agent publishes a new post, send a message to a Discord channel via webhook.
        The webhook URL is stored encrypted in Supabase Vault.
      </Typography>

      {flash && (
        <Alert severity={flash.kind} sx={{ mb: 2 }} onClose={() => setFlash(null)}>
          {flash.text}
        </Alert>
      )}

      {/* Webhook URL */}
      <Typography sx={{ fontSize: "0.8125rem", fontWeight: 600, color: "#3C4043", mb: 0.5 }}>
        Webhook URL
      </Typography>
      <TextField
        fullWidth
        size="small"
        value={webhook}
        onChange={(e) => setWebhook(e.target.value)}
        placeholder={
          settings.hasWebhook
            ? `${settings.webhookHint} — leave blank to keep`
            : "https://discord.com/api/webhooks/…"
        }
        sx={{ mb: 0.5 }}
      />
      <Typography sx={{ fontSize: "0.75rem", color: "#80868B", mb: 2.5 }}>
        Discord → Server Settings → Integrations → Webhooks → New Webhook → Copy Webhook URL.
        {settings.hasWebhook && " A webhook is already saved; only enter a value to replace it."}
      </Typography>

      {/* Enabled toggle */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 3 }}>
        <Box>
          <Typography sx={{ fontSize: "0.875rem", fontWeight: 500, color: "#3C4043" }}>
            Enable notifications
          </Typography>
          <Typography sx={{ fontSize: "0.75rem", color: "#80868B" }}>
            Turn off to pause Discord alerts without removing the webhook.
          </Typography>
        </Box>
        <Switch checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
      </Box>

      {/* Actions */}
      <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }}>
        <Button
          variant="contained"
          disableElevation
          onClick={save}
          disabled={saving}
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : undefined}
          sx={{ textTransform: "none", borderRadius: "8px", bgcolor: "#0B57D0" }}
        >
          {saving ? "Saving…" : "Save"}
        </Button>
        <Button
          variant="outlined"
          onClick={sendTest}
          disabled={testing || !settings.hasWebhook}
          startIcon={testing ? <CircularProgress size={16} color="inherit" /> : undefined}
          sx={{ textTransform: "none", borderRadius: "8px" }}
        >
          {testing ? "Sending…" : "Send test message"}
        </Button>
      </Box>
    </Box>
  );
}
