"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import Typography from "@mui/material/Typography";
import AddRounded from "@mui/icons-material/AddRounded";
import ChevronLeftRounded from "@mui/icons-material/ChevronLeftRounded";
import ChevronRightRounded from "@mui/icons-material/ChevronRightRounded";
import { toastError } from "@/components/ui/Toast";
import { listEntries } from "../api";
import { KIND_META, MONTHS, formatDate, formatIDR, type EntryKind, type FinanceEntry } from "../types";
import { EntryDialog } from "./EntryDialog";

// Finance (docs/FINANCE.md): as simple as the team's spreadsheet — a tab per month with its Pemasukan and
// Pengeluaran rows (Tanggal · Keterangan · Kategori · Jumlah · Catatan), plus a "Rekap" tab for the year.

const MAX_W = 1180;
const TOPBAR = 64;
const HEADER_H = 68;
const REKAP = -1;

const CARD = { bgcolor: "#fff", border: "1px solid #E8EAED", borderRadius: "16px", overflow: "hidden" } as const;
const num = { fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" } as const;

const pad = (n: number) => String(n).padStart(2, "0");
const sum = (rows: FinanceEntry[]) => rows.reduce((s, e) => s + e.amount, 0);

type Editing = { entry: FinanceEntry | null; kind: EntryKind } | null;

export function FinanceApp() {
  const router = useRouter();
  const params = useSearchParams();
  const now = new Date();

  // ?m=YYYY-MM (links from notifications) or the current month.
  const initial = (() => {
    const m = /^(\d{4})-(\d{2})$/.exec(params.get("m") ?? "");
    return m ? { year: Number(m[1]), month: Number(m[2]) - 1 } : { year: now.getFullYear(), month: now.getMonth() };
  })();
  const [year, setYear] = useState(initial.year);
  const [tab, setTab] = useState<number>(initial.month); // 0–11 or REKAP
  const [entries, setEntries] = useState<FinanceEntry[] | null>(null);
  const [editing, setEditing] = useState<Editing>(null);

  const load = useCallback(() => {
    listEntries(year).then(setEntries, (e: Error) => {
      toastError(e.message);
      setEntries([]);
    });
  }, [year]);
  useEffect(() => {
    setEntries(null);
    load();
  }, [load]);

  const byMonth = useMemo(() => {
    const out = MONTHS.map(() => [] as FinanceEntry[]);
    for (const e of entries ?? []) out[Number(e.entry_date.slice(5, 7)) - 1]?.push(e);
    return out;
  }, [entries]);

  const goTo = (y: number, t: number) => {
    setYear(y);
    setTab(t);
    if (params.get("m")) router.replace("/finance");
  };

  // New rows default to today in the current month, else the 1st of the month in view.
  const defaultDate =
    tab !== REKAP && year === now.getFullYear() && tab === now.getMonth()
      ? `${year}-${pad(tab + 1)}-${pad(now.getDate())}`
      : `${year}-${pad((tab === REKAP ? now.getMonth() : tab) + 1)}-01`;

  return (
    <Box sx={{ minHeight: "100%", bgcolor: "#F0F4F9" }}>
      {/* Fixed page header */}
      <Box
        sx={{
          position: "fixed",
          top: TOPBAR,
          left: "var(--sidebar-w)",
          transition: "left 280ms cubic-bezier(0.22, 1, 0.36, 1)",
          right: 0,
          zIndex: 10,
          height: HEADER_H,
          bgcolor: "#F0F4F9",
          borderBottom: "1px solid #E8EAED",
          display: "flex",
          alignItems: "center",
        }}
      >
        <Box sx={{ maxWidth: MAX_W, mx: "auto", px: { xs: 2, sm: 3 }, width: "100%", display: "flex", alignItems: "center", gap: 1 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography component="h1" sx={{ fontSize: "1.375rem", lineHeight: "1.75rem", color: "#1F1F1F" }}>
              Finance
            </Typography>
            <Typography sx={{ fontSize: "0.75rem", color: "#5f6368" }}>Pemasukan & pengeluaran per bulan</Typography>
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", bgcolor: "#fff", border: "1px solid #E8EAED", borderRadius: "9999px" }}>
            <IconButton size="small" aria-label="Tahun sebelumnya" onClick={() => goTo(year - 1, tab)}>
              <ChevronLeftRounded fontSize="small" />
            </IconButton>
            <Typography sx={{ fontSize: "0.875rem", fontWeight: 500, px: 0.5, ...num }}>{year}</Typography>
            <IconButton size="small" aria-label="Tahun berikutnya" onClick={() => goTo(year + 1, tab)}>
              <ChevronRightRounded fontSize="small" />
            </IconButton>
          </Box>
          <Button
            variant="contained"
            disableElevation
            startIcon={<AddRounded />}
            onClick={() => setEditing({ entry: null, kind: "expense" })}
            sx={{ borderRadius: "9999px", display: { xs: "none", sm: "inline-flex" } }}
          >
            Tambah
          </Button>
        </Box>
      </Box>

      <Box sx={{ maxWidth: MAX_W, mx: "auto", px: { xs: 2, sm: 3 }, pt: `${HEADER_H + 12}px`, pb: 5 }}>
        <Tabs
          value={tab}
          onChange={(_, v: number) => goTo(year, v)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            mb: 2,
            minHeight: 40,
            "& .MuiTab-root": { textTransform: "none", minHeight: 40, minWidth: 0, px: 1.75, fontSize: "0.875rem" },
          }}
        >
          <Tab value={REKAP} label="Rekap" />
          {MONTHS.map((m, i) => (
            <Tab key={m} value={i} label={byMonth[i].length ? `${m} · ${byMonth[i].length}` : m} />
          ))}
        </Tabs>

        {entries === null ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
            <CircularProgress size={28} />
          </Box>
        ) : tab === REKAP ? (
          <Recap year={year} byMonth={byMonth} onOpen={(i) => goTo(year, i)} />
        ) : (
          <MonthView
            title={`${MONTHS[tab]} ${year}`}
            rows={byMonth[tab]}
            onAdd={(kind) => setEditing({ entry: null, kind })}
            onEdit={(entry) => setEditing({ entry, kind: entry.kind })}
          />
        )}
      </Box>

      {editing && (
        <EntryDialog
          entry={editing.entry}
          kind={editing.kind}
          defaultDate={defaultDate}
          onClose={() => setEditing(null)}
          onSaved={load}
        />
      )}
    </Box>
  );
}

// ── Month: totals + one table per kind ─────────────────────────────────────────

function Totals({ income, expense }: { income: number; expense: number }) {
  const saldo = income - expense;
  const items = [
    { label: "Pemasukan", value: income, color: KIND_META.income.color },
    { label: "Pengeluaran", value: expense, color: KIND_META.expense.color },
    { label: "Saldo", value: saldo, color: saldo < 0 ? KIND_META.expense.color : "#1F1F1F" },
  ];
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" }, gap: 1.5, mb: 2 }}>
      {items.map((it) => (
        <Box key={it.label} sx={{ ...CARD, px: 2.5, py: 2 }}>
          <Typography sx={{ fontSize: "0.8125rem", color: "#5f6368" }}>{it.label}</Typography>
          <Typography sx={{ fontSize: "1.5rem", color: it.color, mt: 0.25, ...num }}>{formatIDR(it.value)}</Typography>
        </Box>
      ))}
    </Box>
  );
}

