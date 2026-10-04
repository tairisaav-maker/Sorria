import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FinanceDashboardClient } from "@/components/finance/finance-dashboard-client";
import { can } from "@/lib/authz/can";
import { requireClinic } from "@/lib/authz/guards";

export const metadata: Metadata = {
  title: "Financeiro",
};

export default async function FinanceiroPage() {
  const actor = await requireClinic();
  if (!can(actor.ctx, "finance.view_administrative").allowed) {
    notFound();
  }

  return (
    <FinanceDashboardClient
      canCreate={can(actor.ctx, "finance.transaction_create").allowed}
      canExpense={can(actor.ctx, "finance.expense_create").allowed}
      canPay={can(actor.ctx, "finance.payment_create").allowed}
      canReverse={can(actor.ctx, "finance.payment_reverse").allowed}
      canExport={can(actor.ctx, "finance.export").allowed}
    />
  );
}
