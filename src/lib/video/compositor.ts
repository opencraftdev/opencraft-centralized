// Shared vertical compositor — the single source of truth for how a tutorial
// frame is baked into a 1080×1920 (9:16) canvas.
//
// Both surfaces import THIS module so there is exactly one implementation:
//   • the web in-browser recorder (src/features/tutorial-video/.../ScreenRecorder)
//   • the native recorder app (apps/recorder-apps, via a path/workspace import)
//
// Per frame the caller hands us { screen, cam?, focus, zoom }. We draw:
//   • the screen, cover-cropped into the TOP region (~62%), centered on `focus`
//     and magnified by `zoom` (cursor-follow auto-zoom — the Screen Studio look)
//   • the webcam, cover-cropped into the BOTTOM region (~38%) with a divider
//   • no cam → the screen fills the whole 1080×1920 frame
//
// Framework-agnostic: it only touches the Canvas 2D API (available in both the
// browser and the Tauri WebView2/WebKit webview) and plain math — no React, no
// Tauri, no DOM lookups. The crop math is exported as pure functions so it can
// be unit-tested headlessly.

export const OUTPUT_WIDTH = 1080;
export const OUTPUT_HEIGHT = 1920;

// Fraction of the canvas height given to the screen when a webcam is present.
// The remaining ~38% holds the big webcam rectangle (was a corner circle).
export const DEFAULT_SCREEN_RATIO = 0.62;

// Per-frame easing applied to the crop rect + zoom so motion glides instead of
// snapping. 0 = frozen, 1 = instant. ~0.18 reads as a smooth Screen-Studio ease.
export const DEFAULT_SMOOTHING = 0.18;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Focus {
  x: number; // 0..1 across the source width
  y: number; // 0..1 down the source height
}

// Anything drawable by CanvasRenderingContext2D.drawImage (HTMLVideoElement,
// HTMLCanvasElement, ImageBitmap, VideoFrame, …).
export type FrameSource = CanvasImageSource;

export interface CompositorFrameInput {
  screen: FrameSource;
  screenWidth: number;
  screenHeight: number;
  cam?: FrameSource | null;
  camWidth?: number;
  camHeight?: number;
  focus: Focus; // where the zoom is centered (cursor position on the native app)
  zoom: number; // >= 1; 1 = no magnification
}

// ── pure math (unit-testable) ───────────────────────────────────────────────

export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

export function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

export function lerpRect(from: Rect, to: Rect, t: number): Rect {
  return {
    x: lerp(from.x, to.x, t),
    y: lerp(from.y, to.y, t),
    w: lerp(from.w, to.w, t),
    h: lerp(from.h, to.h, t),
  };
}

// Largest rect of `destW:destH` aspect that fits inside `srcW×srcH`, centered.
// This is the classic "cover" crop (object-fit: cover) used for the webcam and
// as the zoom-1 baseline for the screen.
export function computeCoverCrop(
  srcW: number,
  srcH: number,
  destW: number,
  destH: number,
): Rect {
  const destAspect = destW / destH;
  let w = srcW;
  let h = srcW / destAspect;
  if (h > srcH) {
    h = srcH;
    w = srcH * destAspect;
  }
  return { x: (srcW - w) / 2, y: (srcH - h) / 2, w, h };
}

// The source crop rect to render into a `destW×destH` region, magnified by
// `zoom` and centered on `focus` — then clamped to stay inside the source so we
// never sample outside the captured frame (which would show black bars).
export function computeScreenCrop(
  srcW: number,
  srcH: number,
  destW: number,
  destH: number,
  focus: Focus,
  zoom: number,
): Rect {
  const base = computeCoverCrop(srcW, srcH, destW, destH);
  const z = Math.max(1, zoom);
  const cropW = base.w / z;
  const cropH = base.h / z;
  const cx = clamp(focus.x, 0, 1) * srcW;
  const cy = clamp(focus.y, 0, 1) * srcH;
  const x = clamp(cx - cropW / 2, 0, srcW - cropW);
  const y = clamp(cy - cropH / 2, 0, srcH - cropH);
  return { x, y, w: cropW, h: cropH };
}

// Layout of the two stacked regions. With a cam: screen on top (screenRatio of
// the height), cam on the bottom. Without a cam: the screen owns the whole frame.
export function regionsFor(
  hasCam: boolean,
  width: number,
  height: number,
  screenRatio: number,
): { screen: Rect; cam: Rect | null } {
  if (!hasCam) {
    return { screen: { x: 0, y: 0, w: width, h: height }, cam: null };
  }
  const screenH = Math.round(height * screenRatio);
  return {
    screen: { x: 0, y: 0, w: width, h: screenH },
    cam: { x: 0, y: screenH, w: width, h: height - screenH },
  };
}

