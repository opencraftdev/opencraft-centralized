# Drive (Documents) — contract

`/documents` is a Google-Drive style file manager. Users browse folders, upload files, and
**generate** business documents (SPH, MoU, Deck) with Claude running on the OpenCraft server.

```
Browser (/documents) ──insert drive_files {status:'queued'}──► Supabase
                                                                  │  poll (claim_drive_job)
                                     opencraft VPS: drive-worker ◄┘
                                          │ POST /v1/runs (127.0.0.1, cc-gateway profile "opencraft-document",
                                          │                 workdir ~/document-agent)
                                          ▼
                                     claude -p renders PDF/PPTX in ~/document-agent/documents/...
                                          │
                     worker uploads file to Google Drive, updates drive_files {status:'ready', google_file_id}
Browser polls drive_files every ~4s while any item is queued/generating ◄──┘
```

Files live in **Google Drive** (account `opencraft.dev@gmail.com`, see "Storage: Google Drive" below).
Nothing on the server is exposed to the internet: the worker only makes outbound calls to Supabase and
Google, and loopback calls to cc-gateway.

## Database (Supabase project `wdzmuniyqqyngzckeoph`)

Migrations: `supabase/migrations/020_drive.sql`, `021_drive_google.sql`, `022_google_login_allowlist_and_sync.sql`.

### `drive_folders`
`id uuid`, `name`, `parent_id uuid null` (null = root, cascade delete), `starred bool`,
`trashed_at timestamptz null`, `google_folder_id text null` (unique; null = not created in Google yet),
`created_by uuid`, `created_at`, `updated_at`.
Seeded root folders: **SPH**, **MoU**, **Deck**.

### `drive_files`
| column | notes |
|---|---|
| `id uuid` | |
| `folder_id uuid null` | null = root ("My Drive") |
| `name text` | display name incl. extension |
| `mime_type`, `size_bytes` | |
| `google_file_id text null` | the file in Google Drive (unique). Null while a job is not ready, or for a row whose file is not in Google |
| `storage_path`, `legacy_document_id` | **deprecated, unused** (old Supabase Storage / S3 links); dropped at cutover by `021_drive_google.sql` part 2 |
| `source` | `generated` \| `upload` \| `agent` \| `google` (created directly in Google Drive, mirrored by the sync) |
| `google_modified_at` | Google `modifiedTime` last written/seen (also on `drive_folders`); see "Two-way sync" |
| `status` | `queued` → `generating` → `ready` \| `failed` \| `needs_input` |
| `doc_type` | `sph` \| `mou` \| `deck` \| `other` |
| `prompt text` | the user's original request |
| `messages jsonb` | `[{ "role": "user"\|"assistant", "text": "...", "at": "<iso>" }]` full conversation |
| `agent_message text` | last assistant reply (the question when `needs_input`, the summary when `ready`) |
| `gateway_session_id text` | cc-gateway session to `--resume` for follow-ups |
| `run_id`, `cost_usd`, `doc_number`, `error_msg`, `started_at`, `finished_at` | worker-owned |
| `starred bool`, `trashed_at` | UI-owned |
| `metadata jsonb` | free-form |

RLS: allow-listed users (`is_allowed_user()`, migration 022) have full access to both tables (the browser reads them and writes DB-only fields:
`starred`, generation-job fields). Anything that changes Google Drive goes through the server routes below.

### Job lifecycle

1. **Create (UI):** insert `drive_files` with `source='generated'`, `status='queued'`, `doc_type`,
   `prompt`, `messages=[{role:'user', text: prompt, at}]`, `name` = placeholder like
   `"SPH — <first words of prompt>"`, `folder_id` = current folder, or the doc_type folder when at root.
2. **Claim (worker):** `select * from claim_drive_job()` (service role only) → row flips to `generating`.
3. **Run (worker):** `POST http://127.0.0.1:<port>/v1/runs` with `{prompt, session_id?, stream:false}`.
   - First run: prompt = the user's request + the RESULT protocol below.
   - Follow-up (row has `gateway_session_id`): send only the last user message + RESULT reminder, with `session_id`.
4. **Finish (worker):** parse the last `RESULT:` line of the reply.
   - `ready` → upload the file to Google Drive (folder of `folder_id`), set `status='ready'`, `name`=basename,
     `google_file_id`, `mime_type`, `size_bytes`, `doc_number`, `agent_message`, append assistant message.
     A re-generated row's previous Google file is deleted.
   - `needs_input` → `status='needs_input'`, `agent_message`=question, append assistant message.
   - anything else / errors / timeout → `status='failed'`, `error_msg`.
   Always store `gateway_session_id`, `run_id`, `cost_usd`, `finished_at`.
