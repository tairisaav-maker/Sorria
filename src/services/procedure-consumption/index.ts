import type { AuthzContext } from "@/lib/authz/can";
import { assertPermission } from "@/lib/authz/guards";
import { getInventoryStore } from "@/lib/demo/inventory-store";
import {
  getPerformedStore,
  withConfirmLock,
  writePerformedAudit,
} from "@/lib/demo/performed-procedures-store";
import { consumptionCostCents } from "@/lib/inventory/units";
import {
  addExtraMaterialSchema,
  confirmConsumptionSchema,
  correctConsumptionSchema,
  updateActualConsumptionSchema,
} from "@/lib/validations/performed-procedure";
import { applyInventoryMovement } from "@/services/inventory/movements";
import {
  allocateSharedCost,
  calculateGrossResult,
  calculateDeviation,
  deviationPercent,
} from "@/services/performed-procedures/costs";
import { getPerformedProcedure } from "@/services/performed-procedures";
import type { ProcedureConsumption } from "@/types/performed-procedure";

export {
  calculateProcedureStandardConsumption,
  calculateAppointmentPlannedConsumption,
  listProcedureMaterials,
} from "@/services/procedures";

function now() {
  return new Date().toISOString();
}

function findPerformed(ctx: AuthzContext, id: string) {
  const row = getPerformedStore().performedProcedures.find((p) => p.id === id);
  if (!row || row.clinic_id !== ctx.clinicId) {
    throw new Error("PERFORMED_PROCEDURE_NOT_FOUND");
  }
  return row;
}

export function getPerformedProcedureConsumption(
  ctx: AuthzContext,
  performedProcedureId: string,
) {
  assertPermission(ctx, "procedure_consumption.view");
  return getPerformedProcedure(ctx, performedProcedureId);
}

export function updateActualConsumption(ctx: AuthzContext, input: unknown) {
  assertPermission(ctx, "procedure_consumption.update");
  const data = updateActualConsumptionSchema.parse(input);
  const performed = findPerformed(ctx, data.performed_procedure_id);
  if (performed.consumption_confirmed) {
    throw new Error("CONSUMPTION_ALREADY_CONFIRMED");
  }
  const store = getPerformedStore();
  const inv = getInventoryStore();

  for (const line of data.lines) {
    const row = store.procedureConsumptions.find(
      (c) =>
        c.id === line.id &&
        c.performed_procedure_id === performed.id &&
        c.clinic_id === ctx.clinicId,
    );
    if (!row) throw new Error("CONSUMPTION_LINE_NOT_FOUND");
    row.actual_quantity = line.actual_quantity;
    if (line.actual_inventory_item_id) {
      const item = inv.inventoryItems.find(
        (i) => i.id === line.actual_inventory_item_id,
      );
      if (!item || item.clinic_id !== ctx.clinicId) {
        throw new Error("CROSS_CLINIC_REFERENCE");
      }
      row.actual_inventory_item_id = item.id;
      row.actual_item_name_snapshot = item.name;
      row.unit_cost_snapshot_cents = item.average_unit_cost_cents;
    }
    row.actual_cost_cents = consumptionCostCents(
      line.actual_quantity,
      row.unit_cost_snapshot_cents,
    );
    row.updated_at = now();
  }

  for (const line of data.appointment_lines ?? []) {
    const row = store.appointmentConsumptions.find(
      (c) =>
        c.id === line.id &&
        c.appointment_id === performed.appointment_id &&
        c.clinic_id === ctx.clinicId,
    );
    if (!row) throw new Error("APPOINTMENT_CONSUMPTION_NOT_FOUND");
    if (row.status === "confirmed") continue;
    row.actual_quantity = line.actual_quantity;
    if (line.actual_inventory_item_id) {
      const item = inv.inventoryItems.find(
        (i) => i.id === line.actual_inventory_item_id,
      );
      if (!item || item.clinic_id !== ctx.clinicId) {
        throw new Error("CROSS_CLINIC_REFERENCE");
      }
      row.actual_inventory_item_id = item.id;
      row.actual_item_name_snapshot = item.name;
      row.unit_cost_snapshot_cents = item.average_unit_cost_cents;
    }
    row.actual_cost_cents = consumptionCostCents(
      line.actual_quantity,
      row.unit_cost_snapshot_cents,
    );
    row.updated_at = now();
  }

  writePerformedAudit({
    clinic_id: ctx.clinicId,
    actor_user_id: ctx.userId,
    action: "procedure_consumption.updated",
    target_type: "performed_procedure",
    target_id: performed.id,
  });

  return getPerformedProcedure(ctx, performed.id);
}