function MonthView({
  title,
  rows,
  onAdd,
  onEdit,
}: {
  title: string;
  rows: FinanceEntry[];
  onAdd: (kind: EntryKind) => void;
  onEdit: (entry: FinanceEntry) => void;
}) {
  const income = rows.filter((r) => r.kind === "income");
  const expense = rows.filter((r) => r.kind === "expense");
  return (
    <>
      <Totals income={sum(income)} expense={sum(expense)} />
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <Ledger kind="income" title={title} rows={income} onAdd={() => onAdd("income")} onEdit={onEdit} />
        <Ledger kind="expense" title={title} rows={expense} onAdd={() => onAdd("expense")} onEdit={onEdit} />
      </Box>
    </>
  );
}

const COLS = "110px minmax(160px, 2fr) minmax(130px, 1.2fr) 140px minmax(140px, 1.6fr)";
const cell = { px: 2, py: 1.25, fontSize: "0.8125rem", color: "#1F1F1F", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" } as const;

function Ledger({
  kind,
  title,
  rows,
  onAdd,
  onEdit,
}: {
  kind: EntryKind;
  title: string;
  rows: FinanceEntry[];
  onAdd: () => void;
  onEdit: (entry: FinanceEntry) => void;
}) {
  const meta = KIND_META[kind];
  return (
    <Box sx={CARD}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, px: 2.5, py: 1.75, borderBottom: "1px solid #E8EAED" }}>
        <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: meta.color, flexShrink: 0 }} />
        <Typography sx={{ flex: 1, fontSize: "1rem", fontWeight: 500, color: "#1F1F1F" }}>
          {meta.label} {title}
        </Typography>
        <Typography sx={{ fontSize: "0.8125rem", color: "#5f6368", display: { xs: "none", sm: "block" } }}>Total</Typography>
        <Typography sx={{ fontSize: "1rem", fontWeight: 600, color: meta.color, ...num }}>{formatIDR(sum(rows))}</Typography>
        <Button size="small" startIcon={<AddRounded />} onClick={onAdd} sx={{ borderRadius: "9999px", ml: 0.5 }}>
          Tambah
        </Button>
      </Box>

      <Box sx={{ overflowX: "auto" }}>
        <Box sx={{ minWidth: 720 }}>
          <Box sx={{ display: "grid", gridTemplateColumns: COLS, bgcolor: "#F8FAFD", borderBottom: "1px solid #E8EAED" }}>
            {["Tanggal", "Keterangan", "Kategori", "Jumlah (Rp)", "Catatan"].map((h, i) => (
              <Box key={h} sx={{ ...cell, py: 1, fontSize: "0.75rem", fontWeight: 600, color: "#444746", textAlign: i === 3 ? "right" : "left" }}>
                {h}
              </Box>
            ))}
          </Box>
          {rows.length === 0 ? (
            <Box sx={{ px: 2.5, py: 3, fontSize: "0.875rem", color: "#5f6368" }}>
              Belum ada {meta.label.toLowerCase()} bulan ini.{" "}
              <Box component="button" onClick={onAdd} sx={{ all: "unset", cursor: "pointer", color: "#0B57D0", fontWeight: 500 }}>
                Tambah
              </Box>
            </Box>
          ) : (
            rows.map((r) => (
              <Box
                key={r.id}
                role="button"
                tabIndex={0}
                onClick={() => onEdit(r)}
                onKeyDown={(e) => e.key === "Enter" && onEdit(r)}
                sx={{
                  display: "grid",
                  gridTemplateColumns: COLS,
                  borderBottom: "1px solid #F1F3F4",
                  cursor: "pointer",
                  "&:hover": { bgcolor: "#F8FAFD" },
                  "&:last-of-type": { borderBottom: 0 },
                }}
              >
                <Box sx={{ ...cell, color: "#444746", ...num }}>{formatDate(r.entry_date)}</Box>
                <Box sx={{ ...cell, whiteSpace: "nowrap", fontWeight: 500 }} title={r.description}>
                  {r.description}
                </Box>
                <Box sx={{ ...cell, whiteSpace: "nowrap", color: "#444746" }}>{r.category}</Box>
                <Box sx={{ ...cell, textAlign: "right", fontWeight: 500, ...num }}>{formatIDR(r.amount)}</Box>
                <Box sx={{ ...cell, whiteSpace: "nowrap", color: "#5f6368" }} title={r.note}>
                  {r.note}
                </Box>
              </Box>
            ))
          )}
        </Box>
      </Box>
    </Box>
  );
}

