-- ============================================================
-- Record Tutorial Video — add a user-supplied title per video.
-- The title is entered before choosing a presenter and can be
-- renamed later from the renders library.
-- ============================================================

alter table tutorial_videos add column title text;
