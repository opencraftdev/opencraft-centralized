// Two-way sync, Google → dashboard, of the "OpenCraft Documents" folder (docs/DRIVE.md → "Two-way sync").
// Dashboard → Google is done by the web app/worker when they change something (Google first, then the DB).
//
// One `syncOnce()` call:
//  - no google_drive_auth.changes_page_token yet → full sync: take a start page token, list the whole
//    root subtree recursively, mirror it, drop rows whose Google item is gone, store the token.
//  - otherwise → changes.list from the token (includeRemoved), page by page; the token is persisted after
//    every page, so a crash re-processes at most one page (all operations are idempotent).
//
// Rules:
//  - only items whose parent chain reaches root_folder_id are mirrored; anything else (moved out,
//    deleted, outside) is "gone": its row is deleted (Google untouched).
//  - folders → drive_folders (google_folder_id), files → drive_files (source='google', status='ready').
//    Google-native Docs/Sheets/Slides are files (size null). Shortcuts are ignored.
//  - parents are resolved (and created) before their children.
//  - trashed = Google `explicitlyTrashed` (a trashed folder carries its contents, like the dashboard).
//  - parent and trash state are always mirrored; the name (and mime/size) only when Google's
//    modifiedTime is newer than the row's google_modified_at (rename bumps modifiedTime; move/trash do
//    not). Rows from before the sync (google_modified_at null) compare against updated_at instead, so
//    their dashboard names (e.g. without ".pdf") are kept until the file really changes in Google.
//    The web app/worker store modifiedTime after their own changes, so echoes are no-ops.
//  - no-ops are skipped; rows in queued/generating/needs_input/failed are never touched.
import type { SupabaseClient } from "@supabase/supabase-js";

const API = "https://www.googleapis.com/drive/v3";
const FOLDER_MIME = "application/vnd.google-apps.folder";
const SHORTCUT_MIME = "application/vnd.google-apps.shortcut";
const ITEM_FIELDS = "id,name,mimeType,parents,trashed,explicitlyTrashed,trashedTime,modifiedTime,size";
const PROTECTED = new Set(["queued", "generating", "needs_input", "failed"]);

type GItem = {
  id: string;
  name: string;
  mimeType: string;
  parents?: string[];
  trashed?: boolean;
  explicitlyTrashed?: boolean;
  trashedTime?: string;
  modifiedTime?: string;
  size?: string;
};
type FolderRow = {
  id: string;
  name: string;
  parent_id: string | null;
  google_folder_id: string | null;
  trashed_at: string | null;
  google_modified_at: string | null;
  created_at: string;
  updated_at: string;
};
type FileRow = {
  id: string;
  name: string;
  folder_id: string | null;
  google_file_id: string;
  status: string;
  mime_type: string | null;
  size_bytes: number | null;
  trashed_at: string | null;
  google_modified_at: string | null;
  created_at: string;
  updated_at: string;
};

type ChangesPage = {
  changes?: { removed?: boolean; fileId?: string; changeType?: string; file?: GItem }[];
  nextPageToken?: string;
  newStartPageToken?: string;
};

export type SyncStats = {
  mode: "full" | "changes";
  seen: number;
  inserted: number;
  updated: number;
  deleted: number;
  foldersCreated: number; // dashboard folders that got their Google folder this pass (eager folders)
  rootFolderId: string;
};

// Dashboard folders younger than this are left to the web app, which creates their Google folder itself
// right after inserting the row (avoids racing it into a duplicate).
const EAGER_MIN_AGE_MS = 60_000;

const time = (s: string | null | undefined) => (s ? Date.parse(s) : NaN);
const newer = (google: string | undefined, row: string | null) =>
  !!google && (row == null || time(google) > time(row));

