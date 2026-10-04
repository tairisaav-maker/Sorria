/**
 * Reexporta utilitários monetários + totais de plano (Fase 5).
 */
export {
  centsToReais,
  formatBRL,
  lineTotalCents,
  reaisToCents,
} from "@/lib/money";

import { lineTotalCents } from "@/lib/money";

export function calculatePlanTotals(input: {
  items: Array<{ quantity: number; unit_price_cents: number; status?: string }>;
  discount_type?: "percent" | "fixed" | null;
  discount_percent?: number | null;
  discount_value_cents?: number | null;
}): {
  subtotal_cents: number;
  discount_cents: number;
  total_cents: number;
} {
  const subtotal = input.items
    .filter((i) => i.status !== "cancelled")
    .reduce(
      (sum, i) => sum + lineTotalCents(i.quantity, i.unit_price_cents),
      0,
    );

  let discount = 0;
  if (input.discount_type === "percent") {
    const pct = Math.min(100, Math.max(0, input.discount_percent ?? 0));
    discount = Math.round((subtotal * pct) / 100);
  } else if (input.discount_type === "fixed") {
    discount = Math.max(0, input.discount_value_cents ?? 0);
  }

  if (discount > subtotal) discount = subtotal;
  const total = subtotal - discount;
  return {
    subtotal_cents: subtotal,
    discount_cents: discount,
    total_cents: Math.max(0, total),
  };
}
