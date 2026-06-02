import { createHash, timingSafeEqual } from "node:crypto";

// Dependency-free Cloudinary helper for the "Record Tutorial Video" feature.
//
// Mirrors the approach in src/lib/s3.ts: no SDK, just fetch + node:crypto. The
// API secret stays server-side — every function here must only be imported from
// route handlers / server code, never a Client Component.
//
// Flow: the browser uploads the raw recording straight to Cloudinary (signed,
// so it never passes through our serverless function and dodges Vercel's
// 4.5 MB body limit). We then kick off an async "eager" render that overlays
// the name + logo on the opening and splices a fixed outro onto the end, and
// poll Cloudinary for the finished MP4.

const API_BASE = "https://api.cloudinary.com/v1_1";

export interface CloudinaryConfig {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
}

// Reads credentials from env. Returns null when not configured so callers can
// degrade gracefully (show a "not configured" state instead of throwing).
export function getCloudinaryConfig(): CloudinaryConfig | null {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) return null;
  return { cloudName, apiKey, apiSecret };
}

// Where uploaded source recordings live in the Media Library.
export const TUTORIAL_SOURCE_FOLDER = "tutorial-sources";

function unixNow(): number {
  return Math.floor(Date.now() / 1000);
}

// Cloudinary signs a request with the SHA-1 of the alphabetically-sorted
// "k=v&k2=v2" param string (excluding file/api_key/resource_type/cloud_name/
// signature) with the api_secret appended.
export function signParams(
  params: Record<string, string | number>,
  apiSecret: string,
): string {
  const toSign = Object.keys(params)
    .filter((k) => params[k] !== undefined && params[k] !== "")
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  return createHash("sha1").update(toSign + apiSecret).digest("hex");
}

