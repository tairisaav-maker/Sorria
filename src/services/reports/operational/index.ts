import { can, type AuthzContext } from "@/lib/authz/can";
import { assertPermission } from "@/lib/authz/guards";
import { getClinic } from "@/lib/demo/authz-store";
import { getFinanceStore } from "@/lib/demo/finance-store";
import { getInventoryStore } from "@/lib/demo/inventory-store";
import { getPatientRecord } from "@/lib/demo/patients-store";
import { getPerformedStore } from "@/lib/demo/performed-procedures-store";
import {
  autoGranularity,
  bucketKey,
  bucketLabel,
  DEFAULT_CLINIC_TZ,
  inPeriod,
  previousEquivalentPeriod,
  resolveReportPeriod,
} from "@/lib/reports/period";
import {
  averageOrNull,
  costCoverage,
  grossMarginPercent,
  grossResult,
  periodDeltaPercent,
  plannedVsActual,
} from "@/lib/reports/operational-formulas";
import {
  calculateProcedureOutstandingBalance,
  calculateProcedureReceivedAmount,
} from "@/services/patient-procedure-finance";
import type { ReportFilter } from "@/services/reports";
import { getFinancialMetrics } from "@/services/reports";
import type {
  CostCoverageReport,
  FinancialOperationalReport,
  MaterialConsumptionDetail,
  MaterialConsumptionRow,
  OperationalCostCoverageReport,
  OperationalOverview,
  PatientOperationalRow,
  ProcedurePerformanceDetail,
  ProcedurePerformanceRow,
} from "@/types/operational-reports";
import type { ReportPeriod } from "@/types/reports";
import type { PerformedProcedure } from "@/types/performed-procedure";

function clinicTz(clinicId: string) {
  return getClinic(clinicId)?.timezone ?? DEFAULT_CLINIC_TZ;
}

function periodOf(ctx: AuthzContext, filter: ReportFilter): ReportPeriod {
  return resolveReportPeriod({
    preset: filter.preset,
    customStart: filter.customStart,
    customEnd: filter.customEnd,
    timeZone: clinicTz(ctx.clinicId),
  });
}

function canViewProcedureCosts(ctx: AuthzContext) {
  return (
    can(ctx, "reports.procedure_costs_view").allowed ||
    can(ctx, "procedure_costs.view").allowed ||
    can(ctx, "cost_reports.view").allowed
  );
}

function canViewOperationalCosts(ctx: AuthzContext) {
  return (
    can(ctx, "procedure_operational_costs.view").allowed ||
    can(ctx, "operational_costs.view").allowed ||
    can(ctx, "clinic_costs.view").allowed ||
    can(ctx, "cost_reports.view").allowed
  );
}

function hasOperationalCost(p: PerformedProcedure) {
  return (
    p.actual_duration_minutes != null &&
    p.actual_duration_minutes > 0 &&
    p.productive_hour_cost_snapshot_cents != null &&
    p.operational_total_cost_cents != null
  );
}

function canViewMaterials(ctx: AuthzContext) {
  return (
    can(ctx, "reports.materials_view").allowed ||
    can(ctx, "inventory.view").allowed
  );
}

function canViewPatientFinancial(ctx: AuthzContext) {
  return (
    can(ctx, "reports.patient_financial_view").allowed ||
    can(ctx, "finance.view_administrative").allowed ||
    can(ctx, "finance.view_authorized").allowed
  );
}

function canViewFinancialOps(ctx: AuthzContext) {
  return (
    can(ctx, "reports.financial_view").allowed ||
    can(ctx, "reports.view_financial").allowed
  );
}

function completedInPeriod(
  ctx: AuthzContext,
  period: ReportPeriod,
): PerformedProcedure[] {
  return getPerformedStore().performedProcedures.filter((p) => {
    if (p.clinic_id !== ctx.clinicId || p.status !== "completed") return false;
    const at = p.completed_at ?? p.created_at;
    return inPeriod(at, period);
  });
}

