/**
 * Abstração de observabilidade — sem acoplar a fornecedor.
 * Em produção, configure Sentry/OpenTelemetry via adapters.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export type ObsEvent = {
  level: LogLevel;
  message: string;
  clinicId?: string | null;
  userId?: string | null;
  correlationId?: string;
  meta?: Record<string, unknown>;
};

function sanitizeMeta(meta?: Record<string, unknown>) {
  if (!meta) return undefined;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(meta)) {
    const key = k.toLowerCase();
    if (
      key.includes("password") ||
      key.includes("token") ||
      key.includes("secret") ||
      key.includes("authorization") ||
      key === "cpf" ||
      key.includes("service_role")
    ) {
      out[k] = "[redacted]";
      continue;
    }
    out[k] = v;
  }
  return out;
}

export function createCorrelationId() {
  return crypto.randomUUID().slice(0, 8).toUpperCase();
}

export function logEvent(event: ObsEvent) {
  const payload = {
    ...event,
    meta: sanitizeMeta(event.meta),
    ts: new Date().toISOString(),
  };
  if (event.level === "error") {
    console.error("[sorria]", payload);
  } else if (event.level === "warn") {
    console.warn("[sorria]", payload);
  } else if (process.env.NODE_ENV !== "production") {
    console.info("[sorria]", payload);
  }
}

export function captureException(
  error: unknown,
  context: Omit<ObsEvent, "level" | "message"> = {},
) {
  const message = error instanceof Error ? error.message : "Unknown error";
  const correlationId = context.correlationId ?? createCorrelationId();
  logEvent({
    level: "error",
    message,
    ...context,
    correlationId,
    meta: {
      ...context.meta,
      name: error instanceof Error ? error.name : "Error",
    },
  });
  return correlationId;
}

export type ErrorTracker = {
  captureException: typeof captureException;
  logEvent: typeof logEvent;
};

export function getErrorTracker(): ErrorTracker {
  return { captureException, logEvent };
}
