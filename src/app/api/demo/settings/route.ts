import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getDemoSession } from "@/lib/demo/authz-store";
import {
  DEMO_COOKIE_NAME,
  hydrateDemoSessionFromCookie,
} from "@/lib/demo/session";
import {
  getClinicSettings,
  getMyProfile,
  getOnboarding,
  listRecentAudit,
  markOnboardingStep,
  updateClinicHours,
  updateClinicSettings,
  updateMyProfile,
} from "@/services/settings";

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
  if (message === "CLINIC_INACTIVE") {
    return NextResponse.json(
      { error: "Esta clínica está suspensa ou encerrada." },
      { status: 403 },
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
    const resource = new URL(request.url).searchParams.get("resource") ?? "clinic";
    if (resource === "clinic") return NextResponse.json(getClinicSettings(auth));
    if (resource === "profile") return NextResponse.json(getMyProfile(auth));
    if (resource === "onboarding") return NextResponse.json(getOnboarding(auth));
    if (resource === "audit") {
      return NextResponse.json({ items: listRecentAudit(auth) });
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
      payload?: Record<string, unknown>;
      hours?: unknown;
      step?: string;
    };
    const action = body.action ?? "update_clinic";

    if (action === "update_clinic") {
      return NextResponse.json(
        updateClinicSettings(auth, body.payload ?? {}),
      );
    }
    if (action === "update_hours") {
      return NextResponse.json(updateClinicHours(auth, body.hours));
    }
    if (action === "update_profile") {
      return NextResponse.json(updateMyProfile(auth, body.payload ?? {}));
    }
    if (action === "onboarding_step") {
      return NextResponse.json(
        markOnboardingStep(
          auth,
          (body.step ?? "welcome") as Parameters<typeof markOnboardingStep>[1],
        ),
      );
    }
    return NextResponse.json({ error: "action inválida" }, { status: 400 });
  } catch (error) {
    return mapError(error);
  }
}
