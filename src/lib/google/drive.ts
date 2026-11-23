// Google Drive v3 REST client for the dashboard Drive (server-only: reads OAuth creds with the
// service-role client). Contract: docs/DRIVE.md → "Storage: Google Drive". Plain fetch, no googleapis.
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

const API = "https://www.googleapis.com/drive/v3";
const UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";
const FOLDER_MIME = "application/vnd.google-apps.folder";

export class GoogleDriveError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
  }
}

type GoogleMeta = { id: string; modifiedTime?: string };

type Auth = { client_id: string; client_secret: string; refresh_token: string; root_folder_id: string | null };

let tokenCache: { refreshToken: string; token: string; expiresAt: number } | null = null;

const admin = (): SupabaseClient => createAdminClient();

async function loadAuth(db: SupabaseClient): Promise<Auth> {
  const { data, error } = await db
    .from("google_drive_auth")
    .select("client_id, client_secret, refresh_token, root_folder_id")
    .eq("id", 1)
    .maybeSingle();
  if (error) throw new GoogleDriveError(`google_drive_auth: ${error.message}`);
  if (!data) throw new GoogleDriveError("Google Drive belum terhubung (google_drive_auth kosong)");
  return data as Auth;
}

async function accessToken(db: SupabaseClient): Promise<string> {
  const auth = await loadAuth(db);
  if (tokenCache && tokenCache.refreshToken === auth.refresh_token && tokenCache.expiresAt > Date.now() + 60_000) {
    return tokenCache.token;
  }
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: auth.client_id,
      client_secret: auth.client_secret,
      refresh_token: auth.refresh_token,
    }),
    cache: "no-store",
  });
  const j = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error?: string };
  if (!res.ok || !j.access_token) throw new GoogleDriveError(`Google token: ${j.error ?? res.status}`, res.status);
  tokenCache = {
    refreshToken: auth.refresh_token,
    token: j.access_token,
    expiresAt: Date.now() + (j.expires_in ?? 3600) * 1000,
  };
  return j.access_token;
}

async function gfetch(url: string, init: RequestInit & { db?: SupabaseClient } = {}): Promise<Response> {
  const { db = admin(), ...rest } = init;
  const token = await accessToken(db);
  const headers = new Headers(rest.headers);
  headers.set("authorization", `Bearer ${token}`);
  return fetch(url, { ...rest, headers, cache: "no-store" });
}

async function fail(res: Response, what: string): Promise<never> {
  const text = await res.text().catch(() => "");
  let msg = text.slice(0, 300);
  try {
    msg = (JSON.parse(text) as { error?: { message?: string } }).error?.message ?? msg;
  } catch {}
  throw new GoogleDriveError(`Google Drive ${what}: ${res.status} ${msg}`, res.status);
}

export async function rootFolderId(db: SupabaseClient = admin()): Promise<string> {
  const { root_folder_id } = await loadAuth(db);
  if (!root_folder_id) throw new GoogleDriveError("Google Drive root folder belum diset (google_drive_auth.root_folder_id)");
  return root_folder_id;
}

async function createGoogleFolder(name: string, parentId: string, db: SupabaseClient): Promise<GoogleMeta> {
  const res = await gfetch(`${API}/files?fields=id,modifiedTime`, {
    db,
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name, mimeType: FOLDER_MIME, parents: [parentId] }),
  });
  if (!res.ok) await fail(res, "create folder");
  return (await res.json()) as GoogleMeta;
}

