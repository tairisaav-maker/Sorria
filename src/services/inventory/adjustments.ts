import type { AuthzContext } from "@/lib/authz/can";
import { assertPermission } from "@/lib/authz/guards";
import {
  getInventoryStore,
  writeInventoryAudit,
} from "@/lib/demo/inventory-store";
import { reaisToCents } from "@/lib/money";
import {
  adjustInventorySchema,
  initialStockSchema,
  lossSchema,
  registerExpirationSchema,
  registerReturnSchema,
} from "@/lib/validations/inventory";
import { applyInventoryMovement } from "@/services/inventory/movements";
import { ADJUSTMENT_REASON_LABELS } from "@/types/inventory";

function findItem(ctx: AuthzContext, id: string) {
  const item = getInventoryStore().inventoryItems.find((i) => i.id === id);
  if (!item || item.clinic_id !== ctx.clinicId) {
    throw new Error("INVENTORY_ITEM_NOT_FOUND");
  }
  return item;
}

/** Estoque inicial (não é compra). */
export function registerInitialStock(ctx: AuthzContext, input: unknown) {
  assertPermission(ctx, "inventory.adjust");
  const data = initialStockSchema.parse(input);
  const item = findItem(ctx, data.inventory_item_id);

  if (item.current_quantity !== 0) {
    // Permite complementar só se explicitamente allow_when_nonzero
    if (!data.allow_when_nonzero) {
      throw new Error("ITEM_ALREADY_HAS_STOCK");
    }
  }

  const unitCostCents = reaisToCents(data.unit_cost_reais);
  const movement = applyInventoryMovement(ctx, {
    inventory_item_id: item.id,
    movement_type: "initial_balance",
    quantity_delta: data.quantity,
    unit_cost_snapshot_cents: unitCostCents,
    update_average_cost: true,
    reason: data.notes ?? "Estoque inicial",
    allow_negative: false,
  });

  writeInventoryAudit({
    clinic_id: ctx.clinicId,
    actor_user_id: ctx.userId,
    action: "inventory.initial_balance_created",
    target_type: "inventory_item",
    target_id: item.id,
    metadata: { quantity: data.quantity, unit_cost_cents: unitCostCents },
  });

  return { item: findItem(ctx, item.id), movement };
}

/**
 * Ajuste por contagem: informa quantidade contada → calcula delta.
 * allow_negative: confirmação explícita do cliente.
 */
export function adjustInventory(ctx: AuthzContext, input: unknown) {
  assertPermission(ctx, "inventory.adjust");
  const data = adjustInventorySchema.parse(input);
  const item = findItem(ctx, data.inventory_item_id);
  const delta = data.counted_quantity - item.current_quantity;
  if (delta === 0) {
    throw new Error("NO_ADJUSTMENT_NEEDED");
  }

  const willBeNegative = item.current_quantity + delta < 0;
  if (willBeNegative && !data.confirm_negative) {
    throw new Error("NEGATIVE_STOCK_CONFIRMATION_REQUIRED");
  }

  const reasonLabel =
    ADJUSTMENT_REASON_LABELS[data.reason] +
    (data.notes ? ` — ${data.notes}` : "");

  const movementType =
    data.reason === "perda" || data.reason === "quebra"
      ? "loss"
      : data.reason === "vencimento"
        ? "expiration"
        : data.reason === "correcao"
          ? "correction"
          : "manual_adjustment";

  const movement = applyInventoryMovement(ctx, {
    inventory_item_id: item.id,
    movement_type: movementType,
    quantity_delta: delta,
    unit_cost_snapshot_cents: item.average_unit_cost_cents,
    update_average_cost: false,
    reason: reasonLabel,
    allow_negative: Boolean(data.confirm_negative),
  });

  writeInventoryAudit({
    clinic_id: ctx.clinicId,
    actor_user_id: ctx.userId,
    action: "inventory.adjusted",
    target_type: "inventory_item",
    target_id: item.id,
    metadata: {
      delta,
      counted: data.counted_quantity,
      reason: data.reason,
      negative: willBeNegative,
    },
  });

  return { item: findItem(ctx, item.id), movement };
}

