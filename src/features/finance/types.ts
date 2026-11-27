// Finance book (docs/FINANCE.md): every income / expense is one row of `finance_entries`.

export type EntryKind = "income" | "expense";

export interface FinanceEntry {
  id: string;
  kind: EntryKind;
  entry_date: string; // YYYY-MM-DD
  description: string;
  category: string;
  amount: number; // whole rupiah
  note: string;
  /** Who paid (expense) / received (income): task_members ids, several allowed. */
  pic_ids: string[];
  /** Optional proof image (drive_files id). */
  proof_file_id: string | null;
  created_by: string | null;
  created_at: string;
}

export type EntryInput = Pick<FinanceEntry, "kind" | "entry_date" | "description" | "category" | "amount" | "note" | "pic_ids" | "proof_file_id">;

// Categories from the team's spreadsheet ("Kategori" dropdown); income has its own list.
export const CATEGORIES: Record<EntryKind, string[]> = {
  expense: ["Gaji", "Operasional", "Software & Langganan", "Marketing", "Transport", "Lain-lain"],
  income: ["Penjualan", "Jasa / Project", "Investasi / Modal", "Lain-lain"],
};

export const KIND_META: Record<EntryKind, { label: string; color: string; bg: string }> = {
  income: { label: "Pemasukan", color: "#188038", bg: "#E6F4EA" },
  expense: { label: "Pengeluaran", color: "#B3261E", bg: "#FCE8E6" },
};

/** PIC label per kind. */
export const PIC_LABEL: Record<EntryKind, string> = { expense: "Dibayar oleh", income: "Diterima oleh" };

export const MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

/** 2500000 → "Rp2.500.000" (as in the spreadsheet). */
export function formatIDR(n: number): string {
  return (n < 0 ? "-Rp" : "Rp") + Math.abs(Math.round(n)).toLocaleString("id-ID");
}

/** "2026-11-20" → "20/11/2026". */
export function formatDate(d: string): string {
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}
