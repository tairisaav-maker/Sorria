import { can, type AuthzContext } from "@/lib/authz/can";
import { assertPermission } from "@/lib/authz/guards";
import {
  getInventoryStore,
  writeInventoryAudit,
} from "@/lib/demo/inventory-store";
import {
  getPricingStore,
  writePricingAudit,
} from "@/lib/demo/pricing-store";
import {
  consumptionCostCents,
  plannedQuantityForMode,
} from "@/lib/inventory/units";
import { reaisToCents } from "@/lib/money";
import {
  archiveProcedureSchema,
  createProcedureSchema,
  procedureMaterialSchema,
  removeProcedureMaterialSchema,
  updateProcedureMaterialSchema,
  updateProcedureSchema,
} from "@/lib/validations/inventory";
import type {
  Procedure,
  ProcedureMaterial,
  ProcedureMaterialLine,
  ProcedureStandardCost,
} from "@/types/inventory";

function now() {
  return new Date().toISOString();
}

function findProcedure(ctx: AuthzContext, id: string): Procedure {
  const proc = getInventoryStore().procedures.find((p) => p.id === id);
  if (!proc || proc.clinic_id !== ctx.clinicId) {
    throw new Error("PROCEDURE_NOT_FOUND");
  }
  return proc;
}

function findItem(ctx: AuthzContext, id: string) {
  const item = getInventoryStore().inventoryItems.find((i) => i.id === id);
  if (!item || item.clinic_id !== ctx.clinicId) {
    throw new Error("INVENTORY_ITEM_NOT_FOUND");
  }
  return item;
}

