// drive-worker — (1) claims queued drive_files jobs, runs them through the cc-gateway
// "opencraft-document" profile (POST /v1/runs) and uploads the result to Google Drive.
// Contract: docs/DRIVE.md. (2) Chat loop (chat.ts, docs/CHAT.md). Shared gateway code: gateway.ts. Runs on the OpenCraft VPS under systemd (logs → journald).
import { createClient } from "@supabase/supabase-js";
import { createGoogleDrive } from "./google.ts";
import { createDriveSync } from "./sync.ts";
import { createChatLoop } from "./chat.ts";
import {
  MIME, RetryLater, callGateway, deleteRun, liveWriter as genericLiveWriter, nextCost, now, progressFor, sleep,
  type Gateway, type Hooks, type Req, type RunResp, type Step,
} from "./gateway.ts";
import fs from "node:fs";
import path from "node:path";

const env = (k: string, def?: string) => {
  const v = process.env[k] ?? def;
  if (!v) throw new Error(`missing env ${k}`);
  return v;
};
const SUPABASE_URL = env("SUPABASE_URL");
const SUPABASE_SECRET_KEY = env("SUPABASE_SECRET_KEY");
const GATEWAY_URL = env("GATEWAY_URL", "http://127.0.0.1:8788").replace(/\/+$/, "");
const GATEWAY_KEY = env("GATEWAY_KEY");
const DOC_AGENT_DIR = fs.realpathSync(env("DOC_AGENT_DIR"));
const POLL_MS = Number(process.env.POLL_MS ?? 5000);
const RUN_TIMEOUT_MS = Number(process.env.RUN_TIMEOUT_MS ?? 960_000); // gateway run_timeout_secs=900 + slack
const STALE_MINUTES = Number(process.env.STALE_MINUTES ?? 20);
const SYNC_MS = Number(process.env.SYNC_MS ?? 30_000); // Google → dashboard sync interval; 0 = off
const SYNC_REQUEST_POLL_MS = 2500;
const CANCEL_POLL_MS = 2000; // how often drive_files.cancel_requested_at ("Stop") is checked during a run
const gw: Gateway = { url: GATEWAY_URL, key: GATEWAY_KEY, timeoutMs: RUN_TIMEOUT_MS };

const db = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const gdrive = createGoogleDrive(db);
// Chat (docs/CHAT.md): second loop in this process, on the cc-gateway "opencraft-chat" profile. Off without CHAT_GATEWAY_KEY.
const chat = process.env.CHAT_GATEWAY_KEY
  ? createChatLoop({
      db,
      gdrive,
      gateway: {
        url: env("CHAT_GATEWAY_URL", "http://127.0.0.1:8789").replace(/\/+$/, ""),
        key: env("CHAT_GATEWAY_KEY"),
        timeoutMs: RUN_TIMEOUT_MS,
      },
      workdir: env("CHAT_WORKDIR", "/home/opencraft/opencraft-chat"),
      pollMs: Number(process.env.CHAT_POLL_MS ?? 2000),
      log: (...a) => log(...a),
    })
  : null;
const gsync = createDriveSync({
  db,
  accessToken: gdrive.accessToken,
  ensureFolder: gdrive.ensureFolder,
  log: (...a) => log(...a),
});

type Msg = { role: "user" | "assistant"; text: string; at: string; steps?: Step[]; duration_ms?: number; stopped?: boolean };
type Row = {
  id: string;
  name: string;
  folder_id: string | null;
  google_file_id: string | null;
  doc_type: string | null;
  prompt: string | null;
  messages: Msg[] | null;
  gateway_session_id: string | null;
  cost_usd: number | string | null;
  doc_number: string | null;
  metadata: Record<string, unknown> | null;
  cancel_requested_at?: string | null;
};
type Result =
  | { status: "ready"; path: string; doc_number?: string; title?: string }
  | { status: "needs_input"; question: string };

const log = (...a: unknown[]) => console.log(new Date().toISOString(), ...a);

