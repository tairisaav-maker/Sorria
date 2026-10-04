import { can, type AuthzContext } from "@/lib/authz/can";
import { assertPermission } from "@/lib/authz/guards";
import { getAgendaStore } from "@/lib/demo/agenda-store";
import { getInventoryStore } from "@/lib/demo/inventory-store";
import { getPerformedStore } from "@/lib/demo/performed-procedures-store";
import { getPurchaseListsStore } from "@/lib/demo/purchase-lists-store";
import {
  calculateEstimatedPackageCostCents,
  calculateEstimatedPurchaseCostCents,
  calculateRecommendedPackages,
  calculateReplenishmentQuantity,
  historicalDeviationPercent,
  isHistoricalReliable,
  purchasedQuantityFromPackages,
  resolveDataConfidence,
  resolveReplenishmentStatus,
  roundQty,
  surplusAfterPurchase,
} from "@/lib/inventory/replenishment";
import { forecastMaterialNeeds, FORECAST_ELIGIBLE_STATUSES } from "@/services/inventory/forecast";
import { getActivePlannedForAppointment } from "@/services/appointment-planned-procedures";
import type {
  ReplenishmentHorizon,
  ReplenishmentNeedRow,
  ReplenishmentSummary,
} from "@/types/replenishment";

function canViewCost(ctx: AuthzContext) {
  return can(ctx, "inventory.cost_view").allowed;
}

function canViewPatients(ctx: AuthzContext) {
  return can(ctx, "patients.demographics.view").allowed;
}

function horizonToRange(
  horizon: ReplenishmentHorizon,
  customStart?: string | null,
  customEnd?: string | null,
): { start: string; end: string } {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  if (horizon === "custom" && customStart && customEnd) {
    return {
      start: new Date(customStart).toISOString(),
      end: new Date(new Date(customEnd).setHours(23, 59, 59, 999)).toISOString(),
    };
  }
  const days = horizon === "15d" ? 15 : horizon === "30d" ? 30 : 7;
  end.setDate(end.getDate() + days);
  end.setHours(23, 59, 59, 999);
  return { start: start.toISOString(), end: end.toISOString() };
}

function lastPurchasePackageCost(
  clinicId: string,
  inventoryItemId: string,
): { cost: number | null; supplier: string | null } {
  const store = getInventoryStore();
  const lines = store.purchaseItems
    .filter(
      (i) =>
        i.clinic_id === clinicId &&
        i.inventory_item_id === inventoryItemId,
    )
    .map((i) => {
      const p = store.purchases.find((x) => x.id === i.inventory_purchase_id);
      return { line: i, purchase: p };
    })
    .filter((x) => x.purchase && !x.purchase.cancelled_at)
    .sort((a, b) =>
      (b.purchase!.purchase_date + b.line.created_at).localeCompare(
        a.purchase!.purchase_date + a.line.created_at,
      ),
    );
  const top = lines[0];
  if (!top) return { cost: null, supplier: null };
  return {
    cost: top.line.cost_per_purchase_unit_cents,
    supplier: top.purchase?.supplier_name ?? null,
  };
}

function historicalForItem(clinicId: string, inventoryItemId: string) {
  const store = getPerformedStore();
  const lines = store.procedureConsumptions.filter(
    (c) =>
      c.clinic_id === clinicId &&
      c.inventory_item_id === inventoryItemId &&
      (c.status === "confirmed" || c.status === "corrected") &&
      c.actual_quantity != null,
  );
  const sample = lines.length;
  if (sample === 0) {
    return {
      sample_size: 0,
      reliable: false,
      avg_actual_per_use: null as number | null,
      avg_planned_per_use: null as number | null,
      deviation_percent: null as number | null,
    };
  }
  const sumActual = lines.reduce((s, l) => s + (l.actual_quantity ?? 0), 0);
  const sumPlanned = lines.reduce((s, l) => s + l.planned_quantity, 0);
  const avgActual = roundQty(sumActual / sample);
  const avgPlanned = roundQty(sumPlanned / sample);
  return {
    sample_size: sample,
    reliable: isHistoricalReliable(sample),
    avg_actual_per_use: avgActual,
    avg_planned_per_use: avgPlanned,
    deviation_percent: historicalDeviationPercent(avgActual, avgPlanned),
  };
}

