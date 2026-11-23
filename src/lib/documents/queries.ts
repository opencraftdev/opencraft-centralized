import type { SupabaseClient } from "@supabase/supabase-js";
import { presignS3GetUrl } from "@/lib/s3";
import type { AgentDocumentRow } from "@/lib/documents/types";

// Legacy Document Agent docs (agent_documents) are still served from S3. Drive rows point at them
// via drive_files.legacy_document_id; these helpers resolve their view/download links.

const LINK_TTL = 3600; // 1 hour — long enough for an open dashboard tab

export interface DocLinks {
  viewUrl: string | null; // opens inline (in-browser)
  downloadUrl: string | null; // forces a file download
}

function basename(p: string): string {
  const parts = p.split("/");
  return parts[parts.length - 1] || p;
}

// Prefers a presigned S3 GET, then a stored file_url, then a Supabase Storage signed URL.
async function resolveLinks(supabase: SupabaseClient, doc: AgentDocumentRow): Promise<DocLinks> {
  if (doc.s3_bucket && doc.s3_key) {
    const region = doc.s3_region ?? undefined;
    const filename = basename(doc.s3_key);
    const viewUrl = presignS3GetUrl({ bucket: doc.s3_bucket, key: doc.s3_key, region, expiresIn: LINK_TTL });
    const downloadUrl = presignS3GetUrl({
      bucket: doc.s3_bucket,
      key: doc.s3_key,
      region,
      expiresIn: LINK_TTL,
      downloadFilename: filename,
    });
    if (viewUrl) return { viewUrl, downloadUrl: downloadUrl ?? viewUrl };
  }
  if (doc.file_url) return { viewUrl: doc.file_url, downloadUrl: doc.file_url };
  if (doc.storage_bucket && doc.storage_path) {
    return signStorage(supabase, doc.storage_bucket, doc.storage_path);
  }
  return { viewUrl: null, downloadUrl: null };
}

// Signed inline + download URLs for a Supabase Storage object.
export async function signStorage(
  supabase: SupabaseClient,
  bucket: string,
  path: string,
  downloadName?: string,
): Promise<DocLinks> {
  const store = supabase.storage.from(bucket);
  const [view, dl] = await Promise.all([
    store.createSignedUrl(path, LINK_TTL),
    store.createSignedUrl(path, LINK_TTL, { download: downloadName ?? true }),
  ]);
  const viewUrl = view.data?.signedUrl ?? null;
  return { viewUrl, downloadUrl: dl.data?.signedUrl ?? viewUrl };
}

export async function getLegacyLinks(supabase: SupabaseClient, documentId: number): Promise<DocLinks> {
  const { data, error } = await supabase
    .from("agent_documents")
    .select("*")
    .eq("id", documentId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return { viewUrl: null, downloadUrl: null };
  return resolveLinks(supabase, data as AgentDocumentRow);
}
