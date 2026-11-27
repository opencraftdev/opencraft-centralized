// Browser-side reads/writes for /finance (docs/FINANCE.md). RLS: is_allowed_user() — the whole team edits.
import { createClient } from "@/lib/supabase/client";
import type { EntryInput, FinanceEntry } from "./types";

const COLUMNS = "id,kind,entry_date,description,category,amount,note,created_by,created_at";

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
