import crypto from "node:crypto";
import { readFileSync } from "node:fs";

// Mints a Google OAuth2 access token from a service-account key, with zero deps:
// we build + RS256-sign the JWT assertion ourselves and exchange it at the token
// endpoint. Used server-side only (Search Console read API).

interface ServiceAccount {
  client_email: string;
  private_key: string;
  token_uri: string;
}

// Sentinel so callers can distinguish "not set up yet" from a real failure and
// render a clean connect-state instead of an error.
export class ServiceAccountMissingError extends Error {
  constructor() {
    super("Google service account not configured");
    this.name = "ServiceAccountMissingError";
  }
}

export function isServiceAccountConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_SERVICE_ACCOUNT_FILE || process.env.GOOGLE_SERVICE_ACCOUNT_JSON,
  );
}

// Loads the key from either a file path or an inline value (raw JSON or base64).
function loadServiceAccount(): ServiceAccount {
  const file = process.env.GOOGLE_SERVICE_ACCOUNT_FILE;
  const inline = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

  let raw: string | null = null;
  if (file) {
    raw = readFileSync(file, "utf8");
  } else if (inline) {
    const trimmed = inline.trim();
    raw = trimmed.startsWith("{") ? trimmed : Buffer.from(trimmed, "base64").toString("utf8");
  }
  if (!raw) throw new ServiceAccountMissingError();

  const parsed = JSON.parse(raw) as Partial<ServiceAccount>;
  if (!parsed.client_email || !parsed.private_key) {
    throw new Error("Service account key is missing client_email / private_key");
  }
  return {
    client_email: parsed.client_email,
    // env-stored keys often carry literal "\n" rather than real newlines.
    private_key: parsed.private_key.replace(/\\n/g, "\n"),
    token_uri: parsed.token_uri ?? "https://oauth2.googleapis.com/token",
  };
}

const b64url = (input: string | Buffer): string =>
  Buffer.from(input).toString("base64url");

// In-process token cache, keyed by scope. Tokens live ~1h; refresh a minute early.
const cache = new Map<string, { token: string; exp: number }>();

export async function getAccessToken(scope: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const hit = cache.get(scope);
  if (hit && hit.exp - 60 > now) return hit.token;

  const sa = loadServiceAccount();
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(
    JSON.stringify({
      iss: sa.client_email,
      scope,
      aud: sa.token_uri,
      iat: now,
      exp: now + 3600,
    }),
  );
  const signingInput = `${header}.${claims}`;
  const signature = crypto
    .sign("RSA-SHA256", Buffer.from(signingInput), sa.private_key)
    .toString("base64url");
  const assertion = `${signingInput}.${signature}`;

  const res = await fetch(sa.token_uri, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!res.ok) {
    throw new Error(`Google token exchange failed (${res.status}): ${await res.text()}`);
  }
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cache.set(scope, { token: json.access_token, exp: now + json.expires_in });
  return json.access_token;
}

// ── OAuth (user) credentials ────────────────────────────────
// Used when service-account keys are blocked by org policy. A one-time consent
// (scripts/gsc-oauth.mjs) mints a refresh token; we exchange it for short-lived
// access tokens here. The refresh grant returns the originally-consented scope.

export function isOAuthConfigured(): boolean {
  return Boolean(
    process.env.GSC_OAUTH_CLIENT_ID &&
      process.env.GSC_OAUTH_CLIENT_SECRET &&
      process.env.GSC_OAUTH_REFRESH_TOKEN,
  );
}

const oauthCache = new Map<string, { token: string; exp: number }>();

async function getOAuthAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const hit = oauthCache.get("oauth");
  if (hit && hit.exp - 60 > now) return hit.token;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GSC_OAUTH_CLIENT_ID!,
      client_secret: process.env.GSC_OAUTH_CLIENT_SECRET!,
      refresh_token: process.env.GSC_OAUTH_REFRESH_TOKEN!,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    throw new Error(`OAuth token refresh failed (${res.status}): ${await res.text()}`);
  }
  const json = (await res.json()) as { access_token: string; expires_in: number };
  oauthCache.set("oauth", { token: json.access_token, exp: now + json.expires_in });
  return json.access_token;
}

// Unified accessor: prefer OAuth (works when SA keys are org-blocked), else SA.
export function isGscConfigured(): boolean {
  return isOAuthConfigured() || isServiceAccountConfigured();
}

export async function getGscAccessToken(scope: string): Promise<string> {
  if (isOAuthConfigured()) return getOAuthAccessToken();
  return getAccessToken(scope);
}