5. **Reply (UI):** when `needs_input`, the user answers → append `{role:'user'}` message,
   set `status='queued'` (worker resumes the same session).
6. **Retry (UI):** on `failed`, set `status='queued'` again.

### RESULT protocol (appended to every prompt by the worker)

The agent must end its reply with exactly one line:

```
RESULT: {"status":"ready","path":"documents/sph/001_SPH-OC_2026.pdf","doc_number":"001/SPH-OC/2026","title":"SPH PT Contoh"}
RESULT: {"status":"needs_input","question":"Harga paket X belum ada di pricelist. Berapa harganya?"}
```

`path` is relative to `~/document-agent`. Decks: the draft→polish confirmation step is a
`needs_input` round trip.

## Storage: Google Drive (account `opencraft.dev@gmail.com`)

All Drive files are stored in Google Drive (migration `021_drive_google.sql`). Supabase Storage (bucket `drive`)
and the legacy S3 links are no longer used.

- **Credentials**: table `public.google_drive_auth` (single row `id=1`): `client_id`, `client_secret`,
  `refresh_token`, `root_folder_id`, `account_email`. RLS on with no policies: readable only with the
  service role (`createAdminClient()` on Vercel — `SUPABASE_SERVICE_ROLE_KEY`; the worker's
  `SUPABASE_SECRET_KEY`). No new env vars. OAuth scope: `https://www.googleapis.com/auth/drive` since
  migration 022 (recorded in `google_drive_auth.scope`; was `drive.file`). Access tokens are refreshed and cached in memory.
- **Code**: web `src/lib/google/drive.ts` (server-only, plain fetch to Drive v3), links `src/lib/drive/links.ts`;
  worker `worker/drive-worker/google.ts`.
