import { NextResponse } from "next/server";
import { getDemoSession } from "@/lib/demo/authz-store";
import {
  getPilotCoverageMetrics,
  getPilotPreparationChecklist,
  getProcedureMaterialVariance,
  listPilotFeedback,
  submitPilotFeedback,
  trackPilotEvent,
} from "@/services/pilot";

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
  return NextResponse.json(
    { error: "Não foi possível concluir esta ação." },
    { status: 400 },
  );
}

export async function GET(request: Request) {
  const denied = ensureDemo();
  if (denied) return denied;
  const session = ctx();
  const { searchParams } = new URL(request.url);
  const view = searchParams.get("view") ?? "checklist";
  try {
    if (view === "checklist") {
      return NextResponse.json(getPilotPreparationChecklist(session));
    }
    if (view === "metrics") {
      return NextResponse.json(getPilotCoverageMetrics(session));
    }
    if (view === "feedback") {
      return NextResponse.json({ items: listPilotFeedback(session) });
    }
    if (view === "variance") {
      const procedureId = searchParams.get("procedureId");
      if (!procedureId) {
        return NextResponse.json(
          { error: "procedureId obrigatório" },
          { status: 400 },
        );
      }
      return NextResponse.json(
        getProcedureMaterialVariance(session, procedureId),
      );
    }
    return NextResponse.json({ error: "view inválida" }, { status: 400 });
  } catch (error) {
    return mapError(error);
  }
}

export async function POST(request: Request) {
  const denied = ensureDemo();
  if (denied) return denied;
  const session = ctx();
  try {
    const body = (await request.json()) as {
      action?: string;
      data?: Record<string, unknown>;
    };
    if (body.action === "track") {
      return NextResponse.json(trackPilotEvent(session, body.data ?? {}));
    }
    if (body.action === "feedback") {
      return NextResponse.json(submitPilotFeedback(session, body.data ?? {}));
    }
    return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
  } catch (error) {
    return mapError(error);
  }
}