/** Custo completo = consumo confirmado + actual_total_cost não nulo. */
function hasCompleteCost(p: PerformedProcedure): boolean {
  return p.consumption_confirmed && p.actual_total_cost_cents != null;
}

function hasBom(ctx: AuthzContext, procedureId: string): boolean {
  return getInventoryStore().procedureMaterials.some(
    (m) => m.clinic_id === ctx.clinicId && m.procedure_id === procedureId,
  );
}

function sumChargedAvoidingPlanDup(items: PerformedProcedure[]): number {
  // Evita somar charged de itens included_in_plan (plano já cobrado no financeiro)
  return items.reduce((s, p) => {
    if (p.financial_status === "included_in_plan") return s;
    if (p.financial_status === "no_charge") return s;
    return s + (p.charged_amount_cents ?? 0);
  }, 0);
}

function sumReceived(ctx: AuthzContext, items: PerformedProcedure[]): number {
  return items.reduce(
    (s, p) => s + calculateProcedureReceivedAmount(ctx, p.id),
    0,
  );
}

function sumActualCost(items: PerformedProcedure[]): {
  sum: number;
  complete: number;
} {
  let sum = 0;
  let complete = 0;
  for (const p of items) {
    if (hasCompleteCost(p)) {
      sum += p.actual_total_cost_cents ?? 0;
      complete += 1;
    }
  }
  return { sum, complete };
}

export function getCostCoverageReport(
  ctx: AuthzContext,
  filter: ReportFilter,
): CostCoverageReport {
  assertPermission(ctx, "reports.view");
  const period = periodOf(ctx, filter);
  const items = completedInPeriod(ctx, period);
  let withComplete = 0;
  let withoutBom = 0;
  let withoutUnitCost = 0;
  for (const p of items) {
    if (hasCompleteCost(p)) {
      withComplete += 1;
      continue;
    }
    if (!hasBom(ctx, p.procedure_id)) withoutBom += 1;
    else withoutUnitCost += 1;
  }
  return {
    completed: items.length,
    with_complete_cost: withComplete,
    coverage_percent: costCoverage(withComplete, items.length),
    incomplete_count: items.length - withComplete,
    without_bom_count: withoutBom,
    without_unit_cost_count: withoutUnitCost,
  };
}

function overviewForPeriod(
  ctx: AuthzContext,
  period: ReportPeriod,
  filter?: ReportFilter,
): Omit<OperationalOverview, "previous_comparison" | "planned_vs_actual_percent" | "planned_vs_actual_label"> {
  const items = completedInPeriod(ctx, period);
  const showCost = canViewProcedureCosts(ctx);
  const showFin = canViewFinancialOps(ctx) || canViewPatientFinancial(ctx);
  const { sum: costSum, complete } = sumActualCost(items);
  const charged = sumChargedAvoidingPlanDup(items);
  const received = showFin ? sumReceived(ctx, items) : null;

  let receivable: number | null = null;
  if (showFin && filter) {
    try {
      const fin = getFinancialMetrics(ctx, filter);
      receivable = fin.receivable_cents?.value ?? null;
    } catch {
      receivable = null;
    }
  }

  const showOp = canViewOperationalCosts(ctx);
  let opTotal = 0;
  let opComplete = 0;
  for (const p of items) {
    if (hasOperationalCost(p)) {
      opTotal += p.operational_total_cost_cents ?? 0;
      opComplete += 1;
    }
  }
  const opResult =
    showOp && opComplete > 0 ? charged - opTotal : null;

  return {
    procedures_completed: items.length,
    materials_cost_cents: showCost ? costSum : null,
    charged_cents: showCost || showFin ? charged : null,
    received_cents: received,
    gross_result_charged_cents:
      showCost ? grossResult(charged, costSum) : null,
    gross_result_received_cents:
      showCost && showFin && received != null
        ? grossResult(received, costSum)
        : null,
    receivable_cents: receivable,
    cost_coverage_percent: costCoverage(complete, items.length),
    incomplete_cost_procedures: items.length - complete,
    operational_total_cost_cents: showOp && opComplete > 0 ? opTotal : null,
    operational_result_cents: opResult,
    operational_coverage_percent: showOp
      ? costCoverage(opComplete, items.length)
      : null,
  };
}

