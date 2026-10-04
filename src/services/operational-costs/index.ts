import { can, type AuthzContext } from "@/lib/authz/can";
import { assertPermission } from "@/lib/authz/guards";
import {
  getClinicCostsStore,
  writeClinicCostAudit,
} from "@/lib/demo/clinic-costs-store";
import {
  calculateCostPerMinuteCents,
  calculateHourlyOperatingCostCents,
  simulateHourlyCostCents,
  simulatePriceForMarginCents,
} from "@/lib/clinic-costs/formulas";
import {
  calculateProductiveHours,
  getAllocatableMonthlyCosts,
  getClinicCostSettings,
  getMonthlyOperatingExpenses,
  getMonthlyOperatingExpensesInternal,
} from "@/services/clinic-costs";
import type {
  ClinicHourlyCostSnapshot,
  HourlyOperatingCost,
} from "@/types/clinic-costs";

function now() {
  return new Date().toISOString();
}

function assertView(ctx: AuthzContext) {
  if (
    !can(ctx, "operational_costs.view").allowed &&
    !can(ctx, "clinic_costs.view").allowed
  ) {
    assertPermission(ctx, "operational_costs.view");
  }
}

export function getHourlySnapshot(
  ctx: AuthzContext,
  referenceMonth: string,
): ClinicHourlyCostSnapshot | null {
  assertView(ctx);
  return (
    getClinicCostsStore().hourlySnapshots.find(
      (s) =>
        s.clinic_id === ctx.clinicId && s.reference_month === referenceMonth,
    ) ?? null
  );
}

/**
 * Calcula e opcionalmente persiste snapshot do mês.
 * Não altera procedimentos históricos.
 */
export function calculateHourlyOperatingCost(
  ctx: AuthzContext,
  referenceMonth: string,
  opts?: { persist?: boolean },
): HourlyOperatingCost {
  assertView(ctx);
  const settings = getClinicCostSettings(ctx);
  const expenses = getMonthlyOperatingExpenses(ctx, referenceMonth);
  const hours = calculateProductiveHours(ctx, settings);
  const existing = getHourlySnapshot(ctx, referenceMonth);

  if (hours == null || hours <= 0) {
    return {
      reference_month: referenceMonth,
      allocatable_cost_cents: expenses.allocatable_cents,
      productive_hours: null,
      hourly_cost_cents: null,
      cost_per_minute_cents: null,
      insufficient_data: true,
      message:
        "Configure suas horas produtivas para calcular o custo operacional dos procedimentos.",
      composition: expenses.lines.filter((l) => l.allocation_eligible),
      snapshot_id: existing?.id ?? null,
    };
  }

  const hourly = calculateHourlyOperatingCostCents(
    expenses.allocatable_cents,
    hours,
  );
  if (hourly == null) {
    return {
      reference_month: referenceMonth,
      allocatable_cost_cents: expenses.allocatable_cents,
      productive_hours: hours,
      hourly_cost_cents: null,
      cost_per_minute_cents: null,
      insufficient_data: true,
      message: "Dados insuficientes para calcular o custo/hora.",
      composition: expenses.lines.filter((l) => l.allocation_eligible),
      snapshot_id: existing?.id ?? null,
    };
  }

  let snapshotId = existing?.id ?? null;
  if (opts?.persist && !existing) {
    const snap: ClinicHourlyCostSnapshot = {
      id: `chs-${crypto.randomUUID()}`,
      clinic_id: ctx.clinicId,
      reference_month: referenceMonth,
      allocatable_cost_cents: expenses.allocatable_cents,
      productive_hours: hours,
      hourly_cost_cents: hourly,
      calculation_method:
        settings?.calculation_mode ?? "manual_productive_hours",
      created_at: now(),
    };
    getClinicCostsStore().hourlySnapshots.unshift(snap);
    snapshotId = snap.id;
    writeClinicCostAudit({
      clinic_id: ctx.clinicId,
      actor_user_id: ctx.userId,
      action: "clinic_hourly_cost_snapshot.created",
      target_type: "clinic_hourly_cost_snapshot",
      target_id: snap.id,
      metadata: { reference_month: referenceMonth, hourly_cost_cents: hourly },
    });
  }

  return {
    reference_month: referenceMonth,
    allocatable_cost_cents: expenses.allocatable_cents,
    productive_hours: hours,
    hourly_cost_cents: hourly,
    cost_per_minute_cents: calculateCostPerMinuteCents(hourly),
    insufficient_data: false,
    message: null,
    composition: expenses.lines.filter((l) => l.allocation_eligible),
    snapshot_id: snapshotId,
  };
}

