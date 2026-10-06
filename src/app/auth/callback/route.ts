import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAppUrl } from "@/lib/app-url";

/** Evita open redirect: só caminhos relativos internos. */
function safeNextPath(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/app/home";
  if (raw.includes("://")) return "/app/home";
  return raw;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));

  // Preferir origin da request (localhost ou domínio); fallback APP_URL
  const base =
    origin && !origin.includes("0.0.0.0") ? origin : getAppUrl();

  if (code) {
    try {
      const supabase = await createClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        return NextResponse.redirect(`${base}${next}`);
      }
    } catch {
      // Sem Supabase real (ex.: demo/local com placeholders) — volta ao login.
    }
  }

  return NextResponse.redirect(`${base}/login?error=auth_callback`);
}
