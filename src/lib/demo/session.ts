import {
  CLINIC_A_ID,
  OWNER_A_ID,
  setDemoSession,
} from "@/lib/demo/authz-store";
import { listActiveAccessesForUser } from "@/lib/demo/portal-store";

export const DEMO_COOKIE_NAME = "sorria_demo_session";

export function isDemoCookiePresent(value: string | undefined | null) {
  return Boolean(value && value.length > 0);
}

export function isPortalDemoCookie(value: string | undefined | null) {
  return Boolean(value?.startsWith("portal:"));
}

/**
 * Hidrata sessão demo a partir do cookie (processos / HMR seguros).
 * Cookie formats:
 * - `1` → profissional OWNER_A
 * - `pro:<userId>:<clinicId>` → profissional SaaS / multi-clínica
 * - `portal:<authUserId>` → Portal (primeiro acesso ativo)
 * - `portal:<authUserId>:<clinicId>:<patientId>` → Portal com sujeito explícito
 */
export function hydrateDemoSessionFromCookie(
  cookieValue: string | undefined | null,
) {
  if (!cookieValue) return null;

  if (cookieValue === "1") {
    setDemoSession(OWNER_A_ID, CLINIC_A_ID, { kind: "professional" });
    return { kind: "professional" as const };
  }

  if (cookieValue.startsWith("pro:")) {
    const parts = cookieValue.slice("pro:".length).split(":");
    const userId = parts[0];
    const clinicId = parts[1] ?? "";
    if (userId) {
      setDemoSession(userId, clinicId, { kind: "professional" });
      return { kind: "professional" as const, userId, clinicId };
    }
  }

  if (cookieValue.startsWith("portal:")) {
    const parts = cookieValue.slice("portal:".length).split(":");
    const authUserId = parts[0];
    if (!authUserId) return null;
    const accesses = listActiveAccessesForUser(authUserId);
    if (accesses.length === 0) {
      return { kind: "portal_revoked" as const };
    }
    let selected = accesses[0]!;
    if (parts[1] && parts[2]) {
      const match = accesses.find(
        (a) => a.clinic_id === parts[1] && a.patient_id === parts[2],
      );
      if (match) selected = match;
    }
    setDemoSession(authUserId, selected.clinic_id, {
      patientId: selected.patient_id,
      kind: "portal",
    });
    return { kind: "portal" as const, authUserId };
  }

  return null;
}