export function registerLoss(ctx: AuthzContext, input: unknown) {
  assertPermission(ctx, "inventory.adjust");
  const data = lossSchema.parse(input);
  findItem(ctx, data.inventory_item_id);
  const movement = applyInventoryMovement(ctx, {
    inventory_item_id: data.inventory_item_id,
    movement_type: "loss",
    quantity_delta: -Math.abs(data.quantity),
    reason: data.notes ?? "Perda",
    allow_negative: Boolean(data.confirm_negative),
  });
  writeInventoryAudit({
    clinic_id: ctx.clinicId,
    actor_user_id: ctx.userId,
    action: "inventory.loss_recorded",
    target_type: "inventory_item",
    target_id: data.inventory_item_id,
    metadata: { quantity: data.quantity },
  });
  return movement;
}

export function registerExpiration(ctx: AuthzContext, input: unknown) {
  assertPermission(ctx, "inventory.adjust");
  const data = registerExpirationSchema.parse(input);
  findItem(ctx, data.inventory_item_id);
  const store = getInventoryStore();
  const movement = applyInventoryMovement(ctx, {
    inventory_item_id: data.inventory_item_id,
    movement_type: "expiration",
    quantity_delta: -Math.abs(data.quantity),
    reason: data.notes ?? "Descarte por vencimento",
    allow_negative: Boolean(data.confirm_negative),
    reference_type: data.lot_id ? "inventory_lot" : null,
    reference_id: data.lot_id ?? null,
  });
  if (data.lot_id) {
    const lot = store.lots.find(
      (l) => l.id === data.lot_id && l.clinic_id === ctx.clinicId,
    );
    if (lot) {
      lot.quantity_remaining = Math.max(
        0,
        lot.quantity_remaining - Math.abs(data.quantity),
      );
    }
  }
  writeInventoryAudit({
    clinic_id: ctx.clinicId,
    actor_user_id: ctx.userId,
    action: "inventory.expiration_recorded",
    target_type: "inventory_item",
    target_id: data.inventory_item_id,
    metadata: { quantity: data.quantity, lot_id: data.lot_id },
  });
  return movement;
}

export function registerReturn(ctx: AuthzContext, input: unknown) {
  assertPermission(ctx, "inventory.adjust");
  const data = registerReturnSchema.parse(input);
  findItem(ctx, data.inventory_item_id);
  const movement = applyInventoryMovement(ctx, {
    inventory_item_id: data.inventory_item_id,
    movement_type: "return",
    quantity_delta: -Math.abs(data.quantity),
    reason: data.notes ?? "Devolução ao fornecedor",
    allow_negative: Boolean(data.confirm_negative),
  });
  writeInventoryAudit({
    clinic_id: ctx.clinicId,
    actor_user_id: ctx.userId,
    action: "inventory.return_recorded",
    target_type: "inventory_item",
    target_id: data.inventory_item_id,
    metadata: { quantity: data.quantity },
  });
  return movement;
}

/** Correção explícita (delta informado, não contagem). */
export function registerCorrection(
  ctx: AuthzContext,
  input: {
    inventory_item_id: string;
    quantity_delta: number;
    reason: string;
    confirm_negative?: boolean;
  },
) {
  assertPermission(ctx, "inventory.adjust");
  findItem(ctx, input.inventory_item_id);
  const movement = applyInventoryMovement(ctx, {
    inventory_item_id: input.inventory_item_id,
    movement_type: "correction",
    quantity_delta: input.quantity_delta,
    reason: input.reason,
    allow_negative: Boolean(input.confirm_negative),
  });
  writeInventoryAudit({
    clinic_id: ctx.clinicId,
    actor_user_id: ctx.userId,
    action: "inventory.corrected",
    target_type: "inventory_item",
    target_id: input.inventory_item_id,
    metadata: { quantity_delta: input.quantity_delta },
  });
  return movement;
}