export function getOperationalCostCoverageReport(
  ctx: AuthzContext,
  filter: ReportFilter,
): OperationalCostCoverageReport {
  assertPermission(ctx, "reports.view");
  if (!canViewOperationalCosts(ctx)) {
    return {
      completed: 0,
      with_operational_cost: 0,
      coverage_percent: null,
      incomplete_count: 0,
    };
  }
  const period = periodOf(ctx, filter);
  const items = completedInPeriod(ctx, period);
  let withOp = 0;
  for (const p of items) {
    if (hasOperationalCost(p)) withOp += 1;
  }
  return {
    completed: items.length,
    with_operational_cost: withOp,
    coverage_percent: costCoverage(withOp, items.length),
    incomplete_count: items.length - withOp,
  };
}

function plannedVsActualForPeriod(ctx: AuthzContext, period: ReportPeriod) {
  const items = completedInPeriod(ctx, period);
  const store = getPerformedStore();
  let planned = 0;
  let actual = 0;
  let withData = 0;
  for (const p of items) {
    if (!p.consumption_confirmed) continue;
    const lines = store.procedureConsumptions.filter(
      (c) => c.performed_procedure_id === p.id && c.clinic_id === ctx.clinicId,
    );
    if (lines.length === 0) continue;
    withData += 1;
    for (const l of lines) {
      planned += l.planned_cost_cents;
      actual += l.actual_cost_cents ?? l.planned_cost_cents;
    }
  }
  if (withData < 3 || planned <= 0) {
    return {
      percent: null as number | null,
      label:
        withData === 0
          ? "Dados insuficientes para comparar consumo previsto e real."
          : null,
    };
  }
  const pv = plannedVsActual({ planned, actual });
  return {
    percent: pv.percent,
    label:
      pv.percent == null
        ? null
        : pv.percent >= 0
          ? `Materiais utilizados: ${pv.percent}% acima do previsto`
          : `Materiais utilizados: ${Math.abs(pv.percent)}% abaixo do previsto`,
  };
}

export function getOperationalOverview(
  ctx: AuthzContext,
  filter: ReportFilter,
): OperationalOverview {
  assertPermission(ctx, "reports.view");
  const period = periodOf(ctx, filter);
  const prev = previousEquivalentPeriod(period);
  const current = overviewForPeriod(ctx, period, filter);
  const previous = overviewForPeriod(ctx, prev);
  const pva = plannedVsActualForPeriod(ctx, period);

  return {
    ...current,
    planned_vs_actual_percent: pva.percent,
    planned_vs_actual_label: pva.label,
    previous_comparison: {
      procedures: {
        current: current.procedures_completed,
        previous: previous.procedures_completed,
        label: periodDeltaPercent(
          current.procedures_completed,
          previous.procedures_completed,
        ).label,
      },
      materials_cost: {
        current: current.materials_cost_cents,
        previous: previous.materials_cost_cents,
        label:
          current.materials_cost_cents != null &&
          previous.materials_cost_cents != null
            ? periodDeltaPercent(
                current.materials_cost_cents,
                previous.materials_cost_cents,
              ).label
            : "Sem base de comparação",
      },
      received: {
        current: current.received_cents,
        previous: previous.received_cents,
        label:
          current.received_cents != null && previous.received_cents != null
            ? periodDeltaPercent(
                current.received_cents,
                previous.received_cents,
              ).label
            : "Sem base de comparação",
      },
    },
  };
}

