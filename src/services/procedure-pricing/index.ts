import { can, type AuthzContext } from "@/lib/authz/can";
import { assertPermission } from "@/lib/authz/guards";
import { getInventoryStore } from "@/lib/demo/inventory-store";
import { getPerformedStore } from "@/lib/demo/performed-procedures-store";
import {
  getPricingStore,
  writePricingAudit,
} from "@/lib/demo/pricing-store";
import { reaisToCents } from "@/lib/money";
import {
  calculateBreakEvenPriceCents,
  calculateDirectResultCents,
  calculateOperationalMarginPercent,
  calculateOperationalResultCents,
  calculatePriceDifferenceCents,
  calculatePriceDifferencePercent,
  PRICING_ALERT_LABELS,
  resolvePerformedPricingAlerts,
  simulateDiscountCents,
  simulatePriceByDesiredResultCents,
  simulatePriceByMarginCents,
  simulatePriceCents,
} from "@/lib/pricing/formulas";
import {
  calculateProcedureOutstandingBalance,
  calculateProcedureReceivedAmount,
} from "@/services/patient-procedure-finance";
import { getStandardOperationalEstimate } from "@/services/procedure-operational-costs";
import type {
  PerformedPricingAnalysis,
  PriceSimulation,
  ProcedurePriceHistory,
  ProcedurePricingSummary,
} from "@/types/pricing";
import { z } from "zod";

function now() {
  return new Date().toISOString();
}

function canViewPricing(ctx: AuthzContext) {
  return (
    can(ctx, "procedure_pricing.view").allowed ||
    can(ctx, "procedure_pricing.manage").allowed ||
    can(ctx, "reports.pricing_view").allowed
  );
}

function canManagePrice(ctx: AuthzContext) {
  return (
    can(ctx, "procedures.update_price").allowed ||
    can(ctx, "procedure_pricing.manage").allowed
  );
}

export function getProcedurePricingSummary(
  ctx: AuthzContext,
  procedureId: string,
): ProcedurePricingSummary {
  if (!canViewPricing(ctx) && !can(ctx, "procedure_costs.view").allowed) {
    assertPermission(ctx, "procedure_pricing.view");
  }
  const estimate = getStandardOperationalEstimate(ctx, procedureId);
  const proc = getInventoryStore().procedures.find(
    (p) => p.id === procedureId && p.clinic_id === ctx.clinicId,
  );
  if (!proc) throw new Error("PROCEDURE_NOT_FOUND");

  writePricingAudit({
    clinic_id: ctx.clinicId,
    actor_user_id: ctx.userId,
    action: "procedure.pricing_viewed",
    target_type: "procedure",
    target_id: procedureId,
  });

  const breakEven = calculateBreakEvenPriceCents(
    estimate.operational_total_cents,
  );
  const standardBelow =
    estimate.default_price_cents != null &&
    estimate.operational_total_cents != null &&
    estimate.default_price_cents < estimate.operational_total_cents;

  return {
    procedure_id: procedureId,
    procedure_name: proc.name,
    default_price_cents: estimate.default_price_cents,
    materials_cost_cents: estimate.materials_cost_cents,
    direct_costs_cents: estimate.direct_costs_cents,
    default_duration_minutes: estimate.default_duration_minutes,
    hourly_cost_cents: estimate.hourly_cost_cents,
    time_cost_cents: estimate.time_cost_cents,
    operational_total_cents: estimate.operational_total_cents,
    operational_result_cents: estimate.operational_result_cents,
    operational_margin_percent: estimate.operational_margin_percent,
    break_even_cents: breakEven,
    insufficient_data: estimate.insufficient_data,
    standard_below_operational: standardBelow,
    disclaimer:
      "Estimativa baseada nos custos e horas configurados. Não é lucro líquido nem recomendação de preço.",
  };
}

