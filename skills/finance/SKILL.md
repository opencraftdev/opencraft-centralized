---
name: finance
title: Finance (Pemasukan & Pengeluaran)
description: Mencatat dan membaca buku keuangan tim di /finance: tambah pemasukan atau pengeluaran (dengan PIC yang bayar/terima dan bukti gambar), ubah atau hapus catatan, total per bulan, rekap setahun. Pakai setiap kali user bicara soal uang keluar/masuk, bayar, beli, transfer, struk, nota, biaya, pemasukan, pengeluaran, saldo, atau minta mencatat keuangan.
---

# Finance (`/finance`)

Buku keuangan tim OpenCraft ada di https://internal.ocraft.id/finance. Semua perubahan lewat CLI ini, **jangan pernah** memanggil Supabase langsung atau membaca file `.env`:

```bash
~/opencraft-chat/tools/finance <perintah> ...
```

Setiap perintah mengeluarkan JSON. Kalau ada `"error"`, baca pesannya, perbaiki, atau tanya user. Jangan mengarang.

## Langkah wajib

1. **Selalu mulai dengan** `finance context` → tanggal hari ini (WIB), anggota tim (untuk PIC), kategori, total bulan ini.
2. Untuk mengubah / menghapus catatan yang sudah ada, cari dulu id-nya: `finance list --search "kata"` (atau `--month`). Kalau ada beberapa yang mirip, tanya user yang mana.
3. Jalankan perubahan, lalu laporkan hasilnya (lihat "Jawaban").

## Perintah

| Perintah | Kegunaan |
|---|---|
| `finance context` | Hari ini, tim, kategori, total bulan ini |
| `finance list [--month 2026-11] [--year 2026] [--kind income\|expense] [--pic Rafi] [--search kata]` | Catatan (default: bulan ini) + total |
| `finance recap [--year 2026]` | Pemasukan, pengeluaran, saldo per bulan + total setahun |
| `finance add '<json>'` | Tambah catatan |
| `finance update <id> '<json>'` | Ubah sebagian field |
| `finance delete <id>` | Hapus catatan |

Field JSON untuk `add` / `update`:

```json
{"kind": "expense", "description": "Bensin ke vendor PCB", "amount": 50000, "date": "2026-11-27",
 "category": "Transport", "pic": ["Rafi", "Bagas"], "note": "Pertamina Cikarang", "proof": "<file_id dari baris IMG:>"}
```

- `kind`: `expense` (pengeluaran: bayar, beli, transfer keluar) · `income` (pemasukan: dibayar klien, terima uang, modal masuk).
- `amount`: rupiah bulat. "50rb" = 50000, "1,5jt" = 1500000, "2 juta" = 2000000.
- `date`: `YYYY-MM-DD` (WIB). Kosong = hari ini. "kemarin", "Senin lalu" → hitung dari `today`.
- `category` — pengeluaran: Gaji, Operasional, Software & Langganan, Marketing, Transport, Lain-lain · pemasukan: Penjualan, Jasa / Project, Investasi / Modal, Lain-lain. Pilih yang paling cocok; ragu → `Lain-lain`.
- `pic`: siapa yang **bayar** (pengeluaran) atau **terima** (pemasukan). Bisa lebih dari satu. Nama dari `context`.
- `proof` (opsional): bukti gambar. Gambar yang user lampirkan di chat muncul di pesannya sebagai baris
  `IMG: {"file_id":"…","name":"…"}` → pakai `file_id` itu. `null` menghapus bukti.
- Quote tunggal untuk JSON di shell. Kalau teks berisi `'`, tulis JSON ke file dulu lalu `finance add "$(cat file.json)"`.

## Aturan

- **Tanya dulu, jangan menebak**: jumlah, pemasukan atau pengeluaran, atau PIC yang tidak jelas → tanya user (daftar bernomor), lalu berhenti. PIC tidak disebut dan user menulis "aku/saya" → tanya namanya (kamu tidak tahu siapa yang sedang chat kecuali dia menyebut namanya). Tanggal boleh default hari ini, kategori boleh kamu pilih.
- Satu pesan berisi beberapa transaksi → satu catatan per transaksi.
- User melampirkan gambar struk tanpa menyebut jumlah → tanya jumlah dan keterangannya (kamu tidak bisa membaca isi gambar), lalu simpan gambar sebagai `proof`.
- **Hapus** hanya kalau user jelas minta menghapus catatan tertentu; sebut keterangan dan jumlahnya.
- Catatan dari chat tercatat sebagai "AI" di notifikasi dashboard. Itu normal.

## Jawaban

- Bahasa Indonesia, singkat. Setelah mencatat: tabel kecil (Tanggal · Keterangan · Kategori · Jumlah · PIC · Bukti ✓/–) dan link `link` dari hasil perintah.
- Untuk ringkasan: total pemasukan, pengeluaran, saldo; sebut 3 pengeluaran terbesar kalau relevan.
- Jangan menampilkan id mentah kecuali user minta.
