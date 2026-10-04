import { NextResponse } from "next/server";
import {
  CLINIC_A_ID,
  OWNER_A_ID,
  getAuthzStore,
  setDemoSession,
} from "@/lib/demo/authz-store";
import {
  PATIENT_USER_A_ID,
  PORTAL_DEMO_USERS,
  listActiveAccessesForUser,
} from "@/lib/demo/portal-store";
import { DEMO_COOKIE } from "@/lib/supabase/middleware";

export async function POST(request: Request) {
  if (process.env.NEXT_PUBLIC_DEMO_MODE !== "true") {
    return NextResponse.json(
      { error: "Modo demo desabilitado." },
      { status: 403 },
    );
  }

  const body = (await request.json()) as {
    email?: string;
    password?: string;
  };

  const demoEmail = process.env.DEMO_EMAIL ?? "demo@sorria.app";
  const demoPassword = process.env.DEMO_PASSWORD ?? "sorria-demo";

  // Portal patient login
  const portalUser = PORTAL_DEMO_USERS.find(
    (u) => u.email === body.email && u.password === body.password,
  );
  if (portalUser) {
    const accesses = listActiveAccessesForUser(portalUser.id);
    if (accesses.length === 0) {
      return NextResponse.json(
        { error: "Seu acesso ao Portal foi revogado." },
        { status: 403 },
      );
    }
    const store = getAuthzStore();
    if (!store.profiles.some((p) => p.id === portalUser.id)) {
      store.profiles.push({
        id: portalUser.id,
        full_name: portalUser.full_name,
        email: portalUser.email,
      });
    }
    const primary = accesses[0]!;
    setDemoSession(portalUser.id, primary.clinic_id, {
      patientId: primary.patient_id,
      kind: "portal",
    });
    const response = NextResponse.json({
      ok: true,
      kind: "portal",
      redirect: "/portal/inicio",
    });
    response.cookies.set(DEMO_COOKIE, `portal:${portalUser.id}`, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    return response;
  }

  // Professional demo
  if (body.email !== demoEmail || body.password !== demoPassword) {
    return NextResponse.json(
      { error: "Credenciais demo inválidas." },
      { status: 401 },
    );
  }

  setDemoSession(OWNER_A_ID, CLINIC_A_ID, { kind: "professional" });
  const response = NextResponse.json({
    ok: true,
    kind: "professional",
    redirect: "/app/home",
  });
  response.cookies.set(DEMO_COOKIE, "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}

export async function DELETE() {
  setDemoSession(OWNER_A_ID, CLINIC_A_ID, { kind: "professional" });
  void PATIENT_USER_A_ID;
  const response = NextResponse.json({ ok: true });
  response.cookies.set(DEMO_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return response;
}
