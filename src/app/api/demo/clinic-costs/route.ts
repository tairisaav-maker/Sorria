import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getDemoSession } from "@/lib/demo/authz-store";
import {
  DEMO_COOKIE_NAME,
  hydrateDemoSessionFromCookie,
} from "@/lib/demo/session";
import {
  createRecurringExpenseTemplate,
  getClinicCostSettings,
  getMonthlyOperatingExpenses,
  listRecurringExpenseTemplates,
  updateClinicCostSettings,
} from "@/services/clinic-costs";
import {
  calculateHourlyOperatingCost,
  simulateHourlyCost,
  simulateProcedurePrice,
} from "@/services/operational-costs";
import {
  getStandardOperationalEstimate,
} from "@/services/procedure-operational-costs";

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
    const resource = url.searchParams.get("resource") ?? "dashboard";
    const month =
      url.searchParams.get("month") ?? new Date().toISOString().slice(0, 7);

    if (resource === "settings") {
      return NextResponse.json({ settings: getClinicCostSettings(auth) });
    }
    if (resource === "expenses") {
      return NextResponse.json(getMonthlyOperatingExpenses(auth, month));
    }
    if (resource === "hourly") {
      return NextResponse.json(
        calculateHourlyOperatingCost(auth, month, { persist: false }),
      );
    }
    if (resource === "templates") {
      return NextResponse.json({
        templates: listRecurringExpenseTemplates(auth),
      });
    }
    if (resource === "procedure-estimate") {
      const procedureId = url.searchParams.get("procedureId") ?? "";
      return NextResponse.json(
        getStandardOperationalEstimate(auth, procedureId),
      );
    }

    const settings = getClinicCostSettings(auth);
    const expenses = getMonthlyOperatingExpenses(auth, month);
    const hourly = calculateHourlyOperatingCost(auth, month, {
      persist: false,
    });
    return NextResponse.json({
      settings,
      expenses,
      hourly,
      templates: listRecurringExpenseTemplates(auth),
    });
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

    if (action === "update_settings") {
      return NextResponse.json({
        settings: updateClinicCostSettings(auth, body),
      });
    }
    if (action === "create_template") {
      return NextResponse.json({
        template: createRecurringExpenseTemplate(auth, body),
      });
    }
    if (action === "simulate_hourly") {
      return NextResponse.json(
        simulateHourlyCost(auth, {
          reference_month: String(
            body.month ?? new Date().toISOString().slice(0, 7),
          ),
          productive_hours: Number(body.productive_hours),
        }),
      );
    }
    if (action === "simulate_price") {
      return NextResponse.json(
        simulateProcedurePrice(auth, {
          operational_cost_cents: Number(body.operational_cost_cents),
          desired_margin_percent:
            body.desired_margin_percent != null
              ? Number(body.desired_margin_percent)
              : undefined,
          simulated_price_cents:
            body.simulated_price_cents != null
              ? Number(body.simulated_price_cents)
              : undefined,
        }),
      );
    }
    if (action === "persist_hourly") {
      return NextResponse.json(
        calculateHourlyOperatingCost(
          auth,
          String(body.month ?? new Date().toISOString().slice(0, 7)),
          { persist: true },
        ),
      );
    }
    return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
  } catch (e) {
    return mapError(e);
  }
}