// Google folder for a dashboard folder (null = root). Creates missing folders lazily, parents first,
// and persists drive_folders.google_folder_id (+ google_modified_at, so the sync echo is a no-op).
// A concurrent creator wins via the `is null` guard; the worker's sync may also have adopted our new
// Google folder for this row already (same id → fine).
export async function ensureFolder(driveFolderId: string | null, db: SupabaseClient = admin(), depth = 0): Promise<string> {
  if (!driveFolderId) return rootFolderId(db);
  if (depth > 32) throw new GoogleDriveError("folder tree too deep / cyclic");
  const { data: folder, error } = await db
    .from("drive_folders")
    .select("id, name, parent_id, google_folder_id")
    .eq("id", driveFolderId)
    .maybeSingle();
  if (error) throw new GoogleDriveError(`drive_folders: ${error.message}`);
  if (!folder) throw new GoogleDriveError("Folder tidak ditemukan");
  if (folder.google_folder_id) return folder.google_folder_id as string;

  const parent = await ensureFolder(folder.parent_id as string | null, db, depth + 1);
  const { id: created, modifiedTime } = await createGoogleFolder(folder.name as string, parent, db);
  const { data: won, error: upErr } = await db
    .from("drive_folders")
    .update({ google_folder_id: created, google_modified_at: modifiedTime ?? null })
    .eq("id", driveFolderId)
    .is("google_folder_id", null)
    .select("google_folder_id");
  if (upErr || !won?.length) {
    const { data: now } = await db.from("drive_folders").select("google_folder_id").eq("id", driveFolderId).maybeSingle();
    if (now?.google_folder_id === created) return created; // adopted by the sync
    await deleteFile(created, db).catch(() => {});
    if (upErr) throw new GoogleDriveError(`drive_folders: ${upErr.message}`);
    return ensureFolder(driveFolderId, db, depth + 1); // someone else created it first
  }
  return created;
}

// Resumable upload session in `parentId`. `origin` = the browser's origin, so Google answers the
// browser's cross-origin PUT to the returned session URL with CORS headers.
export async function createResumableUpload(args: {
  name: string;
  mimeType: string;
  parentId: string;
  origin: string;
  size?: number;
}): Promise<string> {
  const headers: Record<string, string> = {
    "content-type": "application/json; charset=UTF-8",
    "x-upload-content-type": args.mimeType,
    origin: args.origin,
  };
  if (args.size != null) headers["x-upload-content-length"] = String(args.size);
  const res = await gfetch(`${UPLOAD_API}/files?uploadType=resumable&fields=id,name,mimeType,size,modifiedTime`, {
    method: "POST",
    headers,
    body: JSON.stringify({ name: args.name, mimeType: args.mimeType, parents: [args.parentId] }),
  });
  if (!res.ok) await fail(res, "create upload session");
  const url = res.headers.get("location");
  if (!url) throw new GoogleDriveError("Google Drive upload session: no Location header");
  return url;
}

export async function getParents(id: string, db: SupabaseClient = admin()): Promise<string[]> {
  const res = await gfetch(`${API}/files/${encodeURIComponent(id)}?fields=parents`, { db });
  if (!res.ok) await fail(res, "get file");
  return ((await res.json()) as { parents?: string[] }).parents ?? [];
}

