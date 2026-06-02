import { createHash, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AgentRow } from "@/lib/monitor/types";

// Per-agent API-key authentication for the ingestion API.
//
// An agent sends `Authorization: Bearer <key>` and identifies itself by `slug`
// in the body. We look up the agent, sha256 the presented key, and compare it
// (constant-time) against the stored `api_key_hash`. A key only authorizes
// writing *that* agent's telemetry.

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function getBearerToken(req: Request): string | null {
  const header = req.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1].trim() : null;
}

function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    return false;
  }
}

export type AuthResult =
  | { ok: true; agent: AgentRow }
  | { ok: false; status: 401; error: string };

// Authenticates a request against the agent identified by `slug`.
// Returns the agent row on success.
export async function authenticateAgent(
  admin: SupabaseClient,
  req: Request,
  slug: string,
): Promise<AuthResult> {
  const token = getBearerToken(req);
  if (!token) return { ok: false, status: 401, error: "Missing bearer token" };

  const { data, error } = await admin
    .from("agents")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (error || !data) return { ok: false, status: 401, error: "Unknown agent" };

  const agent = data as AgentRow & { api_key_hash: string | null };
  if (!agent.api_key_hash) {
    return { ok: false, status: 401, error: "Agent has no API key configured" };
  }

  if (!safeEqualHex(sha256Hex(token), agent.api_key_hash)) {
    return { ok: false, status: 401, error: "Invalid API key" };
  }

  return { ok: true, agent };
}
