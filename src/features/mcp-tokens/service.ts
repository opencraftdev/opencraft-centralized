import { createHash, randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Personal Access Tokens for internal MCP endpoints.
 *
 * Format: `ocb_live_<random>` (ocb = OpenCraft brand). Only the SHA-256 hash is
 * stored; the raw value is returned once at creation and never again.
 */

const PREFIX = "ocb_live_";

export type McpTokenRow = {
  id: string;
  name: string;
  token_prefix: string;
  last_used_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
};

/** Columns safe to return to the owning user (never the hash). */
const SAFE_COLS = "id,name,token_prefix,last_used_at,expires_at,revoked_at,created_at";

export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/** Generate a new raw token and the values to persist. */
export function generateToken(): { raw: string; tokenPrefix: string; tokenHash: string } {
  const random = randomBytes(24).toString("base64url"); // ~32 url-safe chars
  const raw = `${PREFIX}${random}`;
  return {
    raw,
    // Shown in the list so a user can recognise which token is which.
    tokenPrefix: `${PREFIX}${random.slice(0, 6)}…`,
    tokenHash: hashToken(raw),
  };
}

/** List a user's tokens (RLS-scoped client). Hash is never selected. */
export async function listTokens(rls: SupabaseClient, userId: string): Promise<McpTokenRow[]> {
  const { data, error } = await rls
    .from("mcp_tokens")
    .select(SAFE_COLS)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as McpTokenRow[];
}

/** Create a token for a user. Returns the raw token (shown once) + the row. */
export async function createToken(
  rls: SupabaseClient,
  userId: string,
  name: string,
  expiresInDays?: number,
): Promise<{ raw: string; token: McpTokenRow }> {
  const { raw, tokenPrefix, tokenHash } = generateToken();
  const expires_at =
    expiresInDays && expiresInDays > 0
      ? new Date(Date.now() + expiresInDays * 86_400_000).toISOString()
      : null;

  const { data, error } = await rls
    .from("mcp_tokens")
    .insert({
      user_id: userId,
      name: name?.trim() || "MCP token",
      token_prefix: tokenPrefix,
      token_hash: tokenHash,
      expires_at,
    })
    .select(SAFE_COLS)
    .single();
  if (error) throw error;
  return { raw, token: data as McpTokenRow };
}

/** Revoke (soft-delete) a token the user owns. */
export async function revokeToken(
  rls: SupabaseClient,
  userId: string,
  id: string,
): Promise<void> {
  const { error } = await rls
    .from("mcp_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId)
    .is("revoked_at", null);
  if (error) throw error;
}

/**
 * Validate a raw PAT (service-role client, bypasses RLS). Returns the owning
 * user id if the token is active, else null. Touches last_used_at.
 */
export async function verifyToken(
  admin: SupabaseClient,
  raw: string,
): Promise<{ userId: string } | null> {
  if (!raw.startsWith(PREFIX)) return null;
  const { data, error } = await admin
    .from("mcp_tokens")
    .select("id,user_id,expires_at,revoked_at")
    .eq("token_hash", hashToken(raw))
    .maybeSingle();
  if (error || !data) return null;
  if (data.revoked_at) return null;
  if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) return null;

  // Best-effort usage stamp; don't block auth on it.
  void admin
    .from("mcp_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id);

  return { userId: data.user_id as string };
}

export function isPatToken(raw: string): boolean {
  return raw.startsWith(PREFIX);
}