export function createDriveSync(opts: {
  db: SupabaseClient;
  accessToken: () => Promise<string>;
  // google.ts ensureFolder: creates the Google folder of a dashboard folder (parents first) if missing.
  ensureFolder?: (folderId: string) => Promise<string>;
  log?: (...a: unknown[]) => void;
}) {
  const { db, accessToken } = opts;
  const log = opts.log ?? (() => {});

  async function gget<T>(path: string, params: Record<string, string>): Promise<T> {
    const url = `${API}/${path}?${new URLSearchParams(params)}`;
    const res = await fetch(url, { headers: { authorization: `Bearer ${await accessToken()}` } });
    if (!res.ok) {
      const err: Error & { status?: number } = new Error(`google ${path}: ${res.status} ${(await res.text()).slice(0, 300)}`);
      err.status = res.status;
      throw err;
    }
    return (await res.json()) as T;
  }

  async function loadAuth() {
    const { data, error } = await db
      .from("google_drive_auth")
      .select("root_folder_id, changes_page_token, scope")
      .eq("id", 1)
      .maybeSingle();
    if (error) throw new Error(`google_drive_auth: ${error.message}`);
    if (!data?.root_folder_id) throw new Error("google_drive_auth.root_folder_id is not set");
    return data as { root_folder_id: string; changes_page_token: string | null; scope: string | null };
  }

  async function saveToken(token: string) {
    const { error } = await db
      .from("google_drive_auth")
      .update({ changes_page_token: token, last_sync_at: new Date().toISOString() })
      .eq("id", 1);
    if (error) throw new Error(`google_drive_auth save token: ${error.message}`);
  }

  // ---- one batch (a changes page, or the full listing) ----
  async function applyBatch(
    root: string,
    items: GItem[],
    removedIds: string[],
    stats: SyncStats,
    full: { startedAt: string } | null,
  ) {
    const [{ data: fData, error: fErr }, { data: rData, error: rErr }] = await Promise.all([
      db.from("drive_folders").select("id, name, parent_id, google_folder_id, trashed_at, google_modified_at, created_at, updated_at"),
      db
        .from("drive_files")
        .select("id, name, folder_id, google_file_id, status, mime_type, size_bytes, trashed_at, google_modified_at, created_at, updated_at")
        .not("google_file_id", "is", null)
        .range(0, 9999),
    ]);
    if (fErr) throw new Error(`drive_folders: ${fErr.message}`);
    if (rErr) throw new Error(`drive_files: ${rErr.message}`);
    const folders = new Map((fData as FolderRow[]).map((f) => [f.id, f]));
    const folderByG = new Map<string, FolderRow>();
    for (const f of folders.values()) if (f.google_folder_id) folderByG.set(f.google_folder_id, f);
    const fileByG = new Map((rData as FileRow[]).map((f) => [f.google_file_id, f]));

    // Google parent of every known folder: this batch first, then the DB mirror, then the API (cached).
    const meta = new Map<string, GItem>();
    for (const it of items) meta.set(it.id, it);
    const parentOf = (gid: string): string | null | undefined => {
      const m = meta.get(gid);
      if (m) return m.parents?.[0] ?? null;
      const row = folderByG.get(gid);
      if (row) return row.parent_id ? (folders.get(row.parent_id)?.google_folder_id ?? undefined) : root;
      return undefined;
    };
    async function fetchMeta(gid: string): Promise<GItem | null> {
      if (meta.has(gid)) return meta.get(gid)!;
      try {
        const m = await gget<GItem>(`files/${encodeURIComponent(gid)}`, { fields: ITEM_FIELDS });
        meta.set(gid, m);
        return m;
      } catch (e) {
        if ((e as { status?: number }).status === 404) return null;
        throw e;
      }
    }
    async function inSubtree(gid: string | null | undefined, depth = 0): Promise<boolean> {
      if (!gid) return false;
      if (gid === root) return true;
      if (depth > 64) return false;
      let p = parentOf(gid);
      if (p === undefined) p = (await fetchMeta(gid))?.parents?.[0] ?? null;
      return inSubtree(p, depth + 1);
    }

    // Dashboard folder id for a Google parent (null = root). Creates missing ancestor rows first.
    // undefined = not in the subtree.
    async function parentRow(gParent: string | undefined, depth = 0): Promise<string | null | undefined> {
      if (!gParent) return undefined;
      if (gParent === root) return null;
      if (!(await inSubtree(gParent))) return undefined;
      const known = folderByG.get(gParent);
      if (known && !meta.has(gParent)) return known.id;
      const m = await fetchMeta(gParent);
      if (!m || m.mimeType !== FOLDER_MIME || depth > 64) return undefined;
      return upsertFolder(m, depth + 1);
    }

    const done = new Map<string, string | null>(); // folder gid → row id (this batch); null = in progress / gone

    // Returns the folder's row id, or undefined when it is not (or can no longer be) mirrored.
    async function upsertFolder(it: GItem, depth = 0): Promise<string | undefined> {
      if (done.has(it.id)) return done.get(it.id) ?? undefined;
      done.set(it.id, null); // cycle guard
      const parent = await parentRow(it.parents?.[0], depth);
      if (parent === undefined) {
        await goneFolder(it.id);
        return undefined;
      }
      const trashed = !!it.explicitlyTrashed;
      const row = folderByG.get(it.id);
      if (row) {
        const patch: Record<string, unknown> = {};
        if (row.parent_id !== parent) patch.parent_id = parent;
        if (!!row.trashed_at !== trashed) patch.trashed_at = trashed ? (it.trashedTime ?? new Date().toISOString()) : null;
        if (newer(it.modifiedTime, row.google_modified_at ?? row.updated_at)) {
          patch.google_modified_at = it.modifiedTime;
          if (row.name !== it.name) patch.name = it.name;
        }
        if (Object.keys(patch).length) {
          const { error } = await db.from("drive_folders").update(patch).eq("id", row.id);
          if (error) throw new Error(`drive_folders update: ${error.message}`);
          Object.assign(row, patch);
          stats.updated++;
          log(`sync: folder ${row.id} "${it.name}" ${Object.keys(patch).join(",")}`);
        }
        done.set(it.id, row.id);
        return row.id;
      }

      // Same-named dashboard folder at the same place that has no Google folder yet (a seeded folder, or
      // one the web app is creating right now, row inserted but Google id not stored yet): adopt it.
      const pending = [...folders.values()].find((f) => !f.google_folder_id && f.name === it.name && f.parent_id === parent);
      if (pending) {
        const { data: won } = await db
          .from("drive_folders")
          .update({ google_folder_id: it.id, google_modified_at: it.modifiedTime ?? null })
          .eq("id", pending.id)
          .is("google_folder_id", null)
          .select("id");
        if (won?.length) {
          pending.google_folder_id = it.id;
          pending.google_modified_at = it.modifiedTime ?? null;
          folderByG.set(it.id, pending);
          done.set(it.id, pending.id);
          stats.updated++;
          log(`sync: folder ${pending.id} "${it.name}" adopted google ${it.id}`);
          return pending.id;
        }
      }

      const { data, error } = await db
        .from("drive_folders")
        .insert({
          name: it.name,
          parent_id: parent,
          google_folder_id: it.id,
          trashed_at: trashed ? (it.trashedTime ?? new Date().toISOString()) : null,
          google_modified_at: it.modifiedTime ?? null,
        })
        .select("id, name, parent_id, google_folder_id, trashed_at, google_modified_at, created_at, updated_at")
        .single();
      let created = data as FolderRow | null;
      if (error) {
        if (error.code !== "23505") throw new Error(`drive_folders insert: ${error.message}`);
        // Stored concurrently by the web app/worker (ensureFolder): use that row.
        const { data: other, error: e2 } = await db
          .from("drive_folders")
          .select("id, name, parent_id, google_folder_id, trashed_at, google_modified_at, created_at, updated_at")
          .eq("google_folder_id", it.id)
          .maybeSingle();
        if (e2 || !other) throw new Error(`drive_folders insert: ${error.message}`);
        created = other as FolderRow;
        folders.set(created.id, created);
        folderByG.set(it.id, created);
        done.set(it.id, created.id);
        return created.id;
      }
      created = created!;
      folders.set(created.id, created);
      folderByG.set(it.id, created);
      done.set(it.id, created.id);
      stats.inserted++;
      log(`sync: folder + "${it.name}" (${it.id})`);
      // Moved in from outside the subtree: its contents produce no change events of their own.
      if (!full) {
        for (const child of await listChildren(it.id)) {
          meta.set(child.id, child);
          if (child.mimeType === FOLDER_MIME) await upsertFolder(child);
          else await upsertFile(child);
        }
      }
      return created.id;
    }

    async function upsertFile(it: GItem) {
      if (it.mimeType === SHORTCUT_MIME) return;
      const row = fileByG.get(it.id);
      if (row && PROTECTED.has(row.status)) return;
      const parent = await parentRow(it.parents?.[0]);
      if (parent === undefined) return goneFile(it.id);
      const trashed = !!it.explicitlyTrashed;
      const size = it.size != null ? Number(it.size) : null;
      if (row) {
        const patch: Record<string, unknown> = {};
        if (row.folder_id !== parent) patch.folder_id = parent;
        if (!!row.trashed_at !== trashed) patch.trashed_at = trashed ? (it.trashedTime ?? new Date().toISOString()) : null;
        if (newer(it.modifiedTime, row.google_modified_at ?? row.updated_at)) {
          patch.google_modified_at = it.modifiedTime;
          if (row.name !== it.name) patch.name = it.name;
          if (row.mime_type !== it.mimeType) patch.mime_type = it.mimeType;
          if (row.size_bytes !== size) patch.size_bytes = size;
        }
        if (!Object.keys(patch).length) return;
        const { error } = await db.from("drive_files").update(patch).eq("id", row.id).not("status", "in", "(queued,generating,needs_input,failed)");
        if (error) throw new Error(`drive_files update: ${error.message}`);
        Object.assign(row, patch);
        stats.updated++;
        log(`sync: file ${row.id} "${it.name}" ${Object.keys(patch).join(",")}`);
        return;
      }
      const { data, error } = await db
        .from("drive_files")
        .insert({
          folder_id: parent,
          name: it.name,
          mime_type: it.mimeType,
          size_bytes: size,
          google_file_id: it.id,
          google_modified_at: it.modifiedTime ?? null,
          source: "google",
          status: "ready",
          trashed_at: trashed ? (it.trashedTime ?? new Date().toISOString()) : null,
        })
        .select("id, name, folder_id, google_file_id, status, mime_type, size_bytes, trashed_at, google_modified_at, created_at, updated_at")
        .single();
      if (error) {
        if (error.code === "23505") return; // the web app / worker inserted it meanwhile
        throw new Error(`drive_files insert: ${error.message}`);
      }
      fileByG.set(it.id, data as FileRow);
      stats.inserted++;
      log(`sync: file + "${it.name}" (${it.id})`);
    }

    async function goneFile(gid: string) {
      const row = fileByG.get(gid);
      if (!row || PROTECTED.has(row.status)) return;
      const { error } = await db.from("drive_files").delete().eq("id", row.id).not("status", "in", "(queued,generating,needs_input,failed)");
      if (error) throw new Error(`drive_files delete: ${error.message}`);
      fileByG.delete(gid);
      stats.deleted++;
      log(`sync: file - "${row.name}" (${gid})`);
    }

    // A folder left the subtree / was deleted: drop its whole dashboard subtree (protected job rows stay,
    // moved to the root by the FK's ON DELETE SET NULL).
    async function goneFolder(gid: string) {
      const row = folderByG.get(gid);
      if (!row) return;
      const ids = new Set([row.id]);
      for (let grew = true; grew; ) {
        grew = false;
        for (const f of folders.values())
          if (f.parent_id && ids.has(f.parent_id) && !ids.has(f.id)) {
            ids.add(f.id);
            grew = true;
          }
      }
      const { error: fe } = await db
        .from("drive_files")
        .delete()
        .in("folder_id", [...ids])
        .not("status", "in", "(queued,generating,needs_input,failed)");
      if (fe) throw new Error(`drive_files delete: ${fe.message}`);
      const { error } = await db.from("drive_folders").delete().eq("id", row.id); // sub-folders: ON DELETE CASCADE
      if (error) throw new Error(`drive_folders delete: ${error.message}`);
      for (const id of ids) {
        const f = folders.get(id);
        if (f?.google_folder_id) folderByG.delete(f.google_folder_id);
        folders.delete(id);
      }
      for (const [g, f] of fileByG) if (f.folder_id && ids.has(f.folder_id) && !PROTECTED.has(f.status)) fileByG.delete(g);
      stats.deleted++;
      log(`sync: folder - "${row.name}" (${gid}) with ${ids.size - 1} sub-folder(s)`);
    }

    for (const gid of removedIds) {
      if (gid === root) continue;
      if (folderByG.has(gid)) await goneFolder(gid);
      else await goneFile(gid);
    }
    // Folders before files; parentRow() creates missing ancestors on demand.
    const live = items.filter((it) => it.id !== root);
    for (const it of live) if (it.mimeType === FOLDER_MIME) await upsertFolder(it);
    for (const it of live) if (it.mimeType !== FOLDER_MIME) await upsertFile(it);
    stats.seen += items.length + removedIds.length;

    if (full) {
      // Rows mirrored from Google whose item is no longer in the subtree. Rows created after the listing
      // started are left alone (the changes feed from the start token covers them).
      const listed = new Set(items.map((it) => it.id));
      for (const [gid, f] of [...fileByG])
        if (!listed.has(gid) && time(f.created_at) < time(full.startedAt)) await goneFile(gid);
      for (const [gid, f] of [...folderByG])
        if (folderByG.has(gid) && !listed.has(gid) && time(f.created_at) < time(full.startedAt)) await goneFolder(gid);
    }
  }

  async function listChildren(folderGid: string): Promise<GItem[]> {
    const out: GItem[] = [];
    let pageToken: string | undefined;
    do {
      const params: Record<string, string> = {
        q: `'${folderGid}' in parents`,
        fields: `nextPageToken,files(${ITEM_FIELDS})`,
        pageSize: "1000",
        spaces: "drive",
      };
      if (pageToken) params.pageToken = pageToken;
      const j = await gget<{ files?: GItem[]; nextPageToken?: string }>("files", params);
      out.push(...(j.files ?? []));
      pageToken = j.nextPageToken;
    } while (pageToken);
    return out;
  }

  async function fullSync(root: string, stats: SyncStats) {
    const startedAt = new Date().toISOString();
    const { startPageToken } = await gget<{ startPageToken: string }>("changes/startPageToken", {});
    const items: GItem[] = [];
    const queue = [root];
    while (queue.length) {
      const gid = queue.shift()!;
      for (const it of await listChildren(gid)) {
        if (it.mimeType === FOLDER_MIME && !items.some((x) => x.id === it.id)) queue.push(it.id);
        items.push(it);
      }
    }
    await applyBatch(root, items, [], stats, { startedAt });
    await saveToken(startPageToken);
  }

  async function changesSync(root: string, token: string, stats: SyncStats) {
    let pageToken: string | undefined = token;
    while (pageToken) {
      const j: ChangesPage = await gget<ChangesPage>("changes", {
        pageToken,
        pageSize: "1000",
        spaces: "drive",
        includeRemoved: "true",
        fields: `nextPageToken,newStartPageToken,changes(changeType,removed,fileId,file(${ITEM_FIELDS}))`,
      });
      // Last change per item wins.
      const latest = new Map<string, { removed: boolean; file?: GItem }>();
      for (const c of j.changes ?? []) {
        if (c.changeType && c.changeType !== "file") continue;
        const id = c.fileId ?? c.file?.id;
        if (id) latest.set(id, { removed: !!c.removed || !c.file, file: c.file });
      }
      const items: GItem[] = [];
      const removed: string[] = [];
      for (const [id, c] of latest) (c.removed ? removed.push(id) : items.push(c.file!));
      if (items.length || removed.length) await applyBatch(root, items, removed, stats, null);
      const next = j.nextPageToken ?? j.newStartPageToken;
      if (!next) throw new Error("changes.list returned no page token");
      await saveToken(next); // also stamps last_sync_at
      pageToken = j.nextPageToken;
    }
  }

  // Eager folders (docs/DRIVE.md → "Sync status in the UI"): every non-trashed dashboard folder (none of its
  // ancestors trashed either) gets a Google folder, parents first, so Google's tree matches the dashboard.
  async function ensureAllFolders(stats: SyncStats) {
    if (!opts.ensureFolder) return;
    const { data, error } = await db.from("drive_folders").select("id, name, parent_id, google_folder_id, trashed_at, created_at");
    if (error) throw new Error(`drive_folders: ${error.message}`);
    const rows = data as Pick<FolderRow, "id" | "name" | "parent_id" | "google_folder_id" | "trashed_at" | "created_at">[];
    const byId = new Map(rows.map((f) => [f.id, f]));
    const chain = (f: (typeof rows)[number]) => {
      const out = [f];
      for (let p = f.parent_id ? byId.get(f.parent_id) : undefined; p && out.length < 64; p = p.parent_id ? byId.get(p.parent_id) : undefined)
        out.push(p);
      return out;
    };
    const missing = rows
      .filter((f) => !f.google_folder_id && Date.now() - time(f.created_at) > EAGER_MIN_AGE_MS)
      .map((f) => ({ f, c: chain(f) }))
      .filter(({ c }) => c.every((x) => !x.trashed_at))
      .sort((a, b) => a.c.length - b.c.length); // parents first
    for (const { f } of missing) {
      try {
        await opts.ensureFolder(f.id); // re-reads the row; no-op if a parent pass created it meanwhile
        stats.foldersCreated++;
        log(`sync: google folder created for dashboard folder ${f.id} "${f.name}"`);
      } catch (e) {
        log(`sync: could not create google folder for ${f.id} "${f.name}": ${(e as Error).message}`);
      }
    }
  }

  // One sync pass. Safe to call repeatedly; never run two passes concurrently.
  async function syncOnce(): Promise<SyncStats> {
    const auth = await loadAuth();
    const stats: SyncStats = {
      mode: auth.changes_page_token ? "changes" : "full",
      seen: 0,
      inserted: 0,
      updated: 0,
      deleted: 0,
      foldersCreated: 0,
      rootFolderId: auth.root_folder_id,
    };
    if (auth.changes_page_token) await changesSync(auth.root_folder_id, auth.changes_page_token, stats);
    else await fullSync(auth.root_folder_id, stats);
    // After the Google → dashboard pass, so folders made in Google (same name) are adopted rather than duplicated.
    await ensureAllFolders(stats);
    return stats;
  }

  return { syncOnce };
}
