import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getDemoSession } from "@/lib/demo/authz-store";
import { DEMO_COOKIE_NAME, hydrateDemoSessionFromCookie } from "@/lib/demo/session";
import {
  acceptInvitation,
  changeClinicPlan,
  createClinicForOwner,
  createSecureInvitation,
  getSaasHealth,
  getSubscriptionOverview,
  handleBillingWebhook,
  internalFindClinic,
  listMembershipClinics,
  listPublicPlans,
  requestAccountClosure,
  requestCancelSubscription,
  signupAccount,
  switchClinic,
} from "@/services/saas";
import { checkLoginRateLimit } from "@/lib/auth/rate-limit";
import { getBillingStore } from "@/lib/demo/billing-store";
import { createHash } from "crypto";

function proCookie(userId: string, clinicId: string) {
  return `pro:${userId}:${clinicId}`;
}

async function hydrate() {
  const jar = await cookies();
  hydrateDemoSessionFromCookie(jar.get(DEMO_COOKIE_NAME)?.value);
}

function ensureDemo() {
  if (process.env.NEXT_PUBLIC_DEMO_MODE !== "true") {
    return NextResponse.json({ error: "Demo mode only" }, { status: 403 });
  }
  return null;
}

function mapError(error: unknown) {
  const message = error instanceof Error ? error.message : "Erro";
  const map: Record<string, { status: number; error: string }> = {
    EMAIL_ALREADY_REGISTERED: {
      status: 409,
      error: "Este e-mail já possui conta.",
    },
    AUTHORIZATION_DENIED: {
      status: 403,
      error: "Você não tem permissão para esta ação.",
    },
    SUBSCRIPTION_RESTRICTED: {
      status: 402,
      error:
        "Assinatura em modo restrito. Gerencie o plano em Configurações → Assinatura.",
    },
    PLAN_ENTITLEMENT_REQUIRED: {
      status: 403,
      error: "Este recurso não está disponível no seu plano atual.",
    },
    PLAN_STAFF_LIMIT_REACHED: {
      status: 403,
      error: "Limite de usuários do plano atingido.",
    },
    PLAN_PROFESSIONAL_LIMIT_REACHED: {
      status: 403,
      error: "Limite de profissionais do plano atingido.",
    },
    WEBHOOK_INVALID: { status: 401, error: "Webhook inválido." },
    INVITATION_INVALID: { status: 400, error: "Convite inválido." },
    INVITATION_EXPIRED: { status: 400, error: "Convite expirado." },
    INVITE_REQUIRED: {
      status: 403,
      error: "Beta fechado: informe um código de convite válido.",
    },
    INVITE_INVALID: {
      status: 403,
      error: "Código de convite inválido.",
    },
    INVITE_EXHAUSTED: {
      status: 403,
      error: "Este convite já atingiu o limite de usos.",
    },
  };
  const hit = map[message];
  if (hit) return NextResponse.json({ error: hit.error, code: message }, { status: hit.status });
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
  const view = searchParams.get("view") ?? "plans";
  try {
    if (view === "plans") return NextResponse.json({ items: listPublicPlans() });
    if (view === "health") return NextResponse.json(getSaasHealth());
    const session = getDemoSession();
    if (view === "subscription") {
      return NextResponse.json(
        getSubscriptionOverview({
          userId: session.userId,
          clinicId: session.clinicId,
        }),
      );
    }
    if (view === "clinics") {
      return NextResponse.json({
        items: listMembershipClinics(session.userId),
        current: session.clinicId,
      });
    }
    if (view === "internal_clinics") {
      const q = searchParams.get("q") ?? "";
      // proteção mínima: só demo owner A
      if (session.userId !== "a1000000-0000-0000-0000-000000000001") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      return NextResponse.json({ items: internalFindClinic(q) });
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

    if (action === "signup") {
      const email = String(data.email ?? "");
      if (!checkLoginRateLimit("signup-ip", email)) {
        return NextResponse.json(
          { error: "Muitas tentativas. Aguarde um momento." },
          { status: 429 },
        );
      }
      const result = signupAccount(data);
      const res = NextResponse.json(result);
      res.cookies.set(DEMO_COOKIE_NAME, proCookie(result.user_id, ""), {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
      });
      return res;
    }

    if (action === "login_saas") {
      const email = String(data.email ?? "").toLowerCase();
      const password = String(data.password ?? "");
      const hash = createHash("sha256").update(`sorria:${password}`).digest("hex");
      const account = getBillingStore().accounts.find(
        (a) => a.email === email && a.password_hash === hash,
      );
      if (!account) {
        return NextResponse.json(
          { error: "Credenciais inválidas." },
          { status: 401 },
        );
      }
      const clinics = listMembershipClinics(account.user_id);
      const clinicId = clinics[0]?.clinic_id ?? "";
      const { setDemoSession } = await import("@/lib/demo/authz-store");
      setDemoSession(account.user_id, clinicId);
      const res = NextResponse.json({
        ok: true,
        next: clinicId ? "/app/home" : "/cadastro/clinica",
      });
      res.cookies.set(DEMO_COOKIE_NAME, proCookie(account.user_id, clinicId), {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
      });
      return res;
    }

    if (action === "create_clinic") {
      const session = getDemoSession();
      const result = createClinicForOwner(session.userId, data);
      const res = NextResponse.json(result);
      res.cookies.set(
        DEMO_COOKIE_NAME,
        proCookie(session.userId, result.clinic.id),
        { httpOnly: true, sameSite: "lax", path: "/" },
      );
      return res;
    }

    if (action === "webhook") {
      const rawBody = JSON.stringify(data.payload ?? data);
      const signature =
        (data.signature as string | undefined) ??
        request.headers.get("x-sorria-billing-secret");
      return NextResponse.json(
        await handleBillingWebhook({ rawBody, signature }),
      );
    }

    const session = getDemoSession();
    const ctx = { userId: session.userId, clinicId: session.clinicId };

    switch (action) {
      case "cancel_subscription":
        return NextResponse.json(requestCancelSubscription(ctx));
      case "change_plan":
        return NextResponse.json(
          changeClinicPlan(ctx, String(data.plan_code ?? "")),
        );
      case "invite":
        return NextResponse.json(
          createSecureInvitation(ctx, {
            email: String(data.email ?? ""),
            role_key: data.role_key === "secretary" ? "secretary" : "dentist",
            full_name: String(data.full_name ?? "Convidado"),
          }),
        );
      case "accept_invite":
        return NextResponse.json(
          acceptInvitation(String(data.token ?? ""), session.userId),
        );
      case "switch_clinic": {
        const switched = switchClinic(
          session.userId,
          String(data.clinic_id ?? ""),
        );
        const res = NextResponse.json(switched);
        res.cookies.set(
          DEMO_COOKIE_NAME,
          proCookie(session.userId, switched.clinic_id),
          { httpOnly: true, sameSite: "lax", path: "/" },
        );
        return res;
      }
      case "close_account":
        return NextResponse.json(
          requestAccountClosure(ctx, String(data.confirm ?? "")),
        );
      default:
        return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
    }
  } catch (error) {
    return mapError(error);
  }
}
