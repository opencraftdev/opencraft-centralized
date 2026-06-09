import type { SupabaseClient } from "@supabase/supabase-js";
import type { Expense, ExpenseCategory, ExpenseFrequency } from "./types";

/** Raw shape of a `finance_expenses` row as returned by Supabase. */
type FinanceExpenseRow = {
  id: string;
  item: string;
  vendor: string;
  category: ExpenseCategory;
  frequency: ExpenseFrequency;
  amount: number;
  billing_day: number;
};

function toExpense(row: FinanceExpenseRow): Expense {
  return {
    id: row.id,
    item: row.item,
    vendor: row.vendor,
    category: row.category,
    frequency: row.frequency,
    // bigint columns can come back as strings over the wire — coerce.
    amount: Number(row.amount),
    billingDay: row.billing_day,
  };
}

/**
 * Load the active expense line items, largest first.
 * Status is NOT fetched — it resets every cycle and is derived in
 * `resolveExpenses` from today's date (see data.ts).
 */
export async function getExpenses(supabase: SupabaseClient): Promise<Expense[]> {
  const { data, error } = await supabase
    .from("finance_expenses")
    .select("id,item,vendor,category,frequency,amount,billing_day")
    .eq("active", true)
    .order("amount", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row) => toExpense(row as FinanceExpenseRow));
}
