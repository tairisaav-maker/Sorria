import { NextResponse } from "next/server";
import { getDemoSession } from "@/lib/demo/authz-store";
import {
  addPlannedProcedureToAppointment,
  convertPlannedProceduresToPerformedProcedures,
  getAppointmentPlannedProcedures,
  removePlannedProcedure,
  updatePlannedProcedure,
} from "@/services/appointment-planned-procedures";
import {
  calculateAppointmentMaterialForecast,
  getAppointmentForecastIndicator,
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
  if (
    message === "PLANNED_PROCEDURE_NOT_FOUND" ||
    message === "APPOINTMENT_NOT_FOUND" ||
    message === "PROCEDURE_NOT_FOUND" ||
    message === "PATIENT_NOT_FOUND"
  ) {
    return NextResponse.json(
      { error: "Não encontramos este registro." },
      { status: 404 },
    );
  }
  if (message === "CROSS_CLINIC_REFERENCE") {
    return NextResponse.json(
      { error: "Referência entre clínicas não permitida." },
      { status: 400 },
    );
  }
  return NextResponse.json(
    {
      error:
        message.startsWith("INVALID") || message.includes(" ")
          ? message
          : "Não foi possível concluir esta ação.",
    },
    { status: 400 },
  );
}

export async function GET(request: Request) {
  const blocked = ensureDemo();
  if (blocked) return blocked;
  try {
    const url = new URL(request.url);
    const session = ctx();
    const appointmentId = url.searchParams.get("appointmentId") ?? "";
    const view = url.searchParams.get("view");

    if (view === "forecast" && appointmentId) {
      return NextResponse.json({
        forecast: calculateAppointmentMaterialForecast(session, appointmentId),
      });
    }
    if (view === "indicator" && appointmentId) {
      return NextResponse.json({
        indicator: getAppointmentForecastIndicator(session, appointmentId),
      });
    }
    if (!appointmentId) {
      return NextResponse.json(
        { error: "appointmentId obrigatório" },
        { status: 400 },
      );
    }
    return NextResponse.json({
      items: getAppointmentPlannedProcedures(session, appointmentId),
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
      case "add":
        return NextResponse.json({
          item: addPlannedProcedureToAppointment(session, body.data),
        });
      case "update":
        return NextResponse.json({
          item: updatePlannedProcedure(session, body.data),
        });
      case "remove":
        return NextResponse.json({
          item: removePlannedProcedure(session, body.data),
        });
      case "convert":
        return NextResponse.json(
          convertPlannedProceduresToPerformedProcedures(session, body.data),
        );
      default:
        return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
    }
  } catch (error) {
    return mapError(error);
  }
}
