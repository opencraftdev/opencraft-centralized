import { createHmac, createHash } from "node:crypto";

// Dependency-free AWS SigV4 presigner for S3 GET URLs.
//
// The dashboard is read-only and only ever needs a short-lived link to *view*
// or *download* a document the Document Agent already uploaded — so we just
// presign a GET. This avoids pulling in @aws-sdk/* (keeps the bundle small and
// requires no extra install). Credentials come from env and stay server-side.

const ALGORITHM = "AWS4-HMAC-SHA256";
const SERVICE = "s3";

function hmac(key: Buffer | string, data: string): Buffer {
  return createHmac("sha256", key).update(data, "utf8").digest();
}

function sha256Hex(data: string): string {
  return createHash("sha256").update(data, "utf8").digest("hex");
}

// RFC 3986 encoding, but keep "/" in the object path unescaped.
function encodeRfc3986(str: string, keepSlash = false): string {
  return str
    .split(keepSlash ? "/" : "")
    .map((seg) =>
      keepSlash
        ? seg
            .split("")
            .map(encodeSegmentChar)
            .join("")
        : encodeSegmentChar(seg),
    )
    .join(keepSlash ? "/" : "");
}

function encodeSegmentChar(c: string): string {
  if (/[A-Za-z0-9\-._~]/.test(c)) return c;
  return encodeURIComponent(c)
    .replace(/[!*'()]/g, (ch) => "%" + ch.charCodeAt(0).toString(16).toUpperCase());
}

export interface S3Config {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
}

// Reads S3 credentials from env. Returns null when not configured so callers
// can gracefully fall back to a stored file_url.
export function getS3Config(): S3Config | null {
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  const region = process.env.AWS_S3_REGION;
  if (!accessKeyId || !secretAccessKey || !region) return null;
  return { accessKeyId, secretAccessKey, region };
}

interface PresignArgs {
  bucket: string;
  key: string;
  region?: string;
  expiresIn?: number; // seconds, default 300
  // When set, the URL forces a download with this filename via a signed
  // response-content-disposition. Omit for an inline (in-browser) view URL.
  downloadFilename?: string;
  // Pass a fixed timestamp for deterministic output (e.g. tests). Defaults to now.
  now?: Date;
}

// Builds a presigned GET URL for an S3 object using virtual-hosted–style.
// Returns null when credentials are missing.
export function presignS3GetUrl({
  bucket,
  key,
  region,
  expiresIn = 300,
  downloadFilename,
  now,
}: PresignArgs): string | null {
  const cfg = getS3Config();
  if (!cfg) return null;

  const effectiveRegion = region || cfg.region;
  const date = now ?? new Date();
  const amzDate = date.toISOString().replace(/[:-]|\.\d{3}/g, ""); // YYYYMMDDTHHMMSSZ
  const dateStamp = amzDate.slice(0, 8); // YYYYMMDD

  const host = `${bucket}.s3.${effectiveRegion}.amazonaws.com`;
  const canonicalUri = "/" + encodeRfc3986(key, true);
  const credentialScope = `${dateStamp}/${effectiveRegion}/${SERVICE}/aws4_request`;

  const query: Record<string, string> = {
    "X-Amz-Algorithm": ALGORITHM,
    "X-Amz-Credential": `${cfg.accessKeyId}/${credentialScope}`,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(expiresIn),
    "X-Amz-SignedHeaders": "host",
  };
  if (downloadFilename) {
    // Sanitize to a quoted ASCII filename; signed as part of the query.
    const safe = downloadFilename.replace(/["\\\r\n]/g, "_");
    query["response-content-disposition"] = `attachment; filename="${safe}"`;
  }

  const canonicalQuery = Object.keys(query)
    .sort()
    .map((k) => `${encodeRfc3986(k)}=${encodeRfc3986(query[k])}`)
    .join("&");

  const canonicalHeaders = `host:${host}\n`;
  const canonicalRequest = [
    "GET",
    canonicalUri,
    canonicalQuery,
    canonicalHeaders,
    "host",
    "UNSIGNED-PAYLOAD",
  ].join("\n");

  const stringToSign = [
    ALGORITHM,
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join("\n");

  const kDate = hmac(`AWS4${cfg.secretAccessKey}`, dateStamp);
  const kRegion = hmac(kDate, effectiveRegion);
  const kService = hmac(kRegion, SERVICE);
  const kSigning = hmac(kService, "aws4_request");
  const signature = createHmac("sha256", kSigning)
    .update(stringToSign, "utf8")
    .digest("hex");

  return `https://${host}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}

const EMPTY_SHA256 = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

interface DeleteArgs {
  bucket: string;
  key: string;
  region?: string;
  now?: Date;
}

// Deletes an S3 object using a SigV4 header-signed DELETE request (no deps).
// Returns true on success (S3 returns 204), false otherwise. Returns false when
// credentials are not configured. Caller should treat this as best-effort.
export async function deleteS3Object({ bucket, key, region, now }: DeleteArgs): Promise<boolean> {
  const cfg = getS3Config();
  if (!cfg) return false;

  const effectiveRegion = region || cfg.region;
  const date = now ?? new Date();
  const amzDate = date.toISOString().replace(/[:-]|\.\d{3}/g, ""); // YYYYMMDDTHHMMSSZ
  const dateStamp = amzDate.slice(0, 8);

  const host = `${bucket}.s3.${effectiveRegion}.amazonaws.com`;
  const canonicalUri = "/" + encodeRfc3986(key, true);
  const credentialScope = `${dateStamp}/${effectiveRegion}/${SERVICE}/aws4_request`;

  const canonicalHeaders =
    `host:${host}\n` +
    `x-amz-content-sha256:${EMPTY_SHA256}\n` +
    `x-amz-date:${amzDate}\n`;
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";

  const canonicalRequest = [
    "DELETE",
    canonicalUri,
    "",
    canonicalHeaders,
    signedHeaders,
    EMPTY_SHA256,
  ].join("\n");

  const stringToSign = [ALGORITHM, amzDate, credentialScope, sha256Hex(canonicalRequest)].join("\n");

  const kDate = hmac(`AWS4${cfg.secretAccessKey}`, dateStamp);
  const kRegion = hmac(kDate, effectiveRegion);
  const kService = hmac(kRegion, SERVICE);
  const kSigning = hmac(kService, "aws4_request");
  const signature = createHmac("sha256", kSigning).update(stringToSign, "utf8").digest("hex");

  const authorization =
    `${ALGORITHM} Credential=${cfg.accessKeyId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  try {
    const res = await fetch(`https://${host}${canonicalUri}`, {
      method: "DELETE",
      headers: {
        host,
        "x-amz-content-sha256": EMPTY_SHA256,
        "x-amz-date": amzDate,
        authorization,
      },
    });
    return res.status === 204 || res.status === 200;
  } catch {
    return false;
  }
}