export function getProcedurePerformanceReport(
  ctx: AuthzContext,
  filter: ReportFilter,
): ProcedurePerformanceRow[] {
  assertPermission(ctx, "reports.view");
  const period = periodOf(ctx, filter);
  const items = completedInPeriod(ctx, period);
  const showCost = canViewProcedureCosts(ctx);
  const showFin = canViewFinancialOps(ctx) || canViewPatientFinancial(ctx);
  const inv = getInventoryStore();

  const byProc = new Map<string, PerformedProcedure[]>();
  for (const p of items) {
    const list = byProc.get(p.procedure_id) ?? [];
    list.push(p);
    byProc.set(p.procedure_id, list);
  }

  const rows: ProcedurePerformanceRow[] = [];
  for (const [procedureId, list] of byProc) {
    const name =
      inv.procedures.find((p) => p.id === procedureId)?.name ??
      list[0]?.procedure_name_snapshot ??
      "Procedimento";
    const chargedItems = list.filter(
      (p) =>
        p.financial_status !== "no_charge" &&
        p.financial_status !== "included_in_plan" &&
        (p.charged_amount_cents ?? 0) > 0,
    );
    const { sum: costSum, complete } = sumActualCost(list);
    const plannedSum = list.reduce(
      (s, p) => s + (p.planned_total_cost_cents ?? 0),
      0,
    );
    const chargedSum = sumChargedAvoidingPlanDup(list);
    const receivedSum = showFin ? sumReceived(ctx, list) : null;
    const avgActual = showCost ? averageOrNull(costSum, complete) : null;
    const avgPlanned = showCost
      ? averageOrNull(plannedSum, list.length)
      : null;
    const avgCharged = averageOrNull(
      chargedSum,
      chargedItems.length || 0,
    );
    const result = showCost ? grossResult(chargedSum, costSum) : null;
    const margin = showCost
      ? grossMarginPercent(chargedSum, costSum)
      : null;
    const costDev =
      showCost && plannedSum > 0 && complete > 0
        ? plannedVsActual({
            planned: plannedSum / list.length,
            actual: costSum / complete,
          }).percent
        : null;

    const showOp = canViewOperationalCosts(ctx);
    const withDuration = list.filter(
      (p) => p.actual_duration_minutes != null && p.actual_duration_minutes > 0,
    );
    const avgDuration = averageOrNull(
      withDuration.reduce((s, p) => s + (p.actual_duration_minutes ?? 0), 0),
      withDuration.length,
    );
    const defaultDuration =
      inv.procedures.find((p) => p.id === procedureId)?.default_duration_minutes ??
      null;
    const durationDelta =
      avgDuration != null && defaultDuration != null && defaultDuration > 0
        ? Math.round(
            ((avgDuration - defaultDuration) / defaultDuration) * 1000,
          ) / 10
        : null;
    const withOp = list.filter(hasOperationalCost);
    const opSum = withOp.reduce(
      (s, p) => s + (p.operational_total_cost_cents ?? 0),
      0,
    );
    const opResultSum = withOp.reduce(
      (s, p) => s + (p.operational_result_cents ?? 0),
      0,
    );

    rows.push({
      procedure_id: procedureId,
      procedure_name: name,
      count: list.length,
      charged_count: chargedItems.length,
      avg_actual_cost_cents: avgActual,
      avg_planned_cost_cents: avgPlanned,
      avg_charged_cents: showCost || showFin ? avgCharged : null,
      total_charged_cents: showCost || showFin ? chargedSum : null,
      total_received_cents: receivedSum,
      total_actual_cost_cents: showCost ? costSum : null,
      gross_result_cents: result,
      margin_percent: margin,
      cost_deviation_percent: costDev,
      incomplete_cost_count: list.length - complete,
      avg_duration_minutes: showOp ? avgDuration : null,
      default_duration_minutes: showOp ? defaultDuration : null,
      duration_delta_percent: showOp ? durationDelta : null,
      avg_operational_cost_cents: showOp
        ? averageOrNull(opSum, withOp.length)
        : null,
      total_operational_cost_cents: showOp && withOp.length > 0 ? opSum : null,
      operational_result_cents:
        showOp && withOp.length > 0 ? opResultSum : null,
    });
  }

  return rows.sort((a, b) => b.count - a.count || a.procedure_name.localeCompare(b.procedure_name));
}

