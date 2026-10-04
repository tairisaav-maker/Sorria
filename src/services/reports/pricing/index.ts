import { can, type AuthzContext } from "@/lib/authz/can";
import { assertPermission } from "@/lib/authz/guards";
import { getClinic } from "@/lib/demo/authz-store";
import { getInventoryStore } from "@/lib/demo/inventory-store";
import { getPatientRecord } from "@/lib/demo/patients-store";
import { getPerformedStore } from "@/lib/demo/performed-procedures-store";
import {
  calculateAggregateMarginPercent,
  medianCents,
  pricingCoveragePercent,
} from "@/lib/pricing/formulas";
import {
  DEFAULT_CLINIC_TZ,
  inPeriod,
  resolveReportPeriod,
} from "@/lib/reports/period";
import { analyzePerformedProcedurePricing } from "@/services/procedure-pricing";
import type { ReportFilter } from "@/services/reports";
import type {
  PerformedPricingAnalysis,
  PricingPerformanceRow,
  PricingReport,
} from "@/types/pricing";
import type { PerformedProcedure } from "@/types/performed-procedure";

function canViewPricingReport(ctx: AuthzContext) {
  return (
    can(ctx, "reports.pricing_view").allowed ||
    can(ctx, "procedure_pricing.view").allowed ||
    can(ctx, "cost_reports.view").allowed
  );
}

function canSeePatientNames(ctx: AuthzContext) {
  return can(ctx, "patients.demographics.view").allowed;
}

function periodOf(ctx: AuthzContext, filter: ReportFilter) {
  return resolveReportPeriod({
    preset: filter.preset,
    customStart: filter.customStart,
    customEnd: filter.customEnd,
    timeZone: getClinic(ctx.clinicId)?.timezone ?? DEFAULT_CLINIC_TZ,
  });
}

function completedInPeriod(ctx: AuthzContext, filter: ReportFilter) {
  const period = periodOf(ctx, filter);
  return getPerformedStore().performedProcedures.filter((p) => {
    if (p.clinic_id !== ctx.clinicId) return false;
    if (p.status !== "completed") return false;
    const at = p.completed_at ?? p.created_at;
    return inPeriod(at, period);
  });
}

function hasCompletePricing(p: PerformedProcedure) {
  return (
    p.charged_amount_cents != null &&
    p.operational_total_cost_cents != null
  );
}

function averageOrNull(sum: number, n: number) {
  if (n <= 0) return null;
  return Math.round(sum / n);
}

export function getPricingPerformanceReport(
  ctx: AuthzContext,
  filter: ReportFilter,
): PricingPerformanceRow[] {
  assertPermission(ctx, "reports.view");
  if (!canViewPricingReport(ctx)) {
    assertPermission(ctx, "reports.pricing_view");
  }
  const items = completedInPeriod(ctx, filter);
  const inv = getInventoryStore();
  const byProc = new Map<string, PerformedProcedure[]>();
  for (const p of items) {
    const list = byProc.get(p.procedure_id) ?? [];
    list.push(p);
    byProc.set(p.procedure_id, list);
  }

  const rows: PricingPerformanceRow[] = [];
  for (const [procedureId, list] of byProc) {
    const name =
      inv.procedures.find((p) => p.id === procedureId)?.name ??
      list[0]?.procedure_name_snapshot ??
      "Procedimento";
    const catalog = inv.procedures.find(
      (p) => p.id === procedureId && p.clinic_id === ctx.clinicId,
    );
    const chargedList = list.filter(
      (p) =>
        p.charged_amount_cents != null &&
        p.financial_status !== "no_charge" &&
        p.financial_status !== "included_in_plan",
    );
    const withOp = list.filter(hasCompletePricing);
    const chargedAmounts = chargedList.map((p) => p.charged_amount_cents!);
    const snapSum = chargedList.reduce(
      (s, p) => s + (p.standard_price_snapshot_cents ?? 0),
      0,
    );
    const snapN = chargedList.filter(
      (p) => p.standard_price_snapshot_cents != null,
    ).length;
    const chargedSum = chargedAmounts.reduce((a, b) => a + b, 0);
    const opSum = withOp.reduce(
      (s, p) => s + (p.operational_total_cost_cents ?? 0),
      0,
    );
    const chargedForOp = withOp.reduce(
      (s, p) => s + (p.charged_amount_cents ?? 0),
      0,
    );
    const below = withOp.filter(
      (p) =>
        (p.charged_amount_cents ?? 0) < (p.operational_total_cost_cents ?? 0),
    ).length;
    const diffs = chargedList
      .filter((p) => p.standard_price_snapshot_cents != null)
      .map(
        (p) =>
          (p.charged_amount_cents ?? 0) -
          (p.standard_price_snapshot_cents ?? 0),
      );
    const avgDiff =
      diffs.length > 0
        ? Math.round(diffs.reduce((a, b) => a + b, 0) / diffs.length)
        : null;

    rows.push({
      procedure_id: procedureId,
      procedure_name: name,
      count: list.length,
      charged_count: chargedList.length,
      with_operational_count: withOp.length,
      current_default_price_cents: catalog?.default_price_cents ?? null,
      avg_standard_snapshot_cents: averageOrNull(snapSum, snapN),
      avg_charged_cents: averageOrNull(chargedSum, chargedList.length),
      min_charged_cents:
        chargedAmounts.length >= 3
          ? Math.min(...chargedAmounts)
          : chargedAmounts.length > 0
            ? Math.min(...chargedAmounts)
            : null,
      median_charged_cents:
        chargedAmounts.length >= 3 ? medianCents(chargedAmounts) : null,
      max_charged_cents:
        chargedAmounts.length >= 3
          ? Math.max(...chargedAmounts)
          : chargedAmounts.length > 0
            ? Math.max(...chargedAmounts)
            : null,
      avg_operational_cost_cents: averageOrNull(opSum, withOp.length),
      aggregate_result_cents:
        withOp.length > 0 ? chargedForOp - opSum : null,
      aggregate_margin_percent: calculateAggregateMarginPercent(
        chargedForOp,
        opSum,
      ),
      avg_price_difference_cents: avgDiff,
      below_operational_count: below,
    });
  }

  return rows.sort(
    (a, b) =>
      b.below_operational_count - a.below_operational_count ||
      b.count - a.count,
  );
}