export function addExtraConsumedMaterial(ctx: AuthzContext, input: unknown) {
  assertPermission(ctx, "procedure_consumption.update");
  const data = addExtraMaterialSchema.parse(input);
  const performed = findPerformed(ctx, data.performed_procedure_id);
  if (performed.consumption_confirmed) {
    throw new Error("CONSUMPTION_ALREADY_CONFIRMED");
  }
  const item = getInventoryStore().inventoryItems.find(
    (i) => i.id === data.inventory_item_id,
  );
  if (!item || item.clinic_id !== ctx.clinicId) {
    throw new Error("INVENTORY_ITEM_NOT_FOUND");
  }
  const cost = consumptionCostCents(
    data.quantity,
    item.average_unit_cost_cents,
  );
  const row: ProcedureConsumption = {
    id: `pc-${crypto.randomUUID()}`,
    clinic_id: ctx.clinicId,
    performed_procedure_id: performed.id,
    patient_id: performed.patient_id,
    appointment_id: performed.appointment_id,
    inventory_item_id: item.id,
    item_name_snapshot: item.name,
    actual_inventory_item_id: item.id,
    actual_item_name_snapshot: item.name,
    consumption_mode: data.consumption_mode,
    planned_quantity: 0,
    actual_quantity: data.quantity,
    consumption_unit: item.consumption_unit,
    unit_cost_snapshot_cents: item.average_unit_cost_cents,
    planned_cost_cents: 0,
    actual_cost_cents: cost,
    is_extra: true,
    status: "planned",
    confirmed_by: null,
    confirmed_at: null,
    inventory_movement_id: null,
    created_at: now(),
    updated_at: now(),
  };
  getPerformedStore().procedureConsumptions.push(row);
  return getPerformedProcedure(ctx, performed.id);
}

/**
 * Confirma consumo: baixa estoque (exclusivo + compartilhado uma vez),
 * calcula custos, idempotente.
 */