const DOC_LABEL: Record<string, string> = { sph: "SPH (PDF)", mou: "MoU (PDF)", deck: "Deck (PPTX)", other: "dokumen lain" };

const PROTOCOL = `
## Cara kerja (WAJIB)
You are running NON-INTERACTIVELY behind the OpenCraft web dashboard (/documents). Nobody watches this run;
the user only sees your final reply and the file. Follow CLAUDE.md in this directory (pricelist, doc_number.py, render scripts).
- If any required information is missing (client name/org, recipient, items, package, etc.) or an item/price is NOT in
  data/pricelist.json: do NOT guess and do NOT render. Ask instead (in Bahasa Indonesia) via a needs_input RESULT.
- For a Deck: after rendering the DRAFT pptx, STOP and ask for confirmation via needs_input before running the paid
  polish step (scripts/polish-deck.py). Include the draft path in your question text.
- Only record a document number (doc_number.py record) after the file was rendered successfully.
- Do not mention monitoring/telemetry warnings (e.g. missing SUPABASE_URL) in your reply; they are expected here.
- End your reply with EXACTLY ONE final line, nothing after it, in one of these forms (single-line JSON):
RESULT: {"status":"ready","path":"documents/sph/004_SPH-OC_2026.pdf","doc_number":"004/SPH-OC/2026","title":"SPH PT Contoh"}
RESULT: {"status":"needs_input","question":"<pertanyaan untuk user, Bahasa Indonesia, Markdown>"}
"path" is relative to ${DOC_AGENT_DIR}. Write the reply text before the RESULT line in Bahasa Indonesia (short summary).
- FORMAT: the web UI renders Markdown. Write the reply text AND the needs_input "question" in Markdown, in Bahasa Indonesia:
  short paragraphs, a numbered list when asking several things, **bold** for key values (client, number, total),
  a Markdown table for item lists. The RESULT line itself stays single-line JSON: put line breaks inside the
  "question" string as \\n escapes (e.g. "Mohon lengkapi:\\n\\n1. **Nama klien**?\\n2. **Paket**?").`;

const REMINDER = `\n\n(Reminder: still non-interactive from the web UI. Do not guess missing data or prices. Write the reply and the needs_input question in Markdown, Bahasa Indonesia (short paragraphs, numbered list for several questions, **bold** key values, a table for item lists). End with exactly one single-line JSON line (use \\n escapes inside "question"): RESULT: {"status":"ready","path":...,"doc_number":...,"title":...} or RESULT: {"status":"needs_input","question":"..."})`;

// A follow-up on a row that already produced a document (it has a Google file): the user is revising
// that document in the chat (docs/DRIVE.md → "Chat tab"). Same document, same number, unless asked otherwise.
function revisionNote(row: Row): string {
  if (!row.google_file_id) return "";
  const src = typeof row.metadata?.source_path === "string" ? (row.metadata.source_path as string) : null;
  const flat = src ? path.basename(src, path.extname(src)) : null;
  const num = row.doc_number;
  return (
    `\n\n(REVISION of the document already delivered in this conversation: "${row.name}"` +
    (num ? `, document number ${num}` : "") +
    (src ? `, file ${src}` : "") +
    `.) Apply the change above to THAT SAME document: update its data` +
    (flat ? ` (tmp/${flat}.json)` : "") +
    ` and re-render it (overwriting the same output path is fine).` +
    (num
      ? ` KEEP document number ${num}: do NOT run \`doc_number.py next\` and do NOT run \`doc_number.py record\` again` +
        ` (it is already recorded). Only if the user explicitly asks for a NEW/separate document may you take a new number.` +
        ` The RESULT line must carry "doc_number":"${num}" (or the new number in that explicit case).`
      : ` Do not create a separate document unless the user explicitly asks for one.`) +
    ` If the change needs data that is missing or a price that is not in the pricelist, ask via needs_input instead.`
  );
}

