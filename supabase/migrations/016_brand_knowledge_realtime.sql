-- Enable Supabase Realtime on the knowledge graph tables so the 3D view stays
-- in sync with the database (e.g. when the MCP upserts nodes/edges).
alter publication supabase_realtime add table public.brand_knowledge_nodes;
alter publication supabase_realtime add table public.brand_knowledge_edges;
