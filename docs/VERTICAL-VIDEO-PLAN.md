# Vertical Tutorial Video — Implementation Plan

Produce **9:16 vertical** videos for Instagram Reels / TikTok / X, with **true
cursor-follow auto-zoom**, **global hotkeys**, a **large webcam**, and
**burned-in captions** — replacing the old landscape output.

Two pieces, clean split:

- **`apps/recorder-apps/` — a simple desktop recorder.** Captures the screen + webcam
  + audio, reads **real cursor coordinates + global hotkeys from Rust**, and bakes
  a **finished 1080×1920 vertical** (cursor-follow zoom + big webcam) live in its
  webview. Outputs one vertical video in the desired format.
- **`opencraft-centralized/` — the web app, which *achieves the result*.** The
  Tauri app uploads the finished vertical through the existing signed pipeline;
  the web side adds **captions + outro + logo** via Cloudinary, publishes, and
  shows history. **No in-browser recording.**

---

## Why Tauri (native) and not a browser / Chrome extension

The reference clip (zoom that follows the action on a desktop terminal) is the
**Screen Studio** look — a *native* effect. A browser hits two hard walls when
capturing desktop apps; a native app clears both.

| Capability | Browser (`getDisplayMedia`) | Tauri (Rust) |
|---|---|---|
| **Cursor coordinates** | ❌ pixels only, no x/y | ✅ `device_query` polls global cursor x/y while any app is focused |
| **Global hotkeys** | ❌ keys go to the focused app | ✅ `tauri-plugin-global-shortcut` fires system-wide |
| **Mouse clicks** | ❌ | ✅ `device_query` button state (drives punch-in zoom) |

A Chrome extension can't see desktop apps (content scripts live only inside web
pages), so it's no help here. Tauri is also cross-platform → works on **Windows**
(Screen Studio is Mac-only).

---

## Decisions (locked)

| Decision | Choice |
|---|---|
| Output aspect | **1080×1920 (9:16)**, replaces landscape |
| Recorder | **Tauri desktop app** — simple capture + live vertical bake |
| Render split | **Tauri bakes the finished vertical**; web app adds captions + outro |
| Zoom | **Cursor-follow** (real coords); punch-in on click/dwell; **hotkeys** force in/out |
| Webcam | **Large rectangle, bottom ~38%** (was a corner circle) |
| Captions | **Cloudinary `google_video_transcription`** + burned-in subtitle overlay |
| In-browser recording | **Dropped** — the web app processes & publishes, it doesn't record |
| Backend pipeline | **Reused** — Tauri calls the same `/api/tutorial-video/*` routes |

---

## Architecture

```
┌──────────────── apps/recorder-apps (Tauri v2, React+Vite+TS) ────────────────────┐
│  Rust backend                                                                     │
│    • device_query thread → global cursor x/y + mouse buttons @ ~60fps → events    │
│    • tauri-plugin-global-shortcut → Start/Stop, Zoom in, Zoom out, Reset          │
│    • plugin-store / stronghold → Supabase session token                           │
│  Webview frontend                                                                 │
│    • getDisplayMedia (monitor) + getUserMedia (cam/mic) + system audio mix        │
│    • cursor x/y mapped → captured-display pixels                                  │
│    • SHARED compositor → 1080×1920 canvas: cursor-zoomed screen (top ~62%)        │
│      + webcam cover-crop (bottom ~38%)                                            │
│    • MediaRecorder(canvas.captureStream) → finished vertical WebM                 │
│    • uploader: sign → Cloudinary direct upload → POST render                      │
└───────────────────────────────────┬───────────────────────────────────────────────┘
                                     │  authenticated as the user (Bearer token)
                                     ▼
        Reuses THIS web app's existing API (no backend rewrite):
        POST /api/tutorial-video/sign  → Cloudinary signed upload params
        (Tauri → Cloudinary upload of the finished vertical WebM)
        POST /api/tutorial-video       → startRender + start transcription
        GET  /api/tutorial-video/[id]  → status poll (unchanged)
                                     │
                                     ▼
        Cloudinary eager render: logo + burned captions + spliced outro
        (NO reframe — the video is already vertical)
                                     │
                                     ▼
        Row in `tutorial_videos` → web app dashboard / history (9:16 preview)
```

**Shared compositor contract** — both the live bake and any future re-render use
one module. Per frame: `{ screenFrame, camFrame|null, focus:{x,y} 0..1, zoom }` →
draws the 1080×1920 canvas. Smoothing (lerp of crop rect + zoom) lives inside it.

---

## Project layout

```
apps/recorder-apps/                   # NEW Tauri v2 app
  src/                                # React + Vite renderer
    App.tsx                           # monitor picker, record controls, hotkey hints, login
    recorder.ts                       # getDisplayMedia + getUserMedia + MediaRecorder
    cursor.ts                         # subscribe to Rust cursor/hotkey events, map to pixels
    uploader.ts                       # sign → Cloudinary upload → POST render
  src-tauri/                          # Rust
    src/main.rs                       # window + plugins
    src/cursor.rs                     # device_query polling thread → emit events
    src/shortcuts.rs                  # global-shortcut registration
    tauri.conf.json                   # capabilities, bundle targets (Win .msi/.exe, Mac .dmg)

opencraft-centralized/
  src/lib/video/compositor.ts         # NEW shared compositor (imported by Tauri renderer)
  src/lib/cloudinary.ts               # buildRenderTransformation → drop reframe, add captions
  src/app/api/tutorial-video/route.ts # fire transcription; accept Bearer-token auth
  src/app/api/tutorial-video/sign/route.ts # accept Bearer-token auth
  src/features/tutorial-video/...     # page → upload/processing/history + "Get the recorder" CTA
```

