import { createHmac, timingSafeEqual } from "crypto";

// Short-lived signed token that lets the (unauthenticated) desktop recorder
// fetch a single brief by id. The deep link carries this token; the brief-fetch
// route verifies it instead of a Supabase session.
//
// Token format:  exp + "." + base64url(hmac)
//   exp  = unix-seconds expiry
//   hmac = HMAC-SHA256(secret, briefId + "." + exp)
// The secret comes from RECORDER_TOKEN_SECRET (server-only). If it is unset,
// signing throws and verification returns false (fail closed).

function getSecret(): string {
  const secret = process.env.RECORDER_TOKEN_SECRET;
  if (!secret) {
    throw new Error("Missing RECORDER_TOKEN_SECRET for recorder link signing.");
  }
  return secret;
}

function hmacBase64Url(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function signRecorderToken(briefId: string, ttlSeconds = 600): string {
  const secret = getSecret();
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const hmac = hmacBase64Url(secret, `${briefId}.${exp}`);
  return `${exp}.${hmac}`;
}

export function verifyRecorderToken(token: string, briefId: string): boolean {
  let secret: string;
  try {
    secret = getSecret();
  } catch {
    // RECORDER_TOKEN_SECRET unset → fail closed.
    return false;
  }

  if (!token) return false;
  const dot = token.indexOf(".");
  if (dot <= 0) return false;

  const expStr = token.slice(0, dot);
  const providedHmac = token.slice(dot + 1);
  const exp = Number(expStr);
  if (!Number.isFinite(exp)) return false;

  // Expired?
  if (Math.floor(Date.now() / 1000) > exp) return false;

  const expectedHmac = hmacBase64Url(secret, `${briefId}.${exp}`);

  // Constant-time compare. Length mismatch → not equal (timingSafeEqual throws
  // on differing lengths, so guard first).
  const a = Buffer.from(providedHmac);
  const b = Buffer.from(expectedHmac);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