/**
 * Resolve custo/hora sem assert de permissão (uso interno ao concluir procedimento).
 * Snapshot existente tem prioridade; senão calcula e persiste.
 */
export function resolveHourlyCostForMonthInternal(
  clinicId: string,
  userId: string,
  referenceMonth: string,
): number | null {
  const store = getClinicCostsStore();
  const existing = store.hourlySnapshots.find(
    (s) => s.clinic_id === clinicId && s.reference_month === referenceMonth,
  );
  if (existing) return existing.hourly_cost_cents;

  const settings = store.settings.find((s) => s.clinic_id === clinicId) ?? null;
  const hours = settings?.monthly_productive_hours ?? null;
  if (hours == null || hours <= 0) return null;

  const expenses = getMonthlyOperatingExpensesInternal(clinicId, referenceMonth);
  const hourly = calculateHourlyOperatingCostCents(
    expenses.allocatable_cents,
    hours,
  );
  if (hourly == null) return null;

  const snap: ClinicHourlyCostSnapshot = {
    id: `chs-${crypto.randomUUID()}`,
    clinic_id: clinicId,
    reference_month: referenceMonth,
    allocatable_cost_cents: expenses.allocatable_cents,
    productive_hours: hours,
    hourly_cost_cents: hourly,
    calculation_method: settings?.calculation_mode ?? "manual_productive_hours",
    created_at: now(),
  };
  store.hourlySnapshots.unshift(snap);
  writeClinicCostAudit({
    clinic_id: clinicId,
    actor_user_id: userId,
    action: "clinic_hourly_cost_snapshot.created",
    target_type: "clinic_hourly_cost_snapshot",
    target_id: snap.id,
    metadata: { reference_month: referenceMonth, hourly_cost_cents: hourly },
  });
  return hourly;
}

/**
 * Resolve custo/hora para um procedimento: snapshot do mês se existir;
 * senão calcula e persiste. Não altera snapshots já gravados.
 */
export function resolveHourlyCostForMonth(
  ctx: AuthzContext,
  referenceMonth: string,
): number | null {
  assertView(ctx);
  return resolveHourlyCostForMonthInternal(
    ctx.clinicId,
    ctx.userId,
    referenceMonth,
  );
}

export function simulateHourlyCost(
  ctx: AuthzContext,
  input: { reference_month: string; productive_hours: number },
): {
  allocatable_cost_cents: number;
  productive_hours: number;
  hourly_cost_cents: number | null;
} {
  assertView(ctx);
  const alloc = getAllocatableMonthlyCosts(ctx, input.reference_month);
  return {
    allocatable_cost_cents: alloc,
    productive_hours: input.productive_hours,
    hourly_cost_cents: simulateHourlyCostCents(alloc, input.productive_hours),
  };
}

export function simulateProcedurePrice(
  ctx: AuthzContext,
  input: {
    operational_cost_cents: number;
    desired_margin_percent?: number;
    simulated_price_cents?: number;
  },
): {
  operational_cost_cents: number;
  simulated_price_cents: number | null;
  operational_result_cents: number | null;
  operational_margin_percent: number | null;
  message: string | null;
} {
  assertView(ctx);
  if (
    input.desired_margin_percent != null &&
    input.simulated_price_cents == null
  ) {
    const price = simulatePriceForMarginCents(
      input.operational_cost_cents,
      input.desired_margin_percent,
    );
    if (price == null) {
      return {
        operational_cost_cents: input.operational_cost_cents,
        simulated_price_cents: null,
        operational_result_cents: null,
        operational_margin_percent: null,
        message: "Margem inválida (deve ser menor que 100%).",
      };
    }
    const result = price - input.operational_cost_cents;
    return {
      operational_cost_cents: input.operational_cost_cents,
      simulated_price_cents: price,
      operational_result_cents: result,
      operational_margin_percent: input.desired_margin_percent,
      message: "Simulação — não é recomendação de preço do Sorria.",
    };
  }
  const price = input.simulated_price_cents ?? null;
  if (price == null) {
    return {
      operational_cost_cents: input.operational_cost_cents,
      simulated_price_cents: null,
      operational_result_cents: null,
      operational_margin_percent: null,
      message: "Informe preço simulado ou margem desejada.",
    };
  }
  const result = price - input.operational_cost_cents;
  const margin =
    price === 0 ? null : Math.round((result / price) * 10000) / 100;
  return {
    operational_cost_cents: input.operational_cost_cents,
    simulated_price_cents: price,
    operational_result_cents: result,
    operational_margin_percent: margin,
    message: "Simulação — não é recomendação de preço do Sorria.",
  };
}
