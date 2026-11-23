import { createHmac, createHash } from "node:crypto";

// Dependency-free AWS SigV4 presigner for S3 (GET / PUT / DELETE URLs).
//
// Drive files live in the bucket AWS_S3_BUCKET. The browser never sees credentials: it gets short-lived
// presigned URLs to view, download or upload. Avoids pulling in @aws-sdk/* (keeps the bundle small).

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
  bucket: string | null;
}

// Reads S3 credentials from env. Returns null when not configured so callers
// can gracefully fall back to a stored file_url.
export function getS3Config(): S3Config | null {
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  const region = process.env.AWS_S3_REGION || process.env.AWS_REGION;
  if (!accessKeyId || !secretAccessKey || !region) return null;
  return { accessKeyId, secretAccessKey, region, bucket: process.env.AWS_S3_BUCKET || null };
}

interface PresignArgs {
  method?: "GET" | "PUT" | "DELETE"; // default GET
  bucket?: string; // default AWS_S3_BUCKET
  key: string;
  region?: string;
  expiresIn?: number; // seconds, default 300
  // When set, the URL forces a download with this filename via a signed
  // response-content-disposition. Omit for an inline (in-browser) view URL.
  downloadFilename?: string;
  // Pass a fixed timestamp for deterministic output (e.g. tests). Defaults to now.
  now?: Date;
}

// Builds a presigned URL for an S3 object using virtual-hosted–style.
// Returns null when credentials (or the bucket) are missing.
export function presignS3Url({
  method = "GET",
  bucket: bucketArg,
  key,
  region,
  expiresIn = 300,
  downloadFilename,
  now,
}: PresignArgs): string | null {
  const cfg = getS3Config();
  const bucket = bucketArg || cfg?.bucket;
  if (!cfg || !bucket) return null;

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
    method,
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

export const presignS3GetUrl = (args: Omit<PresignArgs, "method">) => presignS3Url({ ...args, method: "GET" });

// Server-side delete of objects in AWS_S3_BUCKET (missing objects are fine: S3 returns 204).
export async function deleteS3Objects(keys: string[]): Promise<void> {
  for (const key of keys) {
    const url = presignS3Url({ method: "DELETE", key, expiresIn: 60 });
    if (!url) throw new Error("S3 is not configured");
    const res = await fetch(url, { method: "DELETE" });
    if (!res.ok && res.status !== 404) throw new Error(`S3 delete failed (${res.status}) for ${key}`);
  }
}
