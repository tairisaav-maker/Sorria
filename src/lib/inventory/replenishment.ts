/** Regras centralizadas de reposição — Subfase 7. */

import { HISTORICAL_SAMPLE_MIN } from "@/types/replenishment";
import type {
  DataConfidence,
  ReplenishmentStatus,
} from "@/types/replenishment";

export function calculateTotalNeed(input: {
  forecastQuantity: number;
  minimumQuantity: number | null;
}): number {
  const min = input.minimumQuantity ?? 0;
  return Math.max(0, input.forecastQuantity) + Math.max(0, min);
}

export function calculateReplenishmentQuantity(input: {
  forecastQuantity: number;
  minimumQuantity: number | null;
  currentQuantity: number;
}): number {
  const total = calculateTotalNeed(input);
  return Math.max(0, roundQty(total - input.currentQuantity));
}

/**
 * Embalagens sugeridas: ceil(necessidade / unidades por embalagem).
 * unitsPerPackage <= 0 → null (configuração inválida).
 */
export function calculateRecommendedPackages(
  quantityToReplenish: number,
  unitsPerPackage: number,
): number | null {
  if (unitsPerPackage <= 0) return null;
  if (quantityToReplenish <= 0) return 0;
  return Math.ceil(quantityToReplenish / unitsPerPackage);
}

export function purchasedQuantityFromPackages(
  packages: number,
  unitsPerPackage: number,
): number {
  if (packages <= 0 || unitsPerPackage <= 0) return 0;
  return roundQty(packages * unitsPerPackage);
}

export function surplusAfterPurchase(
  purchasedQty: number,
  replenishQty: number,
): number {
  return roundQty(Math.max(0, purchasedQty - replenishQty));
}

export function resolveReplenishmentStatus(input: {
  currentQuantity: number;
  forecastQuantity: number;
  minimumQuantity: number | null;
  packagesValid: boolean;
  historicalAbovePlanned: boolean;
  missingCost: boolean;
}): ReplenishmentStatus {
  if (!input.packagesValid) return "unknown";
  const projected = input.currentQuantity - input.forecastQuantity;
  if (input.forecastQuantity > 0 && input.currentQuantity < input.forecastQuantity) {
    return "critical";
  }
  if (
    input.forecastQuantity >= 0 &&
    input.currentQuantity >= input.forecastQuantity &&
    input.minimumQuantity != null &&
    projected < input.minimumQuantity
  ) {
    return "reorder";
  }
  if (
    input.historicalAbovePlanned ||
    input.missingCost ||
    (input.minimumQuantity != null &&
      input.currentQuantity <= input.minimumQuantity * 1.15 &&
      input.currentQuantity > 0)
  ) {
    return "attention";
  }
  return "ok";
}

export function resolveDataConfidence(input: {
  hasBom: boolean;
  hasValidConversion: boolean;
  hasCost: boolean;
  agendaCoveragePercent: number | null;
}): DataConfidence {
  if (!input.hasValidConversion) return "low";
  if (!input.hasBom) return "low";
  if (
    input.agendaCoveragePercent != null &&
    input.agendaCoveragePercent < 50
  ) {
    return "low";
  }
  if (
    input.hasBom &&
    input.hasValidConversion &&
    input.hasCost &&
    (input.agendaCoveragePercent == null || input.agendaCoveragePercent >= 80)
  ) {
    return "high";
  }
  return "medium";
}

export function historicalDeviationPercent(
  avgActual: number,
  avgPlanned: number,
): number | null {
  if (avgPlanned <= 0) return null;
  return Math.round(((avgActual - avgPlanned) / avgPlanned) * 1000) / 10;
}

export function isHistoricalReliable(sampleSize: number): boolean {
  return sampleSize >= HISTORICAL_SAMPLE_MIN;
}

export function roundQty(n: number): number {
  return Math.round(n * 10000) / 10000;
}

/**
 * Custo estimado da embalagem (centavos).
 * Prefere último preço de compra da embalagem; senão média × conversão.
 */
export function calculateEstimatedPackageCostCents(input: {
  lastPurchasePackageCostCents: number | null;
  averageUnitCostCents: number | null;
  unitsPerPackage: number;
}): { cents: number | null; source: "last_purchase" | "average_cost" | null } {
  if (
    input.lastPurchasePackageCostCents != null &&
    input.lastPurchasePackageCostCents > 0
  ) {
    return { cents: input.lastPurchasePackageCostCents, source: "last_purchase" };
  }
  if (
    input.averageUnitCostCents != null &&
    input.averageUnitCostCents > 0 &&
    input.unitsPerPackage > 0
  ) {
    return {
      cents: Math.round(input.averageUnitCostCents * input.unitsPerPackage),
      source: "average_cost",
    };
  }
  return { cents: null, source: null };
}

export function calculateEstimatedPurchaseCostCents(
  packages: number,
  packageCostCents: number | null,
): number | null {
  if (packageCostCents == null || packages <= 0) return null;
  return packages * packageCostCents;
}