export function listProcedures(
  ctx: AuthzContext,
  opts?: { includeArchived?: boolean },
): Procedure[] {
  assertPermission(ctx, "procedures.view");
  return getInventoryStore()
    .procedures.filter(
      (p) =>
        p.clinic_id === ctx.clinicId &&
        (opts?.includeArchived ? true : p.active && !p.archived_at),
    )
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

export function getProcedure(ctx: AuthzContext, id: string): Procedure {
  assertPermission(ctx, "procedures.view");
  return findProcedure(ctx, id);
}

export function createProcedure(
  ctx: AuthzContext,
  input: unknown,
): Procedure {
  assertPermission(ctx, "procedures.create");
  const data = createProcedureSchema.parse(input);
  const store = getInventoryStore();
  const proc: Procedure = {
    id: `proc-${crypto.randomUUID()}`,
    clinic_id: ctx.clinicId,
    name: data.name,
    description: data.description ?? null,
    category: data.category ?? null,
    default_duration_minutes: data.default_duration_minutes ?? null,
    default_price_cents:
      data.default_price_reais == null
        ? null
        : reaisToCents(data.default_price_reais),
    active: true,
    created_by: ctx.userId,
    created_at: now(),
    updated_at: now(),
    archived_at: null,
    source_template_id: null,
    source_template_version: null,
    favorited: false,
    use_count: 0,
    last_used_at: null,
  };
  store.procedures.push(proc);
  writeInventoryAudit({
    clinic_id: ctx.clinicId,
    actor_user_id: ctx.userId,
    action: "procedure.created",
    target_type: "procedure",
    target_id: proc.id,
    metadata: { name: proc.name },
  });
  return proc;
}

export function updateProcedure(
  ctx: AuthzContext,
  input: unknown,
): Procedure {
  assertPermission(ctx, "procedures.update");
  const data = updateProcedureSchema.parse(input);
  const proc = findProcedure(ctx, data.id);
  const nextPrice =
    data.default_price_reais == null
      ? null
      : reaisToCents(data.default_price_reais);
  const priceChanged = nextPrice !== proc.default_price_cents;

  if (priceChanged) {
    if (
      !can(ctx, "procedures.update_price").allowed &&
      !can(ctx, "procedure_pricing.manage").allowed
    ) {
      assertPermission(ctx, "procedures.update_price");
    }
  }

  proc.name = data.name;
  proc.description = data.description ?? null;
  proc.category = data.category ?? null;
  proc.default_duration_minutes = data.default_duration_minutes ?? null;
  if (priceChanged && nextPrice != null) {
    const stamp = now();
    const open = getPricingStore().priceHistory.find(
      (h) =>
        h.clinic_id === ctx.clinicId &&
        h.procedure_id === proc.id &&
        h.valid_until == null,
    );
    if (open) open.valid_until = stamp;
    else if (proc.default_price_cents != null) {
      getPricingStore().priceHistory.unshift({
        id: `pph-${crypto.randomUUID()}`,
        clinic_id: ctx.clinicId,
        procedure_id: proc.id,
        price_cents: proc.default_price_cents,
        valid_from: proc.created_at,
        valid_until: stamp,
        changed_by: ctx.userId,
        created_at: stamp,
      });
    }
    getPricingStore().priceHistory.unshift({
      id: `pph-${crypto.randomUUID()}`,
      clinic_id: ctx.clinicId,
      procedure_id: proc.id,
      price_cents: nextPrice,
      valid_from: stamp,
      valid_until: null,
      changed_by: ctx.userId,
      created_at: stamp,
    });
    writePricingAudit({
      clinic_id: ctx.clinicId,
      actor_user_id: ctx.userId,
      action: "procedure.price_updated",
      target_type: "procedure",
      target_id: proc.id,
      metadata: {
        old_price_cents: proc.default_price_cents,
        new_price_cents: nextPrice,
      },
    });
  }
  proc.default_price_cents = nextPrice;
  if (data.active !== undefined) proc.active = data.active;
  proc.updated_at = now();
  writeInventoryAudit({
    clinic_id: ctx.clinicId,
    actor_user_id: ctx.userId,
    action: "procedure.updated",
    target_type: "procedure",
    target_id: proc.id,
  });
  return proc;
}

export function archiveProcedure(
  ctx: AuthzContext,
  input: unknown,
): Procedure {
  assertPermission(ctx, "procedures.update");
  const data = archiveProcedureSchema.parse(input);
  const proc = findProcedure(ctx, data.id);
  proc.active = false;
  proc.archived_at = now();
  proc.updated_at = now();
  writeInventoryAudit({
    clinic_id: ctx.clinicId,
    actor_user_id: ctx.userId,
    action: "procedure.archived",
    target_type: "procedure",
    target_id: proc.id,
  });
  return proc;
}

export function listProcedureMaterials(
  ctx: AuthzContext,
  procedureId: string,
): ProcedureMaterialLine[] {
  if (
    !can(ctx, "procedures.view").allowed &&
    !can(ctx, "procedure_costs.view").allowed
  ) {
    throw new Error("AUTHORIZATION_DENIED");
  }
  findProcedure(ctx, procedureId);
  const store = getInventoryStore();
  return store.procedureMaterials
    .filter(
      (m) =>
        m.clinic_id === ctx.clinicId && m.procedure_id === procedureId,
    )
    .map((m) => {
      const item = store.inventoryItems.find(
        (i) => i.id === m.inventory_item_id,
      )!;
      const planned = m.standard_quantity;
      return {
        ...m,
        item_name: item.name,
        average_unit_cost_cents: item.average_unit_cost_cents,
        planned_cost_cents: consumptionCostCents(
          planned,
          item.average_unit_cost_cents,
        ),
      };
    })
    .sort((a, b) => a.item_name.localeCompare(b.item_name, "pt-BR"));
}

export function addProcedureMaterial(
  ctx: AuthzContext,
  input: unknown,
): ProcedureMaterial {
  assertPermission(ctx, "procedure_costs.update");
  const data = procedureMaterialSchema.parse(input);
  const proc = findProcedure(ctx, data.procedure_id);
  const item = findItem(ctx, data.inventory_item_id);

  if (proc.clinic_id !== item.clinic_id || proc.clinic_id !== ctx.clinicId) {
    throw new Error("CROSS_CLINIC_REFERENCE");
  }

  const store = getInventoryStore();
  const exists = store.procedureMaterials.find(
    (m) =>
      m.procedure_id === data.procedure_id &&
      m.inventory_item_id === data.inventory_item_id,
  );
  if (exists) throw new Error("MATERIAL_ALREADY_LINKED");

  const row: ProcedureMaterial = {
    id: `pm-${crypto.randomUUID()}`,
    clinic_id: ctx.clinicId,
    procedure_id: data.procedure_id,
    inventory_item_id: data.inventory_item_id,
    standard_quantity: data.standard_quantity,
    consumption_unit: item.consumption_unit,
    consumption_mode: data.consumption_mode,
    optional: data.optional ?? false,
    clinically_variable: data.clinically_variable ?? false,
    notes: data.notes ?? null,
    created_at: now(),
    updated_at: now(),
    source_material_template_id: data.source_material_template_id ?? null,
  };
  store.procedureMaterials.push(row);
  writeInventoryAudit({
    clinic_id: ctx.clinicId,
    actor_user_id: ctx.userId,
    action: "procedure_material.created",
    target_type: "procedure_material",
    target_id: row.id,
    metadata: { procedure_id: proc.id, inventory_item_id: item.id },
  });
  return row;
}

export function updateProcedureMaterial(
  ctx: AuthzContext,
  input: unknown,
): ProcedureMaterial {
  assertPermission(ctx, "procedure_costs.update");
  const data = updateProcedureMaterialSchema.parse(input);
  const store = getInventoryStore();
  const row = store.procedureMaterials.find((m) => m.id === data.id);
  if (!row || row.clinic_id !== ctx.clinicId) {
    throw new Error("PROCEDURE_MATERIAL_NOT_FOUND");
  }
  if (data.standard_quantity !== undefined) {
    row.standard_quantity = data.standard_quantity;
  }
  if (data.consumption_mode !== undefined) {
    row.consumption_mode = data.consumption_mode;
  }
  if (data.optional !== undefined) row.optional = data.optional;
  if (data.clinically_variable !== undefined) {
    row.clinically_variable = data.clinically_variable;
  }
  if (data.notes !== undefined) row.notes = data.notes;
  row.updated_at = now();
  return row;
}

export function duplicateProcedure(
  ctx: AuthzContext,
  procedureId: string,
  nameOverride?: string | null,
): Procedure {
  assertPermission(ctx, "procedures.create");
  const source = findProcedure(ctx, procedureId);
  const store = getInventoryStore();
  const copy: Procedure = {
    ...source,
    id: `proc-${crypto.randomUUID()}`,
    name: nameOverride?.trim() || `${source.name} (cópia)`,
    created_by: ctx.userId,
    created_at: now(),
    updated_at: now(),
    archived_at: null,
    active: true,
    favorited: false,
    use_count: 0,
    last_used_at: null,
    // Cópia da clínica — mantém referência ao template original se houver
    source_template_id: source.source_template_id,
    source_template_version: source.source_template_version,
  };
  store.procedures.push(copy);
  const mats = store.procedureMaterials.filter(
    (m) => m.procedure_id === source.id && m.clinic_id === ctx.clinicId,
  );
  for (const m of mats) {
    store.procedureMaterials.push({
      ...m,
      id: `pm-${crypto.randomUUID()}`,
      procedure_id: copy.id,
      created_at: now(),
      updated_at: now(),
    });
  }
  writeInventoryAudit({
    clinic_id: ctx.clinicId,
    actor_user_id: ctx.userId,
    action: "procedure.duplicated",
    target_type: "procedure",
    target_id: copy.id,
    metadata: { source_procedure_id: source.id },
  });
  return copy;
}

export function setProcedureFavorite(
  ctx: AuthzContext,
  procedureId: string,
  favorited: boolean,
): Procedure {
  assertPermission(ctx, "procedures.update");
  const proc = findProcedure(ctx, procedureId);
  proc.favorited = favorited;
  proc.updated_at = now();
  return proc;
}

export function recordProcedureUsage(
  ctx: AuthzContext,
  procedureId: string,
): void {
  const proc = getInventoryStore().procedures.find(
    (p) => p.id === procedureId && p.clinic_id === ctx.clinicId,
  );
  if (!proc) return;
  proc.use_count += 1;
  proc.last_used_at = now();
  proc.updated_at = now();
}

export function removeProcedureMaterial(
  ctx: AuthzContext,
  input: unknown,
): void {
  assertPermission(ctx, "procedure_costs.update");
  const data = removeProcedureMaterialSchema.parse(input);
  const store = getInventoryStore();
  const idx = store.procedureMaterials.findIndex(
    (m) => m.id === data.id && m.clinic_id === ctx.clinicId,
  );
  if (idx < 0) throw new Error("PROCEDURE_MATERIAL_NOT_FOUND");
  store.procedureMaterials.splice(idx, 1);
}

/**
 * Calcula consumo padrão previsto para quantity unidades do procedimento.
 * per_appointment: conta uma vez (alreadyCountedInAppointment=false no 1º).
 */
export function calculateProcedureStandardConsumption(
  ctx: AuthzContext,
  procedureId: string,
  procedureQuantity = 1,
  opts?: { alreadyCountedInAppointment?: boolean },
) {
  assertPermission(ctx, "procedures.view");
  findProcedure(ctx, procedureId);
  const lines = listProcedureMaterials(ctx, procedureId);
  return lines.map((line) => {
    const qty = plannedQuantityForMode({
      standardQuantity: line.standard_quantity,
      mode: line.consumption_mode,
      procedureQuantity,
      alreadyCountedInAppointment: opts?.alreadyCountedInAppointment,
    });
    return {
      inventory_item_id: line.inventory_item_id,
      item_name: line.item_name,
      consumption_unit: line.consumption_unit,
      consumption_mode: line.consumption_mode,
      planned_quantity: qty,
      unit_cost_cents: line.average_unit_cost_cents,
      planned_cost_cents: consumptionCostCents(
        qty,
        line.average_unit_cost_cents,
      ),
      optional: line.optional,
    };
  });
}

export function calculateProcedureStandardCost(
  ctx: AuthzContext,
  procedureId: string,
  procedureQuantity = 1,
): ProcedureStandardCost {
  if (
    !can(ctx, "procedure_costs.view").allowed &&
    !can(ctx, "procedures.view").allowed
  ) {
    throw new Error("AUTHORIZATION_DENIED");
  }
  const proc = findProcedure(ctx, procedureId);
  const canSeeCosts = can(ctx, "procedure_costs.view").allowed;
  const lines = listProcedureMaterials(ctx, procedureId);
  const materialLines = lines.map((line) => {
    const qty = plannedQuantityForMode({
      standardQuantity: line.standard_quantity,
      mode: line.consumption_mode,
      procedureQuantity,
    });
    return {
      ...line,
      planned_cost_cents: canSeeCosts
        ? consumptionCostCents(qty, line.average_unit_cost_cents)
        : 0,
      average_unit_cost_cents: canSeeCosts
        ? line.average_unit_cost_cents
        : 0,
    };
  });

  const materials_cost_cents = canSeeCosts
    ? materialLines.reduce((s, l) => s + l.planned_cost_cents, 0)
    : 0;
  const direct_costs_cents = 0; // Subfase futura
  const total_cost_cents = materials_cost_cents + direct_costs_cents;
  const default_price_cents =
    proc.default_price_cents == null
      ? null
      : proc.default_price_cents * Math.max(1, procedureQuantity);
  const gross_result_cents =
    canSeeCosts && default_price_cents != null
      ? default_price_cents - total_cost_cents
      : null;
  const margin_percent =
    gross_result_cents != null &&
    default_price_cents != null &&
    default_price_cents > 0
      ? Math.round((gross_result_cents / default_price_cents) * 10000) / 100
      : null;

  return {
    materials_cost_cents,
    direct_costs_cents,
    total_cost_cents,
    default_price_cents,
    gross_result_cents,
    margin_percent,
    lines: materialLines,
  };
}

/**
 * Agrega materiais per_appointment entre vários procedimentos do mesmo atendimento.
 */
export function calculateAppointmentPlannedConsumption(
  ctx: AuthzContext,
  procedures: Array<{ procedureId: string; quantity: number }>,
) {
  assertPermission(ctx, "procedures.view");
  const countedAppointmentItems = new Set<string>();
  const aggregated = new Map<
    string,
    {
      inventory_item_id: string;
      item_name: string;
      consumption_unit: string;
      planned_quantity: number;
      planned_cost_cents: number;
    }
  >();

  for (const entry of procedures) {
    const lines = listProcedureMaterials(ctx, entry.procedureId);
    for (const line of lines) {
      const already = countedAppointmentItems.has(line.inventory_item_id);
      const qty = plannedQuantityForMode({
        standardQuantity: line.standard_quantity,
        mode: line.consumption_mode,
        procedureQuantity: entry.quantity,
        alreadyCountedInAppointment:
          line.consumption_mode === "per_appointment" ? already : false,
      });
      if (line.consumption_mode === "per_appointment" && qty > 0) {
        countedAppointmentItems.add(line.inventory_item_id);
      }
      if (qty <= 0) continue;
      const prev = aggregated.get(line.inventory_item_id);
      const cost = consumptionCostCents(qty, line.average_unit_cost_cents);
      if (prev) {
        prev.planned_quantity += qty;
        prev.planned_cost_cents += cost;
      } else {
        aggregated.set(line.inventory_item_id, {
          inventory_item_id: line.inventory_item_id,
          item_name: line.item_name,
          consumption_unit: line.consumption_unit,
          planned_quantity: qty,
          planned_cost_cents: cost,
        });
      }
    }
  }

  return [...aggregated.values()];
}
