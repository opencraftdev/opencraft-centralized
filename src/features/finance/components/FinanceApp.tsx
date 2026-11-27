"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "motion/react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import InputBase from "@mui/material/InputBase";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Typography from "@mui/material/Typography";
import AddRounded from "@mui/icons-material/AddRounded";
import SearchRounded from "@mui/icons-material/SearchRounded";
import ReceiptLongRounded from "@mui/icons-material/ReceiptLongRounded";
import Tooltip from "@mui/material/Tooltip";
import { driveContentUrl } from "@/lib/drive/links";
import { toastError } from "@/components/ui/Toast";
import { EASE_OUT, SPRING } from "@/components/ui/motion";
import { listEntries, listMembers } from "../api";
import { AvatarStack } from "@/features/tasks/components/bits";
import type { Member } from "@/features/tasks/types";
import { KIND_META, MONTHS, formatDate, formatIDR, type EntryKind, type FinanceEntry } from "../types";
import { EntryDialog } from "./EntryDialog";

// Finance (docs/FINANCE.md), in the style of Task Management: one white sheet, plain text, no boxes.
// Pick a month, switch Pengeluaran / Pemasukan / Rekap, click a row to edit.

type View = EntryKind | "recap";

const VIEWS: { value: View; label: string }[] = [
  { value: "expense", label: "Pengeluaran" },
  { value: "income", label: "Pemasukan" },
  { value: "recap", label: "Rekap" },
];

