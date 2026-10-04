import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getDemoSession } from "@/lib/demo/authz-store";
import {
  DEMO_COOKIE_NAME,
  hydrateDemoSessionFromCookie,
} from "@/lib/demo/session";
import {
  cancelActionPlan,
  confirmActionPlan,
  createThread,
  getAssistantSuggestions,
  getThread,
  listThreads,
  sendAssistantMessage,
} from "@/services/assistant";

async function ctx() {
  const jar = await cookies();
  hydrateDemoSessionFromCookie(jar.get(DEMO_COOKIE_NAME)?.value);
  const s = getDemoSession();
  return { userId: s.userId, clinicId: s.clinicId };
}

function mapError(error: unknown) {
  const message = error instanceof Error ? error.message : "Erro";
  if (message.includes("PERMISSION") || message.includes("AUTHORIZATION")) {
    return NextResponse.json(
      { error: "Você não tem permissão para esta ação." },
      { status: 403 },
    );
  }
  if (message === "ACTION_EXPIRED") {
    return NextResponse.json(
      { error: "Esta ação expirou. Confira os dados novamente." },
      { status: 410 },
    );
  }
  if (message === "SLOT_UNAVAILABLE") {
    return NextResponse.json(
      {
        error:
          "Esse horário não está mais disponível. Consulte alternativas na Agenda.",
      },
      { status: 409 },
    );
  }
  if (message === "THREAD_NOT_FOUND" || message === "ACTION_NOT_FOUND") {
    return NextResponse.json({ error: "Recurso não encontrado." }, { status: 404 });
  }
  if (message === "ACTION_NOT_PENDING") {
    return NextResponse.json(
      { error: "Esta ação não está aguardando confirmação." },
      { status: 400 },
    );
  }
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function GET(request: Request) {
  if (process.env.NEXT_PUBLIC_DEMO_MODE !== "true") {
    return NextResponse.json({ error: "Demo only" }, { status: 403 });
  }
  try {
    const auth = await ctx();
    const url = new URL(request.url);
    const resource = url.searchParams.get("resource") ?? "threads";

    if (resource === "threads") {
      return NextResponse.json({ threads: listThreads(auth) });
    }
    if (resource === "thread") {
      const id = url.searchParams.get("id");
      if (!id) {
        return NextResponse.json({ error: "id obrigatório" }, { status: 400 });
      }
      return NextResponse.json(getThread(auth, id));
    }
    if (resource === "suggestions") {
      return NextResponse.json({ suggestions: getAssistantSuggestions(auth) });
    }
    return NextResponse.json({ error: "resource inválido" }, { status: 400 });
  } catch (error) {
    return mapError(error);
  }
}

export async function POST(request: Request) {
  if (process.env.NEXT_PUBLIC_DEMO_MODE !== "true") {
    return NextResponse.json({ error: "Demo only" }, { status: 403 });
  }
  try {
    const auth = await ctx();
    const body = (await request.json()) as {
      action?: string;
      threadId?: string | null;
      message?: string;
      actionId?: string;
      title?: string;
    };
    const action = body.action ?? "send";

    if (action === "create_thread") {
      const thread = createThread(auth, body.title);
      return NextResponse.json({ thread });
    }
    if (action === "send") {
      if (!body.message?.trim()) {
        return NextResponse.json({ error: "Mensagem vazia." }, { status: 400 });
      }
      const result = await sendAssistantMessage(auth, {
        threadId: body.threadId,
        message: body.message.trim(),
      });
      return NextResponse.json(result);
    }
    if (action === "confirm") {
      if (!body.actionId) {
        return NextResponse.json({ error: "actionId obrigatório" }, { status: 400 });
      }
      const result = confirmActionPlan(auth, body.actionId);
      return NextResponse.json(result);
    }
    if (action === "cancel_action") {
      if (!body.actionId) {
        return NextResponse.json({ error: "actionId obrigatório" }, { status: 400 });
      }
      const plan = cancelActionPlan(auth, body.actionId);
      return NextResponse.json({ plan });
    }
    return NextResponse.json({ error: "action inválida" }, { status: 400 });
  } catch (error) {
    return mapError(error);
  }
}