function buildPrompt(row: Row): Req {
  const msgs = row.messages ?? [];
  const userMsgs = msgs.filter((m) => m.role === "user");
  const last = userMsgs.at(-1)?.text ?? row.prompt ?? "";
  const rev = revisionNote(row);
  if (row.gateway_session_id) return { prompt: last + rev + REMINDER, session_id: row.gateway_session_id };
  const type = DOC_LABEL[row.doc_type ?? "other"] ?? row.doc_type;
  let body = `Buat dokumen: ${type}.\n\nPermintaan user:\n${row.prompt ?? last}`;
  if (msgs.length > 1) {
    // No session to resume (e.g. lost) → replay the conversation so far.
    body += `\n\nPercakapan sejauh ini:\n` + msgs.map((m) => `${m.role === "user" ? "User" : "Agent"}: ${m.text}`).join("\n");
    body += `\n\nLanjutkan berdasarkan pesan User terakhir.` + rev;
  }
  return { prompt: body + "\n" + PROTOCOL };
}

// Live state of the running job (docs/DRIVE.md → "Chat v2"): progress (newest label), run_steps, stream_text;
// throttled shared writer (gateway.ts), only while the row is still `generating`.
const liveWriter = (id: string) =>
  genericLiveWriter({
    db, table: "drive_files", id, guard: ["status", "generating"], markers: ["RESULT:"], log,
    fields: ({ label, steps, text }) => ({ progress: label, run_steps: steps, stream_text: text }),
  });

// Columns nulled in the same update that ends a run (ready / needs_input / failed / stopped / re-queued).
const LIVE_CLEAR = { progress: null, run_steps: null, stream_text: null, cancel_requested_at: null };

function parseResult(text: string): Result | null {
  const lines = text.split(/\r?\n/);
  for (let i = lines.length - 1; i >= 0; i--) {
    const idx = lines[i].indexOf("RESULT:");
    if (idx < 0) continue;
    const raw = lines[i].slice(idx + 7).trim().replace(/^`+|`+$/g, "").trim();
    try {
      const r = JSON.parse(raw);
      if (r?.status === "ready" && typeof r.path === "string") return r;
      if (r?.status === "needs_input" && typeof r.question === "string") return r;
    } catch {}
    return null; // the last RESULT line is authoritative
  }
  return null;
}

const stripResult = (text: string) =>
  text.split(/\r?\n/).filter((l) => !l.includes("RESULT:")).join("\n").trim();

// Resolve an agent-reported path; refuse anything outside DOC_AGENT_DIR (incl. via symlinks).
function safeFile(p: string): string {
  const abs = fs.realpathSync(path.resolve(DOC_AGENT_DIR, p));
  if (!abs.startsWith(DOC_AGENT_DIR + path.sep)) throw new Error(`path escapes document-agent dir: ${p}`);
  if (!fs.statSync(abs).isFile()) throw new Error(`not a file: ${p}`);
  return abs;
}

async function update(id: string, patch: Record<string, unknown>) {
  const { error } = await db.from("drive_files").update(patch).eq("id", id);
  if (error) throw new Error(`update ${id}: ${error.message}`);
}

