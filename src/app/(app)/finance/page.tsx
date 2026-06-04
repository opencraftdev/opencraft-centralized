import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

import { createClient } from "@/lib/supabase/server";
import { getExpenses } from "@/features/finance/queries";
import { getBillingCycle, getFinanceSummary, resolveExpenses } from "@/features/finance/data";
import { BillingCycleBanner } from "@/features/finance/components/BillingCycleBanner";
import { ExpenseSummary } from "@/features/finance/components/ExpenseSummary";
import { ExpenseTable } from "@/features/finance/components/ExpenseTable";

export const dynamic = "force-dynamic";

const MAX_W = 1180;
const SIDEBAR = 280;
const TOPBAR = 64;
const HEADER_H = 68;

export default async function FinancePage() {
  const supabase = await createClient();
  const rows = await getExpenses(supabase);

  const now = new Date();
  const cycle = getBillingCycle(now);
  const expenses = resolveExpenses(rows, now);
  const summary = getFinanceSummary(expenses);

  return (
    <Box sx={{ minHeight: "100%", bgcolor: "#F0F4F9" }}>
      {/* Fixed page header */}
      <Box
        sx={{
          position: "fixed",
          top: TOPBAR,
          left: SIDEBAR,
          right: 0,
          zIndex: 10,
          height: HEADER_H,
          bgcolor: "#F0F4F9",
          borderBottom: "1px solid #E8EAED",
          display: "flex",
          alignItems: "center",
        }}
      >
        <Box
          sx={{
            maxWidth: MAX_W,
            mx: "auto",
            px: 3,
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 2,
          }}
        >
          <Box>
            <Typography
              component="h1"
              sx={{ fontSize: "1.375rem", fontWeight: 400, lineHeight: "1.75rem", color: "#1F1F1F" }}
            >
              Finance
            </Typography>
            <Typography sx={{ fontSize: "0.75rem", color: "#5f6368" }}>
              {cycle.monthLabel} cycle · {summary.itemCount} line items · resets {cycle.resetLabel}
            </Typography>
          </Box>
        </Box>
      </Box>

      <Box sx={{ maxWidth: MAX_W, mx: "auto", px: 3, pt: `${HEADER_H + 16}px`, pb: 5 }}>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <BillingCycleBanner cycle={cycle} summary={summary} />
          <ExpenseSummary summary={summary} />
          <ExpenseTable expenses={expenses} />
        </Box>
      </Box>
    </Box>
  );
}
