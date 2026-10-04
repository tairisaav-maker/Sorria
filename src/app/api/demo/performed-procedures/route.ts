import { NextResponse } from "next/server";
import { getDemoSession } from "@/lib/demo/authz-store";
import { createIncomeTransaction } from "@/services/finance";
import {
  attachFinancialTransaction,
  cancelPerformedProcedure,
  completePerformedProcedure,
  createPerformedProcedure,
  getAppointmentMaterialForecast,
  getPatientDirectCostSummary,
  getPatientProcedureHistory,
  getPerformedProcedure,
  linkClinicalEntry,
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
import { createClinicalEntry } from "@/services/clinical";
import { centsToReais } from "@/lib/money";

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
        const detail = getPerformedProcedure(session, body.data.id);
        const p = detail.procedure;
        const entry = createClinicalEntry(session, {
          patient_id: p.patient_id,
          appointment_id: p.appointment_id,
          procedure_done: `${p.procedure_name_snapshot}${
            p.tooth_number ? ` — Dente ${p.tooth_number}` : ""
          }${p.region ? ` — ${p.region}` : ""}`,
          related_teeth: p.tooth_number ? [p.tooth_number] : [],
          guidance: body.data.guidance ?? "",
          conduct: body.data.conduct ?? "",
          next_step: body.data.next_step ?? "",
        });
        linkClinicalEntry(session, p.id, entry.id);
        return NextResponse.json({ entry, item: getPerformedProcedure(session, p.id) });
      }
      case "add_to_finance": {
        const offer = shouldOfferFinanceCharge(session, body.data.id);
        if (!offer.offer) {
          return NextResponse.json(
            { error: "Não é possível gerar cobrança automática.", reason: offer.reason },
            { status: 400 },
          );
        }
        const detail = getPerformedProcedure(session, body.data.id);
        const p = detail.procedure;
        const tx = createIncomeTransaction(session, {
          type: "income",
          description: `${p.procedure_name_snapshot}${
            p.tooth_number ? ` — Dente ${p.tooth_number}` : ""
          }`,
          patient_id: p.patient_id,
          appointment_id: p.appointment_id,
          gross_amount_reais: centsToReais(p.charged_amount_cents ?? 0),
          discount_amount_reais: 0,
          due_date: new Date().toISOString().slice(0, 10),
          installments_count: 1,
        });
        attachFinancialTransaction(session, p.id, tx.id);
        return NextResponse.json({
          transaction: tx,
          item: getPerformedProcedure(session, p.id),
        });
      }
      default:
        return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
    }
  } catch (error) {
    return mapError(error);
  }
}
