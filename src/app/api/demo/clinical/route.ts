import { NextResponse } from "next/server";
import { getDemoSession } from "@/lib/demo/authz-store";
import {
  getAnamnesis,
  reviewAnamnesis,
  saveAnamnesisDraft,
  submitAnamnesis,
} from "@/services/anamnesis";
import {
  addClinicalEntryCorrection,
  createClinicalEntry,
  finalizeClinicalEntry,
  getClinicalEntry,
  getClinicalEntryVersions,
  getClinicalSummary,
  listClinicalEntries,
  listDraftsForAppointment,
  updateClinicalEntryDraft,
} from "@/services/clinical";
import { getOdontogram, updateTooth } from "@/services/odontogram";
import {
  getClinicalAttachmentAccess,
  listClinicalAttachments,
  uploadClinicalAttachment,
} from "@/services/attachments";

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
      { error: "Você não tem permissão para acessar o prontuário deste paciente." },
      { status: 403 },
    );
  }
  if (message === "CONCURRENCY_CONFLICT") {
    return NextResponse.json(
      {
        error:
          "Este registro foi atualizado em outra sessão. Atualize a página antes de continuar.",
      },
      { status: 409 },
    );
  }
  if (
    message === "PATIENT_NOT_FOUND" ||
    message === "CLINICAL_ENTRY_NOT_FOUND" ||
    message === "ANAMNESIS_NOT_FOUND" ||
    message === "ATTACHMENT_NOT_FOUND" ||
    message === "APPOINTMENT_NOT_FOUND"
  ) {
    return NextResponse.json(
      { error: "Não encontramos este registro." },
      { status: 404 },
    );
  }
  if (message === "MIME_NOT_ALLOWED" || message === "FILE_TOO_LARGE") {
    return NextResponse.json(
      {
        error:
          "Não foi possível enviar o arquivo. Confira o formato e tente novamente.",
      },
      { status: 400 },
    );
  }
  return NextResponse.json(
    {
      error:
        message.includes("sobrescrito") || message.includes("inválida")
          ? message
          : "Não foi possível concluir esta ação. Tente novamente.",
    },
    { status: 400 },
  );
}

export async function GET(request: Request) {
  const blocked = ensureDemo();
  if (blocked) return blocked;
  try {
    const url = new URL(request.url);
    const resource = url.searchParams.get("resource");
    const patientId = url.searchParams.get("patientId") ?? "";
    const session = ctx();

    if (resource === "summary") {
      return NextResponse.json({ summary: getClinicalSummary(session, patientId) });
    }
    if (resource === "anamnesis") {
      return NextResponse.json(getAnamnesis(session, patientId));
    }
    if (resource === "entries") {
      return NextResponse.json({ items: listClinicalEntries(session, patientId) });
    }
    if (resource === "entry") {
      const id = url.searchParams.get("id") ?? "";
      return NextResponse.json({ entry: getClinicalEntry(session, id) });
    }
    if (resource === "versions") {
      const id = url.searchParams.get("id") ?? "";
      return NextResponse.json({ items: getClinicalEntryVersions(session, id) });
    }
    if (resource === "odontogram") {
      return NextResponse.json(getOdontogram(session, patientId));
    }
    if (resource === "attachments") {
      return NextResponse.json({
        items: listClinicalAttachments(session, patientId),
      });
    }
    if (resource === "attachment-access") {
      const id = url.searchParams.get("id") ?? "";
      return NextResponse.json(
        getClinicalAttachmentAccess(session, id, "view"),
      );
    }
    if (resource === "drafts-for-appointment") {
      const appointmentId = url.searchParams.get("appointmentId") ?? "";
      return NextResponse.json({
        items: listDraftsForAppointment(session, appointmentId),
      });
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
    const session = ctx();
    const action = body.action as string;

    if (action === "anamnesis.save") {
      return NextResponse.json(
        saveAnamnesisDraft(session, body.patient_id, body.answers ?? {}),
      );
    }
    if (action === "anamnesis.submit") {
      return NextResponse.json(submitAnamnesis(session, body.patient_id));
    }
    if (action === "anamnesis.review") {
      return NextResponse.json(reviewAnamnesis(session, body.patient_id));
    }
    if (action === "entry.create") {
      return NextResponse.json(
        { entry: createClinicalEntry(session, body) },
        { status: 201 },
      );
    }
    if (action === "entry.update") {
      return NextResponse.json({
        entry: updateClinicalEntryDraft(session, body.id, body),
      });
    }
    if (action === "entry.finalize") {
      return NextResponse.json({
        entry: finalizeClinicalEntry(session, body),
      });
    }
    if (action === "entry.correct") {
      return NextResponse.json({
        entry: addClinicalEntryCorrection(session, body),
      });
    }
    if (action === "odontogram.update") {
      return NextResponse.json({ tooth: updateTooth(session, body) });
    }
    if (action === "attachment.upload") {
      return NextResponse.json(
        { attachment: uploadClinicalAttachment(session, body) },
        { status: 201 },
      );
    }
    if (action === "attachment.access") {
      return NextResponse.json(
        getClinicalAttachmentAccess(session, body.id, body.purpose ?? "view"),
      );
    }

    return NextResponse.json({ error: "action inválida" }, { status: 400 });
  } catch (error) {
    return mapError(error);
  }
}
