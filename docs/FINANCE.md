# Finance (/finance)

As simple as the team's spreadsheet (one tab per month + "Rekap"), with income as well as expenses.

- Table `finance_entries` (migration `030_finance_entries.sql`): `kind` (`income` | `expense`), `entry_date`,
  `description` (Keterangan), `category` (Kategori), `amount` (whole rupiah), `note` (Catatan), `created_by`.
  RLS: the whole team (`is_allowed_user()`) reads and writes.
- Categories (`src/features/finance/types.ts`):
  - Pengeluaran: Gaji, Operasional, Software & Langganan, Marketing, Transport, Lain-lain (the spreadsheet's list)
  - Pemasukan: Penjualan, Jasa / Project, Investasi / Modal, Lain-lain
- Page: year switcher, tabs **Rekap · Januari … Desember** (opens on the current month; `?m=YYYY-MM` opens a month).
  - A month shows Pemasukan / Pengeluaran / Saldo and two tables, **Pemasukan <bulan>** and **Pengeluaran <bulan>**
    (Tanggal · Keterangan · Kategori · Jumlah · Catatan, total in the header). Click a row to edit or delete it;
    **Tambah** adds one.
  - Rekap: one row per month (Pemasukan, Pengeluaran, Saldo) + "Total setahun"; click a month to open it.
- A new entry posts a Finance notification (`income_new` / `expense_new`) linking to its month.
- The old `finance_expenses` table (007, fixed monthly costs) is no longer shown; it is kept for history.