function effectiveQuantity(
  clinicId: string,
  inventoryItemId: string,
  current: number,
  tracksExpiration: boolean,
  periodEnd: string,
): { effective: number; expiringSoon: number | null } {
  if (!tracksExpiration) {
    return { effective: current, expiringSoon: null };
  }
  const lots = getInventoryStore().lots.filter(
    (l) =>
      l.clinic_id === clinicId &&
      l.inventory_item_id === inventoryItemId &&
      l.quantity_remaining > 0,
  );
  if (lots.length === 0) {
    return { effective: current, expiringSoon: null };
  }
  const endMs = +new Date(periodEnd);
  let usable = 0;
  let expiring = 0;
  for (const lot of lots) {
    if (!lot.expiration_date) {
      usable += lot.quantity_remaining;
      continue;
    }
    const expMs = +new Date(lot.expiration_date);
    if (expMs < endMs) {
      expiring += lot.quantity_remaining;
    } else {
      usable += lot.quantity_remaining;
    }
  }
  // Se soma dos lotes ≠ current, não inventar — usar current com alerta via expiring
  const lotTotal = lots.reduce((s, l) => s + l.quantity_remaining, 0);
  if (Math.abs(lotTotal - current) > 0.0001) {
    return {
      effective: current,
      expiringSoon: expiring > 0 ? roundQty(expiring) : null,
    };
  }
  return {
    effective: roundQty(usable),
    expiringSoon: expiring > 0 ? roundQty(expiring) : null,
  };
}

function proceduresUsingItem(clinicId: string, inventoryItemId: string) {
  const inv = getInventoryStore();
  const procIds = new Set(
    inv.procedureMaterials
      .filter(
        (m) =>
          m.clinic_id === clinicId && m.inventory_item_id === inventoryItemId,
      )
      .map((m) => m.procedure_id),
  );
  return inv.procedures
    .filter((p) => procIds.has(p.id))
    .map((p) => p.name);
}

function openListHint(clinicId: string, inventoryItemId: string): string | null {
  const store = getPurchaseListsStore();
  const open = store.lists.filter(
    (l) =>
      l.clinic_id === clinicId &&
      (l.status === "draft" || l.status === "ready" || l.status === "partially_purchased"),
  );
  for (const list of open) {
    const hit = store.items.find(
      (i) =>
        i.purchase_list_id === list.id &&
        i.inventory_item_id === inventoryItemId &&
        i.selected &&
        i.status === "pending",
    );
    if (hit) {
      return `Já incluído em "${list.name}" (ainda não comprado)`;
    }
  }
  return null;
}

