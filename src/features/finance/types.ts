export type ExpenseCategory =
  | "infrastructure"
  | "ai-tools"
  | "software"
  | "office"
  | "marketing";

export type ExpenseFrequency = "monthly" | "yearly" | "one-time";

export type ExpenseStatus = "paid" | "pending";

export type Expense = {
  id: string;
  /** Human-readable line item, e.g. "Vercel Pro hosting". */
  item: string;
  vendor: string;
  category: ExpenseCategory;
  frequency: ExpenseFrequency;
  /** Normalised monthly cost in IDR (yearly costs are pre-divided by 12). */
  amount: number;
  /** Day of month the charge lands, 1–28. */
  billingDay: number;
};

/**
 * An expense with its status resolved against the current billing cycle.
 * Status is not stored — it resets every month and is derived from where
 * today sits relative to each item's billing day.
 */
export type ResolvedExpense = Expense & { status: ExpenseStatus };
