import { NextResponse } from "next/server";
import { getDemoSession } from "@/lib/demo/authz-store";
import {
  cancelAppointment,
  changeAppointmentStatus,
  createAppointment,
  getAppointment,
  listAppointments,
  listClinicProfessionals,
  rescheduleAppointment,
} from "@/services/appointments";

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
      { error: "Você não tem permissão para alterar esta consulta." },
      { status: 403 },
    );
  }
  if (message === "APPOINTMENT_NOT_FOUND") {
    return NextResponse.json(
      { error: "Não encontramos esta consulta." },
      { status: 404 },
    );
  }
  if (message === "SLOT_UNAVAILABLE") {
    return NextResponse.json(
      {
        error:
          "Este horário não está mais disponível. Escolha outro horário.",
      },
      { status: 409 },
    );
  }
  if (
    message === "PATIENT_TENANT_MISMATCH" ||
    message === "PROFESSIONAL_TENANT_MISMATCH"
  ) {
    return NextResponse.json(
      { error: "Não foi possível concluir esta ação. Tente novamente." },
      { status: 403 },
    );
  }
  return NextResponse.json(
    {
      error:
        message.startsWith("Transição")
          ? message
          : message || "Não foi possível concluir esta ação. Tente novamente.",
    },
    { status: 400 },
  );
}

export async function GET(request: Request) {
  const blocked = ensureDemo();
  if (blocked) return blocked;
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    const session = ctx();
    if (id) {
      return NextResponse.json({ appointment: getAppointment(session, id) });
    }
    if (url.searchParams.get("professionals") === "1") {
      return NextResponse.json({
        professionals: listClinicProfessionals(session),
      });
    }
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    if (!from || !to) {
      return NextResponse.json({ error: "from/to obrigatórios" }, { status: 400 });
    }
    const items = listAppointments(session, {
      from,
      to,
      professionalId: url.searchParams.get("professionalId") ?? "all",
    });
    return NextResponse.json({ items });
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
    const action = body.action as string | undefined;

    if (action === "reschedule") {
      const appointment = rescheduleAppointment(session, body.id, body);
      return NextResponse.json({ appointment });
    }
    if (action === "status") {
      const appointment = changeAppointmentStatus(session, body.id, body);
      return NextResponse.json({ appointment });
    }
    if (action === "cancel") {
      const appointment = cancelAppointment(session, body.id, body);
      return NextResponse.json({ appointment });
    }

    const appointment = createAppointment(session, body);
    return NextResponse.json({ appointment }, { status: 201 });
  } catch (error) {
    return mapError(error);
  }
}