export function calculateReplenishmentNeeds(
  ctx: AuthzContext,
  input: {
    horizon?: ReplenishmentHorizon;
    start_date?: string | null;
    end_date?: string | null;
    professional_id?: string | null;
  } = {},
): ReplenishmentSummary {
  assertPermission(ctx, "inventory.replenishment_view");
  const horizon = input.horizon ?? "7d";
  const range =
    input.start_date && input.end_date
      ? {
          start: new Date(input.start_date).toISOString(),
          end: new Date(input.end_date).toISOString(),
        }
      : horizonToRange(horizon, input.start_date, input.end_date);

  const forecast = forecastMaterialNeeds(ctx, {
    start_date: range.start,
    end_date: range.end,
    professional_id: input.professional_id,
  });

  const agenda = getAgendaStore();
  const eligible = agenda.appointments.filter((a) => {
    if (a.clinic_id !== ctx.clinicId || a.cancelled_at) return false;
    if (!FORECAST_ELIGIBLE_STATUSES.includes(a.status)) return false;
    const t = +new Date(a.start_at);
    return t >= +new Date(range.start) && t <= +new Date(range.end);
  });
  const withProc = eligible.filter(
    (a) => getActivePlannedForAppointment(ctx.clinicId, a.id).length > 0,
  );
  const agendaCoverage =
    eligible.length > 0
      ? Math.round((withProc.length / eligible.length) * 1000) / 10
      : null;

  let proceduresWithBom = 0;
  let proceduresPlanned = 0;
  const inv = getInventoryStore();
  for (const a of withProc) {
    const planned = getActivePlannedForAppointment(ctx.clinicId, a.id);
    for (const p of planned) {
      proceduresPlanned += 1;
      const hasBom = inv.procedureMaterials.some(
        (m) => m.clinic_id === ctx.clinicId && m.procedure_id === p.procedure_id,
      );
      if (hasBom) proceduresWithBom += 1;
    }
  }
  const bomCoverage =
    proceduresPlanned > 0
      ? Math.round((proceduresWithBom / proceduresPlanned) * 1000) / 10
      : null;

  const showCost = canViewCost(ctx);
  const showPatients = canViewPatients(ctx);
  const warnings: string[] = [];
  if (agendaCoverage != null && agendaCoverage < 100) {
    warnings.push(
      `A previsão cobre ${agendaCoverage}% das consultas do período.`,
    );
  }
  if (bomCoverage != null && bomCoverage < 100) {
    warnings.push(
      `Cobertura das fichas técnicas: ${bomCoverage}%.`,
    );
  }
  if (forecast.appointments_without_procedures > 0) {
    warnings.push(
      `Esta lista pode estar subestimada porque ${forecast.appointments_without_procedures} consulta(s) não possuem procedimentos definidos.`,
    );
  }

  const items: ReplenishmentNeedRow[] = [];
  let estimatedSum = 0;
  let hasAnyCost = false;
  let itemsWithoutCost = 0;
  let critical = 0;
  let reorder = 0;
  let attention = 0;

  // Include all active items that appear in forecast OR have low stock needing attention
  const forecastMap = new Map(
    forecast.materials.map((m) => [m.inventory_item_id, m]),
  );
  const candidates = inv.inventoryItems.filter(
    (i) => i.clinic_id === ctx.clinicId && i.active && !i.archived_at,
  );

  for (const item of candidates) {
    const f = forecastMap.get(item.id);
    const forecastQty = f?.forecast_quantity ?? 0;
    // Skip items with zero forecast and healthy stock (not near min)
    const nearMin =
      item.minimum_quantity != null &&
      item.current_quantity <= item.minimum_quantity;
    if (forecastQty <= 0 && !nearMin) continue;

    const packagesValid = item.units_per_purchase_unit > 0;
    const { effective, expiringSoon } = effectiveQuantity(
      ctx.clinicId,
      item.id,
      item.current_quantity,
      item.tracks_expiration,
      range.end,
    );
    const replenishQty = calculateReplenishmentQuantity({
      forecastQuantity: forecastQty,
      minimumQuantity: item.minimum_quantity,
      currentQuantity: effective,
    });
    const packages = packagesValid
      ? calculateRecommendedPackages(
          replenishQty,
          item.units_per_purchase_unit,
        )
      : null;
    const purchasedQty =
      packages != null
        ? purchasedQuantityFromPackages(
            packages,
            item.units_per_purchase_unit,
          )
        : 0;
    const last = lastPurchasePackageCost(ctx.clinicId, item.id);
    const costEst = calculateEstimatedPackageCostCents({
      lastPurchasePackageCostCents: last.cost,
      averageUnitCostCents: item.average_unit_cost_cents,
      unitsPerPackage: item.units_per_purchase_unit,
    });
    const totalCost =
      packages != null
        ? calculateEstimatedPurchaseCostCents(packages, costEst.cents)
        : null;

    const hist = historicalForItem(ctx.clinicId, item.id);
    const historicalAbove =
      hist.reliable &&
      hist.deviation_percent != null &&
      hist.deviation_percent > 0;

    const rowWarnings: string[] = [];
    if (!packagesValid) {
      rowWarnings.push("Configuração de embalagem inválida");
    }
    if (historicalAbove && hist.deviation_percent != null) {
      rowWarnings.push(
        `Consumo real recente ${hist.deviation_percent}% acima do previsto. Considere revisar a quantidade sugerida.`,
      );
    }
    if (expiringSoon != null && expiringSoon > 0) {
      rowWarnings.push(
        `Estoque atual inclui ${expiringSoon} ${item.consumption_unit} que vencem antes do fim do período.`,
      );
    }
    if (item.tracks_expiration && expiringSoon == null) {
      const hasLots = inv.lots.some(
        (l) =>
          l.clinic_id === ctx.clinicId &&
          l.inventory_item_id === item.id &&
          l.quantity_remaining > 0,
      );
      if (hasLots) {
        // already handled
      } else if (item.tracks_expiration) {
        rowWarnings.push(
          "Há materiais com validade próxima. Revise os lotes antes da compra.",
        );
      }
    }
    if (showCost && costEst.cents == null && (packages ?? 0) > 0) {
      rowWarnings.push("Sem preço de referência para estimativa");
    }

    const status = resolveReplenishmentStatus({
      currentQuantity: effective,
      forecastQuantity: forecastQty,
      minimumQuantity: item.minimum_quantity,
      packagesValid,
      historicalAbovePlanned: Boolean(historicalAbove),
      missingCost: costEst.cents == null && (packages ?? 0) > 0,
    });

    const confidence = resolveDataConfidence({
      hasBom: forecastQty > 0 || inv.procedureMaterials.some(
        (m) =>
          m.clinic_id === ctx.clinicId && m.inventory_item_id === item.id,
      ),
      hasValidConversion: packagesValid,
      hasCost: costEst.cents != null,
      agendaCoveragePercent: agendaCoverage,
    });

    if (status === "critical") critical += 1;
    else if (status === "reorder") reorder += 1;
    else if (status === "attention") attention += 1;

    if ((packages ?? 0) > 0) {
      if (totalCost != null && showCost) {
        estimatedSum += totalCost;
        hasAnyCost = true;
      } else if (showCost) {
        itemsWithoutCost += 1;
      }
    }

    const histForecast =
      hist.reliable &&
      hist.avg_actual_per_use != null &&
      hist.avg_planned_per_use != null &&
      hist.avg_planned_per_use > 0 &&
      forecastQty > 0
        ? roundQty(
            forecastQty * (hist.avg_actual_per_use / hist.avg_planned_per_use),
          )
        : null;

    items.push({
      inventory_item_id: item.id,
      item_name: item.name,
      category: item.category,
      consumption_unit: item.consumption_unit,
      purchase_unit: item.purchase_unit,
      units_per_purchase_unit: item.units_per_purchase_unit,
      current_quantity: item.current_quantity,
      effective_quantity: effective,
      minimum_quantity: item.minimum_quantity,
      forecast_quantity: forecastQty,
      recommended_replenishment_quantity: replenishQty,
      recommended_packages: packages ?? 0,
      purchased_quantity_if_suggested: purchasedQty,
      surplus_quantity: surplusAfterPurchase(purchasedQty, replenishQty),
      projected_quantity_after_purchase: roundQty(effective + purchasedQty),
      estimated_package_cost_cents: showCost ? costEst.cents : null,
      estimated_total_cost_cents: showCost ? totalCost : null,
      cost_source: showCost ? costEst.source : null,
      status,
      confidence,
      warnings: rowWarnings,
      historical: {
        ...hist,
        historical_forecast_quantity: histForecast,
      },
      used_in_procedures: proceduresUsingItem(ctx.clinicId, item.id),
      open_list_hint: openListHint(ctx.clinicId, item.id),
      last_supplier_name: last.supplier ?? item.supplier_name,
      last_purchase_package_cost_cents: showCost ? last.cost : null,
      expiring_soon_quantity: expiringSoon,
      patient_breakdown: (f?.patient_breakdown ?? []).map((p) => ({
        patient_id: showPatients ? p.patient_id : null,
        patient_name: showPatients ? p.patient_name : null,
        appointment_id: p.appointment_id,
        procedure_name: p.procedure_name,
        quantity: p.quantity,
      })),
    });
  }

  items.sort((a, b) => {
    const order = { critical: 0, reorder: 1, attention: 2, unknown: 3, ok: 4 };
    const d = order[a.status] - order[b.status];
    if (d !== 0) return d;
    return a.item_name.localeCompare(b.item_name);
  });

  return {
    start_date: range.start,
    end_date: range.end,
    horizon,
    appointments_eligible: eligible.length,
    appointments_with_procedures: withProc.length,
    agenda_coverage_percent: agendaCoverage,
    procedures_planned: proceduresPlanned,
    procedures_with_bom: proceduresWithBom,
    bom_coverage_percent: bomCoverage,
    materials_needing_attention: critical + reorder + attention,
    materials_critical: critical,
    materials_reorder: reorder,
    estimated_list_total_cents:
      showCost && hasAnyCost ? estimatedSum : showCost ? null : null,
    items_without_cost: showCost ? itemsWithoutCost : 0,
    items,
    warnings,
  };
}

export function getReplenishmentWarnings(
  ctx: AuthzContext,
  summary: ReplenishmentSummary,
): string[] {
  assertPermission(ctx, "inventory.replenishment_view");
  return [...summary.warnings];
}

export function getUpcomingReplenishmentBrief(
  ctx: AuthzContext,
  days = 7,
): {
  materials_needing_attention: number;
  materials_critical: number;
  top_critical_name: string | null;
} {
  if (!can(ctx, "inventory.replenishment_view").allowed) {
    return {
      materials_needing_attention: 0,
      materials_critical: 0,
      top_critical_name: null,
    };
  }
  const horizon =
    days <= 7 ? "7d" : days <= 15 ? "15d" : ("30d" as ReplenishmentHorizon);
  const summary = calculateReplenishmentNeeds(ctx, { horizon });
  const top = summary.items.find((i) => i.status === "critical");
  return {
    materials_needing_attention: summary.materials_needing_attention,
    materials_critical: summary.materials_critical,
    top_critical_name: top?.item_name ?? null,
  };
}
