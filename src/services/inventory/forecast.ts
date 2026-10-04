import { can, type AuthzContext } from "@/lib/authz/can";
import { assertPermission } from "@/lib/authz/guards";
import { getAgendaStore } from "@/lib/demo/agenda-store";
import { getInventoryStore } from "@/lib/demo/inventory-store";
import { getPatientRecord } from "@/lib/demo/patients-store";
import { getPerformedStore } from "@/lib/demo/performed-procedures-store";
import {
  getPlannedProceduresStore,
  writePlannedAudit,
} from "@/lib/demo/planned-procedures-store";
import {
  aggregateRequirementLines,
  calculateProcedureMaterialRequirements,
} from "@/lib/inventory/requirements";
import { getActivePlannedForAppointment } from "@/services/appointment-planned-procedures";
import type { AppointmentStatus } from "@/types/agenda";
import type {
  ForecastMaterialRow,
  ForecastMaterialStatus,
  ForecastSummary,
  MaterialRequirementLine,
} from "@/types/forecast";

/** Status elegíveis para previsão futura (sem snapshot de consumo confirmado). */
export const FORECAST_ELIGIBLE_STATUSES: AppointmentStatus[] = [
  "scheduled",
  "confirmed",
  "arrived",
];

function canViewForecastCost(ctx: AuthzContext) {
  return (
    can(ctx, "inventory.forecast_cost_view").allowed ||
    can(ctx, "procedure_costs.view").allowed
  );
}

function materialStatus(
  current: number,
  forecast: number,
  minimum: number | null,
): ForecastMaterialStatus {
  if (forecast <= 0) return "sufficient";
  const projected = current - forecast;
  if (projected < 0) return "insufficient";
  if (minimum != null && projected < minimum) return "low_after_forecast";
  return "sufficient";
}

function appointmentHasConfirmedConsumption(
  clinicId: string,
  appointmentId: string,
) {
  return getPerformedStore().performedProcedures.some(
    (p) =>
      p.clinic_id === clinicId &&
      p.appointment_id === appointmentId &&
      p.consumption_confirmed,
  );
}

function linesForAppointment(
  clinicId: string,
  appointmentId: string,
): {
  lines: MaterialRequirementLine[];
  plannedCount: number;
  patientId: string;
  patientName: string;
} {
  const appt = getAgendaStore().appointments.find((a) => a.id === appointmentId);
  if (!appt || appt.clinic_id !== clinicId) {
    throw new Error("APPOINTMENT_NOT_FOUND");
  }
  const patient = getPatientRecord(appt.patient_id);
  const patientName = patient?.full_name ?? "Paciente";
  const planned = getActivePlannedForAppointment(clinicId, appointmentId);
  const inv = getInventoryStore();

  const lines = calculateProcedureMaterialRequirements(
    clinicId,
    planned.map((p) => ({
      procedure_id: p.procedure_id,
      quantity: p.quantity,
      planned_procedure_id: p.id,
      patient_id: p.patient_id,
      patient_name: patientName,
      tooth_number: p.tooth_number,
    })),
    { dedupePerAppointment: true },
  ).map((line) => ({
    ...line,
    // enrich procedure name in breakdown via planned
    procedure_id: line.procedure_id,
  }));

  // attach procedure names for breakdown
  for (const line of lines) {
    const plannedRow = planned.find((p) => p.id === line.planned_procedure_id);
    if (plannedRow) {
      const name =
        inv.procedures.find((p) => p.id === plannedRow.procedure_id)?.name ??
        "Procedimento";
      (line as MaterialRequirementLine & { procedure_name?: string }).procedure_name =
        name;
    }
  }

  return {
    lines,
    plannedCount: planned.length,
    patientId: appt.patient_id,
    patientName,
  };
}

