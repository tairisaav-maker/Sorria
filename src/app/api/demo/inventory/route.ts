import { NextResponse } from "next/server";
import { getDemoSession } from "@/lib/demo/authz-store";
import {
  adjustInventory,
  calculateInventoryValue,
  cancelInventoryPurchase,
  canViewInventoryCosts,
  createInventoryItem,
  createInventoryPurchase,
  getEmptyStockItems,
  getExpiringInventoryItems,
  getInventoryDashboard,
  getInventoryItem,
  getInventoryMovements,
  getInventoryPurchase,
  getItemLots,
  getLowStockItems,
  getProceduresUsingItem,
  listInventoryItemsWithStatus,
  listInventoryPurchases,
  registerCorrection,
  registerExpiration,
  registerInitialStock,
  registerLoss,
  registerReturn,
  updateInventoryItem,
} from "@/services/inventory";

function ensureDemo() {
  if (process.env.NEXT_PUBLIC_DEMO_MODE !== "true") {
    return NextResponse.json({ error: "Demo mode only" }, { status: 403 });
  }
  return null;
}

function ctx() {
  const s = getDemoSession();
  return { userId: s.userId, clinicId: s.clinicId };
}

function mapError(error: unknown) {
  const message = error instanceof Error ? error.message : "Erro";
  if (message === "AUTHORIZATION_DENIED") {
    return NextResponse.json(
      { error: "Você não tem permissão para esta ação." },
      { status: 403 },
    );
  }
  if (
    message === "INVENTORY_ITEM_NOT_FOUND" ||
    message === "PURCHASE_NOT_FOUND"
  ) {
    return NextResponse.json(
      { error: "Não encontramos este registro." },
      { status: 404 },
    );
  }
  if (message === "NEGATIVE_STOCK_CONFIRMATION_REQUIRED") {
    return NextResponse.json(
      {
        error: "Este ajuste deixará o estoque negativo.",
        code: "NEGATIVE_STOCK_CONFIRMATION_REQUIRED",
      },
      { status: 400 },
    );
  }
  if (
    message === "PURCHASE_ALREADY_CANCELLED" ||
    message === "ITEM_ALREADY_HAS_STOCK" ||
    message === "NO_ADJUSTMENT_NEEDED" ||
    message === "CROSS_CLINIC_REFERENCE" ||
    message.includes("unidade") ||
    message.includes("units_per") ||
    message.includes("Conversão")
  ) {
    return NextResponse.json({ error: message }, { status: 400 });
  }
  return NextResponse.json(
    { error: "Não foi possível concluir esta ação." },
    { status: 400 },
  );
}

export async function GET(request: Request) {
  const blocked = ensureDemo();
  if (blocked) return blocked;
  try {
    const url = new URL(request.url);
    const session = ctx();
    const view = url.searchParams.get("view");
    const id = url.searchParams.get("id");

    if (view === "dashboard") {
      return NextResponse.json({ dashboard: getInventoryDashboard(session) });
    }
    if (view === "purchases") {
      return NextResponse.json({ items: listInventoryPurchases(session) });
    }
    if (view === "purchase" && id) {
      return NextResponse.json(getInventoryPurchase(session, id));
    }
    if (view === "movements") {
      return NextResponse.json({
        items: getInventoryMovements(session, {
          inventoryItemId: url.searchParams.get("itemId") ?? undefined,
          movementType: (url.searchParams.get("type") as never) ?? undefined,
          from: url.searchParams.get("from") ?? undefined,
          to: url.searchParams.get("to") ?? undefined,
        }),
      });
    }
    if (view === "item" && id) {
      const item = getInventoryItem(session, id);
      const showCost = canViewInventoryCosts(session);
      return NextResponse.json({
        item: {
          ...item,
          average_unit_cost_cents: showCost
            ? item.average_unit_cost_cents
            : null,
          stock_value_cents: showCost
            ? Math.round(item.current_quantity * item.average_unit_cost_cents)
            : null,
        },
        movements: getInventoryMovements(session, { inventoryItemId: id }),
        lots: getItemLots(session, id),
        procedures: getProceduresUsingItem(session, id),
        canViewCosts: showCost,
      });
    }
    if (url.searchParams.get("low") === "1") {
      return NextResponse.json({ items: getLowStockItems(session) });
    }
    if (url.searchParams.get("empty") === "1") {
      return NextResponse.json({ items: getEmptyStockItems(session) });
    }
    if (url.searchParams.get("expiring") === "1") {
      const days = Number(url.searchParams.get("days") ?? 30) as 30 | 60 | 90;
      return NextResponse.json({
        items: getExpiringInventoryItems(session, days),
      });
    }
    if (url.searchParams.get("value") === "1") {
      if (!canViewInventoryCosts(session)) {
        return NextResponse.json({ value: null });
      }
      return NextResponse.json({ value: calculateInventoryValue(session) });
    }
    return NextResponse.json({
      items: listInventoryItemsWithStatus(session),
      canViewCosts: canViewInventoryCosts(session),
    });
  } catch (error) {
    return mapError(error);
  }
}

export async function POST(request: Request) {
  const blocked = ensureDemo();
  if (blocked) return blocked;
  try {
    const body = await request.json();
    const session = ctx();
    const action = body.action as string;

    switch (action) {
      case "create":
        return NextResponse.json({
          item: createInventoryItem(session, body.data),
        });
      case "update":
        return NextResponse.json({
          item: updateInventoryItem(session, body.data),
        });
      case "purchase_create":
        return NextResponse.json(createInventoryPurchase(session, body.data));
      case "purchase_cancel":
        return NextResponse.json({
          purchase: cancelInventoryPurchase(session, body.data),
        });
      case "initial_stock":
        return NextResponse.json(registerInitialStock(session, body.data));
      case "adjust":
        return NextResponse.json(adjustInventory(session, body.data));
      case "loss":
        return NextResponse.json({
          movement: registerLoss(session, body.data),
        });
      case "expiration":
        return NextResponse.json({
          movement: registerExpiration(session, body.data),
        });
      case "return":
        return NextResponse.json({
          movement: registerReturn(session, body.data),
        });
      case "correction":
        return NextResponse.json({
          movement: registerCorrection(session, body.data),
        });
      default:
        return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
    }
  } catch (error) {
    return mapError(error);
  }
}
