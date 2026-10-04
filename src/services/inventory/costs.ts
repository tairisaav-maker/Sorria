import type { AuthzContext } from "@/lib/authz/can";
import { can } from "@/lib/authz/can";
import { assertPermission } from "@/lib/authz/guards";
import { getInventoryStore } from "@/lib/demo/inventory-store";
import { recalculateAverageCost } from "@/services/inventory/movements";
import type { InventoryItem, InventoryLot } from "@/types/inventory";

export { recalculateAverageCost };

function activeClinicItems(ctx: AuthzContext): InventoryItem[] {
  return getInventoryStore().inventoryItems.filter(
    (i) => i.clinic_id === ctx.clinicId && i.active && !i.archived_at,
  );
}

export function assertCostView(ctx: AuthzContext) {
  assertPermission(ctx, "inventory.cost_view");
}

export function canViewInventoryCosts(ctx: AuthzContext) {
  return can(ctx, "inventory.cost_view").allowed;
}

/** Valor estimado = qty × custo médio vigente. */
export function calculateInventoryValue(ctx: AuthzContext): {
  total_cents: number;
  item_count: number;
} {
  assertPermission(ctx, "inventory.view");
  assertCostView(ctx);
  const items = activeClinicItems(ctx);
  const total_cents = items.reduce(
    (s, i) => s + Math.round(i.current_quantity * i.average_unit_cost_cents),
    0,
  );
  return { total_cents, item_count: items.length };
}

export function getLowStockItems(ctx: AuthzContext): InventoryItem[] {
  assertPermission(ctx, "inventory.view");
  return activeClinicItems(ctx).filter(
    (i) =>
      i.minimum_quantity != null && i.current_quantity <= i.minimum_quantity,
  );
}

export function getEmptyStockItems(ctx: AuthzContext): InventoryItem[] {
  assertPermission(ctx, "inventory.view");
  return activeClinicItems(ctx).filter((i) => i.current_quantity <= 0);
}

/**
 * Itens com lotes vencendo em `withinDays` (default 30).
 */
export function getExpiringInventoryItems(
  ctx: AuthzContext,
  withinDays: 30 | 60 | 90 = 30,
): Array<InventoryLot & { item_name: string; days_until: number }> {
  assertPermission(ctx, "inventory.view");
  const store = getInventoryStore();
  const limit = Date.now() + withinDays * 86400_000;
  const today = Date.now();
  return store.lots
    .filter((l) => {
      if (l.clinic_id !== ctx.clinicId) return false;
      if (!l.expiration_date || l.quantity_remaining <= 0) return false;
      const exp = new Date(`${l.expiration_date}T23:59:59`).getTime();
      return exp <= limit;
    })
    .map((l) => {
      const item = store.inventoryItems.find(
        (i) => i.id === l.inventory_item_id,
      );
      const exp = new Date(`${l.expiration_date!}T23:59:59`).getTime();
      return {
        ...l,
        item_name: item?.name ?? "—",
        days_until: Math.ceil((exp - today) / 86400_000),
      };
    })
    .sort((a, b) => a.days_until - b.days_until);
}

export function getInventoryItemStatus(
  item: InventoryItem,
  expiringItemIds: Set<string>,
): "empty" | "low" | "expiring" | "normal" {
  if (item.current_quantity <= 0) return "empty";
  if (
    item.minimum_quantity != null &&
    item.current_quantity <= item.minimum_quantity
  ) {
    return "low";
  }
  if (expiringItemIds.has(item.id)) return "expiring";
  return "normal";
}
