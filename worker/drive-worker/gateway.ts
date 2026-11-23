// Shared cc-gateway client for the drive-worker's two agent loops (documents: worker.ts, chat: chat.ts):
// SSE run streaming, stop (DELETE /v1/runs/{id}), Indonesian step labels from tool events, the throttled live
// writer (run_steps / stream_text) and the visible-text filter. Contracts: docs/DRIVE.md → "Chat v2", docs/CHAT.md.
import type { SupabaseClient } from "@supabase/supabase-js";

export type Step = { label: string; at: string };
export type RunResp = { run_id?: string; text?: string; session_id?: string; cost_usd?: number; is_error?: boolean };
export type Req = { prompt: string; session_id?: string };
export type Init = { run_id?: string; session_id?: string };
export type Gateway = { url: string; key: string; timeoutMs: number };

export const now = () => new Date().toISOString();

// claude's `total_cost_usd` for a `--resume`d run is the session's running total (verified 2026-11-23: a resumed
// 8-output-token reply reported the previous total + $0.01), so a row's cost must not simply add it up. Resumed the
// same session → the row's cost is at least that total; new session → add it. (Approximate after a session reset.)
export function nextCost(prev: number | string | null | undefined, run: RunResp, resumedSession: string | null | undefined): number {
  const p = Number(prev ?? 0) || 0;
  const c = run.cost_usd ?? 0;
  const same = !!resumedSession && run.session_id === resumedSession;
  return +(same ? Math.max(p, c) : p + c).toFixed(6);
}
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class RetryLater extends Error {}
export const httpError = (status: number, msg: string) => Object.assign(new Error(msg), { status });

export const MIME: Record<string, string> = {
  ".pdf": "application/pdf",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".csv": "text/csv",
  ".md": "text/markdown",
  ".txt": "text/plain",
  ".json": "application/json",
  ".html": "text/html",
  ".zip": "application/zip",
};

// ---- step labels from the gateway's SSE tool events ----
// The gateway sends `input` as a one-line summary string (command / file_path / path / pattern / url / query …,
// truncated to 60 chars, e.g. "cd /home/opencraft/document-agent && python3 scripts/doc_num"; tools without one of
// those keys, like Skill, get their JSON input), so match loosely. An object input (full tool input) is handled too.
// `generic` (chat): general-purpose fallbacks ("Membaca file…", "Menjalankan perintah…", "Menulis file…") instead
// of the document-only ones, which still apply when the call is clearly about a document.
export function progressFor(name: string, input: unknown, generic = false): string | null {
  const inp = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const str = (k: string) => (typeof inp[k] === "string" ? (inp[k] as string) : "");
  const raw = typeof input === "string" ? input : "";
  const file = (raw || str("file_path") || str("path") || str("notebook_path")).toLowerCase();
  const cmd = (raw || str("command")).toLowerCase();
  switch (name) {
    case "TodoWrite":
    case "ToolSearch":
      return null; // bookkeeping: keep the previous line
    case "Skill": {
      const skill = str("skill") || /"skill"\s*:\s*"([^"]+)/.exec(raw)?.[1] || "";
      return skill ? `Memakai skill ${skill}…` : "Memakai skill…";
    }
    case "WebSearch":
    case "WebFetch":
      return "Mencari di web…";
    case "Read":
      if (file.includes("pricelist")) return "Membaca pricelist…";
      if (file.includes("doc-numbers")) return "Memeriksa nomor dokumen…";
      if (file.includes("brand")) return "Membaca data brand…";
      if (file.includes("claude.md") || file.includes("readme") || file.includes("skill.md")) return "Membaca panduan…";
      if (file.includes("template") || file.includes("sample") || file.includes("types.ts")) return "Mempelajari template dokumen…";
      if (!generic && (file.endsWith(".pdf") || file.endsWith(".png") || file.endsWith(".jpg"))) return "Memeriksa hasil dokumen…";
      if (!generic && (file.includes("/tmp/") || file.startsWith("tmp/"))) return "Membaca data dokumen…";
      return "Membaca file…";
    case "Write":
    case "Edit":
    case "MultiEdit": {
      const doc = !generic || file.includes("document-agent") || file.startsWith("tmp/");
      if (doc && (file.includes(".json") || file.includes("tmp/"))) return "Menyiapkan data dokumen…";
      return doc ? "Menyiapkan dokumen…" : "Menulis file…";
    }
    case "Bash":
      if (/doc_number\.py\s+record/.test(cmd)) return "Mencatat nomor dokumen…";
      if (cmd.includes("doc_num")) return "Mengambil nomor dokumen…";
      if (cmd.includes("polish")) return "Membuat gambar slide…";
      if (cmd.includes("render-ppt") || cmd.includes("render-pp")) return "Membuat slide PPTX…";
      if (cmd.includes("render")) return "Membuat PDF…";
      if (/pdftoppm|pdftotext|pdfinfo|pdfimages/.test(cmd)) return "Memeriksa hasil dokumen…";
      if (cmd.includes("pricelist")) return "Membaca pricelist…";
      if (/samples?\/|templates?\//.test(cmd)) return "Mempelajari template dokumen…";
      if (cmd.includes("tmp/") && cmd.includes(".json")) return "Menyiapkan data dokumen…";
      return generic ? "Menjalankan perintah…" : "Sedang bekerja…";
    case "Glob":
    case "Grep":
      return generic ? "Mencari file…" : "Mencari data…";
    default:
      return "Sedang bekerja…";
  }
}

