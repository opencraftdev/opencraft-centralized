import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { deleteFile, ensureFolder, moveFile, updateFile } from "@/lib/google/drive";

export const runtime = "nodejs";

// POST /api/drive/items — Drive mutations that must be mirrored to Google Drive (docs/DRIVE.md).
//   {op:"createFolder", name, parentId}            → { id }
//   {op:"rename", kind, id, name}
//   {op:"move", kind, id, folderId}
//   {op:"trash" | "restore", kind, id}
//   {op:"delete", kind, id}                        permanent; a folder takes its whole subtree
//   {op:"discardUpload", googleFileId}             undo an upload whose row insert failed
// Google is changed first; if the DB write then fails, the Google change is reverted (best effort).
// Items without a Google id (legacy rows, folders not created in Google yet) are DB-only.

type Kind = "folder" | "file";
const META = {
  folder: { table: "drive_folders", gcol: "google_folder_id", parent: "parent_id" },
  file: { table: "drive_files", gcol: "google_file_id", parent: "folder_id" },
} as const;

type Item = { id: string; name: string; parent: string | null; gid: string | null };

class HttpError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function loadItem(db: SupabaseClient, kind: Kind, id: string): Promise<Item> {
  const m = META[kind];
  const { data, error } = await db.from(m.table).select(`id, name, ${m.parent}, ${m.gcol}`).eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new HttpError(kind === "folder" ? "Folder tidak ditemukan" : "File tidak ditemukan", 404);
  const row = data as unknown as Record<string, string | null>;
  return { id: row.id!, name: row.name!, parent: row[m.parent], gid: row[m.gcol] };
}

async function dbUpdate(db: SupabaseClient, kind: Kind, id: string, patch: Record<string, unknown>) {
  const { error } = await db.from(META[kind].table).update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

// Apply to Google, then the DB; roll Google back if the DB write fails.
async function mirrored(google: () => Promise<void>, revert: () => Promise<unknown>, write: () => Promise<void>) {
  await google();
  try {
    await write();
  } catch (e) {
    await revert().catch(() => {});
    throw e;
  }
}

async function allFolders(db: SupabaseClient) {
  const { data, error } = await db.from("drive_folders").select("id, parent_id, google_folder_id");
  if (error) throw new Error(error.message);
  return data as { id: string; parent_id: string | null; google_folder_id: string | null }[];
}

function subtreeIds(folders: { id: string; parent_id: string | null }[], rootId: string): string[] {
  const ids = new Set([rootId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const f of folders)
      if (f.parent_id && ids.has(f.parent_id) && !ids.has(f.id)) {
        ids.add(f.id);
        grew = true;
      }
  }
  return [...ids];
}

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  const op = str(body.op);
  const kind = body.kind === "folder" || body.kind === "file" ? (body.kind as Kind) : null;
  const id = str(body.id);
  const db = createAdminClient();

  try {
    switch (op) {
      case "createFolder": {
        const name = str(body.name);
        const parentId = str(body.parentId) || null;
        if (!name) throw new HttpError("Nama folder wajib diisi", 400);
        const { data, error } = await db
          .from("drive_folders")
          .insert({ name, parent_id: parentId, created_by: user.id })
          .select("id")
          .single();
        if (error) throw new Error(error.message);
        try {
          await ensureFolder(data.id, db);
        } catch (e) {
          await db.from("drive_folders").delete().eq("id", data.id);
          throw e;
        }
        return NextResponse.json({ id: data.id });
      }

      case "discardUpload": {
        const gid = str(body.googleFileId);
        if (!gid) throw new HttpError("googleFileId is required", 400);
        const { count, error } = await db
          .from("drive_files")
          .select("id", { count: "exact", head: true })
          .eq("google_file_id", gid);
        if (error) throw new Error(error.message);
        if (count) throw new HttpError("File masih dipakai", 409);
        await deleteFile(gid, db);
        return NextResponse.json({ ok: true });
      }
    }

    if (!kind || !id) throw new HttpError("kind and id are required", 400);
    const item = await loadItem(db, kind, id);
    const gid = item.gid;

    switch (op) {
      case "rename": {
        const name = str(body.name);
        if (!name) throw new HttpError("Nama wajib diisi", 400);
        await mirrored(
          async () => void (gid && (await updateFile(gid, { name }, db))),
          async () => gid && updateFile(gid, { name: item.name }, db),
          () => dbUpdate(db, kind, id, { name }),
        );
        break;
      }

      case "move": {
        const target = str(body.folderId) || null;
        if (kind === "folder" && target && subtreeIds(await allFolders(db), id).includes(target)) {
          throw new HttpError("Folder tidak bisa dipindahkan ke dalam dirinya sendiri", 400);
        }
        let dest: string | null = null;
        let oldParents: string[] = [];
        await mirrored(
          async () => {
            if (!gid) return;
            dest = await ensureFolder(target, db);
            oldParents = await moveFile(gid, dest, db);
          },
          async () =>
            gid && dest && updateFile(gid, { addParents: oldParents, removeParents: oldParents.includes(dest) ? [] : [dest] }, db),
          () => dbUpdate(db, kind, id, { [META[kind].parent]: target }),
        );
        break;
      }

      case "trash":
      case "restore": {
        const trashed = op === "trash";
        await mirrored(
          async () => void (gid && (await updateFile(gid, { trashed }, db))),
          async () => gid && updateFile(gid, { trashed: !trashed }, db),
          () => dbUpdate(db, kind, id, { trashed_at: trashed ? new Date().toISOString() : null }),
        );
        break;
      }

      case "delete": {
        // Google first: if the DB delete then fails, a retry finds the Google items gone (404 = ok).
        if (kind === "file") {
          if (gid) await deleteFile(gid, db);
          const { error } = await db.from("drive_files").delete().eq("id", id);
          if (error) throw new Error(error.message);
          break;
        }
        const folders = await allFolders(db);
        const ids = subtreeIds(folders, id);
        const { data: files, error: fErr } = await db
          .from("drive_files")
          .select("id, google_file_id")
          .in("folder_id", ids);
        if (fErr) throw new Error(fErr.message);
        for (const f of files ?? []) if (f.google_file_id) await deleteFile(f.google_file_id, db);
        // Sub-folders explicitly too: Google removes a deleted folder's descendants only asynchronously.
        for (const fid of ids.slice(1).reverse()) {
          const g = folders.find((f) => f.id === fid)?.google_folder_id;
          if (g) await deleteFile(g, db);
        }
        if (gid) await deleteFile(gid, db);
        // Files first: the FK would otherwise move them to root; sub-folders go by ON DELETE CASCADE.
        if (files?.length) {
          const { error } = await db.from("drive_files").delete().in("id", files.map((f) => f.id));
          if (error) throw new Error(error.message);
        }
        const { error } = await db.from("drive_folders").delete().eq("id", id);
        if (error) throw new Error(error.message);
        break;
      }

      default:
        throw new HttpError(`unknown op: ${op}`, 400);
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 502;
    return NextResponse.json({ error: (e as Error).message }, { status });
  }
}