export function getProcedurePerformanceDetail(
  ctx: AuthzContext,
  filter: ReportFilter,
  procedureId: string,
): ProcedurePerformanceDetail {
  const rows = getProcedurePerformanceReport(ctx, filter);
  const row = rows.find((r) => r.procedure_id === procedureId);
  if (!row) throw new Error("PROCEDURE_NOT_FOUND");

  const period = periodOf(ctx, filter);
  const items = completedInPeriod(ctx, period).filter(
    (p) => p.procedure_id === procedureId,
  );
  const showCost = canViewProcedureCosts(ctx);
  const showNames = can(ctx, "patients.demographics.view").allowed;
  const inv = getInventoryStore();
  const catalog = inv.procedures.find((p) => p.id === procedureId);
  const gran = autoGranularity(period);

  const buckets = new Map<string, { count: number; costSum: number; costN: number }>();
  for (const p of items) {
    const at = p.completed_at ?? p.created_at;
    const key = bucketKey(at, gran, period.timezone);
    const b = buckets.get(key) ?? { count: 0, costSum: 0, costN: 0 };
    b.count += 1;
    if (hasCompleteCost(p)) {
      b.costSum += p.actual_total_cost_cents ?? 0;
      b.costN += 1;
    }
    buckets.set(key, b);
  }

  return {
    ...row,
    standard_price_cents: catalog?.default_price_cents ?? null,
    monthly_series: [...buckets.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, b]) => ({
        key,
        label: bucketLabel(key, gran),
        count: b.count,
        avg_cost_cents: showCost ? averageOrNull(b.costSum, b.costN) : null,
      })),
    recent: items
      .sort((a, b) =>
        (b.completed_at ?? b.created_at).localeCompare(
          a.completed_at ?? a.created_at,
        ),
      )
      .slice(0, 40)
      .map((p) => ({
        id: p.id,
        patient_id: p.patient_id,
        patient_name: showNames
          ? getPatientRecord(p.patient_id)?.full_name ?? null
          : null,
        tooth_number: p.tooth_number,
        completed_at: p.completed_at,
        charged_amount_cents: p.charged_amount_cents,
        actual_total_cost_cents: showCost ? p.actual_total_cost_cents : null,
      })),
  };
}

