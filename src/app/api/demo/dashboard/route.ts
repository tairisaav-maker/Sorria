import { NextResponse } from "next/server";
import { getDemoSession } from "@/lib/demo/authz-store";
import { getDashboardSummary } from "@/services/dashboard";
import { getClinic, getProfile } from "@/lib/demo/authz-store";

function ensureDemo() {
  if (process.env.NEXT_PUBLIC_DEMO_MODE !== "true") {
    return NextResponse.json({ error: "Demo mode only" }, { status: 403 });
  }
  return null;
}

export async function GET() {
  const blocked = ensureDemo();
  if (blocked) return blocked;
  try {
    const s = getDemoSession();
    const ctx = { userId: s.userId, clinicId: s.clinicId };
    const profile = getProfile(ctx.userId);
    const clinic = getClinic(ctx.clinicId);
    return NextResponse.json(
      getDashboardSummary(ctx, {
        userName: profile?.full_name ?? "Profissional",
        clinicName: clinic?.name ?? "Clínica",
      }),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro";
    if (message === "AUTHORIZATION_DENIED") {
      return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
    }
    return NextResponse.json({ error: "Falha ao carregar dashboard." }, { status: 400 });
  }
}
