import type { AuthzContext } from "@/lib/authz/can";
import { assertPermission } from "@/lib/authz/guards";
import {
  getInventoryStore,
  writeInventoryAudit,
} from "@/lib/demo/inventory-store";
import { purchaseCostToConsumptionUnitCents } from "@/lib/inventory/units";
import { reaisToCents } from "@/lib/money";
import {
  cancelPurchaseSchema,
  createPurchaseSchema,
} from "@/lib/validations/inventory";
import { applyInventoryMovement } from "@/services/inventory/movements";
import type {
  InventoryLot,
  InventoryPurchase,
  InventoryPurchaseItem,
} from "@/types/inventory";

function now() {
  return new Date().toISOString();
}

function findItem(ctx: AuthzContext, id: string) {
  const item = getInventoryStore().inventoryItems.find((i) => i.id === id);
  if (!item || item.clinic_id !== ctx.clinicId) {
    throw new Error("INVENTORY_ITEM_NOT_FOUND");
  }
  return item;
}

export function listInventoryPurchases(ctx: AuthzContext): Array<
  InventoryPurchase & { items_count: number; total_cost_cents: number }
> {
  assertPermission(ctx, "inventory.view");
  const store = getInventoryStore();
  return store.purchases
    .filter((p) => p.clinic_id === ctx.clinicId)
    .map((p) => {
      const items = store.purchaseItems.filter(
        (i) => i.inventory_purchase_id === p.id,
      );
      return {
        ...p,
        items_count: items.length,
        total_cost_cents: items.reduce((s, i) => s + i.total_cost_cents, 0),
      };
    })
    .sort((a, b) => b.purchase_date.localeCompare(a.purchase_date));
}

export function getInventoryPurchase(
  ctx: AuthzContext,
  id: string,
): {
  purchase: InventoryPurchase;
  items: Array<InventoryPurchaseItem & { item_name: string }>;
} {
  assertPermission(ctx, "inventory.view");
  const store = getInventoryStore();
  const purchase = store.purchases.find((p) => p.id === id);
  if (!purchase || purchase.clinic_id !== ctx.clinicId) {
    throw new Error("PURCHASE_NOT_FOUND");
  }
  const items = store.purchaseItems
    .filter((i) => i.inventory_purchase_id === id)
    .map((i) => {
      const item = store.inventoryItems.find(
        (x) => x.id === i.inventory_item_id,
      );
      return { ...i, item_name: item?.name ?? "—" };
    });
  return { purchase, items };
}

/**
 * Cria compra + itens + movimentos + atualiza saldo/custo médio.
 * Tudo ou nada (rollback em memória se falhar).
 */