export function calculateAppointmentMaterialForecast(
  ctx: AuthzContext,
  appointmentId: string,
) {
  assertPermission(ctx, "inventory.forecast_view");
  const appt = getAgendaStore().appointments.find((a) => a.id === appointmentId);
  if (!appt || appt.clinic_id !== ctx.clinicId) {
    throw new Error("APPOINTMENT_NOT_FOUND");
  }

  const { lines, plannedCount, patientId, patientName } = linesForAppointment(
    ctx.clinicId,
    appointmentId,
  );
  const showCost = canViewForecastCost(ctx);
  const inv = getInventoryStore();
  const aggregated = aggregateRequirementLines(lines);

  const materials: ForecastMaterialRow[] = [...aggregated.values()].map(
    (agg) => {
      const item = inv.inventoryItems.find(
        (i) => i.id === agg.inventory_item_id,
      );
      const current = item?.current_quantity ?? 0;
      const minimum = item?.minimum_quantity ?? null;
      const status = agg.has_estimate
        ? ("unknown" as const)
        : materialStatus(current, agg.quantity, minimum);
      const projected = current - agg.quantity;
      const suggested =
        status === "insufficient" || status === "low_after_forecast"
          ? Math.max(
              0,
              agg.quantity + (minimum ?? 0) - current,
            )
          : null;

      return {
        inventory_item_id: agg.inventory_item_id,
        item_name: agg.item_name,
        consumption_unit: agg.consumption_unit,
        current_quantity: current,
        minimum_quantity: minimum,
        forecast_quantity: agg.quantity,
        projected_remaining: projected,
        status,
        estimated_cost_cents: showCost ? agg.cost_cents : null,
        suggested_purchase_quantity: suggested,
        appointments_count: 1,
        procedures_count: plannedCount,
        patient_breakdown: agg.breakdown.map((b) => {
          const planned = getPlannedProceduresStore().planned.find(
            (p) => p.id === b.planned_procedure_id,
          );
          const procName =
            inv.procedures.find((p) => p.id === (planned?.procedure_id ?? b.procedure_id))
              ?.name ?? "Procedimento";
          return {
            patient_id: patientId,
            patient_name: patientName,
            appointment_id: appointmentId,
            procedure_name: procName,
            tooth_number: b.tooth_number ?? null,
            quantity: b.quantity,
          };
        }),
      };
    },
  );

  const atRisk = materials.filter(
    (m) => m.status === "insufficient" || m.status === "low_after_forecast",
  ).length;

  return {
    appointment_id: appointmentId,
    patient_id: patientId,
    patient_name: patientName,
    planned_procedures_count: plannedCount,
    definition_status:
      plannedCount === 0
        ? ("undefined" as const)
        : atRisk > 0
          ? ("insufficient" as const)
          : ("calculated" as const),
    materials,
    materials_at_risk: atRisk,
    estimated_total_cost_cents: showCost
      ? materials.reduce((s, m) => s + (m.estimated_cost_cents ?? 0), 0)
      : null,
    canViewCosts: showCost,
  };
}

/** Alias público pedido na especificação. */
export function getAppointmentMaterialForecast(
  ctx: AuthzContext,
  appointmentId: string,
) {
  return calculateAppointmentMaterialForecast(ctx, appointmentId);
}

