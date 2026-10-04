"use client";

/** Cliente leve para instrumentação — sem PHI. */
export async function trackClientEvent(
  name: string,
  opts?: {
    route?: string;
    duration_ms?: number;
    meta?: Record<string, string | number | boolean | null>;
  },
) {
  try {
    await fetch("/api/demo/pilot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "track",
        data: {
          name,
          route: opts?.route ?? (typeof window !== "undefined" ? window.location.pathname : null),
          duration_ms: opts?.duration_ms ?? null,
          meta: opts?.meta,
        },
      }),
    });
  } catch {
    // nunca quebrar UX por analytics
  }
}

export function startFlowTimer() {
  const started = performance.now();
  return {
    elapsed() {
      return Math.round(performance.now() - started);
    },
  };
}
