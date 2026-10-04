/**
 * Estratégia monetária: centavos inteiros na aplicação.
 * PostgreSQL: numeric(12,2). Nunca float.
 */

export function reaisToCents(value: number | string): number {
  const n = typeof value === "string" ? Number(value.replace(",", ".")) : value;
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

export function centsToReais(cents: number): number {
  return cents / 100;
}

export function formatBRL(cents: number): string {
  return centsToReais(cents).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function lineTotalCents(quantity: number, unitPriceCents: number): number {
  if (quantity <= 0 || unitPriceCents < 0) return 0;
  return quantity * unitPriceCents;
}

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
