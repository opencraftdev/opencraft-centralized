// Browser-side reads/writes for /finance (docs/FINANCE.md). RLS: is_allowed_user() — the whole team edits.
import { createClient } from "@/lib/supabase/client";
import { createFolder, uploadFile } from "@/features/drive/api";
import type { Member } from "@/features/tasks/types";
import type { EntryInput, FinanceEntry } from "./types";

const COLUMNS = "id,kind,entry_date,description,category,amount,note,pic_ids,proof_file_id,created_by,created_at";

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

/** All entries of a year, oldest first (the order of the spreadsheet). */
export async function listEntries(year: number): Promise<FinanceEntry[]> {
  const rows = check(
    await createClient()
      .from("finance_entries")
      .select(COLUMNS)
      .gte("entry_date", `${year}-01-01`)
      .lte("entry_date", `${year}-12-31`)
      .order("entry_date")
      .order("created_at"),
  ) as FinanceEntry[];
  // bigint can come back as a string
  return rows.map((r) => ({ ...r, amount: Number(r.amount) }));
}

export async function createEntry(input: EntryInput): Promise<void> {
  check(await createClient().from("finance_entries").insert(input));
}

export async function updateEntry(id: string, input: EntryInput): Promise<void> {
  check(await createClient().from("finance_entries").update(input).eq("id", id));
}

export async function deleteEntry(id: string): Promise<void> {
  check(await createClient().from("finance_entries").delete().eq("id", id));
}

/** Active team members (the people who can be PIC). */
export async function listMembers(): Promise<Member[]> {
  return check(
    await createClient().from("task_members").select("*").eq("active", true).order("sort").order("name"),
  ) as Member[];
}

// ── Proof images: stored in Google Drive like every other file, in the dashboard folder "Finance" ──
let folderPromise: Promise<string> | null = null;
function proofFolder(): Promise<string> {
  folderPromise ??= (async () => {
    const res = await createClient()
      .from("drive_folders")
      .select("id")
      .eq("name", "Finance")
      .is("parent_id", null)
      .is("trashed_at", null)
      .limit(1);
    const found = check(res) as { id: string }[];
    return found[0]?.id ?? createFolder("Finance", null);
  })().catch((e) => {
    folderPromise = null;
    throw e;
  });
  return folderPromise;
}

/** Uploads a proof image; returns its drive_files id. */
export async function uploadProof(file: File): Promise<string> {
  const folderId = await proofFolder();
  const { data } = await createClient().auth.getUser();
  return uploadFile(file, folderId, data.user?.id ?? "", { kind: "finance_proof" });
}