export function analyzePerformedProcedurePricing(
  ctx: AuthzContext,
  performedProcedureId: string,
): PerformedPricingAnalysis {
  if (!canViewPricing(ctx)) {
    assertPermission(ctx, "procedure_pricing.view");
  }
  const row = getPerformedStore().performedProcedures.find(
    (p) => p.id === performedProcedureId,
  );
  if (!row || row.clinic_id !== ctx.clinicId) {
    throw new Error("PERFORMED_PROCEDURE_NOT_FOUND");
  }

  const charged = row.charged_amount_cents;
  const direct = row.actual_total_cost_cents;
  const operational = row.operational_total_cost_cents;
  const showFin =
    can(ctx, "finance.view_administrative").allowed ||
    can(ctx, "finance.view_authorized").allowed;

  let received: number | null = null;
  let outstanding: number | null = null;
  if (showFin) {
    try {
      received = calculateProcedureReceivedAmount(ctx, performedProcedureId);
      outstanding = calculateProcedureOutstandingBalance(
        ctx,
        performedProcedureId,
      );
    } catch {
      received = null;
      outstanding = null;
    }
  }

  const calculable =
    charged != null && operational != null && operational >= 0;
  const alerts = resolvePerformedPricingAlerts({
    chargedCents: charged,
    directCostCents: direct,
    operationalCostCents: operational,
  });

  let message: string | null = null;
  if (charged == null) message = "Valor ainda não definido";
  else if (operational == null) message = "Não calculável";
  else if (alerts.includes("below_operational_cost")) {
    message = PRICING_ALERT_LABELS.below_operational_cost;
  } else if (alerts.includes("below_direct_cost")) {
    message = PRICING_ALERT_LABELS.below_direct_cost;
  }

  return {
    performed_procedure_id: row.id,
    procedure_name: row.procedure_name_snapshot,
    patient_id: row.patient_id,
    completed_at: row.completed_at,
    standard_price_snapshot_cents: row.standard_price_snapshot_cents,
    charged_amount_cents: charged,
    price_difference_cents: calculatePriceDifferenceCents(
      charged,
      row.standard_price_snapshot_cents,
    ),
    price_difference_percent: calculatePriceDifferencePercent(
      charged,
      row.standard_price_snapshot_cents,
    ),
    direct_cost_cents: direct,
    operational_total_cost_cents: operational,
    direct_result_cents: calculateDirectResultCents(charged, direct),
    operational_result_cents: calculateOperationalResultCents(
      charged,
      operational,
    ),
    operational_margin_percent: calculateOperationalMarginPercent(
      charged,
      operational,
    ),
    received_cents: received,
    outstanding_cents: outstanding,
    result_considering_received_cents:
      received != null && operational != null
        ? received - operational
        : null,
    break_even_cents: calculateBreakEvenPriceCents(operational),
    alerts,
    calculable,
    message,
  };
}

export function simulatePrice(
  ctx: AuthzContext,
  input: {
    operational_cost_cents: number;
    simulated_price_cents: number;
  },
): PriceSimulation {
  if (!canViewPricing(ctx)) assertPermission(ctx, "procedure_pricing.view");
  const sim = simulatePriceCents(
    input.operational_cost_cents,
    input.simulated_price_cents,
  );
  return {
    operational_cost_cents: sim.operational_cost_cents,
    simulated_price_cents: sim.simulated_price_cents,
    result_cents: sim.result_cents,
    margin_percent: sim.margin_percent,
    break_even_cents: input.operational_cost_cents,
    label: "Simulação — não é recomendação de preço do Sorria",
    message: null,
  };
}

export function simulatePriceByMargin(
  ctx: AuthzContext,
  input: {
    operational_cost_cents: number;
    desired_margin_percent: number;
  },
): PriceSimulation {
  if (!canViewPricing(ctx)) assertPermission(ctx, "procedure_pricing.view");
  const price = simulatePriceByMarginCents(
    input.operational_cost_cents,
    input.desired_margin_percent,
  );
  if (price == null) {
    return {
      operational_cost_cents: input.operational_cost_cents,
      simulated_price_cents: null,
      result_cents: null,
      margin_percent: null,
      break_even_cents: input.operational_cost_cents,
      label: "Preço correspondente à margem simulada",
      message: "Margem inválida (deve ser menor que 100% e ≥ 0).",
    };
  }
  const sim = simulatePriceCents(input.operational_cost_cents, price);
  return {
    operational_cost_cents: sim.operational_cost_cents,
    simulated_price_cents: sim.simulated_price_cents,
    result_cents: sim.result_cents,
    margin_percent: sim.margin_percent,
    break_even_cents: input.operational_cost_cents,
    label: "Preço correspondente à margem simulada",
    message: "Simulação — não é recomendação de preço do Sorria.",
  };
}

export function simulatePriceByDesiredResult(
  ctx: AuthzContext,
  input: {
    operational_cost_cents: number;
    desired_result_cents: number;
  },
): PriceSimulation {
  if (!canViewPricing(ctx)) assertPermission(ctx, "procedure_pricing.view");
  const price = simulatePriceByDesiredResultCents(
    input.operational_cost_cents,
    input.desired_result_cents,
  );
  const sim = simulatePriceCents(input.operational_cost_cents, price);
  return {
    operational_cost_cents: sim.operational_cost_cents,
    simulated_price_cents: sim.simulated_price_cents,
    result_cents: sim.result_cents,
    margin_percent: sim.margin_percent,
    break_even_cents: input.operational_cost_cents,
    label: "Preço correspondente ao resultado simulado",
    message: "Simulação — não é recomendação de preço do Sorria.",
  };
}

