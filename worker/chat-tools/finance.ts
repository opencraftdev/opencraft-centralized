#!/usr/bin/env bun
// Finance CLI for the /chat agent (skill "finance"). Contract: docs/FINANCE.md, docs/CHAT.md.
// Talks to Supabase REST with the service key, but only touches finance_entries (and reads task_members, drive_files).
// Every command prints one JSON document on stdout; errors print {"error": "..."} and exit 1.
//
//   finance context
//   finance list [--month 2026-11] [--year 2026] [--kind income|expense] [--pic Rafi] [--search kata]
//   finance recap [--year 2026]
//   finance add '<json>'            {kind, description, amount, date?, category?, pic?, note?, proof?}
//   finance update <id> '<json>'     (same fields, partial; "proof": null removes it)
//   finance delete <id>
//
// Config: FINANCE_ENV (default ~/opencraft-chat/tools/.env) with SUPABASE_URL and SUPABASE_SECRET_KEY.

import { readFileSync } from "node:fs";
import { homedir } from "node:os";

type Row = Record<string, any>;

const TZ = "Asia/Jakarta";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const APP = "https://internal.ocraft.id";
const KINDS = ["income", "expense"] as const;
const KIND_LABEL: Record<string, string> = { income: "Pemasukan", expense: "Pengeluaran" };
// Same lists as src/features/finance/types.ts
const CATEGORIES: Record<string, string[]> = {
  expense: ["Gaji", "Operasional", "Software & Langganan", "Marketing", "Transport", "Lain-lain"],
  income: ["Penjualan", "Jasa / Project", "Investasi / Modal", "Lain-lain"],
};

class CliError extends Error {}
const fail = (msg: string): never => {
  throw new CliError(msg);
};

