import { logEvent } from "@/lib/observability";

/** Smoke that logEvent redacts sensitive keys without throwing. */
export function sanitizeMetaViaLog() {
  logEvent({
    level: "info",
    message: "test",
    meta: {
      password: "secret",
      token: "abc",
      cpf: "52998224725",
      ok: 1,
    },
  });
  return true;
}
