import type { MetricComparison, MetricValue } from "@/types/reports";

/**
 * Comparecimento =
 *   consultas concluídas ÷ (concluídas + faltas) × 100
 * Cancelamentos NÃO entram no denominador.
 */
export function attendanceRate(completed: number, noShows: number): number | null {
  const den = completed + noShows;
  if (den <= 0) return null;
  return Math.round((completed / den) * 1000) / 10;
}

/** Taxa de falta = faltas ÷ (concluídas + faltas) × 100 */
export function noShowRate(completed: number, noShows: number): number | null {
  const den = completed + noShows;
  if (den <= 0) return null;
  return Math.round((noShows / den) * 1000) / 10;
}

/**
 * Taxa de aceitação =
 *   aceitos ÷ (aceitos + recusados) × 100
 * Planos aguardando decisão NÃO entram.
 */
export function acceptanceRate(accepted: number, rejected: number): number | null {
  const den = accepted + rejected;
  if (den <= 0) return null;
  return Math.round((accepted / den) * 1000) / 10;
}

export function buildComparison(
  current: number,
  previous: number,
  previousLabel = "vs. período anterior",
): MetricComparison {
  if (previous === 0) {
    return {
      previous_value: previous,
      delta_percent: null,
      has_baseline: false,
      label: current === 0 ? previousLabel : "Sem base de comparação",
    };
  }
  const delta = ((current - previous) / Math.abs(previous)) * 100;
  return {
    previous_value: previous,
    delta_percent: Math.round(delta * 10) / 10,
    has_baseline: true,
    label: previousLabel,
  };
}

export function metric(
  partial: Omit<MetricValue, "comparison"> & {
    comparison?: MetricComparison | null;
  },
): MetricValue {
  return {
    ...partial,
    comparison: partial.comparison ?? null,
  };
}
