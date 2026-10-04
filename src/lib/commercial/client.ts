"use client";

/** Analytics comercial no browser — sem PHI. */
export async function trackCommercialEvent(
  name: string,
  opts?: {
    route?: string;
    meta?: Record<string, string | number | boolean | null>;
  },
) {
  try {
    await fetch("/api/demo/commercial", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "track",
        data: {
          name,
          route:
            opts?.route ??
            (typeof window !== "undefined" ? window.location.pathname : null),
          meta: opts?.meta,
        },
      }),
    });
  } catch {
    // nunca quebrar UX
  }
}