> The compositor is imported by the Tauri renderer via a workspace/path reference
> (or published as a tiny local package) so there is exactly one implementation.

---

## Phased work breakdown

### Phase 0 — Shared compositor *(foundation, start here)*
`opencraft-centralized/src/lib/video/compositor.ts`
- Framework-agnostic TS. Input per frame: screen frame, optional cam frame,
  `focus {x,y}` (0..1 of source), `zoom`. Output: draws a **1080×1920** canvas —
  screen crop (top ~62%) centered on `focus` at `zoom`; webcam cover-cropped into
  the bottom ~38% with a divider. No cam → screen fills the frame.
- Internal smoothing: lerp current crop rect + zoom toward targets each frame.
- Pure enough to unit-test the crop math headlessly.

### Phase 1 — Tauri scaffold: capture + record vertical
- Tauri v2 + React + Vite + TS scaffold in `apps/recorder-apps/`.
- Monitor picker; `getDisplayMedia` for the screen + `getUserMedia` for cam/mic;
  mix mic + system audio. **Verify**: `getDisplayMedia` works in WebView2 (Windows
  webview). Fallback if not: Rust capture crate (`scap`/`xcap`) → frames to webview.
- Feed frames + static center focus into the compositor; record → WebM.
- **Milestone:** a finished vertical WebM, no zoom intelligence yet.

### Phase 2 — Cursor-follow zoom + global hotkeys
- Rust `device_query` thread emits cursor x/y + button state (~60fps) to the
  renderer; map global coords → captured display pixels via monitor bounds + scale.
- Compositor focus = cursor; **zoom logic**: dwell/typing in a small area or a
  click → ease zoom in (~1.8–2.2×); large travel or idle → ease back out.
- `tauri-plugin-global-shortcut`: Start/Stop, Zoom in, Zoom out, Reset — fire even
  when VS Code/terminal is focused.
- **Milestone:** cursor-follow zoom matches the reference feel (tune together).

### Phase 3 — Auth bridge + upload (connect to the web app)
- Login: open the web app's auth in a Tauri webview window; capture the Supabase
  session token; store via plugin-store (or stronghold).
- Upload: `POST /api/tutorial-video/sign` (Bearer) → Cloudinary direct upload →
  `POST /api/tutorial-video` to start render + transcription.
- **API shim:** existing routes read a Supabase *cookie* session; add an additive
  **Bearer-token** path (validate token via Supabase) so desktop calls authenticate.
- **Milestone:** a desktop recording appears in the web app history.

### Phase 4 — Cloudinary render: drop reframe, add captions
`src/lib/cloudinary.ts`, `src/app/api/tutorial-video/route.ts`
- Video already vertical → `buildRenderTransformation` **no longer reframes**.
  Transform = logo top-right + (optional small name/handle first 5s) +
  **`l_subtitles` overlay** + outro spliced & padded to 1080×1920 (outro is 1280×720).
- POST fires `raw_convert: google_video_transcription`; the transcript gates the
  subtitle URL, so the existing status poll already covers "ready".

### Phase 5 — Verify Cloudinary recipe
Against the real account (curl / existing `scripts/`):
1. `l_subtitles:<id>.transcript` overlay renders (HTTP 200).
2. `google_video_transcription` add-on enabled (one-click enable; credit cost).
   If unavailable → skip-captions fallback or a dedicated STT key.

### Phase 6 — Web app surface + packaging
- Repurpose the tutorial-video page: **upload/processing/history** + a "Get the
  desktop recorder" download CTA; 9:16 previews in `RecentRenders`. Retire the
  in-browser recorder UI. No DB schema change.
- Package the Tauri app with `tauri build`: Windows (`.msi`/NSIS `.exe`) + Mac
  (`.dmg`). Host the installer from the web app or GitHub Releases.

---

## Prerequisites / open items
- **Rust toolchain** + Tauri v2 CLI on the dev machine (`cargo`, `@tauri-apps/cli`).
- **WebView2 `getDisplayMedia`** support — verified in Phase 1; Rust-capture
  fallback noted.
- **Cursor→capture mapping** assumes **full-monitor** capture (clean math). Window
  capture mapping is a later enhancement.
- **Code signing** — unsigned builds trigger SmartScreen/Gatekeeper warnings on
  first run; signing certs can come later.

## Risks
- Zoom feel is tuned by eye — expect a couple of record-and-adjust rounds.
- `getDisplayMedia` in WebView2 is the main Phase-1 technical risk; Rust capture is
  the fallback if it misbehaves.
- WebM from MediaRecorder is fine for Cloudinary; if a specific MP4 profile is
  required, add a transcode step (Cloudinary can also deliver MP4 from the WebM).

## Sequencing
Phase 0 → 1 → 2 (the recorder is the value) → 3 (connect) → 4–5 (captions) → 6 (surface + packaging).