async function processJob(row: Row) {
  const t0 = Date.now();
  const messages = [...(row.messages ?? [])];
  const prevCost = Number(row.cost_usd ?? 0) || 0;
  log(`job ${row.id} start doc_type=${row.doc_type} resume=${!!row.gateway_session_id}`);

  let run: RunResp;
  let req = buildPrompt(row);
  const live = liveWriter(row.id);
  const done = () => ({ steps: [...live.steps], duration_ms: Date.now() - t0 });

  // Stop (docs/DRIVE.md → "Chat v2"): the user set cancel_requested_at. Never a failure: the streamed text so far
  // becomes a `stopped` assistant message; the row goes back to ready (it has a document) or needs_input.
  const finishStopped = async (init: { run_id?: string; session_id?: string }) => {
    await live.close();
    messages.push({ role: "assistant", text: live.text(), stopped: true, ...done(), at: now() });
    const patch: Record<string, unknown> = {
      ...LIVE_CLEAR,
      status: row.google_file_id ? "ready" : "needs_input",
      messages,
      error_msg: null,
      finished_at: now(),
      gateway_session_id: init.session_id ?? row.gateway_session_id,
      run_id: init.run_id ?? null,
    };
    if (!row.google_file_id) patch.agent_message = "Dihentikan.";
    await update(row.id, patch);
    log(`job ${row.id} stopped by user after ${((Date.now() - t0) / 1000).toFixed(0)}s (run ${init.run_id ?? "-"})`);
  };

  if (row.cancel_requested_at) {
    await finishStopped({}); // stopped while still queued: never sent to the gateway
    return;
  }

  let init: { run_id?: string; session_id?: string } = {};
  const stop = new AbortController();
  let stopped = false;
  const stopRun = () => deleteRun(gw, init.run_id, log, `job ${row.id}`);
  let checking = false;
  const watcher = setInterval(async () => {
    if (stopped || checking) return;
    checking = true;
    try {
      const { data, error } = await db.from("drive_files").select("cancel_requested_at").eq("id", row.id).maybeSingle();
      if (!error && data?.cancel_requested_at && !stopped) {
        stopped = true;
        log(`job ${row.id} stop requested`);
        stopRun();
        stop.abort(); // disconnecting also makes the gateway kill the run
      }
    } finally {
      checking = false;
    }
  }, CANCEL_POLL_MS);

  const hooks: Hooks = {
    onTool: (name, input) => {
      const line = progressFor(name, input);
      log(`job ${row.id} tool ${name}: ${typeof input === "string" ? input : JSON.stringify(input)?.slice(0, 120)} → ${line ?? "-"}`);
      live.step(line);
    },
    onText: (t) => live.addText(t),
    onInit: (i) => {
      init = i;
      if (stopped) stopRun(); // stop arrived before init
    },
    signal: stop.signal,
  };
  live.step(row.google_file_id ? "Memulai revisi…" : "Memulai…");
  try {
    try {
      run = await callGateway(gw, req, hooks);
    } catch (e) {
      // Session gone (gateway reset / other key) → start fresh with the full conversation replayed.
      // (404 = the gateway refused the session before running anything, so this is not a double run.)
      if ((e as { status?: number }).status === 404 && req.session_id && !stopped) {
        log(`job ${row.id} session ${req.session_id} not found, starting a new session`);
        req = buildPrompt({ ...row, gateway_session_id: null });
        run = await callGateway(gw, req, hooks);
      } else throw e;
    }
  } catch (e) {
    clearInterval(watcher);
    if (stopped) {
      await finishStopped(init);
      return;
    }
    await live.close();
    if (e instanceof RetryLater) {
      log(`job ${row.id} ${e.message}; re-queuing`);
      await update(row.id, { ...LIVE_CLEAR, status: "queued", started_at: null });
      await sleep(30_000);
      return;
    }
    const name = (e as Error).name;
    const msg = name === "TimeoutError" || name === "AbortError" ? `timeout after ${RUN_TIMEOUT_MS / 1000}s` : (e as Error).message;
    log(`job ${row.id} failed after ${((Date.now() - t0) / 1000).toFixed(0)}s: ${msg}`);
    await update(row.id, { ...LIVE_CLEAR, status: "failed", error_msg: msg, finished_at: now() });
    return;
  }
  clearInterval(watcher); // the run finished: a late Stop is ignored (cancel_requested_at is cleared below)

  const text = run.text ?? "";
  const base = {
    ...LIVE_CLEAR,
    gateway_session_id: run.session_id ?? req.session_id ?? row.gateway_session_id,
    run_id: run.run_id ?? null,
    cost_usd: nextCost(prevCost, run, req.session_id),
    finished_at: now(),
  };
  const secs = ((Date.now() - t0) / 1000).toFixed(0);
  const result = run.is_error ? null : parseResult(text);

  try {
    if (result?.status === "needs_input") {
      await live.close();
      messages.push({ role: "assistant", text: result.question, ...done(), at: now() });
      await update(row.id, { ...base, status: "needs_input", agent_message: result.question, messages, error_msg: null });
      log(`job ${row.id} needs_input after ${secs}s cost=$${run.cost_usd}`);
      return;
    }
    if (result?.status === "ready") {
      const abs = safeFile(result.path);
      const name = path.basename(abs);
      const mime = MIME[path.extname(name).toLowerCase()] ?? "application/octet-stream";
      const bytes = fs.readFileSync(abs);
      live.step("Mengunggah ke Google Drive…");
      await live.flushNow();
      const up = await gdrive.uploadFile({ folderId: row.folder_id, name, mimeType: mime, bytes });
      await live.close();
      const summary = stripResult(text) || `Dokumen siap: ${name}`;
      messages.push({ role: "assistant", text: summary, ...done(), at: now() });
      const ready = {
        ...base,
        status: "ready",
        name,
        google_file_id: up.id,
        google_modified_at: up.modifiedTime,
        mime_type: mime,
        size_bytes: up.size,
        doc_number: result.doc_number ?? row.doc_number ?? null, // a revision keeps its number
        agent_message: summary,
        messages,
        error_msg: null,
        metadata: { ...(row.metadata ?? {}), title: result.title ?? null, source_path: result.path },
      };
      try {
        // The sync loop may have mirrored the fresh Google file as its own row (source='google') before
        // this update: drop that duplicate so the unique google_file_id can move to the job row.
        await db.from("drive_files").delete().eq("google_file_id", up.id).eq("source", "google");
        await update(row.id, ready);
      } catch (e) {
        await gdrive.deleteFile(up.id).catch(() => {}); // don't leave an orphan in Google Drive
        throw e;
      }
      // Re-generation: the new file replaces the previous one (deleted only once the row points at the new id).
      if (row.google_file_id && row.google_file_id !== up.id) {
        await gdrive
          .deleteFile(row.google_file_id)
          .catch((e) => log(`job ${row.id} old google file ${row.google_file_id} not deleted: ${e.message}`));
      }
      log(`job ${row.id} ready google=${up.id} ${name} doc=${ready.doc_number} (${up.size} B) after ${secs}s cost=$${run.cost_usd}${row.google_file_id ? ` (revision, replaced ${row.google_file_id})` : ""}`);
      return;
    }
    throw new Error(run.is_error ? `agent run error: ${text.slice(0, 500)}` : "agent reply had no valid RESULT line");
  } catch (e) {
    const msg = (e as Error).message;
    log(`job ${row.id} failed after ${secs}s: ${msg}`);
    await live.close();
    await update(row.id, { ...base, status: "failed", error_msg: msg, agent_message: stripResult(text).slice(0, 4000) || null });
  }
}

