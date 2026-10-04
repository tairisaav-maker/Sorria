import { can, type AuthzContext } from "@/lib/authz/can";
import { assertPermission } from "@/lib/authz/guards";
import { getAgendaStore } from "@/lib/demo/agenda-store";
import { getInventoryStore } from "@/lib/demo/inventory-store";
import {
  calculateOperationalMarginPercent,
  calculateOperationalResultCents,
  calculateOperationalTotalCents,
  calculateProcedureTimeCostCents,
  referenceMonthFromDate,
} from "@/lib/clinic-costs/formulas";
import { calculateProcedureStandardCost } from "@/services/procedures";
import {
  resolveHourlyCostForMonth,
  resolveHourlyCostForMonthInternal,
} from "@/services/operational-costs";
import { getPerformedStore } from "@/lib/demo/performed-procedures-store";
import type {
  DurationSource,
  ProcedureOperationalCost,
  StandardOperationalEstimate,
} from "@/types/clinic-costs";
import type { PerformedProcedure } from "@/types/performed-procedure";

function canViewOp(ctx: AuthzContext) {
  return (
    can(ctx, "procedure_operational_costs.view").allowed ||
    can(ctx, "operational_costs.view").allowed ||
    can(ctx, "clinic_costs.view").allowed
  );
}

function resolveDuration(
  ctx: AuthzContext,
  row: PerformedProcedure,
  manualMinutes?: number | null,
): { minutes: number | null; source: DurationSource | null } {
  if (manualMinutes != null && manualMinutes > 0) {
    return { minutes: manualMinutes, source: "manual" };
  }
  if (row.actual_duration_minutes != null && row.actual_duration_minutes > 0) {
    return { minutes: row.actual_duration_minutes, source: "manual" };
  }
  if (row.started_at && row.completed_at) {
    const mins = Math.round(
      (+new Date(row.completed_at) - +new Date(row.started_at)) / 60_000,
    );
    if (mins > 0 && mins < 24 * 60) {
      return { minutes: mins, source: "actual" };
    }
  }
  if (row.appointment_id) {
    const appt = getAgendaStore().appointments.find(
      (a) => a.id === row.appointment_id && a.clinic_id === ctx.clinicId,
    );
    if (appt) {
      const mins = Math.round(
        (+new Date(appt.end_at) - +new Date(appt.start_at)) / 60_000,
      );
      if (mins > 0) return { minutes: mins, source: "appointment" };
    }
  }
  const proc = getInventoryStore().procedures.find(
    (p) => p.id === row.procedure_id,
  );
  if (proc?.default_duration_minutes) {
    return {
      minutes: proc.default_duration_minutes,
      source: "default",
    };
  }
  return { minutes: null, source: null };
}

/**
 * Aplica custeio operacional no procedimento ao concluir.
 * Se não houver custo/hora configurado, deixa campos null (não usa zero).
 */
export function applyOperationalCostOnComplete(
  ctx: AuthzContext,
  row: PerformedProcedure,
  manualDuration?: number | null,
): void {
  const { minutes, source } = resolveDuration(ctx, row, manualDuration);
  row.actual_duration_minutes = minutes;
  row.duration_source = source;

  const month = referenceMonthFromDate(row.completed_at ?? row.created_at);
  const hourly = resolveHourlyCostForMonthInternal(
    ctx.clinicId,
    ctx.userId,
    month,
  );

  if (hourly == null || minutes == null) {
    row.productive_hour_cost_snapshot_cents = hourly;
    row.allocated_time_cost_cents = null;
    row.operational_total_cost_cents = null;
    row.operational_result_cents = null;
    row.operational_margin_percent = null;
    return;
  }

  const timeCost = calculateProcedureTimeCostCents(minutes, hourly);
  const material = row.actual_material_cost_cents ?? 0;
  const direct =
    (row.actual_direct_cost_cents ?? 0) + (row.actual_shared_cost_cents ?? 0);
  const total = calculateOperationalTotalCents({
    materialCents: material,
    directCents: direct,
    timeCents: timeCost,
  });
  row.productive_hour_cost_snapshot_cents = hourly;
  row.allocated_time_cost_cents = timeCost;
  row.operational_total_cost_cents = total;
  row.operational_result_cents = calculateOperationalResultCents(
    row.charged_amount_cents,
    total,
  );
  row.operational_margin_percent = calculateOperationalMarginPercent(
    row.charged_amount_cents,
    total,
  );
}

