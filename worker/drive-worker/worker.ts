// drive-worker — claims queued drive_files jobs, runs them through the cc-gateway
// "opencraft-document" profile (POST /v1/runs) and uploads the result to Google Drive.
// Contract: docs/DRIVE.md. Runs on the OpenCraft VPS under systemd (logs → journald).
import { createClient } from "@supabase/supabase-js";
import { createGoogleDrive } from "./google.ts";
import { createDriveSync } from "./sync.ts";
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

const db = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const gdrive = createGoogleDrive(db);
const gsync = createDriveSync({ db, accessToken: gdrive.accessToken, log: (...a) => log(...a) });

type Msg = { role: "user" | "assistant"; text: string; at: string };
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
  metadata: Record<string, unknown> | null;
};
type RunResp = { run_id?: string; text?: string; session_id?: string; cost_usd?: number; is_error?: boolean };
type Result =
  | { status: "ready"; path: string; doc_number?: string; title?: string }
  | { status: "needs_input"; question: string };

const log = (...a: unknown[]) => console.log(new Date().toISOString(), ...a);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const now = () => new Date().toISOString();

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
RESULT: {"status":"needs_input","question":"<pertanyaan untuk user, Bahasa Indonesia>"}
"path" is relative to ${DOC_AGENT_DIR}. Write the reply text before the RESULT line in Bahasa Indonesia (short summary).`;

const REMINDER = `\n\n(Reminder: still non-interactive from the web UI. Do not guess missing data or prices. End with exactly one line: RESULT: {"status":"ready","path":...,"doc_number":...,"title":...} or RESULT: {"status":"needs_input","question":"..."})`;

function buildPrompt(row: Row): { prompt: string; session_id?: string } {
  const msgs = row.messages ?? [];
  const userMsgs = msgs.filter((m) => m.role === "user");
  const last = userMsgs.at(-1)?.text ?? row.prompt ?? "";
  if (row.gateway_session_id) return { prompt: last + REMINDER, session_id: row.gateway_session_id };
  const type = DOC_LABEL[row.doc_type ?? "other"] ?? row.doc_type;
  let body = `Buat dokumen: ${type}.\n\nPermintaan user:\n${row.prompt ?? last}`;
  if (msgs.length > 1) {
    // No session to resume (e.g. lost) → replay the conversation so far.
    body += `\n\nPercakapan sejauh ini:\n` + msgs.map((m) => `${m.role === "user" ? "User" : "Agent"}: ${m.text}`).join("\n");
    body += `\n\nLanjutkan berdasarkan pesan User terakhir.`;
  }
  return { prompt: body + "\n" + PROTOCOL };
}

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

const MIME: Record<string, string> = {
  ".pdf": "application/pdf",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".csv": "text/csv",
  ".md": "text/markdown",
  ".txt": "text/plain",
};

// Resolve an agent-reported path; refuse anything outside DOC_AGENT_DIR (incl. via symlinks).
function safeFile(p: string): string {
  const abs = fs.realpathSync(path.resolve(DOC_AGENT_DIR, p));
  if (!abs.startsWith(DOC_AGENT_DIR + path.sep)) throw new Error(`path escapes document-agent dir: ${p}`);
  if (!fs.statSync(abs).isFile()) throw new Error(`not a file: ${p}`);
  return abs;
}

class RetryLater extends Error {}

async function callGateway(body: { prompt: string; session_id?: string }): Promise<RunResp> {
  const res = await fetch(`${GATEWAY_URL}/v1/runs`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${GATEWAY_KEY}` },
    body: JSON.stringify({ ...body, stream: false }),
    signal: AbortSignal.timeout(RUN_TIMEOUT_MS),
    timeout: false, // Bun: disable the default fetch timeout; AbortSignal handles it
  } as RequestInit);
  const text = await res.text();
  if (res.status === 429) throw new RetryLater("gateway busy (429)");
  if (!res.ok) {
    const err: Error & { status?: number } = new Error(`gateway HTTP ${res.status}: ${text.slice(0, 500)}`);
    err.status = res.status;
    throw err;
  }
  return JSON.parse(text) as RunResp;
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
  try {
    try {
      run = await callGateway(req);
    } catch (e) {
      // Session gone (gateway reset / other key) → start fresh with the full conversation replayed.
      if ((e as { status?: number }).status === 404 && req.session_id) {
        log(`job ${row.id} session ${req.session_id} not found, starting a new session`);
        req = buildPrompt({ ...row, gateway_session_id: null });
        run = await callGateway(req);
      } else throw e;
    }
  } catch (e) {
    if (e instanceof RetryLater) {
      log(`job ${row.id} ${e.message}; re-queuing`);
      await update(row.id, { status: "queued", started_at: null });
      await sleep(30_000);
      return;
    }
    const msg = (e as Error).name === "TimeoutError" ? `timeout after ${RUN_TIMEOUT_MS / 1000}s` : (e as Error).message;
    log(`job ${row.id} failed: ${msg}`);
    await update(row.id, { status: "failed", error_msg: msg, finished_at: now() });
    return;
  }

  const text = run.text ?? "";
  const base = {
    gateway_session_id: run.session_id ?? req.session_id ?? row.gateway_session_id,
    run_id: run.run_id ?? null,
    cost_usd: +(prevCost + (run.cost_usd ?? 0)).toFixed(6),
    finished_at: now(),
  };
  const secs = ((Date.now() - t0) / 1000).toFixed(0);
  const result = run.is_error ? null : parseResult(text);

  try {
    if (result?.status === "needs_input") {
      messages.push({ role: "assistant", text: result.question, at: now() });
      await update(row.id, { ...base, status: "needs_input", agent_message: result.question, messages, error_msg: null });
      log(`job ${row.id} needs_input after ${secs}s cost=$${run.cost_usd}`);
      return;
    }
    if (result?.status === "ready") {
      const abs = safeFile(result.path);
      const name = path.basename(abs);
      const mime = MIME[path.extname(name).toLowerCase()] ?? "application/octet-stream";
      const bytes = fs.readFileSync(abs);
      const up = await gdrive.uploadFile({ folderId: row.folder_id, name, mimeType: mime, bytes });
      const summary = stripResult(text) || `Dokumen siap: ${name}`;
      messages.push({ role: "assistant", text: summary, at: now() });
      const ready = {
        ...base,
        status: "ready",
        name,
        google_file_id: up.id,
        google_modified_at: up.modifiedTime,
        mime_type: mime,
        size_bytes: up.size,
        doc_number: result.doc_number ?? null,
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
      log(`job ${row.id} ready google=${up.id} ${name} (${up.size} B) after ${secs}s cost=$${run.cost_usd}`);
      return;
    }
    throw new Error(run.is_error ? `agent run error: ${text.slice(0, 500)}` : "agent reply had no valid RESULT line");
  } catch (e) {
    const msg = (e as Error).message;
    log(`job ${row.id} failed after ${secs}s: ${msg}`);
    await update(row.id, { ...base, status: "failed", error_msg: msg, agent_message: stripResult(text).slice(0, 4000) || null });
  }
}

