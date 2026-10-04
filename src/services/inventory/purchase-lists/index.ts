import { can, type AuthzContext } from "@/lib/authz/can";
import { assertPermission } from "@/lib/authz/guards";
import { getInventoryStore } from "@/lib/demo/inventory-store";
import {
  getPurchaseListsStore,
  writePurchaseListAudit,
} from "@/lib/demo/purchase-lists-store";
import {
  calculateEstimatedPurchaseCostCents,
  purchasedQuantityFromPackages,
  roundQty,
} from "@/lib/inventory/replenishment";
import { createInventoryPurchase } from "@/services/inventory/purchases";
import { calculateReplenishmentNeeds } from "@/services/inventory/replenishment";
import type {
  PurchaseList,
  PurchaseListItem,
  PurchaseListStatus,
  ReplenishmentHorizon,
} from "@/types/replenishment";

function now() {
  return new Date().toISOString();
}

function canViewCost(ctx: AuthzContext) {
  return can(ctx, "inventory.cost_view").allowed;
}

function findList(ctx: AuthzContext, id: string): PurchaseList {
  const list = getPurchaseListsStore().lists.find((l) => l.id === id);
  if (!list || list.clinic_id !== ctx.clinicId) {
    throw new Error("PURCHASE_LIST_NOT_FOUND");
  }
  return list;
}

function listItems(listId: string): PurchaseListItem[] {
  return getPurchaseListsStore().items.filter(
    (i) => i.purchase_list_id === listId,
  );
}

function recomputeListEstimate(list: PurchaseList) {
  const items = listItems(list.id).filter((i) => i.selected && i.status === "pending");
  let sum = 0;
  let any = false;
  for (const i of items) {
    if (i.estimated_total_cost_cents != null) {
      sum += i.estimated_total_cost_cents;
      any = true;
    }
  }
  list.estimated_total_cents = any ? sum : null;
  list.updated_at = now();
}

function syncListStatus(list: PurchaseList) {
  if (list.status === "cancelled") return;
  const items = listItems(list.id).filter((i) => i.selected);
  if (items.length === 0) {
    list.status = "draft";
    return;
  }
  const purchased = items.filter((i) => i.status === "purchased").length;
  const pending = items.filter((i) => i.status === "pending").length;
  if (purchased === 0) {
    list.status = list.status === "ready" ? "ready" : "draft";
  } else if (pending === 0) {
    list.status = "completed";
    list.completed_at = now();
  } else {
    list.status = "partially_purchased";
  }
  list.updated_at = now();
}

export function getOpenPurchaseLists(ctx: AuthzContext): Array<
  PurchaseList & { items_count: number; pending_count: number }