export function getMaterialConsumptionReport(
  ctx: AuthzContext,
  filter: ReportFilter,
): MaterialConsumptionRow[] {
  if (!canViewMaterials(ctx)) {
    assertPermission(ctx, "reports.materials_view");
  }
  assertPermission(ctx, "reports.view");
  const period = periodOf(ctx, filter);
  const items = completedInPeriod(ctx, period);
  const ids = new Set(items.map((p) => p.id));
  const store = getPerformedStore();
  const inv = getInventoryStore();
  const showCost = canViewProcedureCosts(ctx) || can(ctx, "inventory.cost_view").allowed;

  type Acc = {
    planned: number;
    actual: number;
    cost: number;
    costIncomplete: boolean;
    procedures: Set<string>;
    unit: string;
    name: string;
  };
  const map = new Map<string, Acc>();

  for (const line of store.procedureConsumptions) {
    if (line.clinic_id !== ctx.clinicId) continue;
    if (!ids.has(line.performed_procedure_id)) continue;
    if (line.status === "planned" && !line.confirmed_at) continue;
    const item = inv.inventoryItems.find((i) => i.id === line.inventory_item_id);
    const acc = map.get(line.inventory_item_id) ?? {
      planned: 0,
      actual: 0,
      cost: 0,
      costIncomplete: false,
      procedures: new Set<string>(),
      unit: line.consumption_unit,
      name: line.item_name_snapshot,
    };
    acc.planned += line.planned_quantity;
    acc.actual += line.actual_quantity ?? line.planned_quantity;
    acc.procedures.add(line.performed_procedure_id);
    const unitCost = line.unit_cost_snapshot_cents;
    if (unitCost <= 0 && (line.actual_quantity ?? 0) > 0) {
      acc.costIncomplete = true;
    } else {
      acc.cost += line.actual_cost_cents ?? line.planned_cost_cents;
    }
    if (item) {
      acc.name = item.name;
      acc.unit = item.consumption_unit;
    }
    map.set(line.inventory_item_id, acc);
  }

  // appointment consumptions
  for (const line of store.appointmentConsumptions) {
    if (line.clinic_id !== ctx.clinicId) continue;
    const related = items.some((p) => p.appointment_id === line.appointment_id);
    if (!related) continue;
    if (line.status === "planned" && !line.confirmed_at) continue;
    const item = inv.inventoryItems.find((i) => i.id === line.inventory_item_id);
    const acc = map.get(line.inventory_item_id) ?? {
      planned: 0,
      actual: 0,
      cost: 0,
      costIncomplete: false,
      procedures: new Set<string>(),
      unit: line.consumption_unit,
      name: line.item_name_snapshot,
    };
    acc.planned += line.planned_quantity;
    acc.actual += line.actual_quantity ?? line.planned_quantity;
    if (line.unit_cost_snapshot_cents <= 0) acc.costIncomplete = true;
    else acc.cost += line.actual_cost_cents ?? line.planned_cost_cents;
    if (item) {
      acc.name = item.name;
      acc.unit = item.consumption_unit;
    }
    map.set(line.inventory_item_id, acc);
  }

  const rows: MaterialConsumptionRow[] = [];
  for (const [id, acc] of map) {
    const item = inv.inventoryItems.find((i) => i.id === id);
    const diff = plannedVsActual({ planned: acc.planned, actual: acc.actual });
    rows.push({
      inventory_item_id: id,
      item_name: acc.name,
      consumption_unit: acc.unit,
      planned_quantity: Math.round(acc.planned * 10000) / 10000,
      actual_quantity: Math.round(acc.actual * 10000) / 10000,
      difference: Math.round(diff.difference * 10000) / 10000,
      difference_percent: diff.percent,
      cost_consumed_cents: showCost
        ? acc.costIncomplete
          ? null
          : acc.cost
        : null,
      cost_incomplete: showCost ? acc.costIncomplete : false,
      procedures_count: acc.procedures.size,
      current_stock: item?.current_quantity ?? null,
      average_unit_cost_cents: showCost
        ? item?.average_unit_cost_cents ?? null
        : null,
    });
  }

  return rows.sort((a, b) => {
    const ca = a.cost_consumed_cents ?? 0;
    const cb = b.cost_consumed_cents ?? 0;
    if (cb !== ca) return cb - ca;
    return a.item_name.localeCompare(b.item_name);
  });
}

