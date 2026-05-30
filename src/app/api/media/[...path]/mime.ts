// Minimal MIME lookup to avoid adding a mime-types dependency.
const MIME: Record<string, string> = {
  mp4:  "video/mp4",
  webm: "video/webm",
  png:  "image/png",
  jpg:  "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif:  "image/gif",
  json: "application/json",
  txt:  "text/plain",
};

export function lookup(ext: string): string {
  return MIME[ext.toLowerCase()] ?? "application/octet-stream";
}
