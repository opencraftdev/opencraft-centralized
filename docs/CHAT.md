# Chat + Skills

A general AI chat (like trina-ax's Trina chat) at **`/chat`**, and a **`/skills`** page to manage the skills that
chat uses. Separate from `/documents` (the Drive). Migration `025_chat_and_skills.sql` (applied). The chat UI reuses
the Chat v2 behaviour from `docs/DRIVE.md` → "Chat v2" (Markdown answers, live steps + streamed text, Stop, folded
steps, copy), with the app's existing MUI look.

Reference: trina-ax `web/src/components/chat/{Messages,Steps,Composer,QueuedMessages,SkillMenu}.tsx`,
`web/src/pages/{Chat,Skills}.tsx`, `docs/site/id/use/team-skills.md`.

## Data (Supabase `wdzmuniyqqyngzckeoph`, RLS: `is_allowed_user()`)

> Since migration 029: chats are per person (`owner_email`) and can be shared (`chat_members`). See
> [ACCOUNTS.md](ACCOUNTS.md).

- `skills` — `name` (slug, folder name and `/name`), `title`, `description` (one sentence: when to use it),
  `body` (SKILL.md Markdown), `enabled`, `updated_at`. Seeded with `opencraft-document` (SPH / MoU / Deck).
- `chats` — `title`, `status` `idle|queued|running|failed`, `session_id` (cc-gateway session), `consumed_at`,
  live `run_steps` / `stream_text` / `started_at`, `cancel_requested_at`, `error_msg`, `cost_usd`, `pinned`,
  `trashed_at`, `updated_at`.
- `chat_messages` — `role` `user|assistant`, `content` (Markdown), `steps` `[{label, at}]`, `duration_ms`,
  `stopped`, `error`, `attachments` `[{file_id, name, mime_type}]` (ids of `drive_files`), `created_at`.
- `drive_files.source = 'chat'` + `chat_id` + `chat_path`: files the agent attached; they live in Google Drive like
  every other file and show in `/documents`.
- RPC `chat_send(p_chat_id uuid|null, p_content text) → uuid`: creates the chat when null (title = first 60 chars,
  without a leading `/skill`), inserts the user message, sets `status='queued'` unless a run is `running`.
- RPC `claim_chat_run()` (service role): oldest `queued` chat → `running`, `started_at=now()`.

## Run lifecycle (worker)

1. Claim. The input = all user messages with `created_at > consumed_at` (all, when null), joined with a blank line;
   set `consumed_at` = the newest of them. Messages sent while the run goes stay unconsumed → **server-side queue**.
2. A leading `/name` of an enabled skill is rewritten to `Use the skill "name" (Skill tool) for this request.\n\n…`.
3. `POST /v1/runs` (stream) on the **`opencraft-chat`** gateway profile, resuming `session_id` (first run: none; store
   the one from `init`). `session_not_found` → new session, replay the last ~20 messages as a transcript.
4. Live: `run_steps` (Indonesian step labels from tool events, same mapping as the drive worker plus generic ones:
   "Membaca file…", "Menjalankan perintah…", "Mencari di web…", "Memakai skill <name>…"), `stream_text` (text so far,
   `ATTACH:` lines cut, a partial `ATTACH…`/`RESULT…` tail too). ≤ 1 write / 1.5 s.
5. End: insert the assistant message (`content` = final text without `ATTACH:` lines, `steps`, `duration_ms`,
   `attachments`), null the live columns + `cancel_requested_at`, add `cost_usd`, `updated_at=now()`. Then
   `status = 'queued'` if there are user messages newer than `consumed_at`, else `idle`.
6. Failure: assistant message with `error` (short text), chat `status='failed'`, `error_msg`. Sending again re-queues.
7. Stop (`cancel_requested_at`, polled every 2 s): `DELETE /v1/runs/{id}` + abort; assistant message
   `{content: text so far, stopped: true, steps, duration_ms}`; status `idle` (messages still pending stay pending
   until the user sends again — they are shown as "belum terkirim" with "Kirim sekarang", which re-queues the chat:
   `update chats set status='queued'`). A still-`queued` chat is stopped by the UI itself (status → `idle`).

### Attachments

The agent attaches a file with one line per file at the end of its reply:
`ATTACH: {"path":"/abs/path/file.pdf","folder":"SPH","doc_number":"004/SPH-OC/2026"}` (`folder`, `doc_number`
optional). The worker uploads it to Google Drive: into the dashboard folder named `folder` under the root (created if
missing), default folder **"Chat"**; creates a `drive_files` row (`source='chat'`, `chat_id`, `chat_path`, `status
'ready'`, `doc_number`, `doc_type` from the folder SPH/MoU/Deck). The same `chat_path` attached again in the same chat
replaces that row's Google file (revision keeps the row). Only paths under `/home/opencraft/` are accepted.

### Skills sync

The worker mirrors enabled `skills` into `~/opencraft-chat/.claude/skills/<name>/SKILL.md`
(`---\nname: <name>\ndescription: <description>\n---\n\n<body>`) before every run when any `updated_at` changed (and
every 30 s), and removes folders of deleted/disabled skills (only folders it manages: marker file `.managed-by-dashboard`).

### Gateway profile `opencraft-chat`

cc-gateway profile like `opencraft-document`, API-only on `127.0.0.1:8789`, workdir `/home/opencraft/opencraft-chat`
(with a `CLAUDE.md`: OpenCraft's internal assistant, answer in Bahasa Indonesia, Markdown, attach files with the ATTACH
protocol, never touch other projects' folders unless a skill says so), API key `chat-worker`. Runs in the same
`drive-worker` process (second loop; env `CHAT_GATEWAY_URL`, `CHAT_GATEWAY_KEY`, `CHAT_WORKDIR`).

## UI

### `/chat` (sidebar item "Chat", first)

- Look: Google Gemini's web chat in its light theme (sidebar `#F0F4F9`, white main card, pill composer, `#0B57D0`
  accents).
- Left: chat list (pinned first, then `updated_at` desc), "Chat baru", search by title (toggled by the search icon),
  row menu: Ganti nama / Sematkan / Hapus (`trashed_at`). Single-line titles. Status dot while queued/running, red when
  failed. Desktop: the column can be collapsed (remembered in localStorage). Mobile: the list is a drawer opened from
  the thread's top bar; `/chat` shows a new chat.
- Empty new chat: centered greeting ("Mulai dari mana?"), the composer, and the enabled skills as suggestion rows
  under it (click → composer gets `/name `).
- Thread: user bubbles; answers as Markdown in the column (no bubble) with copy, folded "N langkah · X dtk", time (on
  hover);
  attachments as file cards (Pratinjau via `/api/drive/files/:id/content`, Buka di Google Drive, Download — same as
  the Drive file card); failed answer → error line + "Coba lagi" (re-queue: `status='queued'`, and the last user
  message is resent by setting `consumed_at` back to just before it).
- Running: live steps (last 3, spinner) + elapsed time + streamed Markdown; "Menunggu giliran…" while queued.
  User messages newer than `consumed_at` while running show under the answer as "Menunggu jawaban selesai".
- Composer: auto-grow, Enter / Shift+Enter, IME-safe, draft per chat (localStorage). `/` at the start (or the "+"
  button) opens the skill menu (filter as you type, ↑↓ Enter, shows title + description); picked → `/name ` chip-like
  prefix. While running: Stop button; Enter still sends (server queue). A disclaimer line sits under it in a thread.
- URL: `/chat` (new), `/chat/<id>`; `/chat?skill=<name>` starts a new chat with `/name ` prefilled.

### `/skills` (sidebar item "Skills")

- List of skills: title, `/name`, description, enabled switch, updated time. "+ Skill baru".
- Editor (dialog or side page): Nama (`name`, slug, validated, immutable after create is fine), Judul, Deskripsi
  (one sentence, "kapan AI memakai skill ini"), Instruksi (Markdown textarea with a Preview tab), Aktif. Save / Hapus
  (confirm). Note under the form: changes reach the chat agent within ~30 s.

### `/documents`

- Remove the "Chat Dokumen" view from the Drive nav. "+ Baru → Generate dokumen" goes to
  `/chat?skill=opencraft-document`. Old generated rows stay files in the Drive (their old conversation view is gone).
