// Google Drive v3 REST client for the dashboard Drive (server-only: reads OAuth creds with the
// service-role client). Contract: docs/DRIVE.md → "Storage: Google Drive". Plain fetch, no googleapis.
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

export { drivePreviewUrl, driveViewUrl, driveDownloadUrl } from "@/lib/drive/links";

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

async function createGoogleFolder(name: string, parentId: string, db: SupabaseClient): Promise<string> {
  const res = await gfetch(`${API}/files?fields=id`, {
    db,
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name, mimeType: FOLDER_MIME, parents: [parentId] }),
  });
  if (!res.ok) await fail(res, "create folder");
  return ((await res.json()) as { id: string }).id;
}

// Google folder for a dashboard folder (null = root). Creates missing folders lazily, parents first,
// and persists drive_folders.google_folder_id. A concurrent creator wins via the `is null` guard.
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
  const created = await createGoogleFolder(folder.name as string, parent, db);
  const { data: won, error: upErr } = await db
    .from("drive_folders")
    .update({ google_folder_id: created })
    .eq("id", driveFolderId)
    .is("google_folder_id", null)
    .select("google_folder_id");
  if (upErr || !won?.length) {
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
  const res = await gfetch(`${UPLOAD_API}/files?uploadType=resumable&fields=id,name,mimeType,size`, {
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

export async function updateFile(
  id: string,
  patch: { name?: string; addParents?: string[]; removeParents?: string[]; trashed?: boolean },
  db: SupabaseClient = admin(),
): Promise<void> {
  const qs = new URLSearchParams({ fields: "id" });
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
}

// Move a file/folder so `newParent` is its only parent.
export async function moveFile(id: string, newParent: string, db: SupabaseClient = admin()): Promise<string[]> {
  const old = await getParents(id, db);
  const remove = old.filter((p) => p !== newParent);
  if (remove.length || !old.includes(newParent)) {
    await updateFile(id, { addParents: old.includes(newParent) ? [] : [newParent], removeParents: remove }, db);
  }
  return old;
}

// Permanent delete (a folder takes its contents with it). Already gone (404) counts as success.
export async function deleteFile(id: string, db: SupabaseClient = admin()): Promise<void> {
  const res = await gfetch(`${API}/files/${encodeURIComponent(id)}`, { db, method: "DELETE" });
  if (res.ok || res.status === 404) return;
  await fail(res, "delete");
}
