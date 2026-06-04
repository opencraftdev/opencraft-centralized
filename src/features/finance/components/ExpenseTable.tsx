import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Chip from "@mui/material/Chip";
import TableChartOutlined from "@mui/icons-material/TableChartOutlined";
import { CATEGORY_META, formatIDR } from "../data";
import type { ResolvedExpense, ExpenseFrequency, ExpenseStatus } from "../types";

const FREQUENCY_LABEL: Record<ExpenseFrequency, string> = {
  monthly: "Monthly",
  yearly: "Yearly",
  "one-time": "One-time",
};

const STATUS_STYLE: Record<ExpenseStatus, { label: string; fg: string; bg: string }> = {
  paid: { label: "Paid", fg: "#188038", bg: "#E6F4EA" },
  pending: { label: "Pending", fg: "#E37400", bg: "#FEF7E0" },
};

function StatusChip({ status }: { status: ExpenseStatus }) {
  const s = STATUS_STYLE[status];
  return (
    <Box
      sx={{
        display: "inline-flex",
        alignItems: "center",
        px: 1,
        py: "2px",
        borderRadius: "9999px",
        fontSize: "0.6875rem",
        fontWeight: 600,
        color: s.fg,
        bgcolor: s.bg,
      }}
    >
      {s.label}
    </Box>
  );
}

export function ExpenseTable({ expenses }: { expenses: ResolvedExpense[] }) {
  const total = expenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <Box sx={{ bgcolor: "#fff", borderRadius: "12px", border: "1px solid #E8EAED", overflow: "hidden" }}>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 2, px: 3, pt: 3, pb: 2 }}>
        <TableChartOutlined sx={{ fontSize: 26, color: "#0B57D0", mt: 0.25 }} />
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontSize: "1.25rem", fontWeight: 400, color: "#202124" }}>
            Expenses
          </Typography>
          <Typography sx={{ fontSize: "0.8125rem", color: "#5f6368", mt: 0.5 }}>
            All recurring company costs, normalised to a monthly figure.
          </Typography>
        </Box>
      </Box>

      <TableContainer>
        <Table sx={{ minWidth: 720 }}>
          <TableHead>
            <TableRow>
              <TableCell>Item</TableCell>
              <TableCell>Category</TableCell>
              <TableCell>Frequency</TableCell>
              <TableCell>Billing</TableCell>
              <TableCell align="center">Status</TableCell>
              <TableCell align="right">Amount / mo</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {expenses.map((e) => {
              const cat = CATEGORY_META[e.category];
              return (
                <TableRow key={e.id} hover sx={{ "&:hover": { bgcolor: "#F8FAFD" } }}>
                  <TableCell>
                    <Typography sx={{ fontSize: "0.8125rem", color: "#202124", fontWeight: 500 }}>
                      {e.item}
                    </Typography>
                    <Typography sx={{ fontSize: "0.6875rem", color: "#80868b" }}>
                      {e.vendor}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={cat.label}
                      sx={{
                        bgcolor: `${cat.color}14`,
                        color: cat.color,
                        border: `1px solid ${cat.color}33`,
                        "& .MuiChip-label": { px: 1 },
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography sx={{ fontSize: "0.8125rem", color: "#5f6368" }}>
                      {FREQUENCY_LABEL[e.frequency]}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography sx={{ fontSize: "0.8125rem", color: "#5f6368" }}>
                      Day {e.billingDay}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    <StatusChip status={e.status} />
                  </TableCell>
                  <TableCell align="right">
                    <Typography
                      sx={{
                        fontSize: "0.8125rem",
                        fontWeight: 600,
                        color: "#202124",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {formatIDR(e.amount)}
                    </Typography>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Total footer */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          px: 3,
          py: 2,
          borderTop: "2px solid #E8EAED",
          bgcolor: "#F8FAFD",
        }}
      >
        <Typography sx={{ fontSize: "0.8125rem", fontWeight: 500, color: "#5f6368" }}>
          Total monthly expense
        </Typography>
        <Typography
          sx={{
            fontSize: "1.0625rem",
            fontWeight: 700,
            color: "#202124",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {formatIDR(total)}
        </Typography>
      </Box>
    </Box>
  );
}
