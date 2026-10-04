import { NextResponse } from "next/server";
import { getDemoSession } from "@/lib/demo/authz-store";
import { globalSearch } from "@/lib/search/global";

function ensureDemo() {
  if (process.env.NEXT_PUBLIC_DEMO_MODE !== "true") {
    return NextResponse.json({ error: "Demo mode only" }, { status: 403 });
  }
  return null;
}

export async function GET(request: Request) {
  const denied = ensureDemo();
  if (denied) return denied;
  const session = getDemoSession();
  const ctx = { userId: session.userId, clinicId: session.clinicId };
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";
  try {
    return NextResponse.json({ items: globalSearch(ctx, q) });
  } catch {
    return NextResponse.json(
      { error: "Não foi possível buscar." },
      { status: 400 },
    );
  }
}
