-- Task Management: project emoji + logo, member profile photo. Contract: docs/TASKS.md.
-- Safe to run more than once. Images are drive_files rows (Google Drive, folder "Task Management").
alter table public.task_projects add column if not exists emoji text not null default '';
alter table public.task_projects add column if not exists logo_file_id uuid references public.drive_files(id) on delete set null;
alter table public.task_members add column if not exists photo_file_id uuid references public.drive_files(id) on delete set null;
