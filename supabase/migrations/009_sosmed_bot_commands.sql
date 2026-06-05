-- Widen bot_commands table to support sosmed worker commands.
-- The comment-bot worker is unaffected: it filters by platform IN ('threads','x','all').

-- Expand command values
ALTER TABLE bot_commands DROP CONSTRAINT bot_commands_command_check;
ALTER TABLE bot_commands ADD CONSTRAINT bot_commands_command_check
  CHECK (command IN ('scrape','post_approved','draft','generate','publish','suggest','approve','reset'));

-- Expand platform values
ALTER TABLE bot_commands DROP CONSTRAINT bot_commands_platform_check;
ALTER TABLE bot_commands ADD CONSTRAINT bot_commands_platform_check
  CHECK (platform IN ('threads','x','all','engage','educate','video'));

-- Expand status values
ALTER TABLE bot_commands DROP CONSTRAINT bot_commands_status_check;
ALTER TABLE bot_commands ADD CONSTRAINT bot_commands_status_check
  CHECK (status IN ('pending','running','done','failed','processing','completed'));

-- Add user_id (nullable — existing comment-bot inserts don't set it)
ALTER TABLE bot_commands ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);

-- Add log_text for video pipeline live log
ALTER TABLE bot_commands ADD COLUMN IF NOT EXISTS log_text text;
