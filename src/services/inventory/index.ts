import { can, type AuthzContext } from "@/lib/authz/can";
import { assertPermission } from "@/lib/authz/guards";
import {
  getInventoryStore,
  writeInventoryAudit,
} from "@/lib/demo/inventory-store";
import {
  assertCompatibleUnits,
  purchaseCostToConsumptionUnitCents,
} from "@/lib/inventory/units";
import {
  createInventoryItemSchema,
  updateInventoryItemSchema,
} from "@/lib/validations/inventory";
import type { InventoryItem, InventoryItemStatus } from "@/types/inventory";
import {
  canViewInventoryCosts,
  getEmptyStockItems,
  getExpiringInventoryItems,
  getInventoryItemStatus,
  getLowStockItems,
  calculateInventoryValue,
} from "@/services/inventory/costs";

export {
  calculateInventoryValue,
  getLowStockItems,
  getEmptyStockItems,
  getExpiringInventoryItems,
  getInventoryItemStatus,
  canViewInventoryCosts,
  recalculateAverageCost,
} from "@/services/inventory/costs";

export {
  createInventoryPurchase,
  cancelInventoryPurchase,
  listInventoryPurchases,
  getInventoryPurchase,
} from "@/services/inventory/purchases";

export {
  forecastMaterialNeeds,
  getAppointmentMaterialForecast,
  calculateAppointmentMaterialForecast,
  getUpcomingStockRisks,
  getPatientUpcomingMaterialNeeds,
  getAppointmentForecastIndicator,
  listAppointmentForecastIndicators,
  FORECAST_ELIGIBLE_STATUSES,
} from "@/services/inventory/forecast";

export {
  getInventoryMovements,
  applyInventoryMovement,
} from "@/services/inventory/movements";

export {
  registerInitialStock,
  adjustInventory,
  registerLoss,
  registerExpiration,
  registerReturn,
  registerCorrection,
} from "@/services/inventory/adjustments";

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

/** Cadastro do item — saldo e custo médio começam em 0 (use estoque inicial/compra). */
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
    current_quantity: 0,
    minimum_quantity: data.minimum_quantity ?? null,
    average_unit_cost_cents: 0,
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

/** Atualiza cadastro — NÃO altera saldo nem custo médio. */
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
  item.minimum_quantity = data.minimum_quantity ?? null;
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

export function calculateAvailableStock(
  ctx: AuthzContext,
  itemId: string,
): number {
  assertPermission(ctx, "inventory.view");
  return findItem(ctx, itemId).current_quantity;
}

export function previewPurchaseUnitCost(input: {
  purchaseTotalReais: number;
  purchaseQuantity: number;
  unitsPerPurchaseUnit: number;
}): number {
  return purchaseCostToConsumptionUnitCents(input);
}

export function listInventoryItemsWithStatus(ctx: AuthzContext) {
  assertPermission(ctx, "inventory.view");
  const showCost = canViewInventoryCosts(ctx);
  const expiring = getExpiringInventoryItems(ctx, 30);
  const expiringIds = new Set(expiring.map((e) => e.inventory_item_id));
  return listInventoryItems(ctx).map((item) => {
    const status: InventoryItemStatus = getInventoryItemStatus(
      item,
      expiringIds,
    );
    return {
      ...item,
      status,
      stock_value_cents: showCost
        ? Math.round(item.current_quantity * item.average_unit_cost_cents)
        : null,
      average_unit_cost_cents: showCost ? item.average_unit_cost_cents : null,
    };
  });
}

export function getInventoryDashboard(ctx: AuthzContext) {
  if (!can(ctx, "inventory.view").allowed) {
    return null;
  }
  const low = getLowStockItems(ctx);
  const empty = getEmptyStockItems(ctx);
  const expiring = getExpiringInventoryItems(ctx, 30);
  const showCost = canViewInventoryCosts(ctx);
  const value = showCost
    ? calculateInventoryValue(ctx)
    : { total_cents: null as number | null, item_count: 0 };
  return {
    low_count: low.length,
    empty_count: empty.length,
    expiring_count: expiring.length,
    estimated_value_cents: value.total_cents,
    low_items: low.slice(0, 5).map((i) => ({
      id: i.id,
      name: i.name,
      current_quantity: i.current_quantity,
      consumption_unit: i.consumption_unit,
    })),
    expiring_items: expiring.slice(0, 5).map((e) => ({
      id: e.id,
      item_name: e.item_name,
      expiration_date: e.expiration_date,
      days_until: e.days_until,
    })),
  };
}

export function getProceduresUsingItem(ctx: AuthzContext, itemId: string) {
  assertPermission(ctx, "inventory.view");
  findItem(ctx, itemId);
  const store = getInventoryStore();
  return store.procedureMaterials
    .filter(
      (m) =>
        m.clinic_id === ctx.clinicId && m.inventory_item_id === itemId,
    )
    .map((m) => {
      const proc = store.procedures.find((p) => p.id === m.procedure_id);
      return {
        procedure_id: m.procedure_id,
        procedure_name: proc?.name ?? "—",
        standard_quantity: m.standard_quantity,
        consumption_unit: m.consumption_unit,
        consumption_mode: m.consumption_mode,
      };
    });
}

export function getItemLots(ctx: AuthzContext, itemId: string) {
  assertPermission(ctx, "inventory.view");
  findItem(ctx, itemId);
  return getInventoryStore()
    .lots.filter(
      (l) =>
        l.clinic_id === ctx.clinicId &&
        l.inventory_item_id === itemId &&
        l.quantity_remaining > 0,
    )
    .sort((a, b) =>
      (a.expiration_date ?? "9999").localeCompare(b.expiration_date ?? "9999"),
    );
}