export function getMaterialConsumptionDetail(
  ctx: AuthzContext,
  filter: ReportFilter,
  inventoryItemId: string,
): MaterialConsumptionDetail {
  const rows = getMaterialConsumptionReport(ctx, filter);
  const row = rows.find((r) => r.inventory_item_id === inventoryItemId);
  if (!row) throw new Error("INVENTORY_ITEM_NOT_FOUND");

  const period = periodOf(ctx, filter);
  const items = completedInPeriod(ctx, period);
  const ids = new Set(items.map((p) => p.id));
  const store = getPerformedStore();
  const showCost = canViewProcedureCosts(ctx) || can(ctx, "inventory.cost_view").allowed;
  const showPatient = can(ctx, "patients.demographics.view").allowed;

  const usages = store.procedureConsumptions
    .filter(
      (c) =>
        c.clinic_id === ctx.clinicId &&
        c.inventory_item_id === inventoryItemId &&
        ids.has(c.performed_procedure_id),
    )
    .map((c) => {
      const pp = items.find((p) => p.id === c.performed_procedure_id);
      return {
        performed_procedure_id: c.performed_procedure_id,
        procedure_name: pp?.procedure_name_snapshot ?? "Procedimento",
        patient_id: showPatient ? pp?.patient_id ?? null : null,
        patient_name: showPatient
          ? getPatientRecord(pp?.patient_id ?? "")?.full_name ?? null
          : null,
        planned_quantity: c.planned_quantity,
        actual_quantity: c.actual_quantity ?? c.planned_quantity,
        cost_cents: showCost
          ? c.unit_cost_snapshot_cents <= 0
            ? null
            : c.actual_cost_cents ?? c.planned_cost_cents
          : null,
      };
    });

  const purchases = getInventoryStore()
    .purchases.filter(
      (p) => p.clinic_id === ctx.clinicId && !p.cancelled_at,
    )
    .flatMap((p) => {
      const lines = getInventoryStore().purchaseItems.filter(
        (i) =>
          i.inventory_purchase_id === p.id &&
          i.inventory_item_id === inventoryItemId,
      );
      return lines.map((l) => ({
        id: p.id,
        purchase_date: p.purchase_date,
        quantity: l.purchase_quantity * l.units_per_purchase_unit_snapshot,
        total_cost_cents: showCost ? l.total_cost_cents : null,
      }));
    })
    .sort((a, b) => b.purchase_date.localeCompare(a.purchase_date))
    .slice(0, 10);

  return { ...row, usages, recent_purchases: purchases };
}

export function getPatientOperationalReport(
  ctx: AuthzContext,
  filter: ReportFilter,
): PatientOperationalRow[] {
  assertPermission(ctx, "reports.view");
  if (!can(ctx, "patients.demographics.view").allowed) {
    throw new Error("AUTHORIZATION_DENIED");
  }
  const period = periodOf(ctx, filter);
  const items = completedInPeriod(ctx, period);
  const showCost = canViewProcedureCosts(ctx);
  const showFin = canViewPatientFinancial(ctx);

  const byPatient = new Map<string, PerformedProcedure[]>();
  for (const p of items) {
    const list = byPatient.get(p.patient_id) ?? [];
    list.push(p);
    byPatient.set(p.patient_id, list);
  }

  const rows: PatientOperationalRow[] = [];
  for (const [patientId, list] of byPatient) {
    const patient = getPatientRecord(patientId);
    const { sum: costSum } = sumActualCost(list);
    const charged = sumChargedAvoidingPlanDup(list);
    let received: number | null = null;
    let outstanding: number | null = null;
    if (showFin) {
      // Recebido/saldo dos procedimentos do período (financeiro real alocado)
      received = sumReceived(ctx, list);
      outstanding = list.reduce(
        (s, p) => s + calculateProcedureOutstandingBalance(ctx, p.id),
        0,
      );
    }
    const showOp = canViewOperationalCosts(ctx);
    const withOp = list.filter(hasOperationalCost);
    const opSum = withOp.reduce(
      (s, p) => s + (p.operational_total_cost_cents ?? 0),
      0,
    );
    const opResult = withOp.reduce(
      (s, p) => s + (p.operational_result_cents ?? 0),
      0,
    );

    rows.push({
      patient_id: patientId,
      patient_name: patient?.full_name ?? "Paciente",
      procedures_count: list.length,
      direct_cost_cents: showCost ? costSum : null,
      charged_cents: showCost || showFin ? charged : null,
      received_cents: received,
      outstanding_cents: outstanding,
      gross_result_cents: showCost ? grossResult(charged, costSum) : null,
      operational_cost_cents: showOp && withOp.length > 0 ? opSum : null,
      operational_result_cents: showOp && withOp.length > 0 ? opResult : null,
    });
  }

  return rows.sort((a, b) => b.procedures_count - a.procedures_count);
}

