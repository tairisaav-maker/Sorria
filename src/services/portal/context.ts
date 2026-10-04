import { getClinic, getProfile } from "@/lib/demo/authz-store";
import { getPatientRecord } from "@/lib/demo/patients-store";
import {
  findActiveAccess,
  listActiveAccessesForUser,
} from "@/lib/demo/portal-store";
import type { PortalContext } from "@/types/portal";

export type PortalSession = {
  authUserId: string;
  /** Clínica ativa do contexto portal (selecionável se multi). */
  clinicId?: string | null;
  /** Paciente ativo do contexto (selecionável se multi / responsável). */
  patientId?: string | null;
};

/**
 * Resolve vínculo Portal a partir da sessão — NUNCA do patientId da URL.
 */
export function getPortalContext(session: PortalSession): PortalContext {
  const accesses = listActiveAccessesForUser(session.authUserId);
  if (accesses.length === 0) {
    throw new Error("PORTAL_ACCESS_DENIED");
  }

  let selected = null as ReturnType<typeof findActiveAccess>;

  if (session.clinicId && session.patientId) {
    selected = findActiveAccess(
      session.authUserId,
      session.clinicId,
      session.patientId,
    );
    if (!selected) {
      throw new Error("PORTAL_ACCESS_DENIED");
    }
  } else {
    selected = accesses[0]!;
  }

  const patient = getPatientRecord(selected.patient_id);
  const clinic = getClinic(selected.clinic_id);
  if (!patient || !clinic) {
    throw new Error("PORTAL_ACCESS_DENIED");
  }

  return {
    authUserId: session.authUserId,
    clinicId: selected.clinic_id,
    clinicName: clinic.name,
    patientId: selected.patient_id,
    patientName: patient.full_name,
    preferredName: patient.preferred_name,
    accessId: selected.id,
    accesses: accesses.map((a) => {
      const p = getPatientRecord(a.patient_id);
      const c = getClinic(a.clinic_id);
      return {
        accessId: a.id,
        clinicId: a.clinic_id,
        clinicName: c?.name ?? "Clínica",
        patientId: a.patient_id,
        patientName: p?.full_name ?? "Paciente",
      };
    }),
  };
}

export function assertPortalOwnsResource(
  ctx: PortalContext,
  resource: { clinic_id: string; patient_id: string },
) {
  if (
    resource.clinic_id !== ctx.clinicId ||
    resource.patient_id !== ctx.patientId
  ) {
    throw new Error("PORTAL_FORBIDDEN");
  }
}

export function getPortalProfileName(authUserId: string) {
  return getProfile(authUserId)?.full_name ?? null;
}