> {
  assertPermission(ctx, "inventory.replenishment_view");
  return getPurchaseListsStore()
    .lists.filter(
      (l) =>
        l.clinic_id === ctx.clinicId &&
        l.status !== "cancelled" &&
        l.status !== "completed",
    )
    .map((l) => {
      const items = listItems(l.id);
      return {
        ...maskListCosts(ctx, l),
        items_count: items.length,
        pending_count: items.filter((i) => i.status === "pending" && i.selected)
          .length,
      };
    })
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function listPurchaseLists(ctx: AuthzContext) {
  assertPermission(ctx, "inventory.replenishment_view");
  return getPurchaseListsStore()
    .lists.filter((l) => l.clinic_id === ctx.clinicId)
    .map((l) => ({
      ...maskListCosts(ctx, l),
      items_count: listItems(l.id).length,
    }))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

function maskListCosts(ctx: AuthzContext, list: PurchaseList): PurchaseList {
  if (canViewCost(ctx)) return list;
  return { ...list, estimated_total_cents: null };
}

function maskItemCosts(ctx: AuthzContext, item: PurchaseListItem): PurchaseListItem {
  if (canViewCost(ctx)) return item;
  return {
    ...item,
    estimated_unit_purchase_cost_cents: null,
    estimated_total_cost_cents: null,
  };
}

export function getPurchaseList(
  ctx: AuthzContext,
  id: string,
): { list: PurchaseList; items: PurchaseListItem[] } {
  assertPermission(ctx, "inventory.replenishment_view");
  const list = findList(ctx, id);
  return {
    list: maskListCosts(ctx, list),
    items: listItems(id).map((i) => maskItemCosts(ctx, i)),
  };
}

export function createPurchaseList(
  ctx: AuthzContext,
  input: {
    name?: string;
    horizon?: ReplenishmentHorizon;
    start_date?: string | null;
    end_date?: string | null;
    item_ids?: string[] | null;
    /** map inventory_item_id → selected packages override */
    package_overrides?: Record<string, number>;
  },
): { list: PurchaseList; items: PurchaseListItem[] } {
  assertPermission(ctx, "inventory.purchase_list_create");
  const summary = calculateReplenishmentNeeds(ctx, {
    horizon: input.horizon ?? "7d",
    start_date: input.start_date,
    end_date: input.end_date,
  });

  const selectedIds = input.item_ids
    ? new Set(input.item_ids)
    : new Set(
        summary.items
          .filter((i) => i.recommended_packages > 0)
          .map((i) => i.inventory_item_id),
      );

  // Cross-clinic / item inexistente
  for (const id of selectedIds) {
    const invItem = getInventoryStore().inventoryItems.find((i) => i.id === id);
    if (!invItem || invItem.clinic_id !== ctx.clinicId) {
      throw new Error("CROSS_CLINIC_REFERENCE");
    }
  }

  const store = getPurchaseListsStore();
  const list: PurchaseList = {
    id: `pl-${crypto.randomUUID()}`,
    clinic_id: ctx.clinicId,
    name:
      input.name?.trim() ||
      `Reposição ${new Date().toLocaleDateString("pt-BR")}`,
    start_date: summary.start_date.slice(0, 10),
    end_date: summary.end_date.slice(0, 10),
    status: "draft",
    estimated_total_cents: null,
    created_by: ctx.userId,
    created_at: now(),
    updated_at: now(),
    completed_at: null,
  };
  store.lists.unshift(list);

  const created: PurchaseListItem[] = [];
  for (const row of summary.items) {
    if (!selectedIds.has(row.inventory_item_id)) continue;
    if (row.units_per_purchase_unit <= 0) continue;

    const invItem = getInventoryStore().inventoryItems.find(
      (i) => i.id === row.inventory_item_id,
    );
    if (!invItem || invItem.clinic_id !== ctx.clinicId) {
      throw new Error("CROSS_CLINIC_REFERENCE");
    }

    const packages =
      input.package_overrides?.[row.inventory_item_id] ??
      row.recommended_packages;
    const unitCost = row.estimated_package_cost_cents;
    const totalCost = calculateEstimatedPurchaseCostCents(packages, unitCost);

    const item: PurchaseListItem = {
      id: `pli-${crypto.randomUUID()}`,
      clinic_id: ctx.clinicId,
      purchase_list_id: list.id,
      inventory_item_id: row.inventory_item_id,
      item_name_snapshot: row.item_name,
      forecast_quantity: row.forecast_quantity,
      minimum_quantity_snapshot: row.minimum_quantity,
      current_quantity_snapshot: row.effective_quantity,
      recommended_consumption_quantity: row.recommended_replenishment_quantity,
      recommended_purchase_packages: row.recommended_packages,
      selected_purchase_packages: Math.max(0, packages),
      selected: packages > 0,
      purchase_unit: row.purchase_unit,
      consumption_unit: row.consumption_unit,
      units_per_purchase_unit_snapshot: row.units_per_purchase_unit,
      estimated_unit_purchase_cost_cents: unitCost,
      estimated_total_cost_cents: totalCost,
      status: "pending",
      notes: null,
      inventory_purchase_item_id: null,
      created_at: now(),
      updated_at: now(),
    };
    store.items.push(item);
    created.push(item);
  }

  recomputeListEstimate(list);
  list.status = created.some((i) => i.selected) ? "ready" : "draft";

  writePurchaseListAudit({
    clinic_id: ctx.clinicId,
    actor_user_id: ctx.userId,
    action: "purchase_list.created",
    target_type: "purchase_list",
    target_id: list.id,
    metadata: { items: created.length },
  });

  return {
    list: maskListCosts(ctx, list),
    items: created.map((i) => maskItemCosts(ctx, i)),
  };
}

export function updatePurchaseListItem(
  ctx: AuthzContext,
  input: {
    purchase_list_item_id: string;
    selected?: boolean;
    selected_purchase_packages?: number;
    notes?: string | null;
  },
): PurchaseListItem {
  assertPermission(ctx, "inventory.purchase_list_update");
  const store = getPurchaseListsStore();
  const item = store.items.find((i) => i.id === input.purchase_list_item_id);
  if (!item || item.clinic_id !== ctx.clinicId) {
    throw new Error("PURCHASE_LIST_ITEM_NOT_FOUND");
  }
  const list = findList(ctx, item.purchase_list_id);
  if (list.status === "cancelled" || list.status === "completed") {
    throw new Error("PURCHASE_LIST_LOCKED");
  }
  if (item.status === "purchased") {
    throw new Error("PURCHASE_LIST_ITEM_ALREADY_PURCHASED");
  }

  if (input.selected != null) item.selected = input.selected;
  if (input.selected_purchase_packages != null) {
    item.selected_purchase_packages = Math.max(
      0,
      Math.floor(input.selected_purchase_packages),
    );
    if (item.selected_purchase_packages === 0) item.selected = false;
    else item.selected = true;
  }
  if (input.notes !== undefined) item.notes = input.notes;
  item.estimated_total_cost_cents = calculateEstimatedPurchaseCostCents(
    item.selected_purchase_packages,
    item.estimated_unit_purchase_cost_cents,
  );
  item.updated_at = now();
  recomputeListEstimate(list);
  syncListStatus(list);

  writePurchaseListAudit({
    clinic_id: ctx.clinicId,
    actor_user_id: ctx.userId,
    action: "purchase_list.updated",
    target_type: "purchase_list_item",
    target_id: item.id,
    metadata: {
      selected: item.selected,
      packages: item.selected_purchase_packages,
    },
  });

  return maskItemCosts(ctx, item);
}

export function refreshPurchaseList(
  ctx: AuthzContext,
  purchaseListId: string,
): { list: PurchaseList; items: PurchaseListItem[]; refreshed: true } {
  assertPermission(ctx, "inventory.purchase_list_update");
  const list = findList(ctx, purchaseListId);
  if (list.status === "cancelled" || list.status === "completed") {
    throw new Error("PURCHASE_LIST_LOCKED");
  }

  const summary = calculateReplenishmentNeeds(ctx, {
    start_date: list.start_date,
    end_date: list.end_date,
    horizon: "custom",
  });
  const byId = new Map(summary.items.map((i) => [i.inventory_item_id, i]));
  const store = getPurchaseListsStore();

  for (const item of listItems(list.id)) {
    if (item.status === "purchased") continue;
    const row = byId.get(item.inventory_item_id);
    if (!row) continue;
    item.forecast_quantity = row.forecast_quantity;
    item.minimum_quantity_snapshot = row.minimum_quantity;
    item.current_quantity_snapshot = row.effective_quantity;
    item.recommended_consumption_quantity =
      row.recommended_replenishment_quantity;
    item.recommended_purchase_packages = row.recommended_packages;
    item.units_per_purchase_unit_snapshot = row.units_per_purchase_unit;
    item.estimated_unit_purchase_cost_cents = row.estimated_package_cost_cents;
    // keep user's selected packages unless 0 and newly recommended
    if (item.selected_purchase_packages === 0 && row.recommended_packages > 0) {
      item.selected_purchase_packages = row.recommended_packages;
      item.selected = true;
    }
    item.estimated_total_cost_cents = calculateEstimatedPurchaseCostCents(
      item.selected_purchase_packages,
      item.estimated_unit_purchase_cost_cents,
    );
    item.updated_at = now();
  }

  // add newly needed items not on list
  const existing = new Set(listItems(list.id).map((i) => i.inventory_item_id));
  for (const row of summary.items) {
    if (existing.has(row.inventory_item_id)) continue;
    if (row.recommended_packages <= 0) continue;
    store.items.push({
      id: `pli-${crypto.randomUUID()}`,
      clinic_id: ctx.clinicId,
      purchase_list_id: list.id,
      inventory_item_id: row.inventory_item_id,
      item_name_snapshot: row.item_name,
      forecast_quantity: row.forecast_quantity,
      minimum_quantity_snapshot: row.minimum_quantity,
      current_quantity_snapshot: row.effective_quantity,
      recommended_consumption_quantity: row.recommended_replenishment_quantity,
      recommended_purchase_packages: row.recommended_packages,
      selected_purchase_packages: row.recommended_packages,
      selected: true,
      purchase_unit: row.purchase_unit,
      consumption_unit: row.consumption_unit,
      units_per_purchase_unit_snapshot: row.units_per_purchase_unit,
      estimated_unit_purchase_cost_cents: row.estimated_package_cost_cents,
      estimated_total_cost_cents: row.estimated_total_cost_cents,
      status: "pending",
      notes: "Adicionado ao atualizar recomendações",
      inventory_purchase_item_id: null,
      created_at: now(),
      updated_at: now(),
    });
  }

  recomputeListEstimate(list);
  syncListStatus(list);

  writePurchaseListAudit({
    clinic_id: ctx.clinicId,
    actor_user_id: ctx.userId,
    action: "purchase_list.updated",
    target_type: "purchase_list",
    target_id: list.id,
    metadata: { refreshed: true },
  });

  return { ...getPurchaseList(ctx, list.id), refreshed: true };
}

export function cancelPurchaseList(ctx: AuthzContext, purchaseListId: string) {
  assertPermission(ctx, "inventory.purchase_list_update");
  const list = findList(ctx, purchaseListId);
  if (list.status === "cancelled") throw new Error("PURCHASE_LIST_ALREADY_CANCELLED");
  if (list.status === "completed") throw new Error("PURCHASE_LIST_LOCKED");
  list.status = "cancelled";
  list.updated_at = now();
  for (const item of listItems(list.id)) {
    if (item.status === "pending") {
      item.status = "cancelled";
      item.updated_at = now();
    }
  }
  writePurchaseListAudit({
    clinic_id: ctx.clinicId,
    actor_user_id: ctx.userId,
    action: "purchase_list.cancelled",
    target_type: "purchase_list",
    target_id: list.id,
    metadata: {},
  });
  return maskListCosts(ctx, list);
}

/**
 * Registra compra real a partir de itens selecionados da lista.
 * Estoque só muda aqui (não ao criar a lista).
 */
export function createPurchaseFromPurchaseList(
  ctx: AuthzContext,
  input: {
    purchase_list_id: string;
    purchase_date: string;
    supplier_name?: string | null;
    invoice_number?: string | null;
    notes?: string | null;
    /** itens a comprar: id → packages (real) e total_cost_reais */
    lines: Array<{
      purchase_list_item_id: string;
      purchase_quantity: number;
      total_cost_reais: number;
    }>;
  },
) {
  assertPermission(ctx, "inventory.purchase_create");
  assertPermission(ctx, "inventory.purchase_list_update");
  const list = findList(ctx, input.purchase_list_id);
  if (list.status === "cancelled" || list.status === "completed") {
    throw new Error("PURCHASE_LIST_LOCKED");
  }

  const store = getPurchaseListsStore();
  const purchaseLines = [];
  const linkMap: Array<{ listItemId: string; inventoryItemId: string }> = [];

  for (const line of input.lines) {
    const item = store.items.find((i) => i.id === line.purchase_list_item_id);
    if (!item || item.clinic_id !== ctx.clinicId) {
      throw new Error("PURCHASE_LIST_ITEM_NOT_FOUND");
    }
    if (item.purchase_list_id !== list.id) {
      throw new Error("PURCHASE_LIST_ITEM_MISMATCH");
    }
    if (item.status === "purchased") {
      throw new Error("PURCHASE_LIST_ITEM_ALREADY_PURCHASED");
    }
    const inv = getInventoryStore().inventoryItems.find(
      (i) => i.id === item.inventory_item_id,
    );
    if (!inv || inv.clinic_id !== ctx.clinicId) {
      throw new Error("CROSS_CLINIC_REFERENCE");
    }
    if (line.purchase_quantity <= 0) continue;
    purchaseLines.push({
      inventory_item_id: item.inventory_item_id,
      purchase_quantity: line.purchase_quantity,
      purchase_unit: item.purchase_unit,
      units_per_purchase_unit: item.units_per_purchase_unit_snapshot,
      total_cost_reais: line.total_cost_reais,
    });
    linkMap.push({
      listItemId: item.id,
      inventoryItemId: item.inventory_item_id,
    });
  }

  if (purchaseLines.length === 0) {
    throw new Error("NO_PURCHASE_LINES");
  }

  const result = createInventoryPurchase(ctx, {
    purchase_date: input.purchase_date,
    supplier_name: input.supplier_name ?? null,
    invoice_number: input.invoice_number ?? null,
    notes:
      input.notes ??
      `Compra a partir da lista ${list.name} (${list.id})`,
    items: purchaseLines,
  });

  // link purchase items back to list items
  for (const link of linkMap) {
    const listItem = store.items.find((i) => i.id === link.listItemId)!;
    const pi = result.items.find(
      (p) => p.inventory_item_id === link.inventoryItemId,
    );
    listItem.status = "purchased";
    listItem.inventory_purchase_item_id = pi?.id ?? null;
    listItem.selected_purchase_packages =
      pi?.purchase_quantity ?? listItem.selected_purchase_packages;
    listItem.updated_at = now();
  }

  syncListStatus(list);

  writePurchaseListAudit({
    clinic_id: ctx.clinicId,
    actor_user_id: ctx.userId,
    action: "purchase_list.converted_to_purchase",
    target_type: "purchase_list",
    target_id: list.id,
    metadata: {
      purchase_id: result.purchase.id,
      lines: linkMap.length,
      status: list.status,
    },
  });

  return {
    list: maskListCosts(ctx, list),
    purchase: result.purchase,
    purchase_items: result.items,
    consumed_quantity_example: linkMap.map((l) => {
      const item = store.items.find((i) => i.id === l.listItemId)!;
      return {
        inventory_item_id: l.inventoryItemId,
        packages: item.selected_purchase_packages,
        consumption_qty: purchasedQuantityFromPackages(
          item.selected_purchase_packages,
          item.units_per_purchase_unit_snapshot,
        ),
      };
    }),
  };
}

export function markPurchaseListReady(ctx: AuthzContext, purchaseListId: string) {
  assertPermission(ctx, "inventory.purchase_list_update");
  const list = findList(ctx, purchaseListId);
  if (list.status === "cancelled" || list.status === "completed") {
    throw new Error("PURCHASE_LIST_LOCKED");
  }
  list.status = "ready" as PurchaseListStatus;
  list.updated_at = now();
  writePurchaseListAudit({
    clinic_id: ctx.clinicId,
    actor_user_id: ctx.userId,
    action: "purchase_list.updated",
    target_type: "purchase_list",
    target_id: list.id,
    metadata: { status: "ready" },
  });
  return maskListCosts(ctx, list);
}

void roundQty;
