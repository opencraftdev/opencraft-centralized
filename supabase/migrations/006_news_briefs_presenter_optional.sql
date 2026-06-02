-- AI News Brief: the presenter is now chosen in the Record Video UI at record
-- time, not baked into the brief. Make the presenter columns optional so a brief
-- can be presenter-neutral content (script + caption + thumbnail only).
alter table public.news_briefs alter column presenter_id   drop not null;
alter table public.news_briefs alter column presenter_name drop not null;