export function confirmProcedureConsumption(ctx: AuthzContext, input: unknown) {
  assertPermission(ctx, "procedure_consumption.confirm");
  const data = confirmConsumptionSchema.parse(input);

  return withConfirmLock(data.performed_procedure_id, () => {
    const performed = findPerformed(ctx, data.performed_procedure_id);

    // Idempotência
    if (performed.consumption_confirmed) {
      return getPerformedProcedure(ctx, performed.id);
    }

    const store = getPerformedStore();
    const lines = store.procedureConsumptions.filter(
      (c) => c.performed_procedure_id === performed.id,
    );

    // Snapshot de custo vigente no confirm (não muda depois)
    const inv = getInventoryStore();
    for (const line of lines) {
      if (line.actual_quantity == null) {
        line.actual_quantity = line.planned_quantity;
      }
      const useItemId = line.actual_inventory_item_id ?? line.inventory_item_id;
      const item = inv.inventoryItems.find((i) => i.id === useItemId);
      if (!item || item.clinic_id !== ctx.clinicId) {
        throw new Error("INVENTORY_ITEM_NOT_FOUND");
      }
      // unit_cost_snapshot já gravado no snapshot; se substituição, atualiza
      if (line.actual_inventory_item_id) {
        line.unit_cost_snapshot_cents = item.average_unit_cost_cents;
      }
      line.actual_cost_cents = consumptionCostCents(
        line.actual_quantity,
        line.unit_cost_snapshot_cents,
      );
    }

    // Checagem de estoque insuficiente (alerta, não bloqueia se confirmado)
    if (!data.confirm_insufficient_stock) {
      for (const line of lines) {
        const qty = line.actual_quantity ?? 0;
        if (qty <= 0) continue;
        const useItemId =
          line.actual_inventory_item_id ?? line.inventory_item_id;
        const item = inv.inventoryItems.find((i) => i.id === useItemId)!;
        if (item.current_quantity < qty) {
          throw new Error("INSUFFICIENT_STOCK");
        }
      }
    }

    // Snapshot para rollback
    const snapItems = inv.inventoryItems.map((i) => ({ ...i }));
    const snapMovLen = inv.movements.length;
    const snapLines = lines.map((l) => ({ ...l }));
    const shared = performed.appointment_id
      ? store.appointmentConsumptions.filter(
          (a) => a.appointment_id === performed.appointment_id,
        )
      : [];
    const snapShared = shared.map((s) => ({ ...s }));

    try {
      // Baixa exclusiva
      for (const line of lines) {
        const qty = line.actual_quantity ?? 0;
        if (qty <= 0) {
          line.status = "confirmed";
          line.confirmed_at = now();
          line.confirmed_by = ctx.userId;
          line.updated_at = now();
          continue;
        }
        // Se substituiu: baixa o item real, não o previsto
        const useItemId =
          line.actual_inventory_item_id ?? line.inventory_item_id;
        const movement = applyInventoryMovement(ctx, {
          inventory_item_id: useItemId,
          movement_type: "procedure_consumption",
          quantity_delta: -qty,
          unit_cost_snapshot_cents: line.unit_cost_snapshot_cents,
          update_average_cost: false,
          reference_type: "performed_procedure",
          reference_id: performed.id,
          reason: `Consumo — ${performed.procedure_name_snapshot}`,
          allow_negative: Boolean(data.confirm_insufficient_stock),
        });
        line.inventory_movement_id = movement.id;
        line.status = "confirmed";
        line.confirmed_at = now();
        line.confirmed_by = ctx.userId;
        line.updated_at = now();

        writePerformedAudit({
          clinic_id: ctx.clinicId,
          actor_user_id: ctx.userId,
          action: "inventory.procedure_consumption",
          target_type: "inventory_movement",
          target_id: movement.id,
          metadata: {
            performed_procedure_id: performed.id,
            quantity: qty,
          },
        });
      }

      // Baixa compartilhada (uma vez por appointment item)
      let sharedActualTotal = 0;
      for (const ac of shared) {
        if (ac.actual_quantity == null) ac.actual_quantity = ac.planned_quantity;
        if (ac.status === "confirmed" && ac.inventory_movement_id) {
          sharedActualTotal += ac.actual_cost_cents ?? 0;
          continue;
        }
        const qty = ac.actual_quantity ?? 0;
        ac.actual_cost_cents = consumptionCostCents(
          qty,
          ac.unit_cost_snapshot_cents,
        );
        if (qty > 0) {
          const useItemId =
            ac.actual_inventory_item_id ?? ac.inventory_item_id;
          const movement = applyInventoryMovement(ctx, {
            inventory_item_id: useItemId,
            movement_type: "procedure_consumption",
            quantity_delta: -qty,
            unit_cost_snapshot_cents: ac.unit_cost_snapshot_cents,
            update_average_cost: false,
            reference_type: "appointment_consumption",
            reference_id: ac.id,
            reason: `Consumo compartilhado — atendimento`,
            allow_negative: Boolean(data.confirm_insufficient_stock),
          });
          ac.inventory_movement_id = movement.id;
        }
        ac.status = "confirmed";
        ac.confirmed_at = now();
        ac.confirmed_by = ctx.userId;
        ac.updated_at = now();
        sharedActualTotal += ac.actual_cost_cents ?? 0;
      }

      const materialActual = lines.reduce(
        (s, l) => s + (l.actual_cost_cents ?? 0),
        0,
      );

      const activeProcs = store.performedProcedures.filter(
        (p) =>
          p.appointment_id === performed.appointment_id &&
          p.status !== "cancelled",
      );
      const shareEach = performed.appointment_id
        ? allocateSharedCost(sharedActualTotal, activeProcs.length || 1)
        : 0;

      // Atualiza rateio em todos os procedimentos do atendimento (os já confirmados mantêm)
      if (performed.appointment_id) {
        for (const p of activeProcs) {
          if (p.id === performed.id || !p.consumption_confirmed) {
            p.actual_shared_cost_cents = shareEach;
            if (!p.consumption_confirmed) {
              p.planned_shared_cost_cents = allocateSharedCost(
                shared.reduce((s, a) => s + a.planned_cost_cents, 0),
                activeProcs.length || 1,
              );
            }
          }
        }
      }

      performed.actual_material_cost_cents = materialActual;
      performed.actual_shared_cost_cents = shareEach;
      performed.actual_direct_cost_cents = performed.planned_direct_cost_cents;
      performed.actual_total_cost_cents =
        materialActual +
        shareEach +
        (performed.actual_direct_cost_cents ?? 0);

      const gross = calculateGrossResult(
        performed.charged_amount_cents,
        performed.actual_total_cost_cents,
      );
      performed.gross_result_cents = gross.gross_result_cents;
      performed.gross_margin_percent = gross.gross_margin_percent;
      performed.consumption_confirmed = true;
      performed.consumption_confirmed_at = now();
      performed.status =
        performed.status === "planned" ? "in_progress" : performed.status;
      performed.started_at = performed.started_at ?? now();
      performed.updated_at = now();

      writePerformedAudit({
        clinic_id: ctx.clinicId,
        actor_user_id: ctx.userId,
        action: "procedure_consumption.confirmed",
        target_type: "performed_procedure",
        target_id: performed.id,
      });

      return getPerformedProcedure(ctx, performed.id);
    } catch (error) {
      inv.inventoryItems.splice(0, inv.inventoryItems.length, ...snapItems);
      inv.movements.length = snapMovLen;
      for (let i = 0; i < lines.length; i++) {
        Object.assign(lines[i], snapLines[i]);
      }
      for (let i = 0; i < shared.length; i++) {
        Object.assign(shared[i], snapShared[i]);
      }
      throw error;
    }
  });
}