export function createInventoryPurchase(ctx: AuthzContext, input: unknown) {
  assertPermission(ctx, "inventory.purchase_create");
  const data = createPurchaseSchema.parse(input);
  const store = getInventoryStore();

  // Snapshot para rollback
  const snapItems = store.inventoryItems.map((i) => ({ ...i }));
  const snapMovLen = store.movements.length;
  const snapPurchLen = store.purchases.length;
  const snapPiLen = store.purchaseItems.length;
  const snapLotsLen = store.lots.length;

  try {
    const purchase: InventoryPurchase = {
      id: `pur-${crypto.randomUUID()}`,
      clinic_id: ctx.clinicId,
      supplier_name: data.supplier_name ?? null,
      invoice_number: data.invoice_number ?? null,
      purchase_date: data.purchase_date,
      notes: data.notes ?? null,
      created_by: ctx.userId,
      created_at: now(),
      updated_at: now(),
      cancelled_at: null,
      cancelled_by: null,
      cancellation_reason: null,
    };
    store.purchases.push(purchase);

    const createdItems: InventoryPurchaseItem[] = [];

    for (const line of data.items) {
      const item = findItem(ctx, line.inventory_item_id);
      const unitsSnapshot =
        line.units_per_purchase_unit ?? item.units_per_purchase_unit;
      const consumptionQty = line.purchase_quantity * unitsSnapshot;
      const totalCents = reaisToCents(line.total_cost_reais);
      const costPerConsumption = purchaseCostToConsumptionUnitCents({
        purchaseTotalReais: line.total_cost_reais,
        purchaseQuantity: line.purchase_quantity,
        unitsPerPurchaseUnit: unitsSnapshot,
      });
      const costPerPurchase = Math.round(totalCents / line.purchase_quantity);

      if (item.tracks_lot && !line.lot_number) {
        // lote opcional mesmo com tracks_lot — não forçar
      }
      if (item.tracks_expiration && !line.expiration_date) {
        // validade recomendada; não bloquear V1 se omitida
      }

      const pi: InventoryPurchaseItem = {
        id: `pi-${crypto.randomUUID()}`,
        clinic_id: ctx.clinicId,
        inventory_purchase_id: purchase.id,
        inventory_item_id: item.id,
        purchase_quantity: line.purchase_quantity,
        purchase_unit: line.purchase_unit ?? item.purchase_unit,
        units_per_purchase_unit_snapshot: unitsSnapshot,
        consumption_quantity_received: consumptionQty,
        total_cost_cents: totalCents,
        cost_per_purchase_unit_cents: costPerPurchase,
        cost_per_consumption_unit_cents: costPerConsumption,
        lot_number: line.lot_number ?? null,
        expiration_date: line.expiration_date ?? null,
        created_at: now(),
      };
      store.purchaseItems.push(pi);
      createdItems.push(pi);

      applyInventoryMovement(ctx, {
        inventory_item_id: item.id,
        movement_type: "purchase",
        quantity_delta: consumptionQty,
        unit_cost_snapshot_cents: costPerConsumption,
        update_average_cost: true,
        reference_type: "inventory_purchase_item",
        reference_id: pi.id,
        reason: data.supplier_name
          ? `Compra — ${data.supplier_name}`
          : "Compra",
      });

      if (line.lot_number || line.expiration_date || item.tracks_lot) {
        const lot: InventoryLot = {
          id: `lot-${crypto.randomUUID()}`,
          clinic_id: ctx.clinicId,
          inventory_item_id: item.id,
          lot_number: line.lot_number ?? null,
          expiration_date: line.expiration_date ?? null,
          quantity_received: consumptionQty,
          quantity_remaining: consumptionQty,
          unit_cost_cents: costPerConsumption,
          source_purchase_item_id: pi.id,
          created_at: now(),
        };
        store.lots.push(lot);
      }
    }

    writeInventoryAudit({
      clinic_id: ctx.clinicId,
      actor_user_id: ctx.userId,
      action: "inventory.purchase_created",
      target_type: "inventory_purchase",
      target_id: purchase.id,
      metadata: { items: createdItems.length },
    });

    return { purchase, items: createdItems };
  } catch (error) {
    // Rollback total
    store.inventoryItems.splice(0, store.inventoryItems.length, ...snapItems);
    store.movements.length = snapMovLen;
    store.purchases.length = snapPurchLen;
    store.purchaseItems.length = snapPiLen;
    store.lots.length = snapLotsLen;
    throw error;
  }
}

export function cancelInventoryPurchase(ctx: AuthzContext, input: unknown) {
  assertPermission(ctx, "inventory.purchase_create");
  const data = cancelPurchaseSchema.parse(input);
  const store = getInventoryStore();
  const purchase = store.purchases.find((p) => p.id === data.id);
  if (!purchase || purchase.clinic_id !== ctx.clinicId) {
    throw new Error("PURCHASE_NOT_FOUND");
  }
  if (purchase.cancelled_at) {
    throw new Error("PURCHASE_ALREADY_CANCELLED");
  }

  const items = store.purchaseItems.filter(
    (i) => i.inventory_purchase_id === purchase.id,
  );

  for (const pi of items) {
    applyInventoryMovement(ctx, {
      inventory_item_id: pi.inventory_item_id,
      movement_type: "correction",
      quantity_delta: -pi.consumption_quantity_received,
      unit_cost_snapshot_cents: pi.cost_per_consumption_unit_cents,
      update_average_cost: false,
      reference_type: "inventory_purchase_cancel",
      reference_id: purchase.id,
      reason: data.cancellation_reason,
      allow_negative: true,
    });

    // Reverte impacto aproximado no custo médio se estoque restante > 0
    const item = findItem(ctx, pi.inventory_item_id);
    if (item.current_quantity > 0) {
      // Mantém average atual (histórico de compra cancelada não reescreve médio
      // de forma complexa). Em V1: não recalcula a partir de zero.
    }

    for (const lot of store.lots.filter(
      (l) => l.source_purchase_item_id === pi.id,
    )) {
      lot.quantity_remaining = 0;
    }
  }

  purchase.cancelled_at = now();
  purchase.cancelled_by = ctx.userId;
  purchase.cancellation_reason = data.cancellation_reason;
  purchase.updated_at = now();

  writeInventoryAudit({
    clinic_id: ctx.clinicId,
    actor_user_id: ctx.userId,
    action: "inventory.purchase_cancelled",
    target_type: "inventory_purchase",
    target_id: purchase.id,
    metadata: { reason: data.cancellation_reason },
  });

  return purchase;
}
