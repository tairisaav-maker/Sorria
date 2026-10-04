import { NextResponse } from "next/server";
import { getDemoSession } from "@/lib/demo/authz-store";
import {
  acceptTreatmentPlan,
  addTreatmentItem,
  cancelTreatmentItem,
  completeTreatmentItem,
  completeTreatmentPlan,
  createTreatmentPlan,
  createTreatmentPlanRevision,
  duplicateTreatmentPlan,
  getTreatmentPlan,
  listTreatmentPlans,
  presentTreatmentPlan,
  rejectTreatmentPlan,
  removeTreatmentItem,
  reorderTreatmentItems,
  startTreatmentItem,
  updateTreatmentItem,
  updateTreatmentPlanDraft,
} from "@/services/treatments";

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
      { error: "Você não tem permissão para alterar este plano." },
      { status: 403 },
    );
  }
  if (message === "CONCURRENCY_CONFLICT") {
    return NextResponse.json(
      { error: "Este plano foi atualizado em outra sessão. Atualize antes de continuar." },
      { status: 409 },
    );
  }
  if (message === "PLAN_EXPIRED") {
    return NextResponse.json(
      {
        error:
          "Este plano está fora da validade e precisa ser revisado antes do aceite.",
      },
      { status: 400 },
    );
  }
  if (
    message === "TREATMENT_PLAN_NOT_FOUND" ||
    message === "TREATMENT_ITEM_NOT_FOUND" ||
    message === "PATIENT_NOT_FOUND" ||
    message === "SOURCE_TENANT_MISMATCH"
  ) {
    return NextResponse.json(
      { error: "Não encontramos este registro." },
      { status: 404 },
    );
  }
  return NextResponse.json(
    {
      error:
        message.startsWith("Transição") ||
        message.includes("procedimento") ||
        message.includes("rascunho") ||
        message.includes("pendentes")
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
    const session = ctx();
    const id = url.searchParams.get("id");
    if (id) {
      return NextResponse.json({ plan: getTreatmentPlan(session, id) });
    }
    const patientId = url.searchParams.get("patientId") ?? "";
    const filter = (url.searchParams.get("filter") ?? "all") as
      | "all"
      | "active"
      | "completed"
      | "rejected";
    return NextResponse.json({
      items: listTreatmentPlans(session, patientId, filter),
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

    if (action === "create") {
      return NextResponse.json(
        { plan: createTreatmentPlan(session, body) },
        { status: 201 },
      );
    }
    if (action === "update") {
      return NextResponse.json({ plan: updateTreatmentPlanDraft(session, body) });
    }
    if (action === "add-item") {
      return NextResponse.json({ plan: addTreatmentItem(session, body) });
    }
    if (action === "update-item") {
      return NextResponse.json({
        plan: updateTreatmentItem(session, body.id, body),
      });
    }
    if (action === "remove-item") {
      return NextResponse.json({ plan: removeTreatmentItem(session, body.id) });
    }
    if (action === "reorder") {
      return NextResponse.json({
        plan: reorderTreatmentItems(session, body.plan_id, body.ordered_ids ?? []),
      });
    }
    if (action === "present") {
      return NextResponse.json({ plan: presentTreatmentPlan(session, body.id) });
    }
    if (action === "accept") {
      return NextResponse.json({ plan: acceptTreatmentPlan(session, body.id) });
    }
    if (action === "reject") {
      return NextResponse.json({ plan: rejectTreatmentPlan(session, body) });
    }
    if (action === "start-item") {
      return NextResponse.json({ plan: startTreatmentItem(session, body.id) });
    }
    if (action === "complete-item") {
      return NextResponse.json({ plan: completeTreatmentItem(session, body.id) });
    }
    if (action === "cancel-item") {
      return NextResponse.json({ plan: cancelTreatmentItem(session, body.id) });
    }
    if (action === "complete-plan") {
      return NextResponse.json({ plan: completeTreatmentPlan(session, body.id) });
    }
    if (action === "revise") {
      createTreatmentPlanRevision(session, body.id, body.reason ?? "Revisão");
      return NextResponse.json({ plan: getTreatmentPlan(session, body.id) });
    }
    if (action === "duplicate") {
      return NextResponse.json({
        plan: duplicateTreatmentPlan(session, body.id),
      });
    }

    return NextResponse.json({ error: "action inválida" }, { status: 400 });
  } catch (error) {
    return mapError(error);
  }
}
