# drive-worker

Background worker for `/documents` generation (contract: `docs/DRIVE.md`). Runs on the OpenCraft VPS,
not on Vercel; excluded from the Next.js type-check via `tsconfig.json` `exclude`.

Loop: every 5s `rpc('claim_drive_job')` → build prompt (first run: doc type + request + RESULT protocol;
follow-up: last user message + reminder with `session_id`) → `POST $GATEWAY_URL/v1/runs` with `stream:true`
(cc-gateway profile `opencraft-document`, workdir `~/document-agent`) → parse the last `RESULT:` line of the
final `result` event's text →
`ready`: upload the file to Google Drive (multipart, into the Google folder of the row's `folder_id`, created
lazily like the web app does; root = `google_drive_auth.root_folder_id`), set `google_file_id`, `mime_type`,
`size_bytes` (a re-generated row's previous Google file is deleted after the row points at the new one) · `needs_input`: store the question ·
anything else: `failed` + `error_msg`. One job at a time. 429 → re-queue after 30s. Rows stuck in
`generating` > 20 min are failed on startup and every 5 min; a job in flight when the worker is stopped is
marked `failed` ("please retry"). `cost_usd` is cumulative across a row's runs.

Chat UX (contract `docs/DRIVE.md` → "Chat tab for creating documents"):
- **Progress**: the SSE stream (`init`, `tool {name,input}`, `text`, `result`, `error`) is parsed and tool events are
  mapped to a short Indonesian line in `drive_files.progress` (Read pricelist → "Membaca pricelist…", Write `*.json` →
  "Menyiapkan data dokumen…", `doc_number.py` → "Mengambil/Mencatat nomor dokumen…", `render.tsx` → "Membuat PDF…",
  `render-ppt` → "Membuat slide PPTX…", `polish-deck` → "Membuat gambar slide…", else "Sedang bekerja…"; then
  "Mengunggah ke Google Drive…"). Written with `run_steps`/`stream_text` (see below); cleared (`null`) when the job
  ends. An `error` event fails the job (`session_not_found` → new session with the
  conversation replayed, as for an HTTP 404); a stream that ends without `result`/`error` fails the job ("not retried",
  so a run is never executed twice). The timeout aborts the connection, which stops the run in the gateway.
- **Live answer, steps, stop** (contract `docs/DRIVE.md` → "Chat v2", migration 024): the gateway's `text {text}`
  events are whole assistant text blocks (not token deltas; cc-gateway emits one per text content block), joined with a
  blank line into `stream_text`, with any `RESULT:` line (or a trailing partial `RESULT…` fragment) cut off. Every time
  the progress line changes, `{label, at}` is appended to `run_steps`; `progress` stays = newest label. `progress`,
  `run_steps`, `stream_text` share one throttled writer (at most one write per 1.5 s, latest state wins, only while
  `generating`). When the run ends the steps move into the assistant message (`steps`, `duration_ms`) and
  `run_steps`, `stream_text`, `progress`, `cancel_requested_at` are nulled in the same update that writes the result
  (ready, needs_input, failed, re-queued, stopped, stale reset, shutdown). **Stop**: during a run
  `cancel_requested_at` is polled every 2 s; when set the worker aborts the SSE fetch and calls
  `DELETE $GATEWAY_URL/v1/runs/{run_id}` (run_id from `init`), appends `{role:'assistant', text:<stream_text so far
  or "">, stopped:true, steps, duration_ms, at}` and sets `ready` (row has `google_file_id`) or `needs_input`
  (`agent_message` "Dihentikan."). Never `failed`. A claimed row that already has `cancel_requested_at` is finished as
  stopped without calling the gateway. Logged as `job <id> stop requested` / `DELETE run … → HTTP 200` / `stopped by user`.
- **Formatting**: the first prompt and the follow-up reminder tell the agent to write its reply and the needs_input
  `question` in Markdown (Bahasa Indonesia; short paragraphs, numbered list for several questions, **bold** key
  values, a table for item lists). The RESULT protocol is unchanged (single-line JSON; `\n` escapes inside `question`).
- **Revisions**: a follow-up on a row that already has a Google file (it was `ready`) adds a revision note to the
  prompt: revise the same document (its `tmp/<flat>.json`), re-render, keep `doc_number` (no `doc_number.py next` /
  `record`) unless the user explicitly asks for a new document. The new file replaces the old Google file on the same
  row; `doc_number` falls back to the row's when the RESULT omits it.

Sync status (`docs/DRIVE.md` → "Sync status in the UI"): after every pass the loop writes `drive_sync_state` (id=1):
`last_sync_at`, `last_sync_summary` (`+inserted ~updated -deleted`), `last_error` (null on success, the message on
failure; `last_sync_at` then stays at the last good pass), `root_folder_id`; `google_drive_auth.last_sync_at` is still
stamped by the pass itself. Between passes it reads `sync_requested_at` every 2.5 s and starts a pass early when the
value changed since the start of the last pass ("Sinkronkan sekarang" → sync within ~5 s). Each pass also makes sure
every non-trashed dashboard folder (no trashed ancestor, older than 60 s so the web app's own create isn't raced) has a
Google folder (`ensureFolder`, parents first).

Two-way sync (`sync.ts`, contract `docs/DRIVE.md` → "Two-way sync"): a second loop in the same process, every
`SYNC_MS` (default 30000; `0` disables), never blocks job processing. Mirrors changes made directly in Google Drive
inside "OpenCraft Documents" (`root_folder_id`) into `drive_folders`/`drive_files` via the Drive Changes API
(`google_drive_auth.changes_page_token`, persisted after each page; `last_sync_at`). With no token it does a full
recursive listing first (set the token to null to force a resync). Logs `sync full|changes: seen=… +ins ~upd -del`
when something changed; repeated identical errors are logged once. Requires the Drive token with scope
`https://www.googleapis.com/auth/drive` (`google_drive_auth.scope`). Rows in queued/generating/needs_input/failed
are never touched. Run one pass by hand: `bun -e 'import {createClient} from "@supabase/supabase-js";
import {createGoogleDrive} from "./google.ts"; import {createDriveSync} from "./sync.ts";
const db=createClient(process.env.SUPABASE_URL!,process.env.SUPABASE_SECRET_KEY!);
console.log(await createDriveSync({db,accessToken:createGoogleDrive(db).accessToken,log:console.log}).syncOnce())'`
(with the `.env` loaded).

Google Drive (`google.ts`): OAuth client + refresh token + root folder come from table `google_drive_auth`
(readable only with the service key, i.e. `SUPABASE_SECRET_KEY`); the worker refreshes access tokens itself
and caches them in memory until expiry. Google's `modifiedTime` from uploads/folder creation is stored as
`google_modified_at` so the sync sees the worker's own changes as no-ops. No extra env vars (`SYNC_MS` optional).

## Server layout

| what | where |
|---|---|
| code | `~/drive-worker/{worker.ts,google.ts,sync.ts,package.json}` |
| env (chmod 600) | `~/drive-worker/.env`: `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `GATEWAY_URL=http://127.0.0.1:8788`, `GATEWAY_KEY` (cc-gateway key `drive-worker`), `DOC_AGENT_DIR=/home/opencraft/document-agent` |
| service | `~/.config/systemd/user/drive-worker.service` (copy of `drive-worker.service`) |
| gateway | `cc-gateway@opencraft-document` (API-only, 127.0.0.1:8788) |

## Deploy / operate

```bash
rsync -a worker.ts google.ts sync.ts package.json drive-worker.service opencraft:~/drive-worker/
ssh opencraft 'cd ~/drive-worker && ~/.bun/bin/bun install --production \
  && cp drive-worker.service ~/.config/systemd/user/ && systemctl --user daemon-reload \
  && systemctl --user enable drive-worker && systemctl --user restart drive-worker'
ssh opencraft 'journalctl --user -u drive-worker -f'     # logs
```

Note: the server's `bun.lock` has `lockfileVersion: 2`, which the service's bun (`~/.local/bin/bun`, 1.3.x) cannot
parse (`UnknownLockfileVersion`); run the install with `~/.bun/bin/bun install --production` (1.4.x) instead. The
service itself still runs `~/.local/bin/bun worker.ts`. Progress lines per tool call are logged as
`job <id> tool <Name>: <input> → <line>`.

Rotate the gateway key: `cc-gateway key revoke opencraft-document drive-worker`, then
`cc-gateway key create opencraft-document drive-worker` and update `GATEWAY_KEY` in `.env`.
