import { getInventoryStore } from "@/lib/demo/inventory-store";
import {
  consumptionCostCents,
  plannedQuantityForMode,
} from "@/lib/inventory/units";
import type { MaterialRequirementLine } from "@/types/forecast";
import type { ConsumptionMode } from "@/types/inventory";

export type ProcedureRequirementInput = {
  procedure_id: string;
  quantity: number;
  planned_procedure_id?: string;
  patient_id?: string;
  patient_name?: string;
  tooth_number?: number | null;
};

/**
 * Calcula requisitos de materiais a partir da ficha técnica atual.
 * Usado por forecast (Subfase 4) e alinhado ao snapshot da Subfase 3.
 *
 * per_appointment: agrega 1× por appointment (via alreadyCounted set externo
 * quando processando múltiplos procedimentos do mesmo atendimento).
 */
export function calculateProcedureMaterialRequirements(
  clinicId: string,
  procedures: ProcedureRequirementInput[],
  opts?: {
    /** Se true, materiais per_appointment contam só na 1ª ocorrência do item */
    dedupePerAppointment?: boolean;
  },
): MaterialRequirementLine[] {
  const inv = getInventoryStore();
  const countedAppointment = new Set<string>();
  const lines: MaterialRequirementLine[] = [];

  for (const proc of procedures) {
    const materials = inv.procedureMaterials.filter(
      (m) => m.clinic_id === clinicId && m.procedure_id === proc.procedure_id,
    );

    for (const mat of materials) {
      const item = inv.inventoryItems.find(
        (i) => i.id === mat.inventory_item_id && i.clinic_id === clinicId,
      );
      if (!item) continue;

      const mode = mat.consumption_mode as ConsumptionMode;
      let already = false;
      if (opts?.dedupePerAppointment && mode === "per_appointment") {
        already = countedAppointment.has(mat.inventory_item_id);
      }

      const qty = plannedQuantityForMode({
        standardQuantity: mat.standard_quantity,
        mode,
        procedureQuantity: proc.quantity,
        alreadyCountedInAppointment: already,
      });

      if (mode === "per_appointment" && qty > 0) {
        countedAppointment.add(mat.inventory_item_id);
      }
      if (qty <= 0) continue;

      const unitCost = item.average_unit_cost_cents;
      lines.push({
        inventory_item_id: item.id,
        item_name: item.name,
        consumption_unit: mat.consumption_unit,
        consumption_mode: mode,
        quantity: qty,
        unit_cost_cents: unitCost,
        cost_cents: consumptionCostCents(qty, unitCost),
        is_estimate: mode === "manual",
        scope: mode === "per_appointment" ? "appointment" : "procedure",
        procedure_id: proc.procedure_id,
        planned_procedure_id: proc.planned_procedure_id,
        patient_id: proc.patient_id,
        patient_name: proc.patient_name,
        tooth_number: proc.tooth_number,
      });
    }
  }

  return lines;
}

export function aggregateRequirementLines(
  lines: MaterialRequirementLine[],
): Map<
  string,
  {
    inventory_item_id: string;
    item_name: string;
    consumption_unit: MaterialRequirementLine["consumption_unit"];
    quantity: number;
    cost_cents: number;
    has_estimate: boolean;
    breakdown: MaterialRequirementLine[];
  }
> {
  const map = new Map<
    string,
    {
      inventory_item_id: string;
      item_name: string;
      consumption_unit: MaterialRequirementLine["consumption_unit"];
      quantity: number;
      cost_cents: number;
      has_estimate: boolean;
      breakdown: MaterialRequirementLine[];
    }
  >();

  for (const line of lines) {
    const prev = map.get(line.inventory_item_id);
    if (prev) {
      prev.quantity += line.quantity;
      prev.cost_cents += line.cost_cents;
      prev.has_estimate = prev.has_estimate || line.is_estimate;
      prev.breakdown.push(line);
    } else {
      map.set(line.inventory_item_id, {
        inventory_item_id: line.inventory_item_id,
        item_name: line.item_name,
        consumption_unit: line.consumption_unit,
        quantity: line.quantity,
        cost_cents: line.cost_cents,
        has_estimate: line.is_estimate,
        breakdown: [line],
      });
    }
  }
  return map;
}
