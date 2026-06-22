"use client";

import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import Tooltip from "@mui/material/Tooltip";
import HubOutlined from "@mui/icons-material/HubOutlined";
import ContentCopyOutlined from "@mui/icons-material/ContentCopyOutlined";
import DeleteOutlined from "@mui/icons-material/DeleteOutlined";
import KeyOutlined from "@mui/icons-material/KeyOutlined";

type TokenRow = {
  id: string;
  name: string;
  token_prefix: string;
  last_used_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
};

const CARD_SX = {
  bgcolor: "#fff",
  borderRadius: "12px",
  border: "1px solid #E8EAED",
  p: { xs: 2, md: 3 },
} as const;

const MCP_URL =
  process.env.NEXT_PUBLIC_MCP_URL ?? "https://internal.ocraft.id/api/mcp";

function installCommand(rawToken: string) {
  return [
    "claude mcp add --transport http brand-knowledge \\",
    `  ${MCP_URL} \\`,
    `  --header "Authorization: Bearer ${rawToken}"`,
  ].join("\n");
}

export function McpTokensCard() {
  const [tokens, setTokens] = useState<TokenRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [freshToken, setFreshToken] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  async function load() {
    try {
      const res = await fetch("/api/mcp-tokens");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load tokens");
      setTokens(json.tokens as TokenRow[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tokens");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function create() {
    setCreating(true);
    setError(null);
    setFreshToken(null);
    try {
      const res = await fetch("/api/mcp-tokens", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name.trim() || "MCP token" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to create token");
      setFreshToken(json.raw as string);
      setName("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create token");
    } finally {
      setCreating(false);
    }
  }

  async function revoke(id: string) {
    setError(null);
    try {
      const res = await fetch(`/api/mcp-tokens?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to revoke token");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to revoke token");
    }
  }

  async function copy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500);
    } catch {
      /* clipboard may be blocked; ignore */
    }
  }

  return (
    <Box sx={{ ...CARD_SX, mt: 3 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
        <HubOutlined sx={{ color: "#0B57D0", fontSize: 22 }} />
        <Typography sx={{ fontSize: "1.05rem", fontWeight: 600, color: "#1F1F1F" }}>
          Brand Knowledge MCP
        </Typography>
      </Box>
      <Typography sx={{ fontSize: "0.8125rem", color: "#5f6368", mb: 2.5 }}>
        Generate a personal access token to connect Claude (or any MCP client) to the
        brand knowledge graph. The token is shown once — copy it now.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Freshly minted token + install command */}
      {freshToken && (
        <Alert
          severity="success"
          icon={<KeyOutlined fontSize="inherit" />}
          sx={{ mb: 2, "& .MuiAlert-message": { width: "100%" } }}
        >
          <Typography sx={{ fontWeight: 600, fontSize: "0.85rem", mb: 1 }}>
            Token created — copy it now, you won&apos;t see it again.
          </Typography>
          <CodeBlock
            text={installCommand(freshToken)}
            onCopy={() => copy(installCommand(freshToken), "cmd")}
            copied={copied === "cmd"}
          />
        </Alert>
      )}

      {/* Create form */}
      <Box sx={{ display: "flex", gap: 1.5, alignItems: "center", mb: 3 }}>
        <TextField
          size="small"
          label="Token name"
          placeholder="e.g. my-laptop"
          value={name}
          onChange={(e) => setName(e.target.value)}
          sx={{ maxWidth: 280 }}
        />
        <Button
          variant="contained"
          onClick={create}
          disabled={creating}
          startIcon={creating ? <CircularProgress size={16} color="inherit" /> : <KeyOutlined />}
          sx={{ borderRadius: "9999px", textTransform: "none", fontWeight: 600 }}
        >
          Generate token
        </Button>
      </Box>

      {/* Token list */}
      {loading ? (
        <CircularProgress size={20} />
      ) : tokens.length === 0 ? (
        <Typography sx={{ fontSize: "0.8125rem", color: "#9aa0a6" }}>
          No tokens yet.
        </Typography>
      ) : (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {tokens.map((t) => {
            const revoked = !!t.revoked_at;
            const expired = !!t.expires_at && new Date(t.expires_at).getTime() < Date.now();
            const status = revoked ? "Revoked" : expired ? "Expired" : "Active";
            return (
              <Box
                key={t.id}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 1,
                  px: 1.5,
                  py: 1,
                  borderRadius: "8px",
                  border: "1px solid #E8EAED",
                  opacity: revoked || expired ? 0.6 : 1,
                }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontSize: "0.875rem", fontWeight: 600, color: "#1F1F1F" }}>
                    {t.name}
                  </Typography>
                  <Typography
                    sx={{ fontSize: "0.75rem", color: "#5f6368", fontFamily: "monospace" }}
                  >
                    {t.token_prefix} · {status}
                    {t.last_used_at
                      ? ` · used ${new Date(t.last_used_at).toLocaleDateString()}`
                      : " · never used"}
                  </Typography>
                </Box>
                {!revoked && (
                  <Tooltip title="Revoke">
                    <IconButton size="small" onClick={() => revoke(t.id)}>
                      <DeleteOutlined fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
}

function CodeBlock({
  text,
  onCopy,
  copied,
}: {
  text: string;
  onCopy: () => void;
  copied: boolean;
}) {
  return (
    <Box sx={{ position: "relative" }}>
      <Box
        component="pre"
        sx={{
          m: 0,
          p: 1.5,
          pr: 5,
          bgcolor: "#0b0e14",
          color: "#e8eaed",
          borderRadius: "8px",
          fontSize: "0.75rem",
          fontFamily: "monospace",
          whiteSpace: "pre-wrap",
          wordBreak: "break-all",
        }}
      >
        {text}
      </Box>
      <Tooltip title={copied ? "Copied!" : "Copy"}>
        <IconButton
          size="small"
          onClick={onCopy}
          sx={{ position: "absolute", top: 6, right: 6, color: "#9aa0a6" }}
        >
          <ContentCopyOutlined fontSize="small" />
        </IconButton>
      </Tooltip>
    </Box>
  );
}