// Returns Google's modifiedTime after the change; callers store it as google_modified_at so the
// worker's sync sees the echo of this change as a no-op.
export async function updateFile(
  id: string,
  patch: { name?: string; addParents?: string[]; removeParents?: string[]; trashed?: boolean },
  db: SupabaseClient = admin(),
): Promise<string | null> {
  const qs = new URLSearchParams({ fields: "id,modifiedTime" });
  if (patch.addParents?.length) qs.set("addParents", patch.addParents.join(","));
  if (patch.removeParents?.length) qs.set("removeParents", patch.removeParents.join(","));
  const body: Record<string, unknown> = {};
  if (patch.name !== undefined) body.name = patch.name;
  if (patch.trashed !== undefined) body.trashed = patch.trashed;
  const res = await gfetch(`${API}/files/${encodeURIComponent(id)}?${qs}`, {
    db,
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) await fail(res, "update");
  return ((await res.json()) as GoogleMeta).modifiedTime ?? null;
}

// Move a file/folder so `newParent` is its only parent. Returns the old parents and the new modifiedTime.
export async function moveFile(
  id: string,
  newParent: string,
  db: SupabaseClient = admin(),
): Promise<{ oldParents: string[]; modifiedTime: string | null }> {
  const old = await getParents(id, db);
  const remove = old.filter((p) => p !== newParent);
  let modifiedTime: string | null = null;
  if (remove.length || !old.includes(newParent)) {
    modifiedTime = await updateFile(id, { addParents: old.includes(newParent) ? [] : [newParent], removeParents: remove }, db);
  }
  return { oldParents: old, modifiedTime };
}

// Permanent delete (a folder takes its contents with it). Already gone (404) counts as success.
export async function deleteFile(id: string, db: SupabaseClient = admin()): Promise<void> {
  const res = await gfetch(`${API}/files/${encodeURIComponent(id)}`, { db, method: "DELETE" });
  if (res.ok || res.status === 404) return;
  await fail(res, "delete");
}

// ---- file content (preview / download proxy, docs/DRIVE.md → "Preview without a Google session") ----

const GOOGLE_NATIVE = "application/vnd.google-apps.";
// Office files the browser cannot render: converted to the Google-native type, exported as PDF.
const CONVERT_FOR_PREVIEW: Record<string, string> = {
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "application/vnd.google-apps.document",
  "application/msword": "application/vnd.google-apps.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "application/vnd.google-apps.presentation",
  "application/vnd.ms-powerpoint": "application/vnd.google-apps.presentation",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "application/vnd.google-apps.spreadsheet",
  "application/vnd.ms-excel": "application/vnd.google-apps.spreadsheet",
};

export const isGoogleNative = (mime: string | null | undefined) => !!mime?.startsWith(GOOGLE_NATIVE);
export const canConvertForPreview = (mime: string | null | undefined) => !!mime && mime in CONVERT_FOR_PREVIEW;

export async function getMeta(id: string, db: SupabaseClient = admin()): Promise<{ name: string; mimeType: string }> {
  const res = await gfetch(`${API}/files/${encodeURIComponent(id)}?fields=name,mimeType`, { db });
  if (!res.ok) await fail(res, "get file");
  return (await res.json()) as { name: string; mimeType: string };
}

async function exportPdf(id: string, db: SupabaseClient): Promise<Response> {
  const res = await gfetch(`${API}/files/${encodeURIComponent(id)}/export?mimeType=application%2Fpdf`, { db });
  if (!res.ok) await fail(res, "export");
  return res;
}

// Raw Google response with the file bytes (body streamed by the caller).
//  - Google-native (Docs/Sheets/Slides…) → exported as PDF
//  - `asPdf` + Office file → temporary converted copy (outside the synced folder), exported, deleted
//  - anything else → alt=media (Range forwarded)
export async function openContent(
  id: string,
  opts: { mimeType: string; asPdf?: boolean; range?: string | null },
  db: SupabaseClient = admin(),
): Promise<{ res: Response; pdf: boolean }> {
  if (isGoogleNative(opts.mimeType)) return { res: await exportPdf(id, db), pdf: true };
  if (opts.asPdf && canConvertForPreview(opts.mimeType)) {
    const copy = await gfetch(`${API}/files/${encodeURIComponent(id)}/copy?fields=id`, {
      db,
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: `preview-tmp-${id}`, mimeType: CONVERT_FOR_PREVIEW[opts.mimeType] }),
    });
    if (!copy.ok) await fail(copy, "convert");
    const tmp = ((await copy.json()) as GoogleMeta).id;
    try {
      const res = await exportPdf(tmp, db);
      // Buffer so the temporary copy can be deleted before we answer.
      const buf = await res.arrayBuffer();
      return { res: new Response(buf, { headers: { "content-type": "application/pdf" } }), pdf: true };
    } finally {
      await deleteFile(tmp, db).catch(() => {});
    }
  }
  const headers: Record<string, string> = {};
  if (opts.range) headers.range = opts.range;
  const res = await gfetch(`${API}/files/${encodeURIComponent(id)}?alt=media`, { db, headers });
  if (!res.ok && res.status !== 206) await fail(res, "download");
  return { res, pdf: false };
}
