import { NextResponse } from "next/server";
import { getDemoSession } from "@/lib/demo/authz-store";
import {
  approveAppointmentRequest,
  cancelAppointmentRequest,
  createAppointmentRequest,
  getAppointmentRequest,
  listAppointmentRequests,
  proposeAppointmentTime,
  rejectAppointmentRequest,
  reviewAppointmentRequest,
  type RequestFilter,
} from "@/services/appointment-requests";

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
  if (message === "REQUEST_NOT_FOUND") {
    return NextResponse.json(
      { error: "Não encontramos esta solicitação." },
      { status: 404 },
    );
  }
  if (message === "SLOT_UNAVAILABLE") {
    return NextResponse.json(
      {
        error:
          "Este horário não está mais disponível. Escolha outro horário.",
        needsNewProposal: true,
      },
      { status: 409 },
    );
  }
  return NextResponse.json(
    {
      error:
        message || "Não foi possível concluir esta ação. Tente novamente.",
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
    const id = url.searchParams.get("id");
    if (id) {
      return NextResponse.json({
        request: getAppointmentRequest(session, id),
      });
    }
    const filter = (url.searchParams.get("filter") as RequestFilter) ?? "pending";
    return NextResponse.json({
      items: listAppointmentRequests(session, filter),
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

    if (action === "review") {
      return NextResponse.json({
        request: reviewAppointmentRequest(session, body.id),
      });
    }
    if (action === "propose") {
      return NextResponse.json({
        request: proposeAppointmentTime(session, body.id, body),
      });
    }
    if (action === "reject") {
      return NextResponse.json({
        request: rejectAppointmentRequest(session, body.id, body),
      });
    }
    if (action === "approve") {
      return NextResponse.json(approveAppointmentRequest(session, body.id));
    }
    if (action === "cancel") {
      return NextResponse.json({
        request: cancelAppointmentRequest(session, body.id),
      });
    }
    if (action === "create") {
      return NextResponse.json(
        { request: createAppointmentRequest(session, body) },
        { status: 201 },
      );
    }
    return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
  } catch (error) {
    return mapError(error);
  }
}
