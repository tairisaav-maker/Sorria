import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getDemoSession } from "@/lib/demo/authz-store";
import {
  DEMO_COOKIE_NAME,
  hydrateDemoSessionFromCookie,
} from "@/lib/demo/session";
import {
  calculateReplenishmentNeeds,
  getUpcomingReplenishmentBrief,
} from "@/services/inventory/replenishment";
import {
  cancelPurchaseList,
  createPurchaseFromPurchaseList,
  createPurchaseList,
  getOpenPurchaseLists,
  getPurchaseList,
  listPurchaseLists,
  refreshPurchaseList,
  updatePurchaseListItem,
} from "@/services/inventory/purchase-lists";
import type { ReplenishmentHorizon } from "@/types/replenishment";

async function ctx() {
  const jar = await cookies();
  hydrateDemoSessionFromCookie(jar.get(DEMO_COOKIE_NAME)?.value);
  const s = getDemoSession();
  return { userId: s.userId, clinicId: s.clinicId };
}

function mapError(error: unknown) {
  const message = error instanceof Error ? error.message : "Erro";
  if (message.includes("PERMISSION") || message.includes("AUTHORIZATION")) {
    return NextResponse.json(
      { error: "Você não tem permissão para esta ação." },
      { status: 403 },
    );
  }
  if (
    message.includes("NOT_FOUND") ||
    message === "CROSS_CLINIC_REFERENCE"
  ) {
    return NextResponse.json(
      { error: "Não encontramos este registro." },
      { status: 404 },
    );
  }
  return NextResponse.json(
    { error: "Não foi possível concluir esta ação." },
    { status: 400 },
  );
}

export async function GET(request: Request) {
  if (process.env.NEXT_PUBLIC_DEMO_MODE !== "true") {
    return NextResponse.json({ error: "Demo only" }, { status: 403 });
  }
  try {
    const auth = await ctx();
    const url = new URL(request.url);
    const resource = url.searchParams.get("resource") ?? "needs";

    if (resource === "brief") {
      return NextResponse.json({
        brief: getUpcomingReplenishmentBrief(auth, 7),
      });
    }
    if (resource === "lists") {
      return NextResponse.json({ lists: listPurchaseLists(auth) });
    }
    if (resource === "open-lists") {
      return NextResponse.json({ lists: getOpenPurchaseLists(auth) });
    }
    if (resource === "list") {
      const id = url.searchParams.get("id") ?? "";
      return NextResponse.json(getPurchaseList(auth, id));
    }

    const horizon = (url.searchParams.get("horizon") ??
      "7d") as ReplenishmentHorizon;
    return NextResponse.json(
      calculateReplenishmentNeeds(auth, {
        horizon,
        start_date: url.searchParams.get("from"),
        end_date: url.searchParams.get("to"),
        professional_id: url.searchParams.get("professionalId"),
      }),
    );
  } catch (e) {
    return mapError(e);
  }
}

export async function POST(request: Request) {
  if (process.env.NEXT_PUBLIC_DEMO_MODE !== "true") {
    return NextResponse.json({ error: "Demo only" }, { status: 403 });
  }
  try {
    const auth = await ctx();
    const body = (await request.json()) as Record<string, unknown>;
    const action = String(body.action ?? "");

    if (action === "create_list") {
      return NextResponse.json(
        createPurchaseList(auth, {
          name: body.name as string | undefined,
          horizon: body.horizon as ReplenishmentHorizon | undefined,
          start_date: body.from as string | null | undefined,
          end_date: body.to as string | null | undefined,
          item_ids: body.item_ids as string[] | null | undefined,
          package_overrides: body.package_overrides as
            | Record<string, number>
            | undefined,
        }),
      );
    }
    if (action === "update_item") {
      return NextResponse.json(
        updatePurchaseListItem(auth, {
          purchase_list_item_id: String(body.purchase_list_item_id ?? ""),
          selected: body.selected as boolean | undefined,
          selected_purchase_packages: body.selected_purchase_packages as
            | number
            | undefined,
          notes: body.notes as string | null | undefined,
        }),
      );
    }
    if (action === "refresh_list") {
      return NextResponse.json(
        refreshPurchaseList(auth, String(body.purchase_list_id ?? "")),
      );
    }
    if (action === "cancel_list") {
      return NextResponse.json(
        cancelPurchaseList(auth, String(body.purchase_list_id ?? "")),
      );
    }
    if (action === "convert_to_purchase") {
      return NextResponse.json(
        createPurchaseFromPurchaseList(auth, {
          purchase_list_id: String(body.purchase_list_id ?? ""),
          purchase_date: String(body.purchase_date ?? ""),
          supplier_name: (body.supplier_name as string | null) ?? null,
          invoice_number: (body.invoice_number as string | null) ?? null,
          notes: (body.notes as string | null) ?? null,
          lines: (body.lines as Array<{
            purchase_list_item_id: string;
            purchase_quantity: number;
            total_cost_reais: number;
          }>) ?? [],
        }),
      );
    }
    return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
  } catch (e) {
    return mapError(e);
  }
}
