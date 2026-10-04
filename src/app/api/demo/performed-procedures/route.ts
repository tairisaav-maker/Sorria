import { NextResponse } from "next/server";
import { getDemoSession } from "@/lib/demo/authz-store";
import {
  cancelPerformedProcedure,
  completePerformedProcedure,
  createPerformedProcedure,
  getAppointmentMaterialForecast,
  getPatientDirectCostSummary,
  getPatientProcedureHistory,
  getPerformedProcedure,
  listAppointmentPerformedProcedures,
  shouldOfferFinanceCharge,
  startPerformedProcedure,
  updatePerformedProcedure,
} from "@/services/performed-procedures";
import {
  addExtraConsumedMaterial,
  confirmProcedureConsumption,
  correctProcedureConsumption,
  getConsumptionDeviations,
  updateActualConsumption,
} from "@/services/procedure-consumption";
import {
  createEvolutionFromPerformedProcedure,
  createFinancialChargeFromPerformedProcedure,
  getAppointmentCompletionSummary,
  getProcedureFinanceBreakdown,
} from "@/services/patient-procedure-finance";

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
    message === "PERFORMED_PROCEDURE_NOT_FOUND" ||
    message === "PATIENT_NOT_FOUND" ||
    message === "PROCEDURE_NOT_FOUND" ||
    message === "APPOINTMENT_NOT_FOUND" ||
    message === "CONSUMPTION_LINE_NOT_FOUND"
  ) {
    return NextResponse.json(
      { error: "Não encontramos este registro." },
      { status: 404 },
    );
  }
  if (message === "INSUFFICIENT_STOCK") {
    return NextResponse.json(
      {
        error:
          "Atenção: o estoque registrado é inferior ao consumo. Confirme para continuar.",
        code: "INSUFFICIENT_STOCK",
      },
      { status: 400 },
    );
  }
  if (message === "CONSUMPTION_ALREADY_CONFIRMED") {
    return NextResponse.json(
      { error: "Consumo já confirmado. Use correção se necessário." },
      { status: 400 },
    );
  }
  if (message === "CONSUMPTION_NOT_CONFIRMED") {
    return NextResponse.json(
      { error: "Confirme o consumo antes de concluir." },
      { status: 400 },
    );
  }
  if (message === "CROSS_CLINIC_REFERENCE") {
    return NextResponse.json(
      { error: "Referência entre clínicas não permitida." },
      { status: 400 },
    );
  }
  return NextResponse.json(
    { error: message.startsWith("INVALID") || message.includes(" ") ? message : "Não foi possível concluir esta ação." },
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

    if (view === "detail" && id) {
      const detail = getPerformedProcedure(session, id);
      return NextResponse.json({
        ...detail,
        deviations: getConsumptionDeviations(session, id),
        financeOffer: shouldOfferFinanceCharge(session, id),
        financeBreakdown: getProcedureFinanceBreakdown(session, id),
      });
    }
    if (view === "patient") {
      const patientId = url.searchParams.get("patientId") ?? "";
      return NextResponse.json({
        items: getPatientProcedureHistory(session, patientId),
        summary: getPatientDirectCostSummary(session, patientId),
      });
    }
    if (view === "appointment") {
      const appointmentId = url.searchParams.get("appointmentId") ?? "";
      return NextResponse.json({
        items: listAppointmentPerformedProcedures(session, appointmentId),
        forecast: getAppointmentMaterialForecast(session, appointmentId),
        completion: getAppointmentCompletionSummary(session, appointmentId),
      });
    }
    return NextResponse.json({ error: "view inválida" }, { status: 400 });
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
          item: createPerformedProcedure(session, body.data),
        });
      case "update":
        return NextResponse.json({
          item: updatePerformedProcedure(session, body.data),
        });
      case "start":
        return NextResponse.json({
          item: startPerformedProcedure(session, body.data.id),
        });
      case "complete":
        return NextResponse.json({
          item: completePerformedProcedure(session, body.data.id),
        });
      case "cancel":
        return NextResponse.json({
          item: cancelPerformedProcedure(session, body.data),
        });
      case "update_consumption":
        return NextResponse.json(
          updateActualConsumption(session, body.data),
        );
      case "add_extra":
        return NextResponse.json(addExtraConsumedMaterial(session, body.data));
      case "confirm_consumption":
        return NextResponse.json(
          confirmProcedureConsumption(session, body.data),
        );
      case "correct_consumption":
        return NextResponse.json(
          correctProcedureConsumption(session, body.data),
        );
      case "register_evolution": {
        const entry = createEvolutionFromPerformedProcedure(
          session,
          body.data.id,
          {
            guidance: body.data.guidance ?? "",
            conduct: body.data.conduct ?? "",
            next_step: body.data.next_step ?? "",
          },
        );
        return NextResponse.json({
          entry,
          item: getPerformedProcedure(session, body.data.id),
        });
      }
      case "add_to_finance": {
        const offer = shouldOfferFinanceCharge(session, body.data.id);
        if (!offer.offer) {
          return NextResponse.json(
            {
              error:
                offer.reason === "plan_already_billed"
                  ? "Incluído no plano de tratamento"
                  : "Não é possível gerar cobrança automática.",
              reason: offer.reason,
            },
            { status: 400 },
          );
        }
        const result = createFinancialChargeFromPerformedProcedure(session, {
          performed_procedure_id: body.data.id,
        });
        return NextResponse.json({
          transaction: result.transaction,
          link: result.link,
          breakdown: result.breakdown,
          item: getPerformedProcedure(session, body.data.id),
        });
      }
      default:
        return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
    }
  } catch (error) {
    return mapError(error);
  }
}
