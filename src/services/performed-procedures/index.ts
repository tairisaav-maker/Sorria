import { can, type AuthzContext } from "@/lib/authz/can";
import { assertPermission } from "@/lib/authz/guards";
import { getAgendaStore } from "@/lib/demo/agenda-store";
import { getInventoryStore } from "@/lib/demo/inventory-store";
import { getMembership, getProfile } from "@/lib/demo/authz-store";
import { getPatientRecord } from "@/lib/demo/patients-store";
import {
  getPerformedStore,
  writePerformedAudit,
} from "@/lib/demo/performed-procedures-store";
import { getPlannedProceduresStore } from "@/lib/demo/planned-procedures-store";
import { getFinanceStore } from "@/lib/demo/finance-store";
import { getTreatmentsStore } from "@/lib/demo/treatments-store";
import {
  consumptionCostCents,
  plannedQuantityForMode,
} from "@/lib/inventory/units";
import { reaisToCents } from "@/lib/money";
import {
  cancelPerformedProcedureSchema,
  createPerformedProcedureSchema,
  updatePerformedProcedureSchema,
} from "@/lib/validations/performed-procedure";
import {
  allocateSharedCost,
  calculateGrossResult,
  canViewProcedureCosts,
} from "@/services/performed-procedures/costs";
import type {
  AppointmentConsumption,
  PerformedProcedure,
  ProcedureConsumption,
} from "@/types/performed-procedure";

export {
  canViewProcedureCosts,
  getPatientDirectCostSummary,
  getAppointmentDirectCost,
  calculateGrossResult,
} from "@/services/performed-procedures/costs";

function now() {
  return new Date().toISOString();
}

function assertPatient(ctx: AuthzContext, patientId: string) {
  const p = getPatientRecord(patientId);
  if (!p || p.clinic_id !== ctx.clinicId) throw new Error("PATIENT_NOT_FOUND");
  return p;
}

function assertProfessional(ctx: AuthzContext, userId: string) {
  const m = getMembership(userId, ctx.clinicId);
  if (!m || m.status !== "active") throw new Error("PROFESSIONAL_NOT_FOUND");
  return m;
}

function findPerformed(ctx: AuthzContext, id: string): PerformedProcedure {
  const row = getPerformedStore().performedProcedures.find((p) => p.id === id);
  if (!row || row.clinic_id !== ctx.clinicId) {
    throw new Error("PERFORMED_PROCEDURE_NOT_FOUND");
  }
  return row;
}

function activeInAppointment(appointmentId: string) {
  return getPerformedStore().performedProcedures.filter(
    (p) =>
      p.appointment_id === appointmentId &&
      p.status !== "cancelled",
  );
}

function recalculatePlannedShared(ctx: AuthzContext, appointmentId: string | null) {
  if (!appointmentId) return;
  const store = getPerformedStore();
  const shared = store.appointmentConsumptions.filter(
    (a) => a.clinic_id === ctx.clinicId && a.appointment_id === appointmentId,
  );
  const totalShared = shared.reduce((s, a) => s + a.planned_cost_cents, 0);
  const procs = activeInAppointment(appointmentId);
  const share = allocateSharedCost(totalShared, procs.length);
  for (const proc of procs) {
    if (proc.consumption_confirmed) continue;
    proc.planned_shared_cost_cents = share;
    proc.planned_total_cost_cents =
      proc.planned_material_cost_cents +
      proc.planned_shared_cost_cents +
      proc.planned_direct_cost_cents;
    proc.updated_at = now();
  }
}

/**
 * Copia ficha técnica → procedure_consumptions (exclusivos)
 * e appointment_consumptions (per_appointment).
 */