- **Mirror**: dashboard changes are applied to Google Drive (below); changes made directly in Google Drive come
  back through the worker's sync ("Two-way sync").
  - Root folder "OpenCraft Documents" (`root_folder_id`) = "Drive Saya". `drive_folders.google_folder_id` maps
    each dashboard folder to a Google folder (parent = parent's google folder, or root). Folders are created
    lazily (`ensureFolder`) when something is put in them or they are created/moved; a concurrent creator loses
    via an `is null` guarded update and deletes its duplicate.
  - `drive_files.google_file_id` = the Google file.

| dashboard action | route | Google Drive |
|---|---|---|
| new folder | `POST /api/drive/items {op:"createFolder"}` | `files.create` folder (row is removed again if Google fails) |
| upload | `POST /api/drive/upload` → browser `PUT` → browser inserts row | resumable upload session in the folder's Google folder |
| rename | `{op:"rename"}` | `files.update {name}` |
| move | `{op:"move"}` | `files.update addParents/removeParents` |
| trash / restore | `{op:"trash"}` / `{op:"restore"}` | `files.update {trashed:true/false}` (a folder carries its contents) |
| permanent delete | `{op:"delete"}` | `files.delete` (files of the subtree, then the folder); 404 = already gone |
| star, generate, reply, retry | browser → Supabase directly | — (DB only) |

  `/api/drive/items` changes Google first, then the DB; if the DB write fails the Google change is reverted
  (best effort). Items without a Google id are DB-only. `{op:"discardUpload"}` deletes an uploaded Google file
  whose row insert failed (refused if a row references it).
- **Upload (browser)**: the server creates a resumable upload session (passing the browser `Origin` header so Google
  allows CORS) and returns `uploadUrl`; the browser PUTs the file there; Google returns the file JSON (`id`, `size`);
  the row is inserted with `google_file_id`, `google_modified_at`, `source='upload'`, `status='ready'` (if the sync
  already mirrored the new file as a `source='google'` row, that row is taken over instead).
- **Preview/download**: through our server, see "Preview without a Google session". "Buka di Google Drive" links to
  `https://drive.google.com/file/d/<id>/view`. Rows without `google_file_id` show "File belum tersedia".
- **Worker**: uploads generated files with the same credentials (multipart upload into the folder of
  `drive_files.folder_id`, lazily creating it), sets `google_file_id`, `google_modified_at`, `mime_type`, `size_bytes`
  (a `source='google'` duplicate the sync may have created for the fresh file is deleted first).

## Login: Google only, allow-listed accounts

- Supabase Auth Google provider (OAuth "Web application" client in GCP project `opencraft-internal`,
  redirect `https://wdzmuniyqqyngzckeoph.supabase.co/auth/v1/callback`, scopes openid/email/profile).
- `public.app_allowed_emails` (service role only) = the allowlist, currently `opencraft.dev@gmail.com`.
  `public.is_allowed_user()` checks the JWT email; **all app RLS policies use it** (migration 022).
- `public.hook_before_user_created(event)` — Supabase "Before User Created" auth hook rejecting other emails.
- App: `/login` shows only "Masuk dengan Google" (`signInWithOAuth({provider:'google', redirectTo:
  <origin>/auth/callback, queryParams:{prompt:'select_account'}})`). `src/app/auth/callback/route.ts` exchanges the
  code, then calls `is_allowed_user()`; not allowed → `signOut()` + `/login?error=not_allowed`. Provider errors (e.g.
  the hook's rejection) → `/login?error=not_allowed|auth_failed`; the login page maps the codes (query or `#error=`
  fragment) to Indonesian messages.
- Middleware (`src/middleware.ts` → `src/lib/supabase/middleware.ts`): public = `/privacy`, `/login`, `/auth/callback`.
  No session → redirect `/login` (API: 401 JSON). Signed in → `is_allowed_user()` verdict cached per email for 60 s
  per server instance; not allowed → `signOut()` (refresh token revoked, cookies cleared) + `/login?error=not_allowed`
  (API: 403 JSON). An RPC error lets the request through uncached (RLS still guards the data).
  Note: before this change the middleware lived at the repo root and was never loaded (Next only picks up
  `src/middleware.ts` when `src/` exists); pages were guarded only by `getUser()` in the layouts.
- Route handlers that use the service-role client (`/api/drive/*`) check the allowlist themselves, failing closed
  (`requireAllowedUser()` in `src/lib/auth/allowed.ts`).

## Preview without a Google session

`GET /api/drive/files/:id/content[?download=1]` (`src/app/api/drive/files/[id]/content/route.ts`, allow-listed users
only) looks up the row's `google_file_id` and streams `files.get?alt=media` with the server token (Range forwarded).
- Google-native Docs/Sheets/Slides (`application/vnd.google-apps.*`) → `files.export` as PDF (inline and download).
- Inline preview of Office files (docx/pptx/xlsx/doc/ppt/xls, e.g. generated Decks) → temporary converted copy
  (`files.copy` to the Google-native type, in My Drive root, outside the synced folder) → exported PDF → copy
  deleted. Takes a few seconds. `?download=1` always returns the original bytes.
- Headers: `Content-Type`, `Content-Disposition: inline|attachment` with an ASCII `filename` + RFC 5987 `filename*`
  (extension added when the display name lacks it, e.g. `.pdf`), `Cache-Control: private, no-store`, `nosniff`.
  Types outside pdf/images/video/audio/plain text/csv get `Content-Security-Policy: sandbox` (uploaded HTML/SVG are inert).
- The preview dialog iframes it for previewable types (browser-native + Google-native + Office) with a loading state;
  other types show "Pratinjau tidak tersedia untuk jenis file ini". Download buttons use `?download=1`.
  "Buka di Google Drive" still links to drive.google.com.

## Two-way sync of "OpenCraft Documents" (scope `drive`)

The OAuth scope is upgraded from `drive.file` to `https://www.googleapis.com/auth/drive` (new refresh token in
`google_drive_auth`, `scope` column records it) so changes made directly in Google Drive are visible.

- Code: `worker/drive-worker/sync.ts` (`createDriveSync().syncOnce()`), run by `worker.ts` in its own loop every
  `SYNC_MS` (default 30 s, `0` = off), independent of job processing; errors are logged (deduplicated) and retried.
- The **worker** (VPS) runs the sync loop every ~30 s using the Drive Changes API:
  `changes.getStartPageToken` / `changes.list` with `google_drive_auth.changes_page_token` (persisted after each
  page, `last_sync_at` stamped) with `includeRemoved`, `fields` incl. parents, trashed, explicitlyTrashed, trashedTime,
  modifiedTime, mimeType, size, name. When `changes_page_token` is null the pass is a **full sync**: take a start page
  token first, list the root subtree recursively (`'<id>' in parents`, trashed included), mirror everything, delete
  mirrored rows whose Google item was not listed (only rows created before the listing started), then store the token.
  Reset `changes_page_token` to null to force a full resync.
- Only items inside the root subtree (`root_folder_id`) are mirrored; an item whose parent chain leaves the
  subtree is treated as removed from the dashboard (row deleted, Google untouched). Membership is checked by walking
  the parent chain (batch items → DB folder mirror → `files.get`, cached per batch). A folder leaving the subtree
  removes its whole dashboard subtree; a folder moving in is listed so its contents appear too.
  Note: Google restores an untrashed item whose parent is still trashed to My Drive root, i.e. outside the subtree.
- Google → dashboard: new folder → `drive_folders` row (`google_folder_id`); new file → `drive_files` row
  (`source='google'`, `status='ready'`, name, mime, size, folder); rename/move → update; trashed → set
  `trashed_at` (Google `trashedTime`); untrashed → clear it; permanently deleted / gone → delete row.
  Trash state = `explicitlyTrashed` (a trashed folder carries its contents, as in the dashboard). Parent folders are
  resolved/created before their children. Google-native Docs/Sheets/Slides are files (size may be null);
  shortcuts are ignored. A new Google folder with the same name and parent as a dashboard folder that has no Google
  folder yet (e.g. seeded MoU/Deck, or one the web app is creating this instant) adopts that row.
- Loop safety: compare against the current row and skip no-ops. Parent and trash state are always compared. Google
  bumps `modifiedTime` on rename/content changes but not on move/trash, so name/mime/size are only taken from Google
  when its `modifiedTime` is newer than the row's `google_modified_at` (rows from before the sync, with
  `google_modified_at` null, compare against `updated_at`, so e.g. the SPH rows keep their names without ".pdf").
  The web app (`/api/drive/items`, upload, `ensureFolder`) and the worker store Google's `modifiedTime` after their own
  changes, so the echo arrives as a no-op.
