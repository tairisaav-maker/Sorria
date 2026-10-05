import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";
import {
  DEMO_COOKIE_NAME,
  isDemoCookiePresent,
  isPortalDemoCookie,
} from "@/lib/demo/session";

const DEMO_COOKIE = DEMO_COOKIE_NAME;

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
  const demoCookie = request.cookies.get(DEMO_COOKIE)?.value;
  const hasDemoSession = isDemoMode && isDemoCookiePresent(demoCookie);
  const isPortalSession = isPortalDemoCookie(demoCookie);
  const path = request.nextUrl.pathname;
  const isAppRoute = path.startsWith("/app");
  const isPortalRoute = path.startsWith("/portal");
  const isLoginRoute = path === "/login";
  const isForbiddenRoute = path === "/forbidden";
  const isPublicMarketing =
    path === "/" ||
    path.startsWith("/cadastro") ||
    path === "/planos" ||
    path === "/privacidade" ||
    path === "/termos" ||
    path.startsWith("/convite") ||
    path === "/offline" ||
    path === "/como-funciona" ||
    path === "/conhecer" ||
    path.startsWith("/auth/callback");
  const isPwaAsset =
    path === "/sw.js" ||
    path === "/manifest.webmanifest" ||
    path.startsWith("/icons/");
  const isHealth = path === "/api/health";
  const isInternalRoute = path.startsWith("/internal");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabaseConfigured =
    Boolean(url && anonKey) && !url?.includes("your-project");

  let hasSupabaseUser = false;

  if (supabaseConfigured && url && anonKey) {
    const supabase = createServerClient<Database>(url, anonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();
    hasSupabaseUser = Boolean(user);
  }

  const isAuthenticated = hasSupabaseUser || hasDemoSession;

  if (
    (isAppRoute || isForbiddenRoute || isPortalRoute || isInternalRoute) &&
    !isAuthenticated
  ) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("next", path);
    return NextResponse.redirect(redirectUrl);
  }

  // Portal session must not use professional shell
  if (isAuthenticated && isDemoMode && isPortalSession && isAppRoute) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/portal/inicio";
    return NextResponse.redirect(redirectUrl);
  }

  if (isLoginRoute && isAuthenticated) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = isPortalSession ? "/portal/inicio" : "/app/home";
    return NextResponse.redirect(redirectUrl);
  }

  // Landing pública, PWA assets e health — autenticados podem ir ao app pelo CTA
  if (isPublicMarketing || isPwaAsset || isHealth) {
    return supabaseResponse;
  }

  return supabaseResponse;
}

export { DEMO_COOKIE };