// Reads the intrinsic pixel size of a frame source when the caller didn't pass
// explicit dimensions (HTMLVideoElement → videoWidth, ImageBitmap/canvas → width).
function sourceSize(
  source: FrameSource,
  width: number | undefined,
  height: number | undefined,
): { w: number; h: number } {
  if (width && height) return { w: width, h: height };
  const anySrc = source as unknown as {
    videoWidth?: number;
    videoHeight?: number;
    width?: number;
    height?: number;
  };
  return {
    w: anySrc.videoWidth || anySrc.width || OUTPUT_WIDTH,
    h: anySrc.videoHeight || anySrc.height || OUTPUT_HEIGHT,
  };
}

// ── the compositor ──────────────────────────────────────────────────────────

// "cover"   — fill the screen region, cropping the sides; combined with focus +
//             zoom this pans to follow the cursor (the native Screen-Studio look).
// "contain" — fit the whole screen inside the region (letterboxed). Lossless, the
//             right default when there is no cursor signal to pan toward (web).
export type ScreenFit = "cover" | "contain";

export interface VerticalCompositorOptions {
  width?: number;
  height?: number;
  screenRatio?: number;
  smoothing?: number;
  divider?: boolean;
  screenFit?: ScreenFit;
}

// Largest rect of `srcW:srcH` aspect that fits INSIDE destW×destH, centered —
// the "contain"/letterbox placement (returns a destination rect to draw into).
export function computeContainRect(
  srcW: number,
  srcH: number,
  destW: number,
  destH: number,
): Rect {
  const scale = Math.min(destW / srcW, destH / srcH);
  const w = srcW * scale;
  const h = srcH * scale;
  return { x: (destW - w) / 2, y: (destH - h) / 2, w, h };
}

// Stateful: holds the currently-eased crop rect + zoom and glides them toward
// each frame's target. One instance per recording session; call reset() to start
// a fresh ease (e.g. before a new take).
export class VerticalCompositor {
  readonly width: number;
  readonly height: number;
  readonly screenRatio: number;
  readonly smoothing: number;
  readonly screenFit: ScreenFit;
  private readonly drawDivider: boolean;

  private currentCrop: Rect | null = null;

  constructor(options: VerticalCompositorOptions = {}) {
    this.width = options.width ?? OUTPUT_WIDTH;
    this.height = options.height ?? OUTPUT_HEIGHT;
    this.screenRatio = options.screenRatio ?? DEFAULT_SCREEN_RATIO;
    this.smoothing = options.smoothing ?? DEFAULT_SMOOTHING;
    this.screenFit = options.screenFit ?? "cover";
    this.drawDivider = options.divider ?? true;
  }

  // Drop the smoothing state so the next frame snaps to its target instead of
  // easing in from a stale position.
  reset(): void {
    this.currentCrop = null;
  }

  // Draw one composited frame onto `ctx` (sized this.width × this.height).
  drawFrame(ctx: CanvasRenderingContext2D, input: CompositorFrameInput): void {
    const hasCam = Boolean(input.cam);
    const { screen, cam } = regionsFor(hasCam, this.width, this.height, this.screenRatio);

    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, this.width, this.height);

    if (this.screenFit === "contain") {
      // Letterbox the whole screen inside its region — no crop, no pan.
      const dest = computeContainRect(
        input.screenWidth,
        input.screenHeight,
        screen.w,
        screen.h,
      );
      ctx.drawImage(
        input.screen,
        screen.x + dest.x,
        screen.y + dest.y,
        dest.w,
        dest.h,
      );
    } else {
      // Cover + cursor-follow zoom: target this frame's crop, ease toward it.
      const target = computeScreenCrop(
        input.screenWidth,
        input.screenHeight,
        screen.w,
        screen.h,
        input.focus,
        input.zoom,
      );
      this.currentCrop = this.currentCrop
        ? lerpRect(this.currentCrop, target, this.smoothing)
        : target;
      const crop = this.currentCrop;
      ctx.drawImage(
        input.screen,
        crop.x,
        crop.y,
        crop.w,
        crop.h,
        screen.x,
        screen.y,
        screen.w,
        screen.h,
      );
    }

    if (hasCam && cam && input.cam) {
      const { w: cw, h: ch } = sourceSize(input.cam, input.camWidth, input.camHeight);
      const camCrop = computeCoverCrop(cw, ch, cam.w, cam.h);
      ctx.drawImage(
        input.cam,
        camCrop.x,
        camCrop.y,
        camCrop.w,
        camCrop.h,
        cam.x,
        cam.y,
        cam.w,
        cam.h,
      );
      if (this.drawDivider) {
        ctx.fillStyle = "rgba(255,255,255,0.9)";
        ctx.fillRect(cam.x, cam.y - 2, cam.w, 4);
      }
    }
  }
}
