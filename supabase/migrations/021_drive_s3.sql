-- Drive storage moved from Supabase Storage to AWS S3 (drive_files.storage_path = S3 key "drive/<id>/<name>").
-- The 3 imported Document Agent SPH files were re-uploaded to S3 from the VPS copies, so the
-- legacy link to agent_documents is no longer needed. The empty Supabase bucket "drive" is removed via
-- the Storage API.
drop policy if exists drive_objects_auth_select on storage.objects;
drop policy if exists drive_objects_auth_insert on storage.objects;
drop policy if exists drive_objects_auth_update on storage.objects;
drop policy if exists drive_objects_auth_delete on storage.objects;
alter table public.drive_files drop column if exists legacy_document_id;
