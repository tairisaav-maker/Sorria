import type { AuthzContext } from "@/lib/authz/can";
import { assertPermission } from "@/lib/authz/guards";
import {
  getInventoryStore,
  writeInventoryAudit,
} from "@/lib/demo/inventory-store";
import {
  assertCompatibleUnits,
  purchaseCostToConsumptionUnitCents,
} from "@/lib/inventory/units";
import { reaisToCents } from "@/lib/money";
import {
  createInventoryItemSchema,
  updateInventoryItemSchema,
} from "@/lib/validations/inventory";
import type { InventoryItem } from "@/types/inventory";

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

export function listInventoryItems(
  ctx: AuthzContext,
  opts?: { includeArchived?: boolean },
): InventoryItem[] {
  assertPermission(ctx, "inventory.view");
  return getInventoryStore()
    .inventoryItems.filter(
      (i) =>
        i.clinic_id === ctx.clinicId &&
        (opts?.includeArchived ? true : i.active && !i.archived_at),
    )
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

export function getInventoryItem(
  ctx: AuthzContext,
  id: string,
): InventoryItem {
  assertPermission(ctx, "inventory.view");
  return findItem(ctx, id);
}

export function createInventoryItem(
  ctx: AuthzContext,
  input: unknown,
): InventoryItem {
  assertPermission(ctx, "inventory.create");
  const data = createInventoryItemSchema.parse(input);
  assertCompatibleUnits(
    data.purchase_unit,
    data.consumption_unit,
    data.units_per_purchase_unit,
  );

  const store = getInventoryStore();
  const item: InventoryItem = {
    id: `inv-${crypto.randomUUID()}`,
    clinic_id: ctx.clinicId,
    name: data.name,
    category: data.category ?? null,
    purchase_unit: data.purchase_unit,
    consumption_unit: data.consumption_unit,
    units_per_purchase_unit: data.units_per_purchase_unit,
    current_quantity: data.current_quantity ?? 0,
    minimum_quantity: data.minimum_quantity ?? null,
    average_unit_cost_cents: reaisToCents(data.average_unit_cost_reais ?? 0),
    last_purchase_cost_cents: null,
    supplier_name: data.supplier_name ?? null,
    tracks_lot: data.tracks_lot ?? false,
    tracks_expiration: data.tracks_expiration ?? false,
    active: true,
    created_by: ctx.userId,
    created_at: now(),
    updated_at: now(),
    archived_at: null,
  };
  store.inventoryItems.push(item);
  writeInventoryAudit({
    clinic_id: ctx.clinicId,
    actor_user_id: ctx.userId,
    action: "inventory_item.created",
    target_type: "inventory_item",
    target_id: item.id,
    metadata: { name: item.name },
  });
  return item;
}

export function updateInventoryItem(
  ctx: AuthzContext,
  input: unknown,
): InventoryItem {
  assertPermission(ctx, "inventory.update");
  const data = updateInventoryItemSchema.parse(input);
  assertCompatibleUnits(
    data.purchase_unit,
    data.consumption_unit,
    data.units_per_purchase_unit,
  );
  const item = findItem(ctx, data.id);
  item.name = data.name;
  item.category = data.category ?? null;
  item.purchase_unit = data.purchase_unit;
  item.consumption_unit = data.consumption_unit;
  item.units_per_purchase_unit = data.units_per_purchase_unit;
  if (data.current_quantity !== undefined) {
    // Subfase 1: edição cadastral. Ajustes com motivo/movimento = Subfase 2.
    item.current_quantity = data.current_quantity;
  }
  item.minimum_quantity = data.minimum_quantity ?? null;
  item.average_unit_cost_cents = reaisToCents(
    data.average_unit_cost_reais ?? 0,
  );
  item.supplier_name = data.supplier_name ?? null;
  item.tracks_lot = data.tracks_lot ?? false;
  item.tracks_expiration = data.tracks_expiration ?? false;
  if (data.active !== undefined) item.active = data.active;
  item.updated_at = now();
  writeInventoryAudit({
    clinic_id: ctx.clinicId,
    actor_user_id: ctx.userId,
    action: "inventory_item.updated",
    target_type: "inventory_item",
    target_id: item.id,
  });
  return item;
}

export function getLowStockItems(ctx: AuthzContext): InventoryItem[] {
  assertPermission(ctx, "inventory.view");
  return listInventoryItems(ctx).filter(
    (i) =>
      i.minimum_quantity != null && i.current_quantity <= i.minimum_quantity,
  );
}

export function calculateAvailableStock(
  ctx: AuthzContext,
  itemId: string,
): number {
  assertPermission(ctx, "inventory.view");
  return findItem(ctx, itemId).current_quantity;
}

/** Valor estimado do estoque (custo médio vigente × quantidade). */
export function calculateInventoryValue(ctx: AuthzContext): {
  total_cents: number;
  item_count: number;
} {
  assertPermission(ctx, "inventory.view");
  const items = listInventoryItems(ctx);
  const total_cents = items.reduce(
    (s, i) =>
      s + Math.round(i.current_quantity * i.average_unit_cost_cents),
    0,
  );
  return { total_cents, item_count: items.length };
}

/**
 * Helper conceitual Subfase 1: converte custo de compra → custo/un consumo.
 * Compras completas + custo médio ponderado = Subfase 2.
 */
export function previewPurchaseUnitCost(input: {
  purchaseTotalReais: number;
  purchaseQuantity: number;
  unitsPerPurchaseUnit: number;
}): number {
  return purchaseCostToConsumptionUnitCents(input);
}