export function getBelowOperationalProcedures(
  ctx: AuthzContext,
  filter: ReportFilter,
): PerformedPricingAnalysis[] {
  assertPermission(ctx, "reports.view");
  if (!canViewPricingReport(ctx)) {
    assertPermission(ctx, "reports.pricing_view");
  }
  const items = completedInPeriod(ctx, filter).filter(
    (p) =>
      p.charged_amount_cents != null &&
      p.operational_total_cost_cents != null &&
      p.charged_amount_cents < p.operational_total_cost_cents,
  );
  const showNames = canSeePatientNames(ctx);
  return items.map((p) => {
    const analysis = analyzePerformedProcedurePricing(ctx, p.id);
    if (!showNames) {
      return { ...analysis, patient_id: "" };
    }
    return analysis;
  });
}

function marginBands(items: PerformedProcedure[]) {
  const bands = [
    { band: "< 0%", count: 0 },
    { band: "0–20%", count: 0 },
    { band: "20–40%", count: 0 },
    { band: "40–60%", count: 0 },
    { band: "> 60%", count: 0 },
  ];
  for (const p of items) {
    if (!hasCompletePricing(p) || p.charged_amount_cents === 0) continue;
    const margin = calculateAggregateMarginPercent(
      p.charged_amount_cents!,
      p.operational_total_cost_cents!,
    );
    if (margin == null) continue;
    if (margin < 0) bands[0]!.count += 1;
    else if (margin < 20) bands[1]!.count += 1;
    else if (margin < 40) bands[2]!.count += 1;
    else if (margin < 60) bands[3]!.count += 1;
    else bands[4]!.count += 1;
  }
  return bands;
}

export function getPricingReport(
  ctx: AuthzContext,
  filter: ReportFilter,
): PricingReport {
  assertPermission(ctx, "reports.view");
  if (!canViewPricingReport(ctx)) {
    assertPermission(ctx, "reports.pricing_view");
  }
  const period = periodOf(ctx, filter);
  const items = completedInPeriod(ctx, filter);
  let complete = 0;
  for (const p of items) {
    if (hasCompletePricing(p)) complete += 1;
  }
  return {
    period_label: period.label,
    rows: getPricingPerformanceReport(ctx, filter),
    below_operational: getBelowOperationalProcedures(ctx, filter),
    pricing_coverage_percent: pricingCoveragePercent(complete, items.length),
    completed: items.length,
    with_complete_pricing: complete,
    incomplete_count: items.length - complete,
    margin_bands: marginBands(items),
    disclaimer:
      "Resultado operacional estimado não representa lucro líquido contábil.",
  };
}

export function getPricingProcedureDetail(
  ctx: AuthzContext,
  filter: ReportFilter,
  procedureId: string,
) {
  const rows = getPricingPerformanceReport(ctx, filter);
  const row = rows.find((r) => r.procedure_id === procedureId);
  if (!row) throw new Error("PROCEDURE_NOT_FOUND");
  const items = completedInPeriod(ctx, filter).filter(
    (p) => p.procedure_id === procedureId,
  );
  const showNames = canSeePatientNames(ctx);
  const recent = items
    .sort((a, b) =>
      (b.completed_at ?? "").localeCompare(a.completed_at ?? ""),
    )
    .slice(0, 40)
    .map((p) => {
      const analysis = analyzePerformedProcedurePricing(ctx, p.id);
      return {
        ...analysis,
        patient_name: showNames
          ? getPatientRecord(p.patient_id)?.full_name ?? null
          : null,
        patient_id: showNames ? p.patient_id : "",
      };
    });
  return { ...row, recent };
}