export function correctProcedureConsumption(ctx: AuthzContext, input: unknown) {
  assertPermission(ctx, "procedure_consumption.correct");
  const data = correctConsumptionSchema.parse(input);
  const performed = findPerformed(ctx, data.performed_procedure_id);
  if (!performed.consumption_confirmed) {
    throw new Error("CONSUMPTION_NOT_CONFIRMED");
  }

  const store = getPerformedStore();

  return withConfirmLock(performed.id, () => {
    for (const line of data.lines) {
      const row = store.procedureConsumptions.find(
        (c) =>
          c.id === line.id && c.performed_procedure_id === performed.id,
      );
      if (!row) throw new Error("CONSUMPTION_LINE_NOT_FOUND");
      const prevQty = row.actual_quantity ?? 0;
      const nextQty = line.actual_quantity;
      const delta = nextQty - prevQty; // positivo = mais consumo; negativo = devolver

      if (delta !== 0) {
        const useItemId =
          line.actual_inventory_item_id ??
          row.actual_inventory_item_id ??
          row.inventory_item_id;
        // delta consumo: se next > prev, baixa mais (-); se next < prev, devolve (+)
        applyInventoryMovement(ctx, {
          inventory_item_id: useItemId,
          movement_type: "correction",
          quantity_delta: -delta,
          unit_cost_snapshot_cents: row.unit_cost_snapshot_cents,
          update_average_cost: false,
          reference_type: "performed_procedure",
          reference_id: performed.id,
          reason: data.reason,
          allow_negative: true,
        });
      }

      if (line.actual_inventory_item_id && line.actual_inventory_item_id !== (row.actual_inventory_item_id ?? row.inventory_item_id)) {
        // substituição após confirmação: reverte antigo, baixa novo
        const oldId = row.actual_inventory_item_id ?? row.inventory_item_id;
        if (prevQty > 0) {
          applyInventoryMovement(ctx, {
            inventory_item_id: oldId,
            movement_type: "correction",
            quantity_delta: prevQty,
            unit_cost_snapshot_cents: row.unit_cost_snapshot_cents,
            reference_type: "performed_procedure",
            reference_id: performed.id,
            reason: `${data.reason} — reverte item`,
            allow_negative: true,
          });
        }
        const newItem = getInventoryStore().inventoryItems.find(
          (i) => i.id === line.actual_inventory_item_id,
        );
        if (!newItem || newItem.clinic_id !== ctx.clinicId) {
          throw new Error("CROSS_CLINIC_REFERENCE");
        }
        if (nextQty > 0) {
          applyInventoryMovement(ctx, {
            inventory_item_id: newItem.id,
            movement_type: "procedure_consumption",
            quantity_delta: -nextQty,
            unit_cost_snapshot_cents: newItem.average_unit_cost_cents,
            reference_type: "performed_procedure",
            reference_id: performed.id,
            reason: `${data.reason} — item correto`,
            allow_negative: true,
          });
        }
        row.actual_inventory_item_id = newItem.id;
        row.actual_item_name_snapshot = newItem.name;
        row.unit_cost_snapshot_cents = newItem.average_unit_cost_cents;
      }

      row.actual_quantity = nextQty;
      row.actual_cost_cents = consumptionCostCents(
        nextQty,
        row.unit_cost_snapshot_cents,
      );
      row.status = "corrected";
      row.updated_at = now();
    }

    const lines = store.procedureConsumptions.filter(
      (c) => c.performed_procedure_id === performed.id,
    );
    performed.actual_material_cost_cents = lines.reduce(
      (s, l) => s + (l.actual_cost_cents ?? 0),
      0,
    );
    performed.actual_total_cost_cents =
      (performed.actual_material_cost_cents ?? 0) +
      (performed.actual_shared_cost_cents ?? 0) +
      (performed.actual_direct_cost_cents ?? 0);
    const gross = calculateGrossResult(
      performed.charged_amount_cents,
      performed.actual_total_cost_cents,
    );
    performed.gross_result_cents = gross.gross_result_cents;
    performed.gross_margin_percent = gross.gross_margin_percent;
    performed.updated_at = now();

    writePerformedAudit({
      clinic_id: ctx.clinicId,
      actor_user_id: ctx.userId,
      action: "procedure_consumption.corrected",
      target_type: "performed_procedure",
      target_id: performed.id,
      metadata: { reason: data.reason },
    });
    writePerformedAudit({
      clinic_id: ctx.clinicId,
      actor_user_id: ctx.userId,
      action: "inventory.procedure_consumption_reversed",
      target_type: "performed_procedure",
      target_id: performed.id,
    });

    return getPerformedProcedure(ctx, performed.id);
  });
}

export function calculatePerformedProcedureCost(
  ctx: AuthzContext,
  performedProcedureId: string,
) {
  return getPerformedProcedure(ctx, performedProcedureId);
}

export function getConsumptionDeviations(
  ctx: AuthzContext,
  performedProcedureId: string,
) {
  assertPermission(ctx, "procedure_consumption.view");
  const store = getPerformedStore();
  return store.procedureConsumptions
    .filter((c) => c.performed_procedure_id === performedProcedureId)
    .map((c) => {
      const actual = c.actual_quantity ?? c.planned_quantity;
      const difference = actual - c.planned_quantity;
      return {
        inventory_item_id: c.inventory_item_id,
        item_name: c.actual_item_name_snapshot ?? c.item_name_snapshot,
        planned_quantity: c.planned_quantity,
        actual_quantity: actual,
        difference,
        percent: deviationPercent(c.planned_quantity, actual),
        label: calculateDeviation(c.planned_quantity, actual),
      };
    });
}
