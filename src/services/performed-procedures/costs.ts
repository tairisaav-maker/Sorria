import type { AuthzContext } from "@/lib/authz/can";
import { can } from "@/lib/authz/can";
import { getPerformedStore } from "@/lib/demo/performed-procedures-store";
import type {
  ConsumptionDeviation,
  PerformedProcedure,
} from "@/types/performed-procedure";

export function canViewProcedureCosts(ctx: AuthzContext) {
  return can(ctx, "procedure_costs.view").allowed;
}

export function calculateGrossResult(
  chargedAmountCents: number | null,
  actualTotalCostCents: number | null,
): { gross_result_cents: number | null; gross_margin_percent: number | null } {
  if (chargedAmountCents == null || actualTotalCostCents == null) {
    return { gross_result_cents: null, gross_margin_percent: null };
  }
  const gross = chargedAmountCents - actualTotalCostCents;
  if (chargedAmountCents === 0) {
    return { gross_result_cents: gross, gross_margin_percent: null };
  }
  return {
    gross_result_cents: gross,
    gross_margin_percent:
      Math.round((gross / chargedAmountCents) * 10000) / 100,
  };
}

export function calculateDeviation(
  planned: number,
  actual: number,
): ConsumptionDeviation["label"] {
  if (actual > planned) return "acima_do_previsto";
  if (actual < planned) return "abaixo_do_previsto";
  return "conforme_previsto";
}

export function deviationPercent(
  planned: number,
  actual: number,
): number | null {
  if (planned === 0) return actual === 0 ? 0 : null;
  return Math.round(((actual - planned) / planned) * 10000) / 100;
}

/** Rateio igual do custo compartilhado entre procedimentos ativos do atendimento. */
export function allocateSharedCost(
  totalSharedCents: number,
  activeProcedureCount: number,
): number {
  if (activeProcedureCount <= 0) return 0;
  return Math.round(totalSharedCents / activeProcedureCount);
}

export function getPatientDirectCostSummary(
  ctx: AuthzContext,
  patientId: string,
): {
  procedures_count: number;
  total_actual_cost_cents: number | null;
  total_charged_cents: number | null;
  total_gross_result_cents: number | null;
} {
  const store = getPerformedStore();
  const items = store.performedProcedures.filter(
    (p) =>
      p.clinic_id === ctx.clinicId &&
      p.patient_id === patientId &&
      p.status === "completed",
  );
  const showCost = canViewProcedureCosts(ctx);
  if (!showCost) {
    return {
      procedures_count: items.length,
      total_actual_cost_cents: null,
      total_charged_cents: null,
      total_gross_result_cents: null,
    };
  }
  const total_actual_cost_cents = items.reduce(
    (s, p) => s + (p.actual_total_cost_cents ?? 0),
    0,
  );
  const total_charged_cents = items.reduce(
    (s, p) => s + (p.charged_amount_cents ?? 0),
    0,
  );
  return {
    procedures_count: items.length,
    total_actual_cost_cents,
    total_charged_cents,
    total_gross_result_cents: total_charged_cents - total_actual_cost_cents,
  };
}

export function getAppointmentDirectCost(
  ctx: AuthzContext,
  appointmentId: string,
): {
  procedures: PerformedProcedure[];
  total_actual_cost_cents: number | null;
} {
  const store = getPerformedStore();
  const procedures = store.performedProcedures.filter(
    (p) =>
      p.clinic_id === ctx.clinicId &&
      p.appointment_id === appointmentId &&
      p.status !== "cancelled",
  );
  if (!canViewProcedureCosts(ctx)) {
    return { procedures, total_actual_cost_cents: null };
  }
  return {
    procedures,
    total_actual_cost_cents: procedures.reduce(
      (s, p) => s + (p.actual_total_cost_cents ?? p.planned_total_cost_cents),
      0,
    ),
  };
}
