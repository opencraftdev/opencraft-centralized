-- Add 'publishing' to content_posts.status — intermediate state the sosmed
-- bot atomically transitions a row into during its claim → publish window,
-- so two workers can't pick up the same scheduled post.

-- IMPORTANT: Constraint name matches Postgres auto-generated name from
-- 001_initial_schema.sql. If altered manually, verify first:
--   SELECT conname FROM pg_constraint
--   WHERE conrelid = 'content_posts'::regclass AND contype = 'c';

ALTER TABLE content_posts DROP CONSTRAINT content_posts_status_check;
ALTER TABLE content_posts ADD CONSTRAINT content_posts_status_check
  CHECK (status IN ('draft','accepted','scheduled','publishing','published','failed'));
