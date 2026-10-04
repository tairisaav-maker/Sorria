/** Fórmulas centralizadas — Subfase 6 (rentabilidade operacional). */

export function grossResult(
  chargedCents: number | null | undefined,
  actualCostCents: number | null | undefined,
): number | null {
  if (chargedCents == null || actualCostCents == null) return null;
  return chargedCents - actualCostCents;
}

export function grossMarginPercent(
  chargedCents: number | null | undefined,
  actualCostCents: number | null | undefined,
): number | null {
  if (chargedCents == null || actualCostCents == null) return null;
  if (chargedCents === 0) return null;
  const result = chargedCents - actualCostCents;
  return Math.round((result / chargedCents) * 10000) / 100;
}

export function plannedVsActual(input: {
  planned: number;
  actual: number;
}): { difference: number; percent: number | null } {
  const difference = input.actual - input.planned;
  if (input.planned <= 0) {
    return { difference, percent: null };
  }
  return {
    difference,
    percent: Math.round((difference / input.planned) * 10000) / 100,
  };
}

export function costCoverage(complete: number, total: number): number | null {
  if (total <= 0) return null;
  return Math.round((complete / total) * 1000) / 10;
}

export function averageOrNull(sum: number, count: number): number | null {
  if (count <= 0) return null;
  return Math.round(sum / count);
}

export function averageFloatOrNull(sum: number, count: number): number | null {
  if (count <= 0) return null;
  return Math.round((sum / count) * 10000) / 10000;
}

/** Comparação período anterior — sem infinito. */
export function periodDeltaPercent(
  current: number,
  previous: number,
): { delta_percent: number | null; has_baseline: boolean; label: string } {
  if (previous === 0) {
    return {
      delta_percent: null,
      has_baseline: false,
      label: "Sem base de comparação",
    };
  }
  return {
    delta_percent: Math.round(((current - previous) / Math.abs(previous)) * 1000) / 10,
    has_baseline: true,
    label: "vs. período anterior",
  };
}
