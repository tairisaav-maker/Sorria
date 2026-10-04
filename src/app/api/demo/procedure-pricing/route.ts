import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getDemoSession } from "@/lib/demo/authz-store";
import {
  DEMO_COOKIE_NAME,
  hydrateDemoSessionFromCookie,
} from "@/lib/demo/session";
import {
  analyzePerformedProcedurePricing,
  getProcedurePriceHistory,
  getProcedurePricingSummary,
  simulateDiscount,
  simulatePrice,
  simulatePriceByDesiredResult,
  simulatePriceByMargin,
  updateProcedureDefaultPrice,
} from "@/services/procedure-pricing";
import { getPricingProcedureDetail, getPricingReport } from "@/services/reports/pricing";
import type { ReportPeriodPreset } from "@/types/reports";

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
    const resource = url.searchParams.get("resource") ?? "summary";

    if (resource === "summary") {
      const procedureId = url.searchParams.get("procedureId") ?? "";
      return NextResponse.json(getProcedurePricingSummary(auth, procedureId));
    }
    if (resource === "performed") {
      const id = url.searchParams.get("id") ?? "";
      return NextResponse.json(analyzePerformedProcedurePricing(auth, id));
    }
    if (resource === "history") {
      const procedureId = url.searchParams.get("procedureId") ?? "";
      return NextResponse.json({
        history: getProcedurePriceHistory(auth, procedureId),
      });
    }
    if (resource === "report") {
      const preset = (url.searchParams.get("preset") ??
        "month") as ReportPeriodPreset;
      return NextResponse.json(
        getPricingReport(auth, {
          preset,
          customStart: url.searchParams.get("start") ?? undefined,
          customEnd: url.searchParams.get("end") ?? undefined,
        }),
      );
    }
    if (resource === "procedure-detail") {
      const procedureId = url.searchParams.get("procedureId") ?? "";
      const preset = (url.searchParams.get("preset") ??
        "month") as ReportPeriodPreset;
      return NextResponse.json(
        getPricingProcedureDetail(
          auth,
          {
            preset,
            customStart: url.searchParams.get("start") ?? undefined,
            customEnd: url.searchParams.get("end") ?? undefined,
          },
          procedureId,
        ),
      );
    }
    return NextResponse.json({ error: "Recurso inválido" }, { status: 400 });
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

    if (action === "simulate_price") {
      return NextResponse.json(
        simulatePrice(auth, {
          operational_cost_cents: Number(body.operational_cost_cents),
          simulated_price_cents: Number(body.simulated_price_cents),
        }),
      );
    }
    if (action === "simulate_margin") {
      return NextResponse.json(
        simulatePriceByMargin(auth, {
          operational_cost_cents: Number(body.operational_cost_cents),
          desired_margin_percent: Number(body.desired_margin_percent),
        }),
      );
    }
    if (action === "simulate_result") {
      return NextResponse.json(
        simulatePriceByDesiredResult(auth, {
          operational_cost_cents: Number(body.operational_cost_cents),
          desired_result_cents: Number(body.desired_result_cents),
        }),
      );
    }
    if (action === "simulate_discount") {
      return NextResponse.json(
        simulateDiscount(auth, {
          standard_price_cents: Number(body.standard_price_cents),
          operational_cost_cents: Number(body.operational_cost_cents),
          discount_percent:
            body.discount_percent != null
              ? Number(body.discount_percent)
              : null,
          discount_amount_cents:
            body.discount_amount_cents != null
              ? Number(body.discount_amount_cents)
              : null,
        }),
      );
    }
    if (action === "update_price") {
      return NextResponse.json(
        updateProcedureDefaultPrice(auth, {
          procedure_id: body.procedure_id,
          new_price_reais: Number(body.new_price_reais),
          confirm: true,
        }),
      );
    }
    return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
  } catch (e) {
    return mapError(e);
  }
}
