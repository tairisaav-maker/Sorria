/** Fórmulas de preço e margem — Subfase 9. Sem float de dinheiro; centavos inteiros. */

export function calculatePriceDifferenceCents(
  chargedCents: number | null | undefined,
  standardSnapshotCents: number | null | undefined,
): number | null {
  if (chargedCents == null || standardSnapshotCents == null) return null;
  return chargedCents - standardSnapshotCents;
}

export function calculatePriceDifferencePercent(
  chargedCents: number | null | undefined,
  standardSnapshotCents: number | null | undefined,
): number | null {
  if (chargedCents == null || standardSnapshotCents == null) return null;
  if (standardSnapshotCents <= 0) return null;
  return (
    Math.round(
      ((chargedCents - standardSnapshotCents) / standardSnapshotCents) * 10000,
    ) / 100
  );
}

export function calculateDirectResultCents(
  chargedCents: number | null | undefined,
  directCostCents: number | null | undefined,
): number | null {
  if (chargedCents == null || directCostCents == null) return null;
  return chargedCents - directCostCents;
}

export function calculateOperationalResultCents(
  chargedCents: number | null | undefined,
  operationalTotalCents: number | null | undefined,
): number | null {
  if (chargedCents == null || operationalTotalCents == null) return null;
  return chargedCents - operationalTotalCents;
}

export function calculateOperationalMarginPercent(
  chargedCents: number | null | undefined,
  operationalTotalCents: number | null | undefined,
): number | null {
  if (chargedCents == null || operationalTotalCents == null) return null;
  if (chargedCents === 0) return null;
  const result = chargedCents - operationalTotalCents;
  return Math.round((result / chargedCents) * 10000) / 100;
}

export function calculateGrossMarginPercent(
  chargedCents: number | null | undefined,
  directCostCents: number | null | undefined,
): number | null {
  if (chargedCents == null || directCostCents == null) return null;
  if (chargedCents === 0) return null;
  const result = chargedCents - directCostCents;
  return Math.round((result / chargedCents) * 10000) / 100;
}

/** Preço de equilíbrio = custo operacional (receita = custo). ≠ preço ideal. */
export function calculateBreakEvenPriceCents(
  operationalTotalCents: number | null | undefined,
): number | null {
  if (operationalTotalCents == null) return null;
  return operationalTotalCents;
}

export function simulatePriceCents(
  operationalCostCents: number,
  simulatedPriceCents: number,
): {
  operational_cost_cents: number;
  simulated_price_cents: number;
  result_cents: number;
  margin_percent: number | null;
} {
  const result = simulatedPriceCents - operationalCostCents;
  const margin =
    simulatedPriceCents === 0
      ? null
      : Math.round((result / simulatedPriceCents) * 10000) / 100;
  return {
    operational_cost_cents: operationalCostCents,
    simulated_price_cents: simulatedPriceCents,
    result_cents: result,
    margin_percent: margin,
  };
}

/** price = cost / (1 - margin) com margem em [0, 100). */
export function simulatePriceByMarginCents(
  operationalCostCents: number,
  desiredMarginPercent: number,
): number | null {
  if (desiredMarginPercent < 0 || desiredMarginPercent >= 100) return null;
  if (operationalCostCents < 0) return null;
  const m = desiredMarginPercent / 100;
  return Math.round(operationalCostCents / (1 - m));
}

export function simulatePriceByDesiredResultCents(
  operationalCostCents: number,
  desiredResultCents: number,
): number {
  return operationalCostCents + desiredResultCents;
}

export function simulateDiscountCents(input: {
  standardPriceCents: number;
  discountPercent?: number | null;
  discountAmountCents?: number | null;
}): number | null {
  const { standardPriceCents, discountPercent, discountAmountCents } = input;
  if (standardPriceCents < 0) return null;
  if (discountPercent != null) {
    if (discountPercent < 0 || discountPercent > 100) return null;
    return Math.round(standardPriceCents * (1 - discountPercent / 100));
  }
  if (discountAmountCents != null) {
    if (discountAmountCents < 0) return null;
    return Math.max(0, standardPriceCents - discountAmountCents);
  }
  return null;
}

/** Margem agregada: sum(result) / sum(charged) — não média simples de %. */
export function calculateAggregateMarginPercent(
  totalChargedCents: number,
  totalOperationalCostCents: number,
): number | null {
  if (totalChargedCents <= 0) return null;
  const result = totalChargedCents - totalOperationalCostCents;
  return Math.round((result / totalChargedCents) * 10000) / 100;
}

export function pricingCoveragePercent(
  withComplete: number,
  total: number,
): number | null {
  if (total <= 0) return null;
  return Math.round((withComplete / total) * 1000) / 10;
}

export function medianCents(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return Math.round((sorted[mid - 1]! + sorted[mid]!) / 2);
  }
  return sorted[mid]!;
}

export type PricingAlert =
  | "below_direct_cost"
  | "below_operational_cost"
  | "reduced_margin"
  | "standard_below_operational"
  | "charged_undefined"
  | null;

export function resolvePerformedPricingAlerts(input: {
  chargedCents: number | null;
  directCostCents: number | null;
  operationalCostCents: number | null;
  reducedMarginThreshold?: number;
}): PricingAlert[] {
  const alerts: PricingAlert[] = [];
  if (input.chargedCents == null) {
    alerts.push("charged_undefined");
    return alerts;
  }
  if (
    input.directCostCents != null &&
    input.chargedCents < input.directCostCents
  ) {
    alerts.push("below_direct_cost");
  }
  if (
    input.operationalCostCents != null &&
    input.chargedCents < input.operationalCostCents
  ) {
    alerts.push("below_operational_cost");
  }
  const margin = calculateOperationalMarginPercent(
    input.chargedCents,
    input.operationalCostCents,
  );
  const threshold = input.reducedMarginThreshold ?? 20;
  if (
    margin != null &&
    margin >= 0 &&
    margin < threshold &&
    !alerts.includes("below_operational_cost")
  ) {
    alerts.push("reduced_margin");
  }
  return alerts;
}

export const PRICING_ALERT_LABELS: Record<
  Exclude<PricingAlert, null>,
  string
> = {
  below_direct_cost: "Abaixo do custo direto",
  below_operational_cost: "Abaixo do custo operacional",
  reduced_margin: "Margem reduzida",
  standard_below_operational:
    "Preço padrão abaixo do custo operacional estimado",
  charged_undefined: "Valor ainda não definido",
};