export function getFinancialOperationalReport(
  ctx: AuthzContext,
  filter: ReportFilter,
): FinancialOperationalReport {
  if (!canViewFinancialOps(ctx)) {
    assertPermission(ctx, "reports.financial_view");
  }
  assertPermission(ctx, "reports.view");
  const period = periodOf(ctx, filter);
  const overview = overviewForPeriod(ctx, period, filter);
  const showCost = canViewProcedureCosts(ctx);

  let overdue: number | null = null;
  try {
    const fin = getFinancialMetrics(ctx, filter);
    overdue = fin.overdue_cents?.value ?? null;
  } catch {
    overdue = null;
  }

  const items = completedInPeriod(ctx, period);
  const gran = autoGranularity(period);
  const buckets = new Map<
    string,
    { charged: number; received: number; cost: number }
  >();

  for (const p of items) {
    const at = p.completed_at ?? p.created_at;
    const key = bucketKey(at, gran, period.timezone);
    const b = buckets.get(key) ?? { charged: 0, received: 0, cost: 0 };
    if (
      p.financial_status !== "no_charge" &&
      p.financial_status !== "included_in_plan"
    ) {
      b.charged += p.charged_amount_cents ?? 0;
    }
    if (hasCompleteCost(p)) b.cost += p.actual_total_cost_cents ?? 0;
    buckets.set(key, b);
  }

  // received by payment date in period
  const finance = getFinanceStore();
  for (const pay of finance.payments) {
    if (pay.clinic_id !== ctx.clinicId || pay.reversed_at) continue;
    if (!inPeriod(pay.paid_at, period)) continue;
    const key = bucketKey(pay.paid_at, gran, period.timezone);
    const b = buckets.get(key) ?? { charged: 0, received: 0, cost: 0 };
    b.received += pay.amount_cents;
    buckets.set(key, b);
  }

  return {
    charged_cents: overview.charged_cents,
    received_cents: overview.received_cents,
    receivable_cents: overview.receivable_cents,
    overdue_cents: overdue,
    direct_cost_cents: showCost ? overview.materials_cost_cents : null,
    gross_result_charged_cents: showCost
      ? overview.gross_result_charged_cents
      : null,
    gross_result_received_cents: showCost
      ? overview.gross_result_received_cents
      : null,
    series: [...buckets.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, b]) => ({
        key,
        label: bucketLabel(key, gran),
        charged_cents: b.charged,
        received_cents: b.received,
        direct_cost_cents: showCost ? b.cost : 0,
      })),
  };
}

export function getOperationalBundle(ctx: AuthzContext, filter: ReportFilter) {
  assertPermission(ctx, "reports.view");
  const period = periodOf(ctx, filter);
  const clinic = getClinic(ctx.clinicId);
  const showCost = canViewProcedureCosts(ctx);
  const showMaterials = canViewMaterials(ctx);
  const showPatientFin = canViewPatientFinancial(ctx);
  const showFin = canViewFinancialOps(ctx);

  const showOp = canViewOperationalCosts(ctx);
  return {
    period,
    clinicName: clinic?.name ?? "Clínica",
    overview: getOperationalOverview(ctx, filter),
    coverage: getCostCoverageReport(ctx, filter),
    operational_coverage: showOp
      ? getOperationalCostCoverageReport(ctx, filter)
      : null,
    procedures: getProcedurePerformanceReport(ctx, filter),
    materials: showMaterials ? getMaterialConsumptionReport(ctx, filter) : null,
    patients:
      can(ctx, "patients.demographics.view").allowed
        ? getPatientOperationalReport(ctx, filter)
        : null,
    financial: showFin ? getFinancialOperationalReport(ctx, filter) : null,
    capabilities: {
      costs: showCost,
      operationalCosts: showOp,
      materials: showMaterials,
      patientFinancial: showPatientFin,
      financial: showFin,
      export: can(ctx, "reports.export").allowed,
      patients: can(ctx, "patients.demographics.view").allowed,
    },
  };
}
