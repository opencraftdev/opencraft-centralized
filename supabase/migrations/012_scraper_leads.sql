-- ============================================================
-- OpenCraft Centralized — Google Maps Scraper Leads
-- Additive migration for the Scrapers dashboard (/scrapers).
--
-- Stores business leads pulled from Google Maps by the
-- `/scrape` skill in the cold-email-automation repo. Each row is a
-- single business, tagged with one of six business categories.
--
-- Write path: the /scrape skill pushes rows here via the Supabase MCP
-- (service-role — bypasses RLS) after each scrape run. Reads come from
-- the dashboard authenticated role (SELECT only), mirroring the
-- read-only design of 007_finance_expenses.
-- ============================================================

create extension if not exists pgcrypto;                 -- gen_random_uuid()
create extension if not exists moddatetime schema extensions;

create table scraper_leads (
  id            uuid primary key default gen_random_uuid(),
  -- One of the six tracked business categories. Stored as a slug; the
  -- dashboard maps each to a human label (see features/scrapers/data.ts).
  category      text not null
                  check (category in (
                    'kecantikan',     -- Kecantikan (beauty)
                    'wisata',         -- Wisata (tourism)
                    'otomotif',       -- Otomotif (automotive)
                    'akomodasi',      -- Akomodasi (accommodation)
                    'kesehatan',      -- Kesehatan (health)
                    'korean-market'   -- Korean Market
                  )),
  business_name text not null,                 -- Maps "title"
  phone         text,
  website       text,                          -- Maps "web_site"
  email         text,                          -- first of Maps "emails"
  address       text,
  rating        numeric(2,1),                  -- Maps "review_rating" (0.0–5.0)
  reviews       integer,                       -- Maps "review_count"
  latitude      double precision,
  longitude     double precision,              -- Maps "longtitude" [sic]
  maps_url      text,                          -- Maps "link"
  query         text,                          -- the search query used, e.g. "klinik kecantikan in Jakarta"
  location      text,                          -- city / area searched
  scraped_at    timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Dedup key for upserts: same business in the same category/address only once.
-- The /scrape skill inserts with ON CONFLICT to refresh existing leads.
create unique index uniq_scraper_lead
  on scraper_leads (category, lower(business_name), coalesce(address, ''));

-- Category filter + recency, the dashboard's primary access pattern.
create index idx_scraper_leads_category on scraper_leads (category, scraped_at desc);

create trigger handle_updated_at_scraper_leads
  before update on scraper_leads
  for each row execute procedure extensions.moddatetime(updated_at);

-- ── Row-Level Security — dashboard reads, skill writes via service-role ──
alter table scraper_leads enable row level security;

create policy "viewers read scraper leads"
  on scraper_leads for select
  using (auth.uid() is not null);
-- No insert/update/delete policies → the dashboard role cannot write.
-- The service-role key used by the /scrape skill (via Supabase MCP) bypasses RLS.
