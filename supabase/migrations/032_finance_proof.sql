-- Finance proof (docs/FINANCE.md): an optional image (receipt / transfer screenshot) per entry. The image is a
-- drive_files row in the Drive folder "Finance" (or a picture attached in /chat).
alter table public.finance_entries
  add column if not exists proof_file_id uuid references public.drive_files (id) on delete set null;