- Generated files in `queued/generating/needs_input/failed` state are never touched by the sync.

## Sync status in the UI (migration 023)

`public.drive_sync_state` (single row id=1, readable by allowed users): `root_folder_id`, `last_sync_at`,
`last_sync_summary`, `last_error`, `sync_requested_at` (the only column the UI may update).
- Worker writes `last_sync_at` / `last_sync_summary` / `last_error` after every sync pass (and keeps
  `google_drive_auth.last_sync_at` too). If `sync_requested_at` > `last_sync_at`, the worker syncs within ~5 s
  instead of waiting for the 30 s interval.
- Worker makes sure **every** non-trashed dashboard folder has a Google folder on each pass (eager, not lazy),
  so the folder tree in Google always matches the dashboard.
- UI header shows "Tersinkron dengan Google Drive · <relative time>" (or the error), a "Sinkronkan sekarang"
  button (sets `sync_requested_at = now()`, then refreshes), and "Buka di Google Drive" for the current folder
  (`https://drive.google.com/drive/folders/<google_folder_id or root_folder_id>`).

## Chat tab for creating documents

A generated document **is** a conversation: one `drive_files` row with `source='generated'`, its `messages`
thread, `status`, `agent_message`, and new column `progress` (live step text while the agent works).

- UI: a **"Chat Dokumen"** view in the Drive nav (`?view=chat`, `&c=<file id>` selects a conversation).
  Left: conversation list (generated rows, newest first, status badge). Right: chat thread (user/assistant
  bubbles from `messages`), typing indicator + `progress` while `queued`/`generating`, the file card when `ready`
  (preview / Buka di Google Drive / Download), error + "Coba lagi" when `failed`, composer at the bottom.
  "+ Baru → Generate dokumen" opens a new chat (optional doc-type chips SPH / MoU / Deck / Lainnya; the first
  message creates the row exactly like before). The old Generate dialog is replaced by this.
- Sending a message on an existing conversation (any status except `queued`/`generating`) appends
  `{role:'user'}` and sets `status='queued'`. This covers answering `needs_input` **and revising a `ready`
  document** ("ganti harga jadi …").
- Worker: follow-ups resume the gateway session. For a revision of a ready document the prompt tells the agent to
  re-render the same document and **keep its document number** (no `doc_number.py next`, no new record) unless the
  user explicitly asks for a new document; the new file replaces the old Google file on the same row.
- Worker streams the gateway run (`/v1/runs` with `stream:true`, SSE events `tool`/`text`/`result`) and writes a
  short Indonesian `progress` line (e.g. "Membaca pricelist…", "Menyiapkan data…", "Membuat PDF…") at most every
  ~2 s; clears it when the run ends.
