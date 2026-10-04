import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getDemoSession, OWNER_A_ID } from "@/lib/demo/authz-store";
import {
  DEMO_COOKIE_NAME,
  hydrateDemoSessionFromCookie,
} from "@/lib/demo/session";
import {
  getCommercialActivation,
  getCommercialFunnelMetrics,
  getInviteOnlyStatus,
  listBetaClinicsInternal,
  recordCancelFeedback,
  submitLead,
  trackCommercialEventPublic,
  updateLeadPipeline,
  validateBetaInvite,
} from "@/services/commercial";
import type { LeadPipelineStatus } from "@/lib/demo/commercial-store";

function ensureDemo() {
  if (process.env.NEXT_PUBLIC_DEMO_MODE !== "true") {
    return NextResponse.json({ error: "Demo mode only" }, { status: 403 });
  }
  return null;
}

async function hydrate() {
  const jar = await cookies();
  hydrateDemoSessionFromCookie(jar.get(DEMO_COOKIE_NAME)?.value);
}

function mapError(error: unknown) {
  const message = error instanceof Error ? error.message : "Erro";
  const map: Record<string, { status: number; error: string }> = {
    LEAD_DUPLICATE_SUBMIT: {
      status: 429,
      error: "Aguarde um momento antes de enviar novamente.",
    },
    LEAD_INVALIDO: { status: 400, error: "Dados do formulário inválidos." },
    EVENTO_DESCONHECIDO: { status: 400, error: "Evento desconhecido." },
    INVITE_INVALID: { status: 400, error: "Código de convite inválido." },
    INVITE_EXHAUSTED: {
      status: 400,
      error: "Este convite já atingiu o limite de usos.",
    },
    CANCEL_REASON_INVALID: {
      status: 400,
      error: "Motivo de cancelamento inválido.",
    },
  };
  const hit = map[message];
  if (hit) {
    return NextResponse.json(
      { error: hit.error, code: message },
      { status: hit.status },
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
  await hydrate();
  const { searchParams } = new URL(request.url);
  const view = searchParams.get("view") ?? "status";
  try {
    if (view === "status") {
      return NextResponse.json(getInviteOnlyStatus());
    }
    if (view === "validate_invite") {
      return NextResponse.json(
        validateBetaInvite(searchParams.get("code")),
      );
    }
    const session = getDemoSession();
    if (view === "activation") {
      return NextResponse.json(
        getCommercialActivation(session.clinicId),
      );
    }
    if (view === "beta_clinics" || view === "metrics") {
      if (session.userId !== OWNER_A_ID) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      if (view === "metrics") {
        return NextResponse.json(getCommercialFunnelMetrics());
      }
      return NextResponse.json({ items: listBetaClinicsInternal() });
    }
    return NextResponse.json({ error: "view inválida" }, { status: 400 });
  } catch (error) {
    return mapError(error);
  }
}

export async function POST(request: Request) {
  const denied = ensureDemo();
  if (denied) return denied;
  await hydrate();
  try {
    const body = (await request.json()) as {
      action?: string;
      data?: Record<string, unknown>;
    };
    const action = body.action;
    const data = body.data ?? {};

    if (action === "lead") {
      return NextResponse.json(submitLead(data));
    }

    if (action === "track") {
      return NextResponse.json(
        trackCommercialEventPublic(String(data.name ?? ""), {
          route: (data.route as string | null) ?? null,
          meta: (data.meta as Record<string, unknown>) ?? {},
        }),
      );
    }

    if (action === "validate_invite") {
      return NextResponse.json(
        validateBetaInvite(String(data.code ?? "")),
      );
    }

    const session = getDemoSession();

    if (action === "cancel_feedback") {
      return NextResponse.json(
        recordCancelFeedback({
          clinicId: session.clinicId,
          userId: session.userId,
          reason: String(data.reason ?? ""),
          detail: (data.detail as string | null) ?? null,
        }),
      );
    }

    if (action === "update_lead_pipeline") {
      if (session.userId !== OWNER_A_ID) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      return NextResponse.json(
        updateLeadPipeline(
          String(data.lead_id ?? ""),
          String(data.status ?? "") as LeadPipelineStatus,
          (data.non_conversion_reason as never) ?? null,
        ),
      );
    }

    return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
  } catch (error) {
    return mapError(error);
  }
}
