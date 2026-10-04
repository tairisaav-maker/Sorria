import { NextResponse } from "next/server";
import { getDemoSession } from "@/lib/demo/authz-store";
import {
  allocateFinancialTransactionToProcedures,
  createEvolutionFromPerformedProcedure,
  createFinancialChargeFromPerformedProcedure,
  getAppointmentCompletionSummary,
  getProcedureFinanceBreakdown,
  linkClinicalEntryToPerformedProcedure,
  linkPerformedProcedureToFinancialTransaction,
  linkPerformedProcedureToTreatmentItem,
  markPerformedProcedureNoCharge,
  setPerformedProcedureChargedAmount,
} from "@/services/patient-procedure-finance";
import {
  getPatientOperationalFinancialSummary,
  getPatientProcedureSummary,
  getTodayOperationalKpis,
} from "@/services/patient-summary";

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
    message === "FINANCE_NOT_FOUND" ||
    message === "PATIENT_NOT_FOUND" ||
    message === "CLINICAL_ENTRY_NOT_FOUND" ||
    message === "TREATMENT_ITEM_NOT_FOUND"
  ) {
    return NextResponse.json(
      { error: "Não encontramos este registro." },
      { status: 404 },
    );
  }
  if (
    message === "INCLUDED_IN_PLAN" ||
    message === "ALREADY_LINKED_TO_FINANCE" ||
    message === "PROCEDURE_MARKED_NO_CHARGE" ||
    message === "CROSS_PATIENT_REFERENCE" ||
    message === "CROSS_CLINIC_REFERENCE" ||
    message === "ALLOCATION_EXCEEDS_TRANSACTION" ||
    message === "HAS_ACTIVE_FINANCIAL_LINKS"
  ) {
    return NextResponse.json({ error: message }, { status: 400 });
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
    const view = url.searchParams.get("view");

    if (view === "breakdown") {
      const id = url.searchParams.get("id") ?? "";
      return NextResponse.json({
        breakdown: getProcedureFinanceBreakdown(session, id),
      });
    }
    if (view === "patient-procedures") {
      const patientId = url.searchParams.get("patientId") ?? "";
      return NextResponse.json({
        items: getPatientProcedureSummary(session, patientId),
        summary: getPatientOperationalFinancialSummary(session, patientId),
      });
    }
    if (view === "patient-summary") {
      const patientId = url.searchParams.get("patientId") ?? "";
      return NextResponse.json(
        getPatientOperationalFinancialSummary(session, patientId),
      );
    }
    if (view === "appointment-summary") {
      const appointmentId = url.searchParams.get("appointmentId") ?? "";
      return NextResponse.json({
        summary: getAppointmentCompletionSummary(session, appointmentId),
      });
    }
    if (view === "today-kpis") {
      return NextResponse.json({ kpis: getTodayOperationalKpis(session) });
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
      case "set_charged":
        return NextResponse.json({
          breakdown: setPerformedProcedureChargedAmount(session, body.data),
        });
      case "no_charge":
        return NextResponse.json({
          breakdown: markPerformedProcedureNoCharge(session, body.data),
        });
      case "create_charge":
        return NextResponse.json(
          createFinancialChargeFromPerformedProcedure(session, body.data),
        );
      case "link_transaction":
        return NextResponse.json({
          link: linkPerformedProcedureToFinancialTransaction(session, body.data),
        });
      case "allocate":
        return NextResponse.json(
          allocateFinancialTransactionToProcedures(session, body.data),
        );
      case "link_treatment":
        return NextResponse.json({
          item: linkPerformedProcedureToTreatmentItem(session, body.data),
        });
      case "link_clinical":
        return NextResponse.json(
          linkClinicalEntryToPerformedProcedure(session, body.data),
        );
      case "create_evolution":
        return NextResponse.json({
          entry: createEvolutionFromPerformedProcedure(
            session,
            body.data.performed_procedure_id,
            body.data.extra,
          ),
        });
      default:
        return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
    }
  } catch (error) {
    return mapError(error);
  }
}
