-- Applied 2026-11-23. See docs/DRIVE.md → "Chat v2 (live answer, steps, stop)".

-- Live view of the running answer, written by the drive-worker while status = 'generating'; cleared when the run ends
-- (the finished steps move into the assistant message's `steps`).
alter table public.drive_files
  add column run_steps jsonb,              -- [{"label":"Membaca pricelist…","at":"<iso>"}] of the current run
  add column stream_text text,             -- the reply text streamed so far (RESULT line stripped)
  add column cancel_requested_at timestamptz; -- set by the UI "Stop"; the worker stops the run within ~2 s