export function simulateDiscount(
  ctx: AuthzContext,
  input: {
    standard_price_cents: number;
    operational_cost_cents: number;
    discount_percent?: number | null;
    discount_amount_cents?: number | null;
  },
): PriceSimulation {
  if (!canViewPricing(ctx)) assertPermission(ctx, "procedure_pricing.view");
  const price = simulateDiscountCents({
    standardPriceCents: input.standard_price_cents,
    discountPercent: input.discount_percent,
    discountAmountCents: input.discount_amount_cents,
  });
  if (price == null) {
    return {
      operational_cost_cents: input.operational_cost_cents,
      simulated_price_cents: null,
      result_cents: null,
      margin_percent: null,
      break_even_cents: input.operational_cost_cents,
      label: "Simulação de diferença em relação ao padrão",
      message: "Desconto inválido.",
    };
  }
  const sim = simulatePriceCents(input.operational_cost_cents, price);
  return {
    operational_cost_cents: sim.operational_cost_cents,
    simulated_price_cents: sim.simulated_price_cents,
    result_cents: sim.result_cents,
    margin_percent: sim.margin_percent,
    break_even_cents: input.operational_cost_cents,
    label: "Simulação de diferença em relação ao padrão",
    message: "Simulação — não altera cadastros.",
  };
}

const updatePriceSchema = z.object({
  procedure_id: z.string().min(1),
  new_price_reais: z.number().min(0),
  confirm: z.literal(true),
});

/**
 * Atualiza preço padrão com histórico.
 * Não altera performed_procedures nem treatment items aceitos.
 */
export function updateProcedureDefaultPrice(
  ctx: AuthzContext,
  raw: unknown,
) {
  if (!canManagePrice(ctx)) {
    assertPermission(ctx, "procedures.update_price");
  }
  const data = updatePriceSchema.parse(raw);
  const proc = getInventoryStore().procedures.find(
    (p) => p.id === data.procedure_id,
  );
  if (!proc || proc.clinic_id !== ctx.clinicId) {
    throw new Error("PROCEDURE_NOT_FOUND");
  }

  const newCents = reaisToCents(data.new_price_reais);
  const oldCents = proc.default_price_cents;
  const stamp = now();

  // Fecha histórico aberto
  const open = getPricingStore().priceHistory.find(
    (h) =>
      h.clinic_id === ctx.clinicId &&
      h.procedure_id === proc.id &&
      h.valid_until == null,
  );
  if (open) open.valid_until = stamp;

  if (oldCents != null) {
    // Se não havia histórico, registra o preço anterior
    if (!open) {
      getPricingStore().priceHistory.unshift({
        id: `pph-${crypto.randomUUID()}`,
        clinic_id: ctx.clinicId,
        procedure_id: proc.id,
        price_cents: oldCents,
        valid_from: proc.created_at,
        valid_until: stamp,
        changed_by: ctx.userId,
        created_at: stamp,
      });
    }
  }

  const history: ProcedurePriceHistory = {
    id: `pph-${crypto.randomUUID()}`,
    clinic_id: ctx.clinicId,
    procedure_id: proc.id,
    price_cents: newCents,
    valid_from: stamp,
    valid_until: null,
    changed_by: ctx.userId,
    created_at: stamp,
  };
  getPricingStore().priceHistory.unshift(history);

  proc.default_price_cents = newCents;
  proc.updated_at = stamp;

  writePricingAudit({
    clinic_id: ctx.clinicId,
    actor_user_id: ctx.userId,
    action: "procedure.price_updated",
    target_type: "procedure",
    target_id: proc.id,
    metadata: {
      old_price_cents: oldCents,
      new_price_cents: newCents,
    },
  });

  return { procedure: proc, history };
}

export function getProcedurePriceHistory(
  ctx: AuthzContext,
  procedureId: string,
): ProcedurePriceHistory[] {
  if (!canViewPricing(ctx) && !canManagePrice(ctx)) {
    assertPermission(ctx, "procedure_pricing.view");
  }
  const proc = getInventoryStore().procedures.find(
    (p) => p.id === procedureId && p.clinic_id === ctx.clinicId,
  );
  if (!proc) throw new Error("PROCEDURE_NOT_FOUND");
  return getPricingStore()
    .priceHistory.filter(
      (h) => h.clinic_id === ctx.clinicId && h.procedure_id === procedureId,
    )
    .sort((a, b) => b.valid_from.localeCompare(a.valid_from));
}

export function countBelowOperationalThisMonth(ctx: AuthzContext): number {
  if (!canViewPricing(ctx) && !can(ctx, "reports.pricing_view").allowed) {
    return 0;
  }
  const month = new Date().toISOString().slice(0, 7);
  let n = 0;
  for (const p of getPerformedStore().performedProcedures) {
    if (p.clinic_id !== ctx.clinicId) continue;
    if (p.status !== "completed") continue;
    if (!(p.completed_at ?? "").startsWith(month)) continue;
    if (p.charged_amount_cents == null) continue;
    if (p.operational_total_cost_cents == null) continue;
    if (p.charged_amount_cents < p.operational_total_cost_cents) n += 1;
  }
  return n;
}

// Re-exports for tests / callers expecting these names
export {
  calculateBreakEvenPriceCents as calculateBreakEvenPrice,
  calculateDirectResultCents as calculateDirectResult,
  calculateOperationalResultCents as calculateOperationalResult,
  calculateOperationalMarginPercent as calculateOperationalMargin,
  calculateGrossMarginPercent as calculateGrossMargin,
} from "@/lib/pricing/formulas";
