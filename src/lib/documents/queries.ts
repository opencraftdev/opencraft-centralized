import type { SupabaseClient } from "@supabase/supabase-js";
import { presignS3GetUrl } from "@/lib/s3";
import type {
  AgentStatusRow,
  AgentDocumentRow,
  DocumentHistoryItem,
} from "@/lib/documents/types";

export async function getAgentBySlug(
  supabase: SupabaseClient,
  slug: string,
): Promise<AgentStatusRow | null> {
  const { data, error } = await supabase
    .from("agent_status")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return (data as AgentStatusRow | null) ?? null;
}


// ── Document history (Document Agent) ───────────────────────

const LINK_TTL = 3600; // 1 hour — long enough for an open dashboard tab

function basename(p: string): string {
  const parts = p.split("/");
  return parts[parts.length - 1] || p;
}

// Resolves view (inline) + download (forced) links for a document, preferring a
// presigned S3 GET, then a stored file_url, then a Supabase Storage signed URL.
async function resolveLinks(
  supabase: SupabaseClient,
  doc: AgentDocumentRow,
): Promise<{ viewUrl: string | null; downloadUrl: string | null }> {
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
    const store = supabase.storage.from(doc.storage_bucket);
    const [view, dl] = await Promise.all([
      store.createSignedUrl(doc.storage_path, LINK_TTL),
      store.createSignedUrl(doc.storage_path, LINK_TTL, { download: true }),
    ]);
    if (view.data?.signedUrl) {
      return {
        viewUrl: view.data.signedUrl,
        downloadUrl: dl.data?.signedUrl ?? view.data.signedUrl,
      };
    }
  }
  return { viewUrl: null, downloadUrl: null };
}

export async function getDocuments(
  supabase: SupabaseClient,
  agentId: number,
  limit = 50,
): Promise<DocumentHistoryItem[]> {
  const { data, error } = await supabase
    .from("agent_documents")
    .select("*")
    .eq("agent_id", agentId)
    .order("generated_at", { ascending: false })
    .limit(limit);
  if (error) throw error;

  const docs = (data ?? []) as AgentDocumentRow[];
  return Promise.all(
    docs.map(async (doc) => ({
      ...doc,
      ...(await resolveLinks(supabase, doc)),
    })),
  );
}

