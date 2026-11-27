# Finance (/finance)

As simple as the team's spreadsheet (one tab per month + "Rekap"), with income as well as expenses.

- Table `finance_entries` (migration `030_finance_entries.sql`): `kind` (`income` | `expense`), `entry_date`,
  `description` (Keterangan), `category` (Kategori), `amount` (whole rupiah), `note` (Catatan), `created_by`.
  RLS: the whole team (`is_allowed_user()`) reads and writes.
- Categories (`src/features/finance/types.ts`):
  - Pengeluaran: Gaji, Operasional, Software & Langganan, Marketing, Transport, Lain-lain (the spreadsheet's list)
  - Pemasukan: Penjualan, Jasa / Project, Investasi / Modal, Lain-lain
- Page (same look as Task Management: one white sheet, plain rows, no boxes):
  - Header "Finance" + **Catatan baru**; under it the plain numbers Pemasukan / Pengeluaran / Saldo.
  - Toolbar: pill switch **Pengeluaran · Pemasukan · Rekap**, search, month and year selects (opens on the current
    month; `?m=YYYY-MM` opens a month).
  - Pengeluaran / Pemasukan: rows Tanggal · Keterangan (category under it) · Catatan · Jumlah, then
    "Tambah …" and the total. Click a row to edit or delete it.
  - Rekap: one row per month (Pemasukan, Pengeluaran, Saldo) + "Total setahun"; click a month to open it.
- A new entry posts a Finance notification (`income_new` / `expense_new`) linking to its month.
- The old `finance_expenses` table (007, fixed monthly costs) is no longer shown; it is kept for history.