export function forecastMaterialNeeds(
  ctx: AuthzContext,
  input: {
    start_date: string;
    end_date: string;
    professional_id?: string | null;
  },
): ForecastSummary {
  assertPermission(ctx, "inventory.forecast_view");
  const showCost = canViewForecastCost(ctx);
  const start = new Date(input.start_date);
  const end = new Date(input.end_date);
  if (Number.isNaN(+start) || Number.isNaN(+end) || end < start) {
    throw new Error("INVALID_DATE_RANGE");
  }

  const appointments = getAgendaStore().appointments.filter((a) => {
    if (a.clinic_id !== ctx.clinicId) return false;
    if (a.cancelled_at) return false;
    if (!FORECAST_ELIGIBLE_STATUSES.includes(a.status)) return false;
    const t = +new Date(a.start_at);
    if (t < +start || t > +end) return false;
    if (
      input.professional_id &&
      a.professional_id !== input.professional_id
    ) {
      return false;
    }
    // arrived com consumo já confirmado → Subfase 3, fora da previsão futura
    if (
      a.status === "arrived" &&
      appointmentHasConfirmedConsumption(ctx.clinicId, a.id)
    ) {
      return false;
    }
    return true;
  });

  let withoutProcedures = 0;
  let proceduresPlanned = 0;
  const allLines: MaterialRequirementLine[] = [];
  const appointmentIdsByItem = new Map<string, Set<string>>();
  const procedureCountByItem = new Map<string, number>();

  for (const appt of appointments) {
    const { lines, plannedCount } = linesForAppointment(ctx.clinicId, appt.id);
    if (plannedCount === 0) {
      withoutProcedures += 1;
      continue;
    }
    proceduresPlanned += plannedCount;
    for (const line of lines) {
      allLines.push(line);
      if (!appointmentIdsByItem.has(line.inventory_item_id)) {
        appointmentIdsByItem.set(line.inventory_item_id, new Set());
      }
      appointmentIdsByItem.get(line.inventory_item_id)!.add(appt.id);
      procedureCountByItem.set(
        line.inventory_item_id,
        (procedureCountByItem.get(line.inventory_item_id) ?? 0) +
          (line.scope === "procedure" ? 1 : 0),
      );
    }
  }

  const inv = getInventoryStore();
  const aggregated = aggregateRequirementLines(allLines);
  const materials: ForecastMaterialRow[] = [...aggregated.values()]
    .map((agg) => {
      const item = inv.inventoryItems.find(
        (i) => i.id === agg.inventory_item_id,
      );
      const current = item?.current_quantity ?? 0;
      const minimum = item?.minimum_quantity ?? null;
      const status = agg.has_estimate
        ? ("unknown" as const)
        : materialStatus(current, agg.quantity, minimum);
      const projected = current - agg.quantity;
      const suggested =
        status === "insufficient" || status === "low_after_forecast"
          ? Math.max(0, agg.quantity + (minimum ?? 0) - current)
          : null;

      const breakdown = agg.breakdown.map((b) => {
        const planned = getPlannedProceduresStore().planned.find(
          (p) => p.id === b.planned_procedure_id,
        );
        const procName =
          inv.procedures.find(
            (p) => p.id === (planned?.procedure_id ?? b.procedure_id),
          )?.name ?? "Procedimento";
        const apptId =
          planned?.appointment_id ??
          appointments.find((a) => a.patient_id === b.patient_id)?.id ??
          "";
        return {
          patient_id: b.patient_id ?? "",
          patient_name: b.patient_name ?? "Paciente",
          appointment_id: apptId,
          procedure_name: procName,
          tooth_number: b.tooth_number ?? null,
          quantity: b.quantity,
        };
      });

      return {
        inventory_item_id: agg.inventory_item_id,
        item_name: agg.item_name,
        consumption_unit: agg.consumption_unit,
        current_quantity: current,
        minimum_quantity: minimum,
        forecast_quantity: agg.quantity,
        projected_remaining: projected,
        status,
        estimated_cost_cents: showCost ? agg.cost_cents : null,
        suggested_purchase_quantity: suggested,
        appointments_count:
          appointmentIdsByItem.get(agg.inventory_item_id)?.size ?? 0,
        procedures_count:
          procedureCountByItem.get(agg.inventory_item_id) ??
          breakdown.length,
        patient_breakdown: breakdown,
      };
    })
    .sort((a, b) => {
      const rank = (s: ForecastMaterialStatus) =>
        s === "insufficient" ? 0 : s === "low_after_forecast" ? 1 : s === "unknown" ? 2 : 3;
      return rank(a.status) - rank(b.status) || a.item_name.localeCompare(b.item_name);
    });

  const materialsAtRisk = materials.filter(
    (m) => m.status === "insufficient" || m.status === "low_after_forecast",
  ).length;

  writePlannedAudit({
    clinic_id: ctx.clinicId,
    actor_user_id: ctx.userId,
    action: "inventory.forecast_viewed",
    target_type: "inventory_forecast",
    target_id: `${input.start_date}_${input.end_date}`,
    metadata: {
      appointments: appointments.length,
      materials_at_risk: materialsAtRisk,
    },
  });

  return {
    start_date: input.start_date,
    end_date: input.end_date,
    appointments_analyzed: appointments.length,
    appointments_without_procedures: withoutProcedures,
    procedures_planned: proceduresPlanned,
    materials_at_risk: materialsAtRisk,
    materials,
    estimated_total_cost_cents: showCost
      ? materials.reduce((s, m) => s + (m.estimated_cost_cents ?? 0), 0)
      : null,
  };
}