export function buildProcedureConsumptionSnapshot(
  ctx: AuthzContext,
  performed: PerformedProcedure,
) {
  const inv = getInventoryStore();
  const materials = inv.procedureMaterials.filter(
    (m) =>
      m.clinic_id === ctx.clinicId && m.procedure_id === performed.procedure_id,
  );
  const store = getPerformedStore();
  let materialCost = 0;

  for (const mat of materials) {
    const item = inv.inventoryItems.find((i) => i.id === mat.inventory_item_id);
    if (!item || item.clinic_id !== ctx.clinicId) {
      throw new Error("CROSS_CLINIC_REFERENCE");
    }

    if (mat.consumption_mode === "per_appointment") {
      if (!performed.appointment_id) {
        // Sem appointment: trata como per_procedure
      } else {
        const existing = store.appointmentConsumptions.find(
          (a) =>
            a.appointment_id === performed.appointment_id &&
            a.inventory_item_id === mat.inventory_item_id,
        );
        if (!existing) {
          const plannedQty = mat.standard_quantity;
          const unitCost = item.average_unit_cost_cents;
          const plannedCost = consumptionCostCents(plannedQty, unitCost);
          const row: AppointmentConsumption = {
            id: `ac-${crypto.randomUUID()}`,
            clinic_id: ctx.clinicId,
            appointment_id: performed.appointment_id,
            patient_id: performed.patient_id,
            inventory_item_id: item.id,
            item_name_snapshot: item.name,
            actual_inventory_item_id: null,
            actual_item_name_snapshot: null,
            planned_quantity: plannedQty,
            actual_quantity: plannedQty,
            consumption_unit: mat.consumption_unit,
            unit_cost_snapshot_cents: unitCost,
            planned_cost_cents: plannedCost,
            actual_cost_cents: plannedCost,
            status: "planned",
            confirmed_by: null,
            confirmed_at: null,
            inventory_movement_id: null,
            created_at: now(),
            updated_at: now(),
          };
          store.appointmentConsumptions.push(row);
        }
        continue;
      }
    }

    const plannedQty = plannedQuantityForMode({
      standardQuantity: mat.standard_quantity,
      mode: mat.consumption_mode,
      procedureQuantity: performed.quantity,
    });
    const unitCost = item.average_unit_cost_cents;
    const plannedCost = consumptionCostCents(plannedQty, unitCost);
    materialCost += plannedCost;

    const row: ProcedureConsumption = {
      id: `pc-${crypto.randomUUID()}`,
      clinic_id: ctx.clinicId,
      performed_procedure_id: performed.id,
      patient_id: performed.patient_id,
      appointment_id: performed.appointment_id,
      inventory_item_id: item.id,
      item_name_snapshot: item.name,
      actual_inventory_item_id: null,
      actual_item_name_snapshot: null,
      consumption_mode: mat.consumption_mode,
      planned_quantity: plannedQty,
      actual_quantity: plannedQty, // pré-preencher UI; não confirma
      consumption_unit: mat.consumption_unit,
      unit_cost_snapshot_cents: unitCost,
      planned_cost_cents: plannedCost,
      actual_cost_cents: plannedCost,
      is_extra: false,
      status: "planned",
      confirmed_by: null,
      confirmed_at: null,
      inventory_movement_id: null,
      created_at: now(),
      updated_at: now(),
    };
    store.procedureConsumptions.push(row);
  }

  performed.planned_material_cost_cents = materialCost;
  performed.planned_total_cost_cents =
    materialCost +
    performed.planned_shared_cost_cents +
    performed.planned_direct_cost_cents;

  writePerformedAudit({
    clinic_id: ctx.clinicId,
    actor_user_id: ctx.userId,
    action: "procedure_consumption.snapshot_created",
    target_type: "performed_procedure",
    target_id: performed.id,
  });
}