async function resetStale() {
  const cutoff = new Date(Date.now() - STALE_MINUTES * 60_000).toISOString();
  const { data, error } = await db
    .from("drive_files")
    .update({ ...LIVE_CLEAR, status: "failed", error_msg: `worker: stuck in generating > ${STALE_MINUTES} min`, finished_at: now() })
    .eq("status", "generating")
    .lt("started_at", cutoff)
    .select("id");
  if (error) log(`resetStale error: ${error.message}`);
  else if (data?.length) log(`reset ${data.length} stale job(s): ${data.map((r) => r.id).join(", ")}`);
}

let stopping = false;
let currentJob: string | null = null;
for (const sig of ["SIGTERM", "SIGINT"] as const)
  process.on(sig, async () => {
    if (stopping) return;
    stopping = true;
    log(`${sig} received`);
    await chat?.shutdown();
    if (currentJob) {
      // The in-flight gateway run dies with our connection; don't leave the row stuck in "generating".
      await update(currentJob, { ...LIVE_CLEAR, status: "failed", error_msg: "worker restarted during generation, please retry", finished_at: now() }).catch(
        (e) => log(`could not mark ${currentJob} failed: ${e.message}`),
      );
    }
    process.exit(0);
  });

// Google → dashboard sync (docs/DRIVE.md → "Two-way sync"): its own loop, so it never blocks jobs.
// After every pass the result goes to drive_sync_state (row id=1, shown in the UI header). Between passes the
// loop polls drive_sync_state.sync_requested_at (set by "Sinkronkan sekarang") and syncs early when it
// changed since the start of the last pass (compared by value, so a skewed browser clock does not matter).
async function writeSyncState(patch: Record<string, unknown>) {
  const { error } = await db
    .from("drive_sync_state")
    .upsert({ id: 1, ...patch, updated_at: now() }, { onConflict: "id" });
  if (error) log(`drive_sync_state write: ${error.message}`);
}

