import { NextResponse } from "next/server";
import { can } from "@/lib/authz/can";
import { getDemoSession } from "@/lib/demo/authz-store";
import {
  calculateAppointmentMaterialForecast,
  forecastMaterialNeeds,
  getPatientUpcomingMaterialNeeds,
  getUpcomingStockRisks,
  listAppointmentForecastIndicators,
} from "@/services/inventory/forecast";

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
  if (message === "INVALID_DATE_RANGE") {
    return NextResponse.json({ error: "Período inválido." }, { status: 400 });
  }
  if (
    message === "APPOINTMENT_NOT_FOUND" ||
    message === "PATIENT_NOT_FOUND"
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
  const blocked = ensureDemo();
  if (blocked) return blocked;
  try {
    const url = new URL(request.url);
    const session = ctx();
    const view = url.searchParams.get("view") ?? "period";

    if (view === "risks") {
      const days = Number(url.searchParams.get("days") ?? "7");
      return NextResponse.json({
        forecast: getUpcomingStockRisks(session, days),
        canViewCosts:
          can(session, "inventory.forecast_cost_view").allowed ||
          can(session, "procedure_costs.view").allowed,
      });
    }
    if (view === "appointment") {
      const appointmentId = url.searchParams.get("appointmentId") ?? "";
      return NextResponse.json({
        forecast: calculateAppointmentMaterialForecast(session, appointmentId),
      });
    }
    if (view === "patient") {
      const patientId = url.searchParams.get("patientId") ?? "";
      return NextResponse.json(
        getPatientUpcomingMaterialNeeds(session, patientId),
      );
    }
    if (view === "indicators") {
      const ids = (url.searchParams.get("ids") ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      return NextResponse.json({
        indicators: listAppointmentForecastIndicators(session, ids),
      });
    }

    const start = url.searchParams.get("start") ?? "";
    const end = url.searchParams.get("end") ?? "";
    const professionalId = url.searchParams.get("professionalId");
    const forecast = forecastMaterialNeeds(session, {
      start_date: start,
      end_date: end,
      professional_id: professionalId,
    });
    return NextResponse.json({
      forecast,
      canViewCosts:
        can(session, "inventory.forecast_cost_view").allowed ||
        can(session, "procedure_costs.view").allowed,
    });
  } catch (error) {
    return mapError(error);
  }
}