export function calculateProcedureOperationalCost(
  ctx: AuthzContext,
  performedProcedureId: string,
): ProcedureOperationalCost {
  if (!canViewOp(ctx)) {
    assertPermission(ctx, "procedure_operational_costs.view");
  }
  const row = getPerformedStore().performedProcedures.find(
    (p) => p.id === performedProcedureId,
  );
  if (!row || row.clinic_id !== ctx.clinicId) {
    throw new Error("PERFORMED_PROCEDURE_NOT_FOUND");
  }

  const insufficient =
    row.productive_hour_cost_snapshot_cents == null ||
    row.operational_total_cost_cents == null;

  return {
    performed_procedure_id: row.id,
    material_cost_cents: row.actual_material_cost_cents,
    direct_cost_cents:
      (row.actual_direct_cost_cents ?? 0) + (row.actual_shared_cost_cents ?? 0),
    duration_minutes: row.actual_duration_minutes,
    duration_source: row.duration_source,
    productive_hour_cost_snapshot_cents: row.productive_hour_cost_snapshot_cents,
    allocated_time_cost_cents: row.allocated_time_cost_cents,
    operational_total_cost_cents: row.operational_total_cost_cents,
    charged_amount_cents: row.charged_amount_cents,
    gross_result_direct_cents: row.gross_result_cents,
    operational_result_cents: row.operational_result_cents,
    operational_margin_percent: row.operational_margin_percent,
    insufficient_data: insufficient,
    message: insufficient
      ? "Dados insuficientes para o custo operacional (horas ou duração)."
      : null,
  };
}

export function calculateProcedureTimeCost(
  ctx: AuthzContext,
  durationMinutes: number,
  referenceMonth?: string,
): number | null {
  if (!canViewOp(ctx)) assertPermission(ctx, "operational_costs.view");
  const month = referenceMonth ?? new Date().toISOString().slice(0, 7);
  const hourly = resolveHourlyCostForMonth(ctx, month);
  if (hourly == null) return null;
  return calculateProcedureTimeCostCents(durationMinutes, hourly);
}

export function calculateProcedureOperationalResult(
  ctx: AuthzContext,
  performedProcedureId: string,
) {
  return calculateProcedureOperationalCost(ctx, performedProcedureId);
}

/** Estimativa na ficha do procedimento (padrão atual — não histórico). */
export function getStandardOperationalEstimate(
  ctx: AuthzContext,
  procedureId: string,
): StandardOperationalEstimate {
  if (!canViewOp(ctx) && !can(ctx, "procedure_costs.view").allowed) {
    assertPermission(ctx, "procedure_operational_costs.view");
  }
  const standard = calculateProcedureStandardCost(ctx, procedureId);
  const proc = getInventoryStore().procedures.find(
    (p) => p.id === procedureId && p.clinic_id === ctx.clinicId,
  );
  const month = new Date().toISOString().slice(0, 7);
  let hourly: number | null = null;
  try {
    hourly = resolveHourlyCostForMonth(ctx, month);
  } catch {
    hourly = null;
  }
  const duration = proc?.default_duration_minutes ?? null;
  const timeCost =
    hourly != null && duration != null
      ? calculateProcedureTimeCostCents(duration, hourly)
      : null;
  const operationalTotal =
    timeCost != null
      ? standard.materials_cost_cents +
        standard.direct_costs_cents +
        timeCost
      : null;
  const price = standard.default_price_cents;
  return {
    procedure_id: procedureId,
    materials_cost_cents: standard.materials_cost_cents,
    direct_costs_cents: standard.direct_costs_cents,
    default_duration_minutes: duration,
    hourly_cost_cents: hourly,
    time_cost_cents: timeCost,
    operational_total_cents: operationalTotal,
    default_price_cents: price,
    operational_result_cents: calculateOperationalResultCents(
      price,
      operationalTotal,
    ),
    operational_margin_percent: calculateOperationalMarginPercent(
      price,
      operationalTotal,
    ),
    insufficient_data: operationalTotal == null,
    disclaimer:
      "Estimativa baseada nos custos e horas configurados pela clínica.",
  };
}