// ── Rekap: one row per month + the year total ─────────────────────────────────

const RCOLS = "minmax(120px, 1.2fr) repeat(3, minmax(130px, 1fr))";

function Recap({ year, byMonth, onOpen }: { year: number; byMonth: FinanceEntry[][]; onOpen: (month: number) => void }) {
  const rows = byMonth.map((list) => {
    const income = sum(list.filter((e) => e.kind === "income"));
    const expense = sum(list.filter((e) => e.kind === "expense"));
    return { income, expense, saldo: income - expense };
  });
  const total = rows.reduce((t, r) => ({ income: t.income + r.income, expense: t.expense + r.expense, saldo: t.saldo + r.saldo }), {
    income: 0,
    expense: 0,
    saldo: 0,
  });
  const line = (label: string, r: (typeof rows)[number], strong = false) => (
    <>
      <Box sx={{ ...cell, fontWeight: strong ? 600 : 500 }}>{label}</Box>
      <Box sx={{ ...cell, textAlign: "right", color: r.income ? KIND_META.income.color : "#9AA0A6", fontWeight: strong ? 600 : 400, ...num }}>
        {formatIDR(r.income)}
      </Box>
      <Box sx={{ ...cell, textAlign: "right", color: r.expense ? KIND_META.expense.color : "#9AA0A6", fontWeight: strong ? 600 : 400, ...num }}>
        {formatIDR(r.expense)}
      </Box>
      <Box sx={{ ...cell, textAlign: "right", color: r.saldo < 0 ? KIND_META.expense.color : r.saldo ? "#1F1F1F" : "#9AA0A6", fontWeight: 600, ...num }}>
        {formatIDR(r.saldo)}
      </Box>
    </>
  );

  return (
    <>
      <Totals income={total.income} expense={total.expense} />
      <Box sx={CARD}>
        <Box sx={{ px: 2.5, py: 1.75, borderBottom: "1px solid #E8EAED" }}>
          <Typography sx={{ fontSize: "1rem", fontWeight: 500, color: "#1F1F1F" }}>Rekap {year}</Typography>
        </Box>
        <Box sx={{ overflowX: "auto" }}>
          <Box sx={{ minWidth: 560 }}>
            <Box sx={{ display: "grid", gridTemplateColumns: RCOLS, bgcolor: "#F8FAFD", borderBottom: "1px solid #E8EAED" }}>
              {["Bulan", "Pemasukan", "Pengeluaran", "Saldo"].map((h, i) => (
                <Box key={h} sx={{ ...cell, py: 1, fontSize: "0.75rem", fontWeight: 600, color: "#444746", textAlign: i ? "right" : "left" }}>
                  {h}
                </Box>
              ))}
            </Box>
            {rows.map((r, i) => (
              <Box
                key={MONTHS[i]}
                role="button"
                tabIndex={0}
                onClick={() => onOpen(i)}
                onKeyDown={(e) => e.key === "Enter" && onOpen(i)}
                sx={{ display: "grid", gridTemplateColumns: RCOLS, borderBottom: "1px solid #F1F3F4", cursor: "pointer", "&:hover": { bgcolor: "#F8FAFD" } }}
              >
                {line(MONTHS[i], r)}
              </Box>
            ))}
            <Box sx={{ display: "grid", gridTemplateColumns: RCOLS, bgcolor: "#F8FAFD", borderTop: "2px solid #E8EAED" }}>
              {line("Total setahun", total, true)}
            </Box>
          </Box>
        </Box>
      </Box>
    </>
  );
}
