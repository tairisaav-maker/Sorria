import { NextResponse } from "next/server";
import { getDemoSession } from "@/lib/demo/authz-store";
import { getClinicalStore } from "@/lib/demo/clinical-store";
import {
  confirmMyAppointment,
  confirmProposedAppointment,
  createMyAppointmentRequest,
  createRecordCopyRequest,
  getMyAppointmentRequests,
  getMyAppointments,
  getMyDocuments,
  getMyDocumentAccess,
  getMyFinancialSummary,
  getMyInstallments,
  getMyPayments,
  getMyProfile,
  getMyRecordCopyRequests,
  getMyTreatment,
  getMyVisibleClinicalData,
  getPortalHome,
  getPortalContext,
  requestAnotherAppointmentTime,
  requestAppointmentCancellation,
  requestAppointmentChange,
  updateMyAllowedProfileFields,
} from "@/services/portal";

function ensureDemo() {
  if (process.env.NEXT_PUBLIC_DEMO_MODE !== "true") {
    return NextResponse.json({ error: "Demo mode only" }, { status: 403 });
  }
  return null;
}

function session() {
  const s = getDemoSession();
  return {
    authUserId: s.userId,
    clinicId: s.clinicId,
    patientId: (s as { patientId?: string }).patientId ?? null,
  };
}

function mapError(error: unknown) {
  const message = error instanceof Error ? error.message : "Erro";
  if (
    message === "PORTAL_ACCESS_DENIED" ||
    message === "PORTAL_FORBIDDEN"
  ) {
    return NextResponse.json(
      { error: "Você não tem acesso a esta informação." },
      { status: 403 },
    );
  }
  if (message === "SLOT_UNAVAILABLE") {
    return NextResponse.json(
      {
        error:
          "Este horário não está mais disponível. A clínica precisará propor uma nova opção.",
      },
      { status: 409 },
    );
  }
  return NextResponse.json(
    {
      error:
        message.includes("confirmar") || message.includes("Dados")
          ? message
          : "Não foi possível enviar sua solicitação. Tente novamente.",
    },
    { status: 400 },
  );
}

export async function GET(request: Request) {
  const blocked = ensureDemo();
  if (blocked) return blocked;
  try {
    const url = new URL(request.url);
    const resource = url.searchParams.get("resource") ?? "home";
    const s = session();

    if (resource === "home") {
      return NextResponse.json(getPortalHome(s));
    }
    if (resource === "context") {
      return NextResponse.json({ context: getPortalContext(s) });
    }
    if (resource === "appointments") {
      const scope = (url.searchParams.get("scope") ?? "upcoming") as
        | "upcoming"
        | "history";
      return NextResponse.json({ items: getMyAppointments(s, scope) });
    }
    if (resource === "requests") {
      return NextResponse.json({ items: getMyAppointmentRequests(s) });
    }
    if (resource === "treatment") {
      return NextResponse.json(getMyTreatment(s));
    }
    if (resource === "clinical") {
      return NextResponse.json(getMyVisibleClinicalData(s));
    }
    if (resource === "documents") {
      return NextResponse.json({ items: getMyDocuments(s) });
    }
    if (resource === "document") {
      return NextResponse.json(
        getMyDocumentAccess(s, url.searchParams.get("id") ?? ""),
      );
    }
    if (resource === "document-content") {
      const access = getMyDocumentAccess(s, url.searchParams.get("id") ?? "");
      const att = getClinicalStore().attachments.find((a) => a.id === access.id);
      return NextResponse.json({
        file_name: att?.file_name,
        message: "Conteúdo demo — arquivo privado via autorização Portal.",
      });
    }
    if (resource === "finance") {
      return NextResponse.json({
        summary: getMyFinancialSummary(s),
        installments: getMyInstallments(s),
        payments: getMyPayments(s),
      });
    }
    if (resource === "profile") {
      return NextResponse.json({ profile: getMyProfile(s) });
    }
    if (resource === "copy-requests") {
      return NextResponse.json({ items: getMyRecordCopyRequests(s) });
    }

    return NextResponse.json({ error: "resource inválido" }, { status: 400 });
  } catch (error) {
    return mapError(error);
  }
}

export async function POST(request: Request) {
  const blocked = ensureDemo();
  if (blocked) return blocked;
  try {
    const body = await request.json();
    const s = session();
    const action = body.action as string;

    if (action === "confirm-appointment") {
      return NextResponse.json({
        appointment: confirmMyAppointment(s, body.id),
        message: "Presença confirmada.",
      });
    }
    if (action === "request-change") {
      return NextResponse.json({
        request: requestAppointmentChange(s, body),
        message: "Solicitação de alteração enviada.",
      });
    }
    if (action === "request-cancel") {
      return NextResponse.json({
        request: requestAppointmentCancellation(s, body),
        message: "Solicitação de cancelamento enviada.",
      });
    }
    if (action === "create-request") {
      return NextResponse.json(
        {
          request: createMyAppointmentRequest(s, body),
          message: "Solicitação enviada",
        },
        { status: 201 },
      );
    }
    if (action === "confirm-proposal") {
      return NextResponse.json({
        ...confirmProposedAppointment(s, body.id),
        message: "Horário confirmado.",
      });
    }
    if (action === "request-alternative") {
      return NextResponse.json({
        request: requestAnotherAppointmentTime(s, body),
        message: "Nova preferência enviada.",
      });
    }
    if (action === "request-copy") {
      return NextResponse.json(
        {
          request: createRecordCopyRequest(s),
          message: "Solicitação de cópia enviada.",
        },
        { status: 201 },
      );
    }
    if (action === "update-profile") {
      return NextResponse.json({
        profile: updateMyAllowedProfileFields(s, body),
        message: "Dados atualizados.",
      });
    }

    return NextResponse.json({ error: "action inválida" }, { status: 400 });
  } catch (error) {
    return mapError(error);
  }
}
