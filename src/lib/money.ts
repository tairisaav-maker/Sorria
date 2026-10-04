/**
 * Estratégia monetária compartilhada (Fases 5–6).
 * App: centavos inteiros. PostgreSQL: numeric(12,2). Nunca float.
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

/**
 * Divide total em N parcelas em centavos.
 * Residual vai para a última parcela (ex.: 10000/3 → 3333, 3333, 3334).
 */
export function splitAmountIntoInstallments(
  totalCents: number,
  count: number,
): number[] {
  if (count <= 0) throw new Error("Quantidade de parcelas inválida");
  if (totalCents < 0) throw new Error("Valor inválido");
  if (count === 1) return [totalCents];
  const base = Math.floor(totalCents / count);
  const parts = Array.from({ length: count }, () => base);
  const remainder = totalCents - base * count;
  parts[count - 1] = base + remainder;
  return parts;
}

export function sumCents(values: number[]): number {
  return values.reduce((acc, v) => acc + v, 0);
}