export function getUpcomingStockRisks(
  ctx: AuthzContext,
  days = 7,
): ForecastSummary {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + days);
  end.setHours(23, 59, 59, 999);
  return forecastMaterialNeeds(ctx, {
    start_date: start.toISOString(),
    end_date: end.toISOString(),
  });
}

export function getPatientUpcomingMaterialNeeds(
  ctx: AuthzContext,
  patientId: string,
) {
  assertPermission(ctx, "inventory.forecast_view");
  const patient = getPatientRecord(patientId);
  if (!patient || patient.clinic_id !== ctx.clinicId) {
    throw new Error("PATIENT_NOT_FOUND");
  }

  const now = Date.now();
  const next = getAgendaStore()
    .appointments.filter(
      (a) =>
        a.clinic_id === ctx.clinicId &&
        a.patient_id === patientId &&
        !a.cancelled_at &&
        FORECAST_ELIGIBLE_STATUSES.includes(a.status) &&
        +new Date(a.start_at) >= now,
    )
    .sort((a, b) => a.start_at.localeCompare(b.start_at))[0];

  if (!next) {
    return {
      patient_id: patientId,
      patient_name: patient.full_name,
      appointment: null,
      forecast: null,
    };
  }

  return {
    patient_id: patientId,
    patient_name: patient.full_name,
    appointment: {
      id: next.id,
      start_at: next.start_at,
      status: next.status,
      reason: next.reason,
    },
    forecast: calculateAppointmentMaterialForecast(ctx, next.id),
  };
}

export function getAppointmentForecastIndicator(
  ctx: AuthzContext,
  appointmentId: string,
): "calculated" | "undefined" | "insufficient" | "ineligible" {
  const appt = getAgendaStore().appointments.find((a) => a.id === appointmentId);
  if (!appt || appt.clinic_id !== ctx.clinicId) return "ineligible";
  if (
    appt.cancelled_at ||
    !FORECAST_ELIGIBLE_STATUSES.includes(appt.status)
  ) {
    return "ineligible";
  }
  const planned = getActivePlannedForAppointment(ctx.clinicId, appointmentId);
  if (planned.length === 0) return "undefined";

  // Indicador leve: sem exigir forecast_view (Agenda); só estoque vs necessidade
  const { lines } = linesForAppointment(ctx.clinicId, appointmentId);
  const aggregated = aggregateRequirementLines(lines);
  const inv = getInventoryStore();
  for (const agg of aggregated.values()) {
    const item = inv.inventoryItems.find((i) => i.id === agg.inventory_item_id);
    const current = item?.current_quantity ?? 0;
    if (current < agg.quantity) return "insufficient";
  }
  return "calculated";
}

export function listAppointmentForecastIndicators(
  ctx: AuthzContext,
  appointmentIds: string[],
) {
  const map: Record<
    string,
    "calculated" | "undefined" | "insufficient" | "ineligible"
  > = {};
  for (const id of appointmentIds) {
    map[id] = getAppointmentForecastIndicator(ctx, id);
  }
  return map;
}