export function createPerformedProcedure(ctx: AuthzContext, input: unknown) {
  assertPermission(ctx, "performed_procedures.create");
  const data = createPerformedProcedureSchema.parse(input);
  assertPatient(ctx, data.patient_id);

  const professionalId = data.professional_id ?? ctx.userId;
  assertProfessional(ctx, professionalId);

  const inv = getInventoryStore();
  const procedure = inv.procedures.find((p) => p.id === data.procedure_id);
  if (!procedure || procedure.clinic_id !== ctx.clinicId) {
    throw new Error("PROCEDURE_NOT_FOUND");
  }

  if (data.appointment_id) {
    const appt = getAgendaStore().appointments.find(
      (a) => a.id === data.appointment_id,
    );
    if (
      !appt ||
      appt.clinic_id !== ctx.clinicId ||
      appt.patient_id !== data.patient_id
    ) {
      throw new Error("APPOINTMENT_NOT_FOUND");
    }
  }

  if (data.treatment_item_id) {
    const item = getTreatmentsStore().items.find(
      (i) => i.id === data.treatment_item_id,
    );
    const plan = item
      ? getTreatmentsStore().plans.find((p) => p.id === item.treatment_plan_id)
      : null;
    if (
      !item ||
      !plan ||
      plan.clinic_id !== ctx.clinicId ||
      plan.patient_id !== data.patient_id
    ) {
      throw new Error("TREATMENT_ITEM_NOT_FOUND");
    }
  }

  const charged = data.charged_amount_reais == null
    ? procedure.default_price_cents
    : reaisToCents(data.charged_amount_reais);

  if (charged === 0 && !data.charged_zero_reason) {
    // permitido com motivo opcional em V1
  }

  if (data.appointment_planned_procedure_id) {
    const planned = getPlannedProceduresStore().planned.find(
      (p) => p.id === data.appointment_planned_procedure_id,
    );
    if (
      !planned ||
      planned.clinic_id !== ctx.clinicId ||
      planned.patient_id !== data.patient_id ||
      (data.appointment_id && planned.appointment_id !== data.appointment_id)
    ) {
      throw new Error("PLANNED_PROCEDURE_NOT_FOUND");
    }
    const dup = getPerformedStore().performedProcedures.find(
      (p) =>
        p.appointment_planned_procedure_id ===
          data.appointment_planned_procedure_id &&
        p.status !== "cancelled",
    );
    if (dup) {
      return getPerformedProcedure(ctx, dup.id);
    }
  }

  const performed: PerformedProcedure = {
    id: `pp-${crypto.randomUUID()}`,
    clinic_id: ctx.clinicId,
    patient_id: data.patient_id,
    appointment_id: data.appointment_id ?? null,
    procedure_id: procedure.id,
    procedure_name_snapshot: procedure.name,
    treatment_item_id: data.treatment_item_id ?? null,
    appointment_planned_procedure_id:
      data.appointment_planned_procedure_id ?? null,
    professional_id: professionalId,
    tooth_number: data.tooth_number ?? null,
    region: data.region ?? null,
    quantity: data.quantity ?? 1,
    status: "planned",
    standard_price_snapshot_cents: procedure.default_price_cents,
    charged_amount_cents: charged,
    charged_zero_reason: data.charged_zero_reason ?? null,
    planned_material_cost_cents: 0,
    actual_material_cost_cents: null,
    planned_shared_cost_cents: 0,
    actual_shared_cost_cents: null,
    planned_direct_cost_cents: 0,
    actual_direct_cost_cents: null,
    planned_total_cost_cents: 0,
    actual_total_cost_cents: null,
    gross_result_cents: null,
    gross_margin_percent: null,
    consumption_confirmed: false,
    consumption_confirmed_at: null,
    started_at: null,
    completed_at: null,
    clinical_entry_id: null,
    financial_transaction_id: null,
    created_by: ctx.userId,
    created_at: now(),
    updated_at: now(),
  };

  getPerformedStore().performedProcedures.push(performed);
  buildProcedureConsumptionSnapshot(ctx, performed);
  recalculatePlannedShared(ctx, performed.appointment_id);

  writePerformedAudit({
    clinic_id: ctx.clinicId,
    actor_user_id: ctx.userId,
    action: "performed_procedure.created",
    target_type: "performed_procedure",
    target_id: performed.id,
    metadata: {
      patient_id: performed.patient_id,
      procedure_id: performed.procedure_id,
    },
  });

  return getPerformedProcedure(ctx, performed.id);
}

