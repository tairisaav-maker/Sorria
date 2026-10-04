import { NextResponse } from "next/server";
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

  if (body.email !== demoEmail || body.password !== demoPassword) {
    return NextResponse.json(
      { error: "Credenciais demo inválidas." },
      { status: 401 },
    );
  }

  const response = NextResponse.json({ ok: true });
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