// Layer public IDs reference folders with ':' instead of '/'.
function layerId(publicId: string): string {
  return publicId.replace(/\//g, ":");
}

// Text in an l_text: layer must be URL-encoded; commas and slashes (which are
// transformation delimiters) become %2C / %2F — encodeURIComponent does this.
function encodeOverlayText(text: string): string {
  return encodeURIComponent(text);
}

export interface RenderRecipeOptions {
  name: string;
  handle?: string;
  logoPublicId: string;
  outroPublicId: string;
  openingSeconds?: number;
  // When set, burns the auto-generated transcript in as on-screen captions.
  // Pass the SOURCE video's public id — Cloudinary serves its sidecar transcript
  // (produced by raw_convert: google_video_transcription) as `<id>.transcript`.
  subtitlesPublicId?: string;
}

// Builds the chained eager transformation string for one tutorial. The source
// is already 1080×1920 (the recorder bakes the vertical frame), so there is NO
// reframe step here — we only overlay and splice:
//   1. logo overlay, top-right (whole video)
//   2. a dark rounded container (lower-third), bottom-left, opening only, with
//      the name (logo blue, bold) and @handle (white) stacked inside it
//   2d. burned-in captions from the auto-transcript (optional)
//   3. fixed outro spliced onto the end, padded to the vertical base size
// Font note: Montserrat is a clean geometric sans that echoes the rounded
// OpenCraft mark. If Cloudinary rejects it for your account, swap to "Arial".
export function buildRenderTransformation(opts: RenderRecipeOptions): string {
  const open = opts.openingSeconds ?? 5;
  const name = encodeOverlayText(opts.name);
  const logo = layerId(opts.logoPublicId);
  const outro = layerId(opts.outroPublicId);

  // Lower-third sizing: a taller container when a handle line is shown.
  const hasHandle = Boolean(opts.handle);
  const boxHeight = hasHandle ? 130 : 84;
  const nameY = hasHandle ? 74 : 26;

  const parts = [
    // 1. logo, top-right — small, scaled to 7% of the video width. No so_/eo_
    //    timing, so it stays as a fixed watermark for the whole tutorial.
    `l_${logo}`,
    "c_scale,w_0.07,fl_relative",
    "fl_layer_apply,g_north_east,x_0.03,y_0.03,fl_relative",
    // 2a. dark rounded container (a sized text layer used as a box), bottom-left
    `l_text:Arial_2:%20,b_rgb:0A1A2F,w_620,h_${boxHeight},c_fill,r_16,o_80`,
    `fl_layer_apply,g_south_west,x_30,y_30,so_0,eo_${open}`,
    // 2b. name — logo blue — inside the container
    `l_text:Montserrat_46_bold:${name},co_rgb:3B82F6`,
    `fl_layer_apply,g_south_west,x_55,y_${nameY},so_0,eo_${open}`,
  ];

  if (opts.handle) {
    // 2c. @handle — white — beneath the name, inside the container
    parts.push(
      `l_text:Montserrat_30:${encodeOverlayText(opts.handle)},co_white`,
      `fl_layer_apply,g_south_west,x_55,y_44,so_0,eo_${open}`,
    );
  }

  // 2d. burned-in captions, when a transcript is available. The subtitles layer
  //     renders the sidecar `.transcript` Cloudinary produced from the source.
  //     White text on a translucent pill, centered, parked above the webcam
  //     region (~38% from the bottom) so it never overlaps the camera.
  if (opts.subtitlesPublicId) {
    const subs = layerId(opts.subtitlesPublicId);
    parts.push(
      `l_subtitles:Arial_44:${subs}.transcript,co_white,b_rgb:000000B3,r_12`,
      "fl_layer_apply,g_south,y_780",
    );
  }

  // 3. outro concatenated onto the very end.
  //    Two hard requirements for fl_splice to actually *append* (vs overlay):
  //      a) fl_splice must sit in the SAME component as l_video — NOT grouped
  //         with fl_layer_apply (that silently overlays and never extends the
  //         duration), and
  //      b) the spliced clip must match the base video's dimensions, so we pad
  //         the outro to the base size. The outro's background is white, so
  //         b_white padding is invisible.
  parts.push(
    `fl_splice,l_video:${outro}`,
    "c_pad,w_1.0,h_1.0,fl_relative,b_white",
    "fl_layer_apply",
  );

  return parts.join("/");
}

// Kicks off an async eager render of an already-uploaded source video via the
// Upload API's "explicit" method. Server-to-server, so the secret never leaves.
//
// `rawConvert` (e.g. "google_video_transcription") rides along on the SAME
// explicit call so transcription starts together with the render. The generated
// `<id>.transcript` is what the l_subtitles overlay later burns in; because the
// recipe's delivery URL only returns 200 once every referenced asset exists, the
// existing status poll already waits for the transcript without extra plumbing.
export async function startRender(opts: {
  config: CloudinaryConfig;
  sourcePublicId: string;
  transformation: string;
  notificationUrl?: string;
  rawConvert?: string;
}): Promise<void> {
  const { config } = opts;
  const timestamp = unixNow();
  const params: Record<string, string | number> = {
    public_id: opts.sourcePublicId,
    type: "upload",
    eager: opts.transformation,
    eager_async: "true",
    timestamp,
  };
  if (opts.notificationUrl) params.notification_url = opts.notificationUrl;
  if (opts.rawConvert) params.raw_convert = opts.rawConvert;

  const signature = signParams(params, config.apiSecret);
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) body.set(k, String(v));
  body.set("api_key", config.apiKey);
  body.set("signature", signature);

  const res = await fetch(`${API_BASE}/${config.cloudName}/video/explicit`, {
    method: "POST",
    body,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Cloudinary explicit failed (${res.status}): ${text}`);
  }
}

// The exact, deterministic delivery URL for a rendered tutorial. Built from the
// SAME transformation string we hand to the eager render, so what we serve is
// always our full recipe (overlays + spliced outro) — never some other derived
// variant of the source. This is the URL we store and give the user.
export function buildDeliveryUrl(
  config: CloudinaryConfig,
  transformation: string,
  sourcePublicId: string,
): string {
  return `https://res.cloudinary.com/${config.cloudName}/video/upload/${transformation}/${sourcePublicId}.mp4`;
}

// Checks whether a rendered video is ready by requesting its delivery URL.
// Cloudinary returns 200 once the (eager) derived asset exists, and 4xx (e.g.
// 423 Locked) while it is still processing.
export async function isRenderReady(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: "HEAD" });
    return res.ok;
  } catch {
    return false;
  }
}

// Reads credit usage for the account (free plan = 25 credits / 30-day cycle).
export async function getCreditUsage(
  config: CloudinaryConfig,
): Promise<{ used: number; limit: number } | null> {
  const auth = Buffer.from(`${config.apiKey}:${config.apiSecret}`).toString("base64");
  const res = await fetch(`${API_BASE}/${config.cloudName}/usage`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  if (!res.ok) return null;
  const json = (await res.json().catch(() => null)) as
    | { credits?: { usage?: number; limit?: number } }
    | null;
  const c = json?.credits;
  if (!c || typeof c.limit !== "number") return null;
  return { used: c.usage ?? 0, limit: c.limit };
}

// Destroys a source video (and its derived output) to free storage credits.
export async function deleteVideo(
  config: CloudinaryConfig,
  publicId: string,
): Promise<boolean> {
  const timestamp = unixNow();
  const signature = signParams({ public_id: publicId, timestamp }, config.apiSecret);
  const body = new URLSearchParams();
  body.set("public_id", publicId);
  body.set("timestamp", String(timestamp));
  body.set("api_key", config.apiKey);
  body.set("signature", signature);
  const res = await fetch(`${API_BASE}/${config.cloudName}/video/destroy`, {
    method: "POST",
    body,
  });
  return res.ok;
}

// Verifies a Cloudinary webhook: SHA-1(body + timestamp + api_secret) must match
// the X-Cld-Signature header.
export function verifyWebhookSignature(
  body: string,
  timestamp: string,
  signature: string,
  apiSecret: string,
): boolean {
  const expected = createHash("sha1").update(body + timestamp + apiSecret).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}