export function startPerformedProcedure(ctx: AuthzContext, id: string) {
  assertPermission(ctx, "performed_procedures.update");
  const row = findPerformed(ctx, id);
  if (row.status === "cancelled" || row.status === "completed") {
    throw new Error("INVALID_STATUS");
  }
  row.status = "in_progress";
  row.started_at = row.started_at ?? now();
  row.updated_at = now();
  writePerformedAudit({
    clinic_id: ctx.clinicId,
    actor_user_id: ctx.userId,
    action: "performed_procedure.started",
    target_type: "performed_procedure",
    target_id: id,
  });
  return getPerformedProcedure(ctx, id);
}

export function completePerformedProcedure(ctx: AuthzContext, id: string) {
  assertPermission(ctx, "performed_procedures.complete");
  const row = findPerformed(ctx, id);
  if (row.status === "cancelled") throw new Error("INVALID_STATUS");
  if (!row.consumption_confirmed) {
    throw new Error("CONSUMPTION_NOT_CONFIRMED");
  }
  row.status = "completed";
  row.completed_at = now();
  row.updated_at = now();
  const gross = calculateGrossResult(
    row.charged_amount_cents,
    row.actual_total_cost_cents,
  );
  row.gross_result_cents = gross.gross_result_cents;
  row.gross_margin_percent = gross.gross_margin_percent;
  writePerformedAudit({
    clinic_id: ctx.clinicId,
    actor_user_id: ctx.userId,
    action: "performed_procedure.completed",
    target_type: "performed_procedure",
    target_id: id,
  });
  return getPerformedProcedure(ctx, id);
}

export function cancelPerformedProcedure(ctx: AuthzContext, input: unknown) {
  assertPermission(ctx, "performed_procedures.update");
  const data = cancelPerformedProcedureSchema.parse(input);
  const row = findPerformed(ctx, data.id);
  if (row.consumption_confirmed) {
    throw new Error("CONSUMPTION_ALREADY_CONFIRMED");
  }
  row.status = "cancelled";
  row.updated_at = now();
  recalculatePlannedShared(ctx, row.appointment_id);
  writePerformedAudit({
    clinic_id: ctx.clinicId,
    actor_user_id: ctx.userId,
    action: "performed_procedure.cancelled",
    target_type: "performed_procedure",
    target_id: row.id,
    metadata: { reason: data.reason },
  });
  return getPerformedProcedure(ctx, row.id);
}

export function updatePerformedProcedure(ctx: AuthzContext, input: unknown) {
  assertPermission(ctx, "performed_procedures.update");
  const data = updatePerformedProcedureSchema.parse(input);
  const row = findPerformed(ctx, data.id);
  if (row.consumption_confirmed) {
    // preço pode mudar; quantidades de ficha não
  }
  if (data.tooth_number !== undefined) row.tooth_number = data.tooth_number;
  if (data.region !== undefined) row.region = data.region;
  if (data.charged_amount_reais !== undefined) {
    row.charged_amount_cents =
      data.charged_amount_reais == null
        ? null
        : reaisToCents(data.charged_amount_reais);
  }
  if (data.charged_zero_reason !== undefined) {
    row.charged_zero_reason = data.charged_zero_reason;
  }
  if (
    data.quantity !== undefined &&
    data.quantity !== row.quantity &&
    !row.consumption_confirmed
  ) {
    row.quantity = data.quantity;
    // rebuild exclusive planned lines
    const store = getPerformedStore();
    store.procedureConsumptions = store.procedureConsumptions.filter(
      (c) => c.performed_procedure_id !== row.id,
    );
    row.planned_material_cost_cents = 0;
    buildProcedureConsumptionSnapshot(ctx, row);
    recalculatePlannedShared(ctx, row.appointment_id);
  }
  row.updated_at = now();
  return getPerformedProcedure(ctx, row.id);
}

