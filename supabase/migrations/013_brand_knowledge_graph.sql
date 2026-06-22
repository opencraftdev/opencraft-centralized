-- Brand Knowledge Graph: nodes (entities) + edges (relationships).
-- One knowledge graph per brand. Writes go through the service role
-- (no public write policies); authenticated viewers may read, matching
-- the brand_profile / scraper_leads RLS pattern.

create table if not exists public.brand_knowledge_nodes (
  id          uuid primary key default gen_random_uuid(),
  brand_slug  text not null default 'opencraft',
  type        text not null,                 -- brand | product | service | value | audience | competitor | channel | tone | persona | topic | subtopic | strategy | other
  label       text not null,
  description text,
  props       jsonb not null default '{}'::jsonb,
  color       text,
  icon        text,
  x           double precision,              -- optional fixed 3D position (null => force-layout computes it)
  y           double precision,
  z           double precision,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.brand_knowledge_edges (
  id          uuid primary key default gen_random_uuid(),
  brand_slug  text not null default 'opencraft',
  source_id   uuid not null references public.brand_knowledge_nodes(id) on delete cascade,
  target_id   uuid not null references public.brand_knowledge_nodes(id) on delete cascade,
  relation    text not null,                 -- offers | serves | values | competes_with | uses | targets | publishes_on | has_tone | includes | interested_in | avoids | uses_strategy | related_to ...
  weight      double precision not null default 1,
  props       jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  constraint brand_knowledge_edges_no_self_loop check (source_id <> target_id)
);

create index if not exists brand_knowledge_nodes_brand_idx  on public.brand_knowledge_nodes (brand_slug);
create index if not exists brand_knowledge_nodes_type_idx   on public.brand_knowledge_nodes (brand_slug, type);
create index if not exists brand_knowledge_edges_brand_idx  on public.brand_knowledge_edges (brand_slug);
create index if not exists brand_knowledge_edges_source_idx on public.brand_knowledge_edges (source_id);
create index if not exists brand_knowledge_edges_target_idx on public.brand_knowledge_edges (target_id);

-- keep updated_at fresh on nodes
create or replace function public.set_brand_knowledge_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_brand_knowledge_nodes_updated_at on public.brand_knowledge_nodes;
create trigger trg_brand_knowledge_nodes_updated_at
  before update on public.brand_knowledge_nodes
  for each row execute function public.set_brand_knowledge_updated_at();

-- RLS: authenticated viewers can read; writes via service role only
alter table public.brand_knowledge_nodes enable row level security;
alter table public.brand_knowledge_edges enable row level security;

drop policy if exists "viewers read brand knowledge nodes" on public.brand_knowledge_nodes;
create policy "viewers read brand knowledge nodes" on public.brand_knowledge_nodes
  for select using (auth.uid() is not null);

drop policy if exists "viewers read brand knowledge edges" on public.brand_knowledge_edges;
create policy "viewers read brand knowledge edges" on public.brand_knowledge_edges
  for select using (auth.uid() is not null);

-- Convenience view: one graph payload row per brand for the 3D UI / MCP.
create or replace view public.brand_knowledge_graph as
select
  n.brand_slug,
  (select coalesce(jsonb_agg(jsonb_build_object(
      'id', nn.id, 'type', nn.type, 'label', nn.label,
      'description', nn.description, 'props', nn.props,
      'color', nn.color, 'icon', nn.icon,
      'x', nn.x, 'y', nn.y, 'z', nn.z
   )), '[]'::jsonb)
   from public.brand_knowledge_nodes nn where nn.brand_slug = n.brand_slug) as nodes,
  (select coalesce(jsonb_agg(jsonb_build_object(
      'id', ee.id, 'source', ee.source_id, 'target', ee.target_id,
      'relation', ee.relation, 'weight', ee.weight, 'props', ee.props
   )), '[]'::jsonb)
   from public.brand_knowledge_edges ee where ee.brand_slug = n.brand_slug) as edges
from public.brand_knowledge_nodes n
group by n.brand_slug;

-- ---------------------------------------------------------------------------
-- Seed: OpenCraft brand knowledge graph (sourced from brand_profile).
-- Idempotent — clears and rebuilds the 'opencraft' graph on each run.
-- ---------------------------------------------------------------------------
delete from public.brand_knowledge_nodes where brand_slug = 'opencraft';

insert into public.brand_knowledge_nodes (brand_slug, type, label, description, color, icon) values
('opencraft','brand','OpenCraft','AI news, read like an operator. Senior-led AI transformation.','#6366f1','🛠️'),
('opencraft','value','AI news, read like an operator','Core tagline / positioning.','#ec4899','🎯'),
('opencraft','value','We watch what ships, not what trends','Anti-hype, shipping-first stance.','#ec4899','🚢'),
('opencraft','value','Ship-first ethos','Output close to shipping > smarter model.','#ec4899','⚡'),
('opencraft','value','Senior-led AI transformation','Operator-grade, experience-backed.','#ec4899','🧭'),
('opencraft','value','Strategy → workflow → rollout','The part that survives the workshop.','#ec4899','🔁'),
('opencraft','topic','AI Tooling','AI tooling for builders.','#0ea5e9','🧰'),
('opencraft','topic','AI Adoption','Practical AI adoption for business.','#0ea5e9','📈'),
('opencraft','subtopic','Claude Code & AI coding workflows',null,'#38bdf8','💻'),
('opencraft','subtopic','MCP (Model Context Protocol)',null,'#38bdf8','🔌'),
('opencraft','subtopic','Agentic dev tools',null,'#38bdf8','🤖'),
('opencraft','subtopic','Indie SaaS + AI',null,'#38bdf8','🚀'),
('opencraft','subtopic','Practical AI rollout in teams',null,'#38bdf8','👥'),
('opencraft','subtopic','Workflow-level AI adoption',null,'#38bdf8','🧩'),
('opencraft','subtopic','AI for small/medium business (UMKM)',null,'#38bdf8','🏪'),
('opencraft','subtopic','AI for non-technical founders',null,'#38bdf8','🙌'),
('opencraft','subtopic','ChatGPT/Claude productivity for office work',null,'#38bdf8','📋'),
('opencraft','subtopic','Business automation with AI',null,'#38bdf8','⚙️'),
('opencraft','subtopic','AI marketing & customer service tools',null,'#38bdf8','📣'),
('opencraft','subtopic','How-to / cara pakai AI',null,'#38bdf8','📚'),
('opencraft','anti_topic','AGI debate / philosophy',null,'#ef4444','🚫'),
('opencraft','anti_topic','Crypto / Web3',null,'#ef4444','🚫'),
('opencraft','anti_topic','Politics, religion, sports',null,'#ef4444','🚫'),
('opencraft','anti_topic','AI doomerism',null,'#ef4444','🚫'),
('opencraft','audience','Builders','Developers, technical founders, AI builders shipping with Claude/Cursor/MCP.','#f59e0b','🧑‍💻'),
('opencraft','audience','Business Owners','Non-technical founders, SMB/UMKM owners learning to use AI.','#f59e0b','💼'),
('opencraft','persona','CTOs & tech leads evaluating AI dev tools',null,'#fbbf24','👤'),
('opencraft','persona','Indie hackers shipping with Claude Code / Cursor / MCP',null,'#fbbf24','👤'),
('opencraft','persona','Senior engineers running AI rollout in startups',null,'#fbbf24','👤'),
('opencraft','persona','Product leaders translating AI hype into workflows',null,'#fbbf24','👤'),
('opencraft','persona','UMKM owners exploring AI for marketing / customer service',null,'#fbbf24','👤'),
('opencraft','persona','Non-tech founders asking how to use AI',null,'#fbbf24','👤'),
('opencraft','persona','Office managers automating reports / outreach',null,'#fbbf24','👤'),
('opencraft','persona','Marketing / sales leads adopting AI tools',null,'#fbbf24','👤'),
('opencraft','persona','Service business owners (clinic, restaurant, retail)',null,'#fbbf24','👤'),
('opencraft','channel','Threads — @opencraft.dev',null,'#10b981','🧵'),
('opencraft','channel','Instagram — @opencraft.dev',null,'#10b981','📸'),
('opencraft','channel','X (Twitter) — @opencraftdev',null,'#10b981','🐦'),
('opencraft','tone','Informal Bahasa Indonesia (gw/lo)',null,'#a855f7','🗣️'),
('opencraft','tone','Operator-grade, knowledgeable-friend voice',null,'#a855f7','🤝'),
('opencraft','strategy','Agree & extend',null,'#14b8a6','➕'),
('opencraft','strategy','Concrete example',null,'#14b8a6','🧪'),
('opencraft','strategy','Polite contrarian',null,'#14b8a6','♟️'),
('opencraft','strategy','Translate to outcome',null,'#14b8a6','💡'),
('opencraft','strategy','Ask sharpening question',null,'#14b8a6','❓');

with n as (select label, id from public.brand_knowledge_nodes where brand_slug='opencraft')
insert into public.brand_knowledge_edges (brand_slug, source_id, target_id, relation, weight)
select 'opencraft', s.id, t.id, e.relation, e.weight
from (values
  ('OpenCraft','AI news, read like an operator','values',3),
  ('OpenCraft','We watch what ships, not what trends','values',2),
  ('OpenCraft','Ship-first ethos','values',2),
  ('OpenCraft','Senior-led AI transformation','values',2),
  ('OpenCraft','Strategy → workflow → rollout','values',2),
  ('OpenCraft','AI Tooling','focuses_on',3),
  ('OpenCraft','AI Adoption','focuses_on',3),
  ('AI Tooling','Claude Code & AI coding workflows','includes',2),
  ('AI Tooling','MCP (Model Context Protocol)','includes',2),
  ('AI Tooling','Agentic dev tools','includes',2),
  ('AI Tooling','Indie SaaS + AI','includes',1),
  ('AI Adoption','Practical AI rollout in teams','includes',2),
  ('AI Adoption','Workflow-level AI adoption','includes',2),
  ('AI Adoption','AI for small/medium business (UMKM)','includes',2),
  ('AI Adoption','AI for non-technical founders','includes',2),
  ('AI Adoption','ChatGPT/Claude productivity for office work','includes',1),
  ('AI Adoption','Business automation with AI','includes',1),
  ('AI Adoption','AI marketing & customer service tools','includes',1),
  ('AI Adoption','How-to / cara pakai AI','includes',1),
  ('OpenCraft','AGI debate / philosophy','avoids',1),
  ('OpenCraft','Crypto / Web3','avoids',1),
  ('OpenCraft','Politics, religion, sports','avoids',1),
  ('OpenCraft','AI doomerism','avoids',1),
  ('OpenCraft','Builders','serves',3),
  ('OpenCraft','Business Owners','serves',3),
  ('Builders','CTOs & tech leads evaluating AI dev tools','includes',1),
  ('Builders','Indie hackers shipping with Claude Code / Cursor / MCP','includes',1),
  ('Builders','Senior engineers running AI rollout in startups','includes',1),
  ('Builders','Product leaders translating AI hype into workflows','includes',1),
  ('Business Owners','UMKM owners exploring AI for marketing / customer service','includes',1),
  ('Business Owners','Non-tech founders asking how to use AI','includes',1),
  ('Business Owners','Office managers automating reports / outreach','includes',1),
  ('Business Owners','Marketing / sales leads adopting AI tools','includes',1),
  ('Business Owners','Service business owners (clinic, restaurant, retail)','includes',1),
  ('Builders','AI Tooling','interested_in',2),
  ('Business Owners','AI Adoption','interested_in',2),
  ('OpenCraft','Threads — @opencraft.dev','publishes_on',2),
  ('OpenCraft','Instagram — @opencraft.dev','publishes_on',2),
  ('OpenCraft','X (Twitter) — @opencraftdev','publishes_on',2),
  ('OpenCraft','Informal Bahasa Indonesia (gw/lo)','has_tone',2),
  ('OpenCraft','Operator-grade, knowledgeable-friend voice','has_tone',2),
  ('OpenCraft','Agree & extend','uses_strategy',1),
  ('OpenCraft','Concrete example','uses_strategy',1),
  ('OpenCraft','Polite contrarian','uses_strategy',1),
  ('OpenCraft','Translate to outcome','uses_strategy',1),
  ('OpenCraft','Ask sharpening question','uses_strategy',1)
) as e(src,tgt,relation,weight)
join n s on s.label = e.src
join n t on t.label = e.tgt;
