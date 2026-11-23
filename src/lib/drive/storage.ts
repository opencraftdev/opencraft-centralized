// Server-only helpers: Drive files are stored in AWS S3 (bucket AWS_S3_BUCKET) under drive/<file id>/<name>.
import { presignS3Url } from "@/lib/s3";

export const LINK_TTL = 3600; // 1 hour — long enough for an open tab
export const UPLOAD_TTL = 600;

// S3 keys: keep them ASCII-safe; the display name stays untouched in drive_files.name.
export function safeKeyName(name: string): string {
  return name.normalize("NFKD").replace(/[^\w.\-() ]+/g, "_").trim() || "file";
}

export const driveKey = (id: string, name: string) => `drive/${id}/${safeKeyName(name)}`;

export function driveLinks(key: string, name: string) {
  const viewUrl = presignS3Url({ key, expiresIn: LINK_TTL });
  const downloadUrl = presignS3Url({ key, expiresIn: LINK_TTL, downloadFilename: name });
  return { viewUrl, downloadUrl: downloadUrl ?? viewUrl };
}