async function resetStale() {
  const cutoff = new Date(Date.now() - STALE_MINUTES * 60_000).toISOString();
  const { data, error } = await db
    .from("drive_files")
    .update({ status: "failed", error_msg: `worker: stuck in generating > ${STALE_MINUTES} min`, finished_at: now() })
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
    if (currentJob) {
      // The in-flight gateway run dies with our connection; don't leave the row stuck in "generating".
      await update(currentJob, { status: "failed", error_msg: "worker restarted during generation, please retry", finished_at: now() }).catch(
        (e) => log(`could not mark ${currentJob} failed: ${e.message}`),
      );
    }
    process.exit(0);
  });

// Google → dashboard sync (docs/DRIVE.md → "Two-way sync"): its own loop, so it never blocks jobs.
async function syncLoop() {
  let lastErr = "";
  while (!stopping) {
    try {
      const t0 = Date.now();
      const s = await gsync.syncOnce();
      if (s.inserted || s.updated || s.deleted || s.mode === "full")
        log(`sync ${s.mode}: seen=${s.seen} +${s.inserted} ~${s.updated} -${s.deleted} in ${Date.now() - t0}ms`);
      lastErr = "";
    } catch (e) {
      const msg = (e as Error).message;
      if (msg !== lastErr) log(`sync error: ${msg}`); // don't flood the journal with the same error
      lastErr = msg;
    }
    await sleep(SYNC_MS);
  }
}

log(`drive-worker up: gateway=${GATEWAY_URL} doc_agent_dir=${DOC_AGENT_DIR} poll=${POLL_MS}ms sync=${SYNC_MS}ms`);
if (SYNC_MS > 0) void syncLoop();
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
