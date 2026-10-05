/**
 * Fonte única da URL pública do Sorria.
 * Nunca hardcode domínio — use NEXT_PUBLIC_APP_URL.
 */
export function getAppUrl(): string {
  const raw = (process.env.NEXT_PUBLIC_APP_URL ?? "").trim().replace(/\/$/, "");
  if (raw) return raw;
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL.replace(/\/$/, "")}`;
  }
  return "http://localhost:3000";
}

export function absoluteUrl(path = "/"): string {
  const base = getAppUrl();
  if (!path || path === "/") return base;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export function isProductionDeploy(): boolean {
  return (
    process.env.NEXT_PUBLIC_SORRIA_ENV === "production" ||
    (process.env.NODE_ENV === "production" &&
      process.env.NEXT_PUBLIC_DEMO_MODE !== "true")
  );
}

/** Auth redirect / Site URL helpers for docs & callbacks */
export function authCallbackUrl(): string {
  return absoluteUrl("/auth/callback");
}
