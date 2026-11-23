# drive-worker

Background worker for `/documents` generation (contract: `docs/DRIVE.md`). Runs on the OpenCraft VPS,
not on Vercel; excluded from the Next.js type-check via `tsconfig.json` `exclude`.

Loop: every 5s `rpc('claim_drive_job')` → build prompt (first run: doc type + request + RESULT protocol;
follow-up: last user message + reminder with `session_id`) → `POST $GATEWAY_URL/v1/runs` (cc-gateway profile
`opencraft-document`, workdir `~/document-agent`) → parse the last `RESULT:` line →
`ready`: upload the file to Google Drive (multipart, into the Google folder of the row's `folder_id`, created
lazily like the web app does; root = `google_drive_auth.root_folder_id`), set `google_file_id`, `mime_type`,
`size_bytes` (a re-generated row's previous Google file is deleted after the row points at the new one) · `needs_input`: store the question ·
anything else: `failed` + `error_msg`. One job at a time. 429 → re-queue after 30s. Rows stuck in
`generating` > 20 min are failed on startup and every 5 min; a job in flight when the worker is stopped is
marked `failed` ("please retry"). `cost_usd` is cumulative across a row's runs.

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
ssh opencraft 'cd ~/drive-worker && ~/.local/bin/bun install --production \
  && cp drive-worker.service ~/.config/systemd/user/ && systemctl --user daemon-reload \
  && systemctl --user enable drive-worker && systemctl --user restart drive-worker'
ssh opencraft 'journalctl --user -u drive-worker -f'     # logs
```

Rotate the gateway key: `cc-gateway key revoke opencraft-document drive-worker`, then
`cc-gateway key create opencraft-document drive-worker` and update `GATEWAY_KEY` in `.env`.