async function syncRequestedAt(): Promise<string | null | undefined> {
  const { data, error } = await db.from("drive_sync_state").select("sync_requested_at").eq("id", 1).maybeSingle();
  if (error) return undefined; // unknown: never triggers
  return (data?.sync_requested_at as string | null) ?? null;
}

async function syncLoop() {
  let lastErr = "";
  while (!stopping) {
    const t0 = Date.now();
    const seenRequest = await syncRequestedAt().catch(() => undefined);
    try {
      const s = await gsync.syncOnce();
      if (s.inserted || s.updated || s.deleted || s.foldersCreated || s.mode === "full")
        log(
          `sync ${s.mode}: seen=${s.seen} +${s.inserted} ~${s.updated} -${s.deleted}` +
            (s.foldersCreated ? ` google_folders_created=${s.foldersCreated}` : "") +
            ` in ${Date.now() - t0}ms`,
        );
      lastErr = "";
      await writeSyncState({
        last_sync_at: now(),
        last_sync_summary: `+${s.inserted} ~${s.updated} -${s.deleted}`,
        last_error: null,
        root_folder_id: s.rootFolderId,
      });
    } catch (e) {
      const msg = (e as Error).message;
      if (msg !== lastErr) log(`sync error: ${msg}`); // don't flood the journal with the same error
      lastErr = msg;
      await writeSyncState({ last_error: msg.slice(0, 1000) });
    }
    // Wait for the interval, or less when the UI asks for a sync now.
    const until = t0 + SYNC_MS;
    while (!stopping && Date.now() < until) {
      await sleep(Math.min(SYNC_REQUEST_POLL_MS, Math.max(0, until - Date.now())));
      const req = await syncRequestedAt().catch(() => undefined);
      if (req && seenRequest !== undefined && req !== seenRequest) {
        log("sync requested from the dashboard");
        break;
      }
    }
  }
}

log(`drive-worker up: gateway=${GATEWAY_URL} doc_agent_dir=${DOC_AGENT_DIR} poll=${POLL_MS}ms sync=${SYNC_MS}ms`);
if (SYNC_MS > 0) void syncLoop();
if (chat) void chat.run().catch((e) => log(`chat loop crashed: ${(e as Error).message}`));
else log("chat loop off (no CHAT_GATEWAY_KEY)");
await resetStale();
let lastStaleCheck = Date.now();
while (!stopping) {
  try {
    if (Date.now() - lastStaleCheck > 5 * 60_000) {
      await resetStale();
      lastStaleCheck = Date.now();
    }
    const { data, error } = await db.rpc("claim_drive_job");
    if (error) throw new Error(`claim_drive_job: ${error.message}`);
    const row = (Array.isArray(data) ? data[0] : data) as Row | undefined;
    if (row?.id) {
      currentJob = row.id;
      await processJob(row);
      currentJob = null;
      continue; // look for the next job right away
    }
  } catch (e) {
    log(`loop error: ${(e as Error).message}`);
  }
  await sleep(POLL_MS);
}
process.exit(0);
