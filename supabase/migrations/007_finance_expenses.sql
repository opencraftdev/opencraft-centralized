-- ============================================================
-- OpenCraft Centralized — Finance / Expenses
-- Additive migration for the Finance dashboard (/finance).
--
-- Stores the company's recurring operating expenses. Each row is a
-- line item whose `amount` is normalised to a MONTHLY figure in whole
-- rupiah (yearly costs are pre-divided by 12), so SUM(amount) over the
-- active rows is the monthly burn — currently Rp 2.500.000.
--
-- Payment status is intentionally NOT stored: the cycle resets every
-- month, so the dashboard derives Paid/Pending from where today sits
-- relative to each item's billing_day (see features/finance/data.ts).
--
-- Consistent with the read-only design (same shape as 005_news_briefs):
--   * Dashboard role (authenticated) — SELECT only.
--   * All writes happen via the service-role key (the finance MCP agent,
--     coming later — bypasses RLS).
-- ============================================================

create extension if not exists pgcrypto;                 -- gen_random_uuid()
create extension if not exists moddatetime schema extensions;

create table finance_expenses (
  id          uuid primary key default gen_random_uuid(),
  item        text not null,                 -- "Vercel Pro hosting"
  vendor      text not null,                 -- "Vercel"
  category    text not null
                check (category in ('infrastructure','ai-tools','software','office','marketing')),
  frequency   text not null
                check (frequency in ('monthly','yearly','one-time')),
  amount      bigint not null check (amount >= 0),  -- normalised MONTHLY cost, whole IDR
  billing_day smallint not null check (billing_day between 1 and 28),
  active      boolean not null default true, -- soft-delete / pause without losing history
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Active expenses, cheapest sort for the table view.
create index idx_finance_expenses_active on finance_expenses(active, amount desc);

create trigger handle_updated_at_finance_expenses
  before update on finance_expenses
  for each row execute procedure extensions.moddatetime(updated_at);

-- ── Row-Level Security — dashboard reads, agent writes via service-role ──
alter table finance_expenses enable row level security;

create policy "viewers read finance expenses"
  on finance_expenses for select
  using (auth.uid() is not null);
-- No insert/update/delete policies → the dashboard role cannot write.
-- The service-role key used by the finance MCP agent bypasses RLS.

-- ── Seed: current monthly operating expenses (sum = Rp 2.500.000) ──
insert into finance_expenses (item, vendor, category, frequency, amount, billing_day) values
  ('Supabase Pro',       'Supabase',   'infrastructure', 'monthly', 400000,  1),
  ('Office internet',    'Biznet',     'office',         'monthly', 400000,  5),
  ('Vercel Pro hosting', 'Vercel',     'infrastructure', 'monthly', 320000,  3),
  ('Claude subscription','Anthropic',  'ai-tools',       'monthly', 320000,  8),
  ('Social automation',  'Blotato',    'marketing',      'monthly', 290000, 12),
  ('Media CDN',          'Cloudinary', 'infrastructure', 'monthly', 240000,  6),
  ('Google Workspace',   'Google',     'software',       'monthly', 180000,  1),
  ('Utilities & misc',   'Various',    'office',         'monthly', 170000, 20),
  ('Canva Pro',          'Canva',      'software',       'yearly',  130000, 15),
  ('Domains & DNS',      'Cloudflare', 'infrastructure', 'yearly',   50000, 22);
