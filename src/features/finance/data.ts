import type { Expense, ExpenseCategory, ResolvedExpense } from "./types";

/**
 * The company's recurring monthly operating expenses.
 *
 * These line items are normalised to a monthly figure and sum to exactly
 * Rp 2.500.000 — the current monthly burn. Status is NOT stored here: it
 * resets every billing cycle and is derived from today's position in the
 * month (see {@link resolveExpenses}). When the finance MCP agent comes
 * online this static list is replaced by a live Supabase-backed query.
 */
export const EXPENSES: Expense[] = [
  {
    id: "exp-supabase",
    item: "Supabase Pro",
    vendor: "Supabase",
    category: "infrastructure",
    frequency: "monthly",
    amount: 400_000,
    billingDay: 1,
  },
  {
    id: "exp-internet",
    item: "Office internet",
    vendor: "Biznet",
    category: "office",
    frequency: "monthly",
    amount: 400_000,
    billingDay: 5,
  },
  {
    id: "exp-vercel",
    item: "Vercel Pro hosting",
    vendor: "Vercel",
    category: "infrastructure",
    frequency: "monthly",
    amount: 320_000,
    billingDay: 3,
  },
  {
    id: "exp-anthropic",
    item: "Claude subscription",
    vendor: "Anthropic",
    category: "ai-tools",
    frequency: "monthly",
    amount: 320_000,
    billingDay: 8,
  },
  {
    id: "exp-blotato",
    item: "Social automation",
    vendor: "Blotato",
    category: "marketing",
    frequency: "monthly",
    amount: 290_000,
    billingDay: 12,
  },
  {
    id: "exp-cloudinary",
    item: "Media CDN",
    vendor: "Cloudinary",
    category: "infrastructure",
    frequency: "monthly",
    amount: 240_000,
    billingDay: 6,
  },
  {
    id: "exp-workspace",
    item: "Google Workspace",
    vendor: "Google",
    category: "software",
    frequency: "monthly",
    amount: 180_000,
    billingDay: 1,
  },
  {
    id: "exp-misc",
    item: "Utilities & misc",
    vendor: "Various",
    category: "office",
    frequency: "monthly",
    amount: 170_000,
    billingDay: 20,
  },
  {
    id: "exp-canva",
    item: "Canva Pro",
    vendor: "Canva",
    category: "software",
    frequency: "yearly",
    amount: 130_000,
    billingDay: 15,
  },
  {
    id: "exp-domain",
    item: "Domains & DNS",
    vendor: "Cloudflare",
    category: "infrastructure",
    frequency: "yearly",
    amount: 50_000,
    billingDay: 22,
  },
];

/** Format an IDR amount the Indonesian way, e.g. 2500000 → "Rp 2.500.000". */
export function formatIDR(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export const CATEGORY_META: Record<ExpenseCategory, { label: string; color: string }> = {
  infrastructure: { label: "Infrastructure", color: "#1a73e8" },
  "ai-tools": { label: "AI tools", color: "#9334E6" },
  software: { label: "Software", color: "#188038" },
  office: { label: "Office", color: "#E37400" },
  marketing: { label: "Marketing", color: "#D93025" },
};

export type BillingCycle = {
  /** e.g. "June 2026" — the cycle currently in view. */
  monthLabel: string;
  /** e.g. "1 Jul 2026" — the day the burn resets to zero. */
  resetLabel: string;
  /** Total days in the current month. */
  totalDays: number;
  /** Day-of-month today (1-based). */
  dayOfMonth: number;
  /** Whole days left until the next reset. */
  daysRemaining: number;
  /** Fraction of the cycle elapsed, 0–1. */
  progress: number;
};

/** Resolve the active billing cycle for a given moment. */
export function getBillingCycle(now: Date): BillingCycle {
  const year = now.getFullYear();
  const month = now.getMonth();
  const totalDays = new Date(year, month + 1, 0).getDate();
  const dayOfMonth = now.getDate();
  const nextReset = new Date(year, month + 1, 1);

  return {
    monthLabel: now.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
    resetLabel: nextReset.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }),
    totalDays,
    dayOfMonth,
    daysRemaining: totalDays - dayOfMonth,
    progress: dayOfMonth / totalDays,
  };
}

/**
 * Stamp each expense with a Paid/Pending status for the current cycle.
 * An item is Paid once its billing day has passed this month; everything
 * flips back to Pending the moment a new month begins.
 */
export function resolveExpenses(expenses: Expense[], now: Date): ResolvedExpense[] {
  const day = now.getDate();
  return expenses.map((e) => ({
    ...e,
    status: e.billingDay <= day ? "paid" : "pending",
  }));
}

export type CategoryTotal = {
  category: ExpenseCategory;
  total: number;
  share: number;
};

export type FinanceSummary = {
  monthlyTotal: number;
  itemCount: number;
  paidTotal: number;
  pendingTotal: number;
  topCategory: ExpenseCategory;
  byCategory: CategoryTotal[];
};

export function getFinanceSummary(expenses: ResolvedExpense[]): FinanceSummary {
  const monthlyTotal = expenses.reduce((sum, e) => sum + e.amount, 0);
  const paidTotal = expenses
    .filter((e) => e.status === "paid")
    .reduce((sum, e) => sum + e.amount, 0);

  const totals = new Map<ExpenseCategory, number>();
  for (const e of expenses) {
    totals.set(e.category, (totals.get(e.category) ?? 0) + e.amount);
  }

  const byCategory: CategoryTotal[] = [...totals.entries()]
    .map(([category, total]) => ({
      category,
      total,
      share: monthlyTotal === 0 ? 0 : total / monthlyTotal,
    }))
    .sort((a, b) => b.total - a.total);

  return {
    monthlyTotal,
    itemCount: expenses.length,
    paidTotal,
    pendingTotal: monthlyTotal - paidTotal,
    topCategory: byCategory[0]?.category ?? "infrastructure",
    byCategory,
  };
}
