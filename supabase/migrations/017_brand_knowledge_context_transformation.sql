-- Add context: OpenCraft = AI Transformation di Indonesia, membantu perusahaan &
-- bisnis menengah scale dengan AI — lewat dua dimensi: Development & Use Case.
-- Additive + idempotent (clears these specific labels first; edges cascade).

delete from public.brand_knowledge_nodes
where brand_slug = 'opencraft'
  and label in (
    'Bantu perusahaan & bisnis menengah scale dengan AI',
    'Development — bangun & engineering AI',
    'Use Case — penerapan AI di operasional nyata',
    'Perusahaan & bisnis menengah',
    'Indonesia'
  );

insert into public.brand_knowledge_nodes (brand_slug, type, label, description, color, icon) values
('opencraft','positioning','Bantu perusahaan & bisnis menengah scale dengan AI','Misi inti: membantu perusahaan dan bisnis menengah di Indonesia berkembang dengan AI.','#f43f5e','🚀'),
('opencraft','pendekatan','Development — bangun & engineering AI','Membangun & meng-engineer sistem AI: agent, RAG, workflow, integrasi.','#eab308','🧰'),
('opencraft','pendekatan','Use Case — penerapan AI di operasional nyata','Menerapkan AI ke use case operasional nyata sehari-hari, bukan sekadar demo.','#eab308','🎯'),
('opencraft','audiens','Perusahaan & bisnis menengah','Perusahaan dan bisnis menengah (SMB) yang ingin scale dengan AI.','#f97316','🏬'),
('opencraft','pasar','Indonesia','Pasar utama OpenCraft — berbasis di Bandung, Indonesia.','#06b6d4','🇮🇩');

with n as (select label, id from public.brand_knowledge_nodes where brand_slug='opencraft')
insert into public.brand_knowledge_edges (brand_slug, source_id, target_id, relation, weight)
select 'opencraft', s.id, t.id, e.relation, e.weight
from (values
  ('OpenCraft','Bantu perusahaan & bisnis menengah scale dengan AI','diposisikan sebagai',3),
  ('OpenCraft','Development — bangun & engineering AI','melalui pendekatan',3),
  ('OpenCraft','Use Case — penerapan AI di operasional nyata','melalui pendekatan',3),
  ('OpenCraft','Perusahaan & bisnis menengah','melayani',3),
  ('OpenCraft','Indonesia','beroperasi di',2),
  ('Development — bangun & engineering AI','LangGraph','mencakup',1),
  ('Development — bangun & engineering AI','LangChain','mencakup',1),
  ('Development — bangun & engineering AI','RAG Systems','mencakup',1),
  ('Development — bangun & engineering AI','OpenAI','mencakup',1),
  ('Use Case — penerapan AI di operasional nyata','Otomasi Customer Service','mencakup',1),
  ('Use Case — penerapan AI di operasional nyata','Internal Knowledge AI','mencakup',1),
  ('Use Case — penerapan AI di operasional nyata','Otomasi Content Creator','mencakup',1),
  ('Perusahaan & bisnis menengah','AI Transformation','tertarik pada',2),
  ('Perusahaan & bisnis menengah','Use Case — penerapan AI di operasional nyata','butuh',1),
  ('Perusahaan & bisnis menengah','Indonesia','berada di',1),
  ('Startup & bisnis Indonesia','Indonesia','berada di',1)
) as e(src,tgt,relation,weight)
join n s on s.label = e.src
join n t on t.label = e.tgt;