export function getPerformedProcedure(ctx: AuthzContext, id: string) {
  assertPermission(ctx, "performed_procedures.view");
  const row = findPerformed(ctx, id);
  const store = getPerformedStore();
  const consumptions = store.procedureConsumptions.filter(
    (c) => c.performed_procedure_id === id,
  );
  const appointmentConsumptions = row.appointment_id
    ? store.appointmentConsumptions.filter(
        (a) => a.appointment_id === row.appointment_id,
      )
    : [];
  const showCost = canViewProcedureCosts(ctx);
  const maskCost = <T extends { unit_cost_snapshot_cents: number; planned_cost_cents: number; actual_cost_cents: number | null }>(
    c: T,
  ) =>
    showCost
      ? c
      : {
          ...c,
          unit_cost_snapshot_cents: 0,
          planned_cost_cents: 0,
          actual_cost_cents: c.actual_cost_cents == null ? null : 0,
        };

  return {
    procedure: {
      ...row,
      professional_name:
        getProfile(row.professional_id)?.full_name ?? "Profissional",
      planned_material_cost_cents: showCost
        ? row.planned_material_cost_cents
        : null,
      actual_material_cost_cents: showCost
        ? row.actual_material_cost_cents
        : null,
      planned_shared_cost_cents: showCost
        ? row.planned_shared_cost_cents
        : null,
      actual_shared_cost_cents: showCost
        ? row.actual_shared_cost_cents
        : null,
      planned_total_cost_cents: showCost ? row.planned_total_cost_cents : null,
      actual_total_cost_cents: showCost ? row.actual_total_cost_cents : null,
      gross_result_cents: showCost ? row.gross_result_cents : null,
      gross_margin_percent: showCost ? row.gross_margin_percent : null,
      charged_amount_cents: showCost || can(ctx, "finance.view_authorized").allowed || can(ctx, "finance.view_administrative").allowed
        ? row.charged_amount_cents
        : null,
    },
    consumptions: consumptions.map(maskCost),
    appointment_consumptions: appointmentConsumptions.map(maskCost),
    canViewCosts: showCost,
  };
}

export function getPatientProcedureHistory(
  ctx: AuthzContext,
  patientId: string,
) {
  assertPermission(ctx, "performed_procedures.view");
  assertPatient(ctx, patientId);
  const showCost = canViewProcedureCosts(ctx);
  const showFinance =
    can(ctx, "finance.view_authorized").allowed ||
    can(ctx, "finance.view_administrative").allowed;
  return getPerformedStore()
    .performedProcedures.filter(
      (p) => p.clinic_id === ctx.clinicId && p.patient_id === patientId,
    )
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map((p) => ({
      ...p,
      professional_name:
        getProfile(p.professional_id)?.full_name ?? "Profissional",
      charged_amount_cents: showFinance || showCost ? p.charged_amount_cents : null,
      actual_total_cost_cents: showCost ? p.actual_total_cost_cents : null,
      gross_result_cents: showCost ? p.gross_result_cents : null,
      gross_margin_percent: showCost ? p.gross_margin_percent : null,
    }));
}