// Visible reply text: the SSE `text` events are whole assistant text blocks (cc-gateway runner.rs emits one event
// per `text` content block of each assistant message, not token deltas), so blocks are joined with a blank line.
// Protocol lines (any line containing one of `markers`, e.g. "RESULT:" / "ATTACH:") are cut, and so is a trailing
// partial fragment of a marker ("RES", "ATTACH" …) at the very end.
export function visibleText(blocks: string[] | string, markers: string[]): string {
  const joined = Array.isArray(blocks) ? blocks.join("\n\n") : blocks;
  const lines = joined.split(/\r?\n/).filter((l) => !markers.some((m) => l.includes(m)));
  while (lines.length) {
    const last = lines[lines.length - 1].trim().replace(/^`+/, "");
    if (!last || markers.some((m) => m.startsWith(last))) lines.pop();
    else break;
  }
  return lines.join("\n").trim();
}

// Throttled live writer: at most one DB write per LIVE_MS, the latest state wins, writes are serialized and only land
// while the row still matches `guard` (e.g. status = generating / running). `fields` maps the state to the patch.
export const LIVE_MS = 1500;
export function liveWriter(opts: {
  db: SupabaseClient;
  table: string;
  id: string;
  guard: [string, string];
  markers: string[];
  fields: (s: { label: string | null; steps: Step[]; text: string | null }) => Record<string, unknown>;
  log: (...a: unknown[]) => void;
}) {
  const steps: Step[] = [];
  const blocks: string[] = [];
  let label: string | null = null;
  let lastAt = 0;
  let dirty = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let chain: Promise<unknown> = Promise.resolve();
  let closed = false;
  const text = () => visibleText(blocks, opts.markers);
  const write = () => {
    dirty = false;
    lastAt = Date.now();
    const patch = opts.fields({ label, steps: [...steps], text: text() || null });
    chain = chain.then(() =>
      opts.db.from(opts.table).update(patch).eq("id", opts.id).eq(opts.guard[0], opts.guard[1])
        .then(({ error }) => error && opts.log(`${opts.table} ${opts.id} live: ${error.message}`)),
    );
  };
  const schedule = () => {
    if (closed) return;
    dirty = true;
    if (timer) return;
    const wait = lastAt + LIVE_MS - Date.now();
    const flush = () => {
      timer = null;
      if (!closed && dirty) write();
    };
    if (wait <= 0) flush();
    else timer = setTimeout(flush, wait);
  };
  return {
    steps,
    blocks,
    text,
    step(t: string | null) {
      if (closed || !t || t === label) return;
      label = t;
      steps.push({ label: t, at: now() });
      schedule();
    },
    addText(t: string) {
      if (closed || !t) return;
      blocks.push(t);
      schedule();
    },
    // Write the current state now (e.g. "Mengunggah ke Google Drive…" after the run), bypassing the throttle.
    async flushNow() {
      if (timer) clearTimeout(timer);
      timer = null;
      if (!closed) write();
      await chain.catch(() => {});
    },
    // Stop writing and wait for in-flight writes, so the final update (nulls) lands last.
    async close() {
      closed = true;
      if (timer) clearTimeout(timer);
      await chain.catch(() => {});
    },
  };
}

export type Hooks = {
  onTool: (name: string, input: unknown) => void;
  onText: (text: string) => void;
  onInit: (init: Init) => void;
  signal: AbortSignal; // user "Stop"
};

// POST /v1/runs with stream:true (cc-telegram SPEC.md → "API gateway"). SSE events: init {run_id, session_id},
// tool {name, input}, text {text}, result {run_id, text, session_id, cost_usd, …}, error {type, message}.
// Errors before the run starts (401/404 session/429/…) come back as plain HTTP errors. Aborting (timeout / stop)
// disconnects, which stops the run in the gateway. A stream that ends without result/error is an error
// (never re-run: the agent may already have taken a number / written files).
export async function callGateway(gw: Gateway, body: Req, hooks: Hooks): Promise<RunResp> {
  const res = await fetch(`${gw.url}/v1/runs`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "text/event-stream", authorization: `Bearer ${gw.key}` },
    body: JSON.stringify({ ...body, stream: true }),
    signal: AbortSignal.any([AbortSignal.timeout(gw.timeoutMs), hooks.signal]),
    timeout: false, // Bun: disable the default fetch timeout; AbortSignal handles it
  } as RequestInit);
  if (res.status === 429) {
    await res.body?.cancel().catch(() => {});
    throw new RetryLater("gateway busy (429)");
  }
  if (!res.ok) throw httpError(res.status, `gateway HTTP ${res.status}: ${(await res.text()).slice(0, 500)}`);
  if (!res.body) throw new Error("gateway returned no stream body");

  let init: Init = {};
  const texts: string[] = [];
  const decoder = new TextDecoder();
  let buf = "";
  const handle = (event: string, data: string): RunResp | null => {
    let v: Record<string, unknown> = {};
    try {
      v = JSON.parse(data);
    } catch {
      return null;
    }
    if (event === "init") {
      init = v as Init;
      hooks.onInit(init);
    } else if (event === "tool") hooks.onTool(String(v.name ?? ""), v.input);
    else if (event === "text" && typeof v.text === "string") {
      texts.push(v.text);
      hooks.onText(v.text);
    } else if (event === "result") {
      const r = v as RunResp;
      return { ...r, run_id: r.run_id ?? init.run_id, session_id: r.session_id ?? init.session_id, text: r.text ?? texts.join("\n\n") };
    } else if (event === "error") {
      const type = String(v.type ?? "");
      const msg = `gateway run error (${type || "unknown"}): ${String(v.message ?? "").slice(0, 500)}`;
      if (type === "session_not_found") throw httpError(404, msg);
      if (type === "rate_limit_error") throw new RetryLater(msg);
      throw Object.assign(new Error(msg), { session_id: init.session_id, run_id: init.run_id });
    }
    return null;
  };
  const reader = res.body.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (value) buf += decoder.decode(value, { stream: true });
      buf = buf.replace(/\r\n?/g, "\n");
      let sep: number;
      while ((sep = buf.indexOf("\n\n")) >= 0) {
        const block = buf.slice(0, sep);
        buf = buf.slice(sep + 2);
        let event = "message";
        const data: string[] = [];
        for (const line of block.split("\n")) {
          if (!line || line.startsWith(":")) continue; // keep-alive comment
          const i = line.indexOf(":");
          const field = i < 0 ? line : line.slice(0, i);
          const val = i < 0 ? "" : line.slice(i + 1).replace(/^ /, "");
          if (field === "event") event = val;
          else if (field === "data") data.push(val);
        }
        if (data.length) {
          const r = handle(event, data.join("\n"));
          if (r) return r;
        }
      }
      if (done) break;
    }
  } finally {
    reader.cancel().catch(() => {});
  }
  throw Object.assign(new Error("gateway stream ended without a result (connection lost?); not retried"), {
    session_id: init.session_id,
    run_id: init.run_id,
  });
}

// DELETE /v1/runs/{id} (fire and forget; disconnecting the stream also kills the run).
export function deleteRun(gw: Gateway, runId: string | undefined, log: (...a: unknown[]) => void, tag: string) {
  if (!runId) return;
  fetch(`${gw.url}/v1/runs/${encodeURIComponent(runId)}`, {
    method: "DELETE",
    headers: { authorization: `Bearer ${gw.key}` },
    signal: AbortSignal.timeout(10_000),
  })
    .then((r) => log(`${tag} DELETE run ${runId} → HTTP ${r.status}`))
    .catch((e) => log(`${tag} DELETE run ${runId}: ${(e as Error).message}`));
}
