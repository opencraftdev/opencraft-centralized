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

Migrations: `supabase/migrations/020_drive.sql`, `021_drive_google.sql`.

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
| `source` | `generated` \| `upload` \| `agent` |
| `status` | `queued` → `generating` → `ready` \| `failed` \| `needs_input` |
| `doc_type` | `sph` \| `mou` \| `deck` \| `other` |
| `prompt text` | the user's original request |
| `messages jsonb` | `[{ "role": "user"\|"assistant", "text": "...", "at": "<iso>" }]` full conversation |
| `agent_message text` | last assistant reply (the question when `needs_input`, the summary when `ready`) |
| `gateway_session_id text` | cc-gateway session to `--resume` for follow-ups |
| `run_id`, `cost_usd`, `doc_number`, `error_msg`, `started_at`, `finished_at` | worker-owned |
| `starred bool`, `trashed_at` | UI-owned |
| `metadata jsonb` | free-form |

RLS: `authenticated` has full access to both tables (the browser reads them and writes DB-only fields:
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
  `SUPABASE_SECRET_KEY`). No new env vars. OAuth scope: `https://www.googleapis.com/auth/drive.file`
  (the app only sees files/folders it created). Access tokens are refreshed and cached in memory.
- **Code**: web `src/lib/google/drive.ts` (server-only, plain fetch to Drive v3), links `src/lib/drive/links.ts`;
  worker `worker/drive-worker/google.ts`.
- **Mirror**: the dashboard is the source of truth; Google Drive mirrors it.
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
  the row is inserted with `google_file_id`, `source='upload'`, `status='ready'`.
- **Preview/download**: the team's browsers are signed in to Google as opencraft.dev, so the preview dialog uses
  `https://drive.google.com/file/d/<id>/preview` (iframe), `https://drive.google.com/file/d/<id>/view` ("Buka di
  Google Drive") and `https://drive.google.com/uc?id=<id>&export=download` ("Download"). Rows without
  `google_file_id` show "File belum tersedia".
- **Worker**: uploads generated files with the same credentials (multipart upload into the folder of
  `drive_files.folder_id`, lazily creating it), sets `google_file_id`, `mime_type`, `size_bytes`.