const pad = (n: number) => String(n).padStart(2, "0");
const sum = (rows: FinanceEntry[]) => rows.reduce((s, e) => s + e.amount, 0);
const num = { fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" } as const;
const LINE = "1px solid #EEF1F4";

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
  const [month, setMonth] = useState(initial.month);
  const [view, setView] = useState<View>("expense");
  const [q, setQ] = useState("");
  const [entries, setEntries] = useState<FinanceEntry[] | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  useEffect(() => {
    listMembers().then(setMembers, () => {});
  }, []);
  const memberById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
  const [editing, setEditing] = useState<{ entry: FinanceEntry | null; kind: EntryKind } | null>(null);

  useEffect(() => {
    if (params.get("m")) router.replace("/finance", { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const monthRows = byMonth[month];
  const income = sum(monthRows.filter((e) => e.kind === "income"));
  const expense = sum(monthRows.filter((e) => e.kind === "expense"));
  const yearIncome = sum((entries ?? []).filter((e) => e.kind === "income"));
  const yearExpense = sum((entries ?? []).filter((e) => e.kind === "expense"));
  const recap = view === "recap";

  const years = Array.from(new Set([2025, now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1, year])).sort();
  const isThisMonth = year === now.getFullYear() && month === now.getMonth();
  const defaultDate = `${year}-${pad(month + 1)}-${isThisMonth ? pad(now.getDate()) : "01"}`;
  const add = (kind: EntryKind) => setEditing({ entry: null, kind });

  return (
    <Box sx={{ minHeight: "100%", bgcolor: "#F0F4F9", px: { xs: 1, md: 2 }, pt: 1, pb: { xs: 1, md: 2 } }}>
      <Box sx={{ bgcolor: "#fff", borderRadius: "16px", overflow: "hidden", minHeight: "calc(100dvh - 64px - 24px)", display: "flex", flexDirection: "column" }}>
        {/* Header */}
        <Box sx={{ display: "flex", alignItems: { xs: "flex-start", sm: "center" }, gap: 2, px: { xs: 2, sm: 3 }, pt: 2.5, pb: 1.5, flexWrap: "wrap" }}>
          <Box sx={{ flex: "1 1 260px", minWidth: 0 }}>
            <Typography component="h1" sx={{ fontSize: "1.5rem", color: "#1F1F1F" }}>
              Finance
            </Typography>
            <Typography sx={{ fontSize: "0.875rem", color: "#5F6368", mt: 0.25 }}>
              Catatan pemasukan dan pengeluaran tim, per bulan.
            </Typography>
          </Box>
          <Button variant="contained" disableElevation startIcon={<AddRounded />} onClick={() => add(view === "income" ? "income" : "expense")} sx={{ borderRadius: "9999px", flexShrink: 0 }}>
            Catatan baru
          </Button>
        </Box>

        {/* Summary: plain numbers */}
        <Box sx={{ display: "flex", flexWrap: "wrap", columnGap: { xs: 3, sm: 5 }, rowGap: 1.5, px: { xs: 2, sm: 3 }, pt: 1, pb: 2.5 }}>
          <Stat label={recap ? `Pemasukan ${year}` : "Pemasukan"} value={recap ? yearIncome : income} color={KIND_META.income.color} />
          <Stat label={recap ? `Pengeluaran ${year}` : "Pengeluaran"} value={recap ? yearExpense : expense} color={KIND_META.expense.color} />
          <Stat label="Saldo" value={recap ? yearIncome - yearExpense : income - expense} />
        </Box>

        {/* Toolbar */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: { xs: 2, sm: 3 }, py: 1.25, borderTop: "1px solid #E0E3E7", borderBottom: "1px solid #E0E3E7", flexWrap: "wrap" }}>
          <Box role="tablist" sx={{ display: "inline-flex", p: 0.5, bgcolor: "#F0F4F9", borderRadius: "9999px", gap: 0.5 }}>
            {VIEWS.map((v) => {
              const on = v.value === view;
              return (
                <Box
                  key={v.value}
                  component="button"
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => setView(v.value)}
                  sx={{
                    height: 32,
                    px: 1.75,
                    border: "none",
                    borderRadius: "9999px",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    fontSize: "0.8125rem",
                    fontWeight: on ? 600 : 500,
                    bgcolor: "transparent",
                    color: on ? "#0B57D0" : "#444746",
                    position: "relative",
                    transition: "color 200ms",
                  }}
                >
                  {on && (
                    <motion.span
                      layoutId="finance-view-pill"
                      transition={SPRING}
                      style={{ position: "absolute", inset: 0, borderRadius: 9999, background: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,.12)" }}
                    />
                  )}
                  <Box component="span" sx={{ position: "relative" }}>
                    {v.label}
                  </Box>
                </Box>
              );
            })}
          </Box>

          <Box sx={{ flex: 1 }} />

          {!recap && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, height: 36, px: 1.5, bgcolor: "#F0F4F9", borderRadius: "9999px", width: { xs: "100%", sm: 220 }, order: { xs: 5, sm: 0 } }}>
              <SearchRounded sx={{ fontSize: 18, color: "#5F6368" }} />
              <InputBase value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari catatan…" sx={{ flex: 1, fontSize: "0.875rem" }} inputProps={{ "aria-label": "Cari catatan" }} />
            </Box>
          )}
          {!recap && (
            <Select size="small" value={month} onChange={(e) => setMonth(Number(e.target.value))} sx={selectSx} aria-label="Bulan">
              {MONTHS.map((m, i) => (
                <MenuItem key={m} value={i} sx={{ fontSize: "0.875rem" }}>
                  {m}
                </MenuItem>
              ))}
            </Select>
          )}
          <Select size="small" value={year} onChange={(e) => setYear(Number(e.target.value))} sx={{ ...selectSx, minWidth: 96 }} aria-label="Tahun">
            {years.map((y) => (
              <MenuItem key={y} value={y} sx={{ fontSize: "0.875rem" }}>
                {y}
              </MenuItem>
            ))}
          </Select>
        </Box>

        {/* Content */}
        <motion.div
          key={`${view}-${year}-${recap ? "" : month}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: EASE_OUT }}
          style={{ flex: 1, minHeight: 0 }}
        >
          <Box sx={{ px: { xs: 2, sm: 3 }, py: 1.5, maxWidth: 980 }}>
            {entries === null ? (
              <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
                <CircularProgress size={24} />
              </Box>
            ) : recap ? (
              <Recap
                byMonth={byMonth}
                onOpen={(i) => {
                  setMonth(i);
                  setView("expense");
                }}
              />
            ) : (
              <Ledger
                kind={view as EntryKind}
                monthLabel={`${MONTHS[month]} ${year}`}
                rows={monthRows.filter((e) => e.kind === view)}
                q={q}
                memberById={memberById}
                onAdd={() => add(view as EntryKind)}
                onEdit={(entry) => setEditing({ entry, kind: entry.kind })}
              />
            )}
          </Box>
        </motion.div>
      </Box>

      {editing && (
        <EntryDialog entry={editing.entry} kind={editing.kind} defaultDate={defaultDate} members={members} onClose={() => setEditing(null)} onSaved={load} />
      )}
    </Box>
  );
}

function Stat({ label, value, color = "#1F1F1F" }: { label: string; value: number; color?: string }) {
  return (
    <Box>
      <Typography sx={{ fontSize: "0.8125rem", color: "#5F6368" }}>{label}</Typography>
      <Typography sx={{ fontSize: "1.375rem", color: value < 0 ? KIND_META.expense.color : color, ...num }}>{formatIDR(value)}</Typography>
    </Box>
  );
}

const headSx = { fontSize: "0.75rem", color: "#5F6368", py: 1, borderBottom: LINE } as const;

function Ledger({
  kind,
  monthLabel,
  rows,
  q,
  memberById,
  onAdd,
  onEdit,
}: {
  kind: EntryKind;
  monthLabel: string;
  rows: FinanceEntry[];
  q: string;
  memberById: Map<string, Member>;
  onAdd: () => void;
  onEdit: (e: FinanceEntry) => void;
}) {
  const s = q.trim().toLowerCase();
  const shown = s
    ? rows.filter((r) =>
        [r.description, r.category, r.note, ...r.pic_ids.map((id) => memberById.get(id)?.name ?? "")].some((x) => x.toLowerCase().includes(s)),
      )
    : rows;
  const label = KIND_META[kind].label.toLowerCase();

  return (
    <Box>
      <Box sx={{ display: "flex", gap: 2, ...headSx }}>
        <Box sx={{ width: 84, flexShrink: 0 }}>Tanggal</Box>
        <Box sx={{ flex: 1 }}>Keterangan</Box>
        <Box sx={{ width: { xs: 64, sm: 120 }, flexShrink: 0 }}>PIC</Box>
        <Box sx={{ flex: 1, display: { xs: "none", md: "block" } }}>Catatan</Box>
        <Box sx={{ width: 130, textAlign: "right", flexShrink: 0 }}>Jumlah</Box>
      </Box>

      {shown.length === 0 && (
        <Typography sx={{ fontSize: "0.875rem", color: "#5F6368", py: 1.5, borderBottom: LINE }}>
          {s ? "Tidak ada yang cocok." : `Belum ada ${label} di ${monthLabel}.`}
        </Typography>
      )}

      {shown.map((r, i) => (
        <Box
          key={r.id}
          component="button"
          type="button"
          onClick={() => onEdit(r)}
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 2,
            width: "100%",
            py: 1.1,
            border: "none",
            borderBottom: LINE,
            bgcolor: "transparent",
            cursor: "pointer",
            fontFamily: "inherit",
            textAlign: "left",
            animation: `oc-rise 320ms cubic-bezier(0.22, 1, 0.36, 1) ${Math.min(i, 10) * 30}ms both`,
            "& .row-title": { transition: "color 150ms" },
            "&:hover .row-title": { color: "#0B57D0" },
            "&:focus-visible": { outline: "2px solid #0B57D0", outlineOffset: 2, borderRadius: "6px" },
          }}
        >
          <Typography sx={{ width: 84, flexShrink: 0, fontSize: "0.8125rem", color: "#5F6368", ...num }}>{formatDate(r.entry_date)}</Typography>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography className="row-title" sx={{ fontSize: "0.875rem", color: "#1F1F1F", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {r.description}
            </Typography>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
              <Typography sx={{ fontSize: "0.75rem", color: "#5F6368" }}>{r.category}</Typography>
              {r.proof_file_id && (
                <Tooltip title="Lihat bukti">
                  <Box
                    component="span"
                    role="link"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(driveContentUrl(r.proof_file_id!), "_blank", "noopener");
                    }}
                    sx={{ display: "inline-flex", alignItems: "center", gap: 0.25, fontSize: "0.75rem", color: "#0B57D0", "&:hover": { textDecoration: "underline" } }}
                  >
                    <ReceiptLongRounded sx={{ fontSize: 14 }} />
                    Bukti
                  </Box>
                </Tooltip>
              )}
            </Box>
          </Box>
          <Box sx={{ width: { xs: 64, sm: 120 }, flexShrink: 0, display: "flex", alignItems: "center", gap: 0.75, minWidth: 0 }}>
            {r.pic_ids.length > 0 ? (
              <>
                <AvatarStack ids={r.pic_ids} members={memberById} size={22} />
                {r.pic_ids.length === 1 && (
                  <Typography sx={{ display: { xs: "none", sm: "block" }, fontSize: "0.8125rem", color: "#444746", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {memberById.get(r.pic_ids[0])?.name}
                  </Typography>
                )}
              </>
            ) : (
              <Typography sx={{ fontSize: "0.75rem", color: "#9AA0A6", whiteSpace: "nowrap" }}>Belum ada</Typography>
            )}
          </Box>
          <Typography sx={{ flex: 1, minWidth: 0, display: { xs: "none", md: "block" }, fontSize: "0.8125rem", color: "#5F6368", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {r.note}
          </Typography>
          <Typography sx={{ width: 130, flexShrink: 0, textAlign: "right", fontSize: "0.875rem", color: "#1F1F1F", ...num }}>{formatIDR(r.amount)}</Typography>
        </Box>
      ))}

      <Box sx={{ display: "flex", alignItems: "center", gap: 2, py: 1.25 }}>
        <Button size="small" startIcon={<AddRounded />} onClick={onAdd} sx={{ borderRadius: "9999px", ml: -1, color: "#444746" }}>
          Tambah {label}
        </Button>
        <Box sx={{ flex: 1 }} />
        <Typography sx={{ fontSize: "0.8125rem", color: "#5F6368" }}>Total</Typography>
        <Typography sx={{ width: 130, textAlign: "right", fontSize: "0.9375rem", fontWeight: 500, color: KIND_META[kind].color, ...num }}>{formatIDR(sum(shown))}</Typography>
      </Box>
    </Box>
  );
}

function Recap({ byMonth, onOpen }: { byMonth: FinanceEntry[][]; onOpen: (month: number) => void }) {
  const rows = byMonth.map((list) => {
    const income = sum(list.filter((e) => e.kind === "income"));
    const expense = sum(list.filter((e) => e.kind === "expense"));
    return { income, expense, saldo: income - expense };
  });
  const total = rows.reduce((t, r) => ({ income: t.income + r.income, expense: t.expense + r.expense, saldo: t.saldo + r.saldo }), { income: 0, expense: 0, saldo: 0 });

  const cols = (r: (typeof rows)[number], strong: boolean) =>
    ([
      [r.income, KIND_META.income.color],
      [r.expense, KIND_META.expense.color],
      [r.saldo, r.saldo < 0 ? KIND_META.expense.color : "#1F1F1F"],
    ] as const).map(([v, c], i) => (
      <Typography key={i} sx={{ width: { xs: 100, sm: 140 }, flexShrink: 0, textAlign: "right", fontSize: "0.875rem", fontWeight: strong ? 500 : 400, color: v ? c : "#9AA0A6", ...num }}>
        {formatIDR(v)}
      </Typography>
    ));

  return (
    <Box sx={{ overflowX: "auto" }}>
      <Box sx={{ minWidth: 440 }}>
        <Box sx={{ display: "flex", gap: 2, ...headSx }}>
          <Box sx={{ flex: 1 }}>Bulan</Box>
          {["Pemasukan", "Pengeluaran", "Saldo"].map((h) => (
            <Box key={h} sx={{ width: { xs: 100, sm: 140 }, flexShrink: 0, textAlign: "right" }}>
              {h}
            </Box>
          ))}
        </Box>
        {rows.map((r, i) => (
          <Box
            key={MONTHS[i]}
            component="button"
            type="button"
            onClick={() => onOpen(i)}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 2,
              width: "100%",
              py: 1.1,
              border: "none",
              borderBottom: LINE,
              bgcolor: "transparent",
              cursor: "pointer",
              fontFamily: "inherit",
              textAlign: "left",
              "& .row-title": { transition: "color 150ms" },
              "&:hover .row-title": { color: "#0B57D0" },
              "&:focus-visible": { outline: "2px solid #0B57D0", outlineOffset: 2, borderRadius: "6px" },
            }}
          >
            <Typography className="row-title" sx={{ flex: 1, fontSize: "0.875rem", color: "#1F1F1F" }}>
              {MONTHS[i]}
            </Typography>
            {cols(r, false)}
          </Box>
        ))}
        <Box sx={{ display: "flex", alignItems: "center", gap: 2, py: 1.25 }}>
          <Typography sx={{ flex: 1, fontSize: "0.875rem", fontWeight: 500, color: "#1F1F1F" }}>Total setahun</Typography>
          {cols(total, true)}
        </Box>
      </Box>
    </Box>
  );
}

const selectSx = {
  height: 36,
  borderRadius: "9999px",
  fontSize: "0.8125rem",
  minWidth: 140,
  bgcolor: "#fff",
  "& .MuiSelect-select": { display: "flex", alignItems: "center", gap: 1, fontSize: "0.8125rem" },
  "& .MuiOutlinedInput-notchedOutline": { borderColor: "#C4C7C5" },
} as const;
