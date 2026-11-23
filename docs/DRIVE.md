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
                     worker uploads file to Storage bucket "drive", updates drive_files {status:'ready'}
Browser polls drive_files every ~4s while any item is queued/generating ◄──┘
```

Nothing on the server is exposed to the internet: the worker only makes outbound calls to Supabase
and loopback calls to cc-gateway.

## Database (Supabase project `wdzmuniyqqyngzckeoph`)

Migration: `supabase/migrations/020_drive.sql`.

### `drive_folders`
`id uuid`, `name`, `parent_id uuid null` (null = root, cascade delete), `starred bool`,
`trashed_at timestamptz null`, `created_by uuid`, `created_at`, `updated_at`.
Seeded root folders: **SPH**, **MoU**, **Deck**.

### `drive_files`
| column | notes |
|---|---|
| `id uuid` | |
| `folder_id uuid null` | null = root ("My Drive") |
| `name text` | display name incl. extension |
| `mime_type`, `size_bytes` | |
| `storage_path text null` | object path in private bucket **`drive`**, convention `<file id>/<filename>` |
| `legacy_document_id bigint null` | old Document Agent rows served from S3; resolve links with `getLegacyLinks()` (existing `resolveLinks` in `src/lib/documents/queries.ts`) |
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

RLS: `authenticated` has full access to both tables and to storage objects in bucket `drive`.

### Job lifecycle

1. **Create (UI):** insert `drive_files` with `source='generated'`, `status='queued'`, `doc_type`,
   `prompt`, `messages=[{role:'user', text: prompt, at}]`, `name` = placeholder like
   `"SPH — <first words of prompt>"`, `folder_id` = current folder, or the doc_type folder when at root.
2. **Claim (worker):** `select * from claim_drive_job()` (service role only) → row flips to `generating`.
3. **Run (worker):** `POST http://127.0.0.1:<port>/v1/runs` with `{prompt, session_id?, stream:false}`.
   - First run: prompt = the user's request + the RESULT protocol below.
   - Follow-up (row has `gateway_session_id`): send only the last user message + RESULT reminder, with `session_id`.
4. **Finish (worker):** parse the last `RESULT:` line of the reply.
   - `ready` → upload file to `drive/<id>/<basename>`, set `status='ready'`, `name`=basename,
     `storage_path`, `mime_type`, `size_bytes`, `doc_number`, `agent_message`, append assistant message.
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
