import { NextResponse } from "next/server";
import { getDemoSession } from "@/lib/demo/authz-store";
import {
  calculateInventoryValue,
  createInventoryItem,
  getInventoryItem,
  getLowStockItems,
  listInventoryItems,
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
  if (message === "INVENTORY_ITEM_NOT_FOUND") {
    return NextResponse.json(
      { error: "Não encontramos este item." },
      { status: 404 },
    );
  }
  if (
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
    const id = url.searchParams.get("id");
    if (id) {
      return NextResponse.json({ item: getInventoryItem(session, id) });
    }
    if (url.searchParams.get("low") === "1") {
      return NextResponse.json({ items: getLowStockItems(session) });
    }
    if (url.searchParams.get("value") === "1") {
      return NextResponse.json({ value: calculateInventoryValue(session) });
    }
    return NextResponse.json({
      items: listInventoryItems(session, {
        includeArchived: url.searchParams.get("archived") === "1",
      }),
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
    if (action === "create") {
      return NextResponse.json({
        item: createInventoryItem(session, body.data),
      });
    }
    if (action === "update") {
      return NextResponse.json({
        item: updateInventoryItem(session, body.data),
      });
    }
    return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
  } catch (error) {
    return mapError(error);
  }
}
