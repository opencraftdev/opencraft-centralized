// Google Drive v3 helpers for the drive-worker (plain fetch, no googleapis). Same mirror rules as the
// web app (src/lib/google/drive.ts, docs/DRIVE.md → "Storage: Google Drive"): credentials in
// public.google_drive_auth (service role only), dashboard root = root_folder_id, drive_folders get a
// Google folder lazily (drive_folders.google_folder_id).
import type { SupabaseClient } from "@supabase/supabase-js";

const API = "https://www.googleapis.com/drive/v3";
const UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";
const FOLDER_MIME = "application/vnd.google-apps.folder";

type Auth = { client_id: string; client_secret: string; refresh_token: string; root_folder_id: string | null };

export function createGoogleDrive(db: SupabaseClient) {
  let cache: { refreshToken: string; token: string; expiresAt: number } | null = null;

  async function loadAuth(): Promise<Auth> {
    const { data, error } = await db
      .from("google_drive_auth")
      .select("client_id, client_secret, refresh_token, root_folder_id")
      .eq("id", 1)
      .maybeSingle();
    if (error) throw new Error(`google_drive_auth: ${error.message}`);
    if (!data) throw new Error("google_drive_auth is empty (Google Drive not connected)");
    return data as Auth;
  }

  async function token(): Promise<string> {
    const auth = await loadAuth();
    if (cache && cache.refreshToken === auth.refresh_token && cache.expiresAt > Date.now() + 60_000) return cache.token;
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: auth.client_id,
        client_secret: auth.client_secret,
        refresh_token: auth.refresh_token,
      }),
    });
    const j = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error?: string };
    if (!res.ok || !j.access_token) throw new Error(`google token: ${j.error ?? res.status}`);
    cache = { refreshToken: auth.refresh_token, token: j.access_token, expiresAt: Date.now() + (j.expires_in ?? 3600) * 1000 };
    return j.access_token;
  }

  async function gfetch(url: string, init: RequestInit = {}): Promise<Response> {
    const headers = new Headers(init.headers);
    headers.set("authorization", `Bearer ${await token()}`);
    return fetch(url, { ...init, headers });
  }

  async function fail(res: Response, what: string): Promise<never> {
    const text = await res.text().catch(() => "");
    throw new Error(`google drive ${what}: ${res.status} ${text.slice(0, 300)}`);
  }

  async function rootFolderId(): Promise<string> {
    const { root_folder_id } = await loadAuth();
    if (!root_folder_id) throw new Error("google_drive_auth.root_folder_id is not set");
    return root_folder_id;
  }

  async function deleteFile(id: string): Promise<void> {
    const res = await gfetch(`${API}/files/${encodeURIComponent(id)}`, { method: "DELETE" });
    if (res.ok || res.status === 404) return;
    await fail(res, "delete");
  }

  async function ensureFolder(folderId: string | null, depth = 0): Promise<string> {
    if (!folderId) return rootFolderId();
    if (depth > 32) throw new Error("folder tree too deep / cyclic");
    const { data: f, error } = await db
      .from("drive_folders")
      .select("id, name, parent_id, google_folder_id")
      .eq("id", folderId)
      .maybeSingle();
    if (error) throw new Error(`drive_folders: ${error.message}`);
    if (!f) throw new Error(`drive_folders ${folderId} not found`);
    if (f.google_folder_id) return f.google_folder_id as string;
    const parent = await ensureFolder(f.parent_id as string | null, depth + 1);
    const res = await gfetch(`${API}/files?fields=id`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: f.name, mimeType: FOLDER_MIME, parents: [parent] }),
    });
    if (!res.ok) await fail(res, "create folder");
    const created = ((await res.json()) as { id: string }).id;
    const { data: won, error: upErr } = await db
      .from("drive_folders")
      .update({ google_folder_id: created })
      .eq("id", folderId)
      .is("google_folder_id", null)
      .select("google_folder_id");
    if (upErr || !won?.length) {
      await deleteFile(created).catch(() => {});
      if (upErr) throw new Error(`drive_folders: ${upErr.message}`);
      return ensureFolder(folderId, depth + 1); // the web app created it first
    }
    return created;
  }

  // Multipart upload into the Google folder of drive folder `folderId` (null = root).
  async function uploadFile(args: {
    folderId: string | null;
    name: string;
    mimeType: string;
    bytes: Uint8Array;
  }): Promise<{ id: string; size: number }> {
    const parent = await ensureFolder(args.folderId);
    const boundary = `drive-worker-${crypto.randomUUID()}`;
    const meta = JSON.stringify({ name: args.name, mimeType: args.mimeType, parents: [parent] });
    const body = Buffer.concat([
      Buffer.from(
        `--${boundary}\r\ncontent-type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n` +
          `--${boundary}\r\ncontent-type: ${args.mimeType}\r\n\r\n`,
      ),
      Buffer.from(args.bytes),
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);
    const res = await gfetch(`${UPLOAD_API}/files?uploadType=multipart&fields=id,size`, {
      method: "POST",
      headers: { "content-type": `multipart/related; boundary=${boundary}` },
      body,
    });
    if (!res.ok) await fail(res, "upload");
    const j = (await res.json()) as { id: string; size?: string };
    return { id: j.id, size: j.size != null ? Number(j.size) : args.bytes.length };
  }

  return { uploadFile, deleteFile, ensureFolder, rootFolderId, accessToken: token };
}
