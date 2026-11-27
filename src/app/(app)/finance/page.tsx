import { Suspense } from "react";
import { FinanceApp } from "@/features/finance/components/FinanceApp";

export const dynamic = "force-dynamic";

export default function FinancePage() {
  return (
    <Suspense>
      <FinanceApp />
    </Suspense>
  );
}