function loadEnv(): { url: string; key: string } {
  const path = process.env.FINANCE_ENV || `${homedir()}/opencraft-chat/tools/.env`;
  const env: Record<string, string> = {};
  try {
    for (const line of readFileSync(path, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
      if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    // fall back to the process environment
  }
  const url = env.SUPABASE_URL || process.env.SUPABASE_URL;
  const key = env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) fail(`missing SUPABASE_URL / SUPABASE_SECRET_KEY (config ${path})`);
  return { url: url!.replace(/\/$/, ""), key: key! };
}

const { url: BASE, key: KEY } = loadEnv();

async function rest(method: string, path: string, body?: unknown): Promise<any> {
  const res = await fetch(`${BASE}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    let msg = text;
    try {
      const j = JSON.parse(text);
      msg = j.message || j.hint || text;
    } catch {}
    fail(`database ${res.status}: ${msg}`);
  }
  return text ? JSON.parse(text) : null;
}

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
const rupiah = (n: number) => (n < 0 ? "-Rp" : "Rp") + Math.abs(Math.round(n)).toLocaleString("id-ID");

function lastDay(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `${month}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, "0")}`;
}

// ── lookups ──
let membersCache: Row[] | null = null;
async function members(): Promise<Row[]> {
  membersCache ??= await rest("GET", "task_members?select=id,name,role,active&order=sort,name");
  return membersCache!;
}

async function memberIds(v: unknown): Promise<string[]> {
  if (v === null || v === undefined || v === "") return [];
  const list = Array.isArray(v) ? v : String(v).split(/\s*,\s*/);
  const all = (await members()).filter((m) => m.active);
  const ids: string[] = [];
  for (const raw of list) {
    const n = String(raw).trim().toLowerCase();
    if (!n) continue;
    const exact = all.filter((m) => m.id === n || m.name.toLowerCase() === n);
    const hit = exact.length === 1 ? exact : all.filter((m) => m.name.toLowerCase().startsWith(n));
    if (hit.length !== 1)
      fail(
        hit.length > 1
          ? `pic "${raw}" is ambiguous (${hit.map((m) => m.name).join(", ")})`
          : `pic "${raw}" not found. Team: ${all.map((m) => m.name).join(", ")}. Ask the user.`,
      );
    if (!ids.includes(hit[0].id)) ids.push(hit[0].id);
  }
  return ids;
}

function parseJson(arg: string | undefined, what: string): Row {
  if (!arg) fail(`${what}: JSON argument required`);
  try {
    const v = JSON.parse(arg!);
    if (!v || typeof v !== "object" || Array.isArray(v)) fail(`${what}: JSON must be an object`);
    return v;
  } catch (e) {
    if (e instanceof CliError) throw e;
    fail(`${what}: invalid JSON (${(e as Error).message})`);
  }
  return {};
}

function entryId(v: string | undefined): string {
  if (!v || !UUID.test(v)) fail(`entry id (full uuid) required, got ${JSON.stringify(v)}`);
  return v!.toLowerCase();
}

function flag(args: string[], name: string): string | undefined {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
}

async function shape(r: Row): Promise<Row> {
  const byId = new Map((await members()).map((m) => [m.id, m.name]));
  return {
    id: r.id,
    jenis: KIND_LABEL[r.kind],
    kind: r.kind,
    tanggal: r.entry_date,
    keterangan: r.description,
    kategori: r.category,
    jumlah: Number(r.amount),
    jumlah_text: rupiah(Number(r.amount)),
    pic: (r.pic_ids ?? []).map((id: string) => byId.get(id) ?? "?"),
    catatan: r.note || undefined,
    bukti: Boolean(r.proof_file_id),
    link: `${APP}/finance?m=${String(r.entry_date).slice(0, 7)}`,
  };
}

// Fields accepted by add/update → finance_entries columns.
async function toColumns(v: Row, creating: boolean): Promise<Row> {
  const known = ["kind", "description", "amount", "date", "category", "pic", "note", "proof"];
  const extra = Object.keys(v).filter((k) => !known.includes(k));
  if (extra.length) fail(`unknown field(s) ${extra.join(", ")}. Fields: ${known.join(", ")}`);
  const row: Row = {};
  if (v.kind !== undefined || creating) {
    if (!KINDS.includes(v.kind)) fail(`kind must be "income" (pemasukan) or "expense" (pengeluaran)`);
    row.kind = v.kind;
  }
  if (v.description !== undefined || creating) {
    if (typeof v.description !== "string" || !v.description.trim()) fail("description (keterangan) is required");
    row.description = v.description.trim();
  }
  if (v.amount !== undefined || creating) {
    const n = typeof v.amount === "number" ? v.amount : typeof v.amount === "string" && /^\d+$/.test(v.amount) ? Number(v.amount) : NaN;
    if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) fail(`amount must be a whole number of rupiah > 0 (e.g. 50000), got ${JSON.stringify(v.amount)}`);
    row.amount = n;
  }
  if (v.date !== undefined || creating) {
    const d = v.date ?? today();
    if (typeof d !== "string" || !DATE.test(d) || isNaN(Date.parse(d))) fail(`date must be YYYY-MM-DD, got ${JSON.stringify(v.date)}`);
    row.entry_date = d;
  }
  if (v.note !== undefined) row.note = String(v.note ?? "").trim();
  if (v.pic !== undefined) row.pic_ids = await memberIds(v.pic);
  if (v.proof !== undefined) {
    if (v.proof === null || v.proof === "") row.proof_file_id = null;
    else {
      if (typeof v.proof !== "string" || !UUID.test(v.proof)) fail(`proof must be the file_id of an IMG: line, got ${JSON.stringify(v.proof)}`);
      const [f] = await rest("GET", `drive_files?select=id,mime_type&id=eq.${v.proof}`);
      if (!f) fail(`proof file ${v.proof} not found`);
      if (!String(f.mime_type).startsWith("image/")) fail(`proof must be an image (got ${f.mime_type})`);
      row.proof_file_id = v.proof;
    }
  }
  return row;
}

async function checkCategory(kind: string, category: unknown): Promise<string> {
  const list = CATEGORIES[kind];
  if (category === undefined || category === null || category === "") return "Lain-lain";
  const hit = list.find((c) => c.toLowerCase() === String(category).trim().toLowerCase());
  if (!hit) fail(`category "${category}" is not valid for ${kind}. Choose one of: ${list.join(", ")}`);
  return hit!;
}

// ── commands ──
async function cmdContext() {
  const t = today();
  const month = t.slice(0, 7);
  const rows: Row[] = await rest("GET", `finance_entries?select=kind,amount&entry_date=gte.${month}-01&entry_date=lte.${lastDay(month)}`);
  const sum = (k: string) => rows.filter((r) => r.kind === k).reduce((s, r) => s + Number(r.amount), 0);
  return {
    today: t,
    team: (await members()).filter((m) => m.active).map((m) => ({ name: m.name, role: m.role })),
    categories: { expense: CATEGORIES.expense, income: CATEGORIES.income },
    this_month: { month, pemasukan: rupiah(sum("income")), pengeluaran: rupiah(sum("expense")), saldo: rupiah(sum("income") - sum("expense")), entries: rows.length },
    link: `${APP}/finance`,
  };
}

async function cmdList(args: string[]) {
  const month = flag(args, "month");
  const year = flag(args, "year");
  const kind = flag(args, "kind");
  const pic = flag(args, "pic");
  const search = flag(args, "search")?.toLowerCase();
  let range: [string, string];
  if (month) {
    if (!/^\d{4}-\d{2}$/.test(month)) fail("--month must be YYYY-MM");
    range = [`${month}-01`, lastDay(month)];
  } else if (year) {
    if (!/^\d{4}$/.test(year)) fail("--year must be YYYY");
    range = [`${year}-01-01`, `${year}-12-31`];
  } else {
    const m = today().slice(0, 7);
    range = [`${m}-01`, lastDay(m)];
  }
  if (kind && !KINDS.includes(kind as any)) fail(`--kind must be income or expense`);
  let q = `finance_entries?select=*&entry_date=gte.${range[0]}&entry_date=lte.${range[1]}&order=entry_date,created_at`;
  if (kind) q += `&kind=eq.${kind}`;
  let rows: Row[] = await rest("GET", q);
  if (pic) {
    const [id] = await memberIds(pic);
    rows = rows.filter((r) => (r.pic_ids ?? []).includes(id));
  }
  let out = await Promise.all(rows.map(shape));
  if (search) out = out.filter((r) => [r.keterangan, r.kategori, r.catatan ?? "", ...r.pic].some((x: string) => x.toLowerCase().includes(search)));
  const total = (k: string) => out.filter((r) => r.kind === k).reduce((s, r) => s + r.jumlah, 0);
  return {
    from: range[0],
    to: range[1],
    entries: out,
    total: { pemasukan: rupiah(total("income")), pengeluaran: rupiah(total("expense")), saldo: rupiah(total("income") - total("expense")) },
  };
}

async function cmdRecap(args: string[]) {
  const year = flag(args, "year") ?? today().slice(0, 4);
  if (!/^\d{4}$/.test(year)) fail("--year must be YYYY");
  const rows: Row[] = await rest("GET", `finance_entries?select=kind,amount,entry_date&entry_date=gte.${year}-01-01&entry_date=lte.${year}-12-31`);
  const names = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  let ti = 0;
  let te = 0;
  const months = names.map((name, i) => {
    const mine = rows.filter((r) => Number(String(r.entry_date).slice(5, 7)) === i + 1);
    const inc = mine.filter((r) => r.kind === "income").reduce((s, r) => s + Number(r.amount), 0);
    const exp = mine.filter((r) => r.kind === "expense").reduce((s, r) => s + Number(r.amount), 0);
    ti += inc;
    te += exp;
    return { bulan: name, pemasukan: rupiah(inc), pengeluaran: rupiah(exp), saldo: rupiah(inc - exp) };
  });
  return { year, months, total: { pemasukan: rupiah(ti), pengeluaran: rupiah(te), saldo: rupiah(ti - te) }, link: `${APP}/finance` };
}

async function cmdAdd(json: string | undefined) {
  const v = parseJson(json, "add");
  const row = await toColumns(v, true);
  row.category = await checkCategory(row.kind, v.category);
  row.created_by = null;
  const [r] = await rest("POST", "finance_entries", row);
  return { added: await shape(r) };
}

async function cmdUpdate(id: string, json: string | undefined) {
  const v = parseJson(json, "update");
  const [cur] = await rest("GET", `finance_entries?select=*&id=eq.${id}`);
  if (!cur) fail(`entry ${id} not found`);
  const row = await toColumns(v, false);
  const kind = row.kind ?? cur.kind;
  if (v.category !== undefined) row.category = await checkCategory(kind, v.category);
  else if (row.kind && !CATEGORIES[kind].includes(cur.category)) row.category = "Lain-lain";
  if (!Object.keys(row).length) fail("nothing to update");
  const [r] = await rest("PATCH", `finance_entries?id=eq.${id}`, row);
  return { updated: await shape(r) };
}

async function cmdDelete(id: string) {
  const [cur] = await rest("GET", `finance_entries?select=*&id=eq.${id}`);
  if (!cur) fail(`entry ${id} not found`);
  await rest("DELETE", `finance_entries?id=eq.${id}`);
  return { deleted: await shape(cur) };
}

async function main() {
  const [cmd, ...args] = process.argv.slice(2);
  switch (cmd) {
    case "context":
      return cmdContext();
    case "list":
      return cmdList(args);
    case "recap":
      return cmdRecap(args);
    case "add":
      return cmdAdd(args[0]);
    case "update":
      return cmdUpdate(entryId(args[0]), args[1]);
    case "delete":
      return cmdDelete(entryId(args[0]));
    default:
      fail(`unknown command ${JSON.stringify(cmd ?? "")}. Commands: context, list, recap, add, update, delete`);
  }
}

main()
  .then((out) => console.log(JSON.stringify(out, null, 1)))
  .catch((e) => {
    console.log(JSON.stringify({ error: e instanceof CliError ? e.message : String(e?.message ?? e) }));
    process.exit(1);
  });
