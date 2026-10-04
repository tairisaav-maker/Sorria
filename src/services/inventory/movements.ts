import type { AuthzContext } from "@/lib/authz/can";
import { assertPermission } from "@/lib/authz/guards";
import {
  getInventoryStore,
  withItemLock,
  writeInventoryAudit,
} from "@/lib/demo/inventory-store";
import { weightedAverageUnitCostCents } from "@/lib/inventory/units";
import type {
  InventoryItem,
  InventoryMovement,
  MovementType,
} from "@/types/inventory";

function now() {
  return new Date().toISOString();
}

function findItem(ctx: AuthzContext, id: string): InventoryItem {
  const item = getInventoryStore().inventoryItems.find((i) => i.id === id);
  if (!item || item.clinic_id !== ctx.clinicId) {
    throw new Error("INVENTORY_ITEM_NOT_FOUND");
  }
  return item;
}

export type ApplyMovementInput = {
  inventory_item_id: string;
  movement_type: MovementType;
  quantity_delta: number;
  unit_cost_snapshot_cents?: number | null;
  /** Se true e entrada positiva, recalcula custo médio ponderado */
  update_average_cost?: boolean;
  reference_type?: string | null;
  reference_id?: string | null;
  reason?: string | null;
  allow_negative?: boolean;
};

/**
 * Aplica movimento de forma atômica por item.
 * Atualiza current_quantity (+ resulting_quantity).
 * Entradas com update_average_cost recalculam average_unit_cost.
 */
export function applyInventoryMovement(
  ctx: AuthzContext,
  input: ApplyMovementInput,
): InventoryMovement {
  if (input.quantity_delta === 0) {
    throw new Error("QUANTITY_DELTA_ZERO");
  }

  return withItemLock(input.inventory_item_id, () => {
    const item = findItem(ctx, input.inventory_item_id);
    const nextQty = item.current_quantity + input.quantity_delta;

    if (nextQty < 0 && !input.allow_negative) {
      throw new Error("NEGATIVE_STOCK_NOT_ALLOWED");
    }

    let avgUpdated = false;
    if (
      input.update_average_cost &&
      input.quantity_delta > 0 &&
      input.unit_cost_snapshot_cents != null
    ) {
      const prevAvg = item.average_unit_cost_cents;
      item.average_unit_cost_cents = weightedAverageUnitCostCents({
        currentQty: item.current_quantity,
        currentAvgCents: item.average_unit_cost_cents,
        incomingQty: input.quantity_delta,
        incomingUnitCostCents: input.unit_cost_snapshot_cents,
      });
      item.last_purchase_cost_cents = input.unit_cost_snapshot_cents;
      avgUpdated = item.average_unit_cost_cents !== prevAvg;
    }

    item.current_quantity = nextQty;
    item.updated_at = now();

    const movement: InventoryMovement = {
      id: `mov-${crypto.randomUUID()}`,
      clinic_id: ctx.clinicId,
      inventory_item_id: item.id,
      movement_type: input.movement_type,
      quantity_delta: input.quantity_delta,
      unit_cost_snapshot_cents: input.unit_cost_snapshot_cents ?? null,
      resulting_quantity: nextQty,
      reference_type: input.reference_type ?? null,
      reference_id: input.reference_id ?? null,
      reason: input.reason ?? null,
      created_by: ctx.userId,
      created_at: now(),
    };
    getInventoryStore().movements.push(movement);

    if (avgUpdated) {
      writeInventoryAudit({
        clinic_id: ctx.clinicId,
        actor_user_id: ctx.userId,
        action: "inventory.average_cost_updated",
        target_type: "inventory_item",
        target_id: item.id,
        metadata: {
          average_unit_cost_cents: item.average_unit_cost_cents,
          movement_id: movement.id,
        },
      });
    }

    return movement;
  });
}

export function getInventoryMovements(
  ctx: AuthzContext,
  filters?: {
    inventoryItemId?: string;
    movementType?: MovementType;
    from?: string;
    to?: string;
  },
): Array<InventoryMovement & { item_name: string }> {
  try {
    assertPermission(ctx, "inventory.movements_view");
  } catch {
    assertPermission(ctx, "inventory.view");
  }
  const store = getInventoryStore();
  return store.movements
    .filter((m) => {
      if (m.clinic_id !== ctx.clinicId) return false;
      if (
        filters?.inventoryItemId &&
        m.inventory_item_id !== filters.inventoryItemId
      ) {
        return false;
      }
      if (filters?.movementType && m.movement_type !== filters.movementType) {
        return false;
      }
      if (filters?.from && m.created_at < filters.from) return false;
      if (filters?.to && m.created_at > filters.to) return false;
      return true;
    })
    .map((m) => {
      const item = store.inventoryItems.find(
        (i) => i.id === m.inventory_item_id,
      );
      return { ...m, item_name: item?.name ?? "—" };
    })
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function recalculateAverageCost(
  currentQty: number,
  currentAvgCents: number,
  incomingQty: number,
  incomingUnitCostCents: number,
): number {
  return weightedAverageUnitCostCents({
    currentQty,
    currentAvgCents,
    incomingQty,
    incomingUnitCostCents,
  });
}