export function listAppointmentPerformedProcedures(
  ctx: AuthzContext,
  appointmentId: string,
) {
  assertPermission(ctx, "performed_procedures.view");
  const appt = getAgendaStore().appointments.find((a) => a.id === appointmentId);
  if (!appt || appt.clinic_id !== ctx.clinicId) {
    throw new Error("APPOINTMENT_NOT_FOUND");
  }
  return getPerformedStore()
    .performedProcedures.filter(
      (p) =>
        p.clinic_id === ctx.clinicId && p.appointment_id === appointmentId,
    )
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export function getAppointmentMaterialForecast(
  ctx: AuthzContext,
  appointmentId: string,
) {
  assertPermission(ctx, "performed_procedures.view");
  const procs = listAppointmentPerformedProcedures(ctx, appointmentId).filter(
    (p) => p.status !== "cancelled",
  );
  const store = getPerformedStore();
  const inv = getInventoryStore();
  const exclusive = store.procedureConsumptions.filter((c) =>
    procs.some((p) => p.id === c.performed_procedure_id),
  );
  const shared = store.appointmentConsumptions.filter(
    (a) => a.appointment_id === appointmentId,
  );

  type Agg = {
    inventory_item_id: string;
    item_name: string;
    planned_quantity: number;
    consumption_unit: string;
    current_stock: number;
    availability: "disponivel" | "estoque_baixo" | "insuficiente";
  };
  const map = new Map<string, Agg>();

  for (const line of [...exclusive, ...shared]) {
    const item = inv.inventoryItems.find((i) => i.id === line.inventory_item_id);
    const prev = map.get(line.inventory_item_id);
    const qty = line.planned_quantity;
    if (prev) prev.planned_quantity += qty;
    else {
      const stock = item?.current_quantity ?? 0;
      const min = item?.minimum_quantity;
      let availability: Agg["availability"] = "disponivel";
      if (stock < qty) availability = "insuficiente";
      else if (min != null && stock <= min) availability = "estoque_baixo";
      map.set(line.inventory_item_id, {
        inventory_item_id: line.inventory_item_id,
        item_name: line.item_name_snapshot,
        planned_quantity: qty,
        consumption_unit: line.consumption_unit,
        current_stock: stock,
        availability,
      });
    }
  }

  // recompute availability after aggregation
  for (const row of map.values()) {
    const item = inv.inventoryItems.find((i) => i.id === row.inventory_item_id);
    const stock = item?.current_quantity ?? 0;
    row.current_stock = stock;
    if (stock < row.planned_quantity) row.availability = "insuficiente";
    else if (
      item?.minimum_quantity != null &&
      stock <= item.minimum_quantity
    ) {
      row.availability = "estoque_baixo";
    } else row.availability = "disponivel";
  }

  return {
    procedures: procs,
    materials: [...map.values()],
  };
}

/** Vincula evolução clínica pré-preenchida. */
export function linkClinicalEntry(
  ctx: AuthzContext,
  performedProcedureId: string,
  clinicalEntryId: string,
) {
  const row = findPerformed(ctx, performedProcedureId);
  row.clinical_entry_id = clinicalEntryId;
  row.updated_at = now();
  return row;
}

/**
 * Oferece criar obrigação financeira — NÃO cria pagamento.
 * Bloqueia se treatment_item já ligado a plano com obrigação.
 */
export function shouldOfferFinanceCharge(ctx: AuthzContext, id: string) {
  const row = findPerformed(ctx, id);
  if (row.charged_amount_cents == null || row.charged_amount_cents <= 0) {
    return { offer: false, reason: "no_charge" as const };
  }
  if (row.financial_transaction_id) {
    return { offer: false, reason: "already_linked" as const };
  }
  if (row.treatment_item_id) {
    const item = getTreatmentsStore().items.find(
      (i) => i.id === row.treatment_item_id,
    );
    const plan = item
      ? getTreatmentsStore().plans.find((p) => p.id === item.treatment_plan_id)
      : null;
    if (plan) {
      const hasTx = getFinanceStore().transactions.some(
        (t) =>
          t.clinic_id === ctx.clinicId &&
          t.treatment_plan_id === plan.id &&
          !t.cancelled_at,
      );
      if (hasTx) {
        return { offer: false, reason: "plan_already_billed" as const };
      }
    }
  }
  return { offer: true, reason: "ok" as const };
}

export function attachFinancialTransaction(
  ctx: AuthzContext,
  performedProcedureId: string,
  transactionId: string,
) {
  const row = findPerformed(ctx, performedProcedureId);
  row.financial_transaction_id = transactionId;
  row.updated_at = now();
  return row;
}
