/** Fórmulas de custeio operacional — Subfase 8. */

export function calculateHourlyOperatingCostCents(
  allocatableCostCents: number,
  productiveHours: number,
): number | null {
  if (productiveHours <= 0) return null;
  return Math.round(allocatableCostCents / productiveHours);
}

/** Precisão interna: não arredondar cedo demais. */
export function calculateCostPerMinuteCents(hourlyCostCents: number): number {
  return hourlyCostCents / 60;
}

export function calculateProcedureTimeCostCents(
  durationMinutes: number,
  hourlyCostCents: number,
): number {
  return Math.round(durationMinutes * calculateCostPerMinuteCents(hourlyCostCents));
}

export function calculateOperationalTotalCents(input: {
  materialCents: number;
  directCents: number;
  timeCents: number;
}): number {
  return input.materialCents + input.directCents + input.timeCents;
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

/** Preço = Custo / (1 - margem) com margem em [0, 1). */
export function simulatePriceForMarginCents(
  costCents: number,
  desiredMarginPercent: number,
): number | null {
  if (desiredMarginPercent < 0 || desiredMarginPercent >= 100) return null;
  if (costCents < 0) return null;
  const m = desiredMarginPercent / 100;
  return Math.round(costCents / (1 - m));
}

export function simulateHourlyCostCents(
  allocatableCostCents: number,
  productiveHours: number,
): number | null {
  return calculateHourlyOperatingCostCents(
    allocatableCostCents,
    productiveHours,
  );
}

export function referenceMonthFromDate(iso: string): string {
  return iso.slice(0, 7);
}
