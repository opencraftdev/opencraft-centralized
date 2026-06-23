-- ============================================================
-- OpenCraft Centralized — scraper_leads "verified" sign-off
-- Additive migration for the Scrapers dashboard (/scrapers).
--
-- Adds a human sign-off layer on top of the automated `validation_status`
-- written by the `/validate` skill. The dashboard's Scrapers view shows a
-- per-lead checklist button; clicking it sets `verified` + `verified_at`.
--
-- Write path: the dashboard role is SELECT-only on scraper_leads (see 012),
-- so the toggle persists via the service-role admin client in the
-- `setLeadVerified` server action (features/scrapers/actions.ts), which
-- bypasses RLS — no new write policy is needed.
-- ============================================================

alter table scraper_leads
  add column if not exists verified    boolean not null default false,
  add column if not exists verified_at timestamptz;

comment on column scraper_leads.verified is
  'Human sign-off in the dashboard Scrapers view (checklist button), on top of the automated validation_status set by /validate.';
comment on column scraper_leads.verified_at is
  'When the lead was marked verified in the dashboard (null if not verified).';
