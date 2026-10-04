import type { FinancialStatus } from "@/types/finance";

/** Deriva status a partir de valor, pagos válidos e vencimento. */
export function deriveFinancialStatus(input: {
  amountCents: number;
  paidCents: number;
  dueDate: string | null | undefined;
  cancelled?: boolean;
  today?: Date;
}): FinancialStatus {
  if (input.cancelled) return "cancelled";
  const paid = Math.max(0, input.paidCents);
  const amount = Math.max(0, input.amountCents);
  if (paid >= amount && amount > 0) return "paid";
  if (amount === 0 && paid === 0) return "paid";

  const today = input.today ?? new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const balance = amount - paid;
  const overdue =
    Boolean(input.dueDate) && input.dueDate! < todayStr && balance > 0;

  if (paid > 0 && balance > 0) {
    return overdue ? "overdue" : "partially_paid";
  }
  if (overdue) return "overdue";
  return "pending";
}

export function calculateInstallmentBalance(
  amountCents: number,
  paidCents: number,
): number {
  return Math.max(0, amountCents - Math.max(0, paidCents));
}
