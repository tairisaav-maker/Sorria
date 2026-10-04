import {
  CLINIC_A_ID,
  CLINIC_B_ID,
  appendAudit,
} from "@/lib/demo/authz-store";
import type {
  PatientPortalAccess,
  PortalNotification,
  RecordCopyRequest,
} from "@/types/portal";

/** Auth users do Portal (demo) — distintos de profissionais. */
export const PATIENT_USER_A_ID = "p1000000-0000-0000-0000-000000000001"; // Mariana p-a-001
export const PATIENT_USER_B_ID = "p1000000-0000-0000-0000-000000000002"; // Camila p-a-004
export const PATIENT_USER_REVOKED_ID = "p1000000-0000-0000-0000-000000000003";
export const PATIENT_USER_CLINIC_B_ID = "p1000000-0000-0000-0000-0000000000b1";

export const PORTAL_DEMO_USERS = [
  {
    id: PATIENT_USER_A_ID,
    email: "paciente@sorria.app",
    password: "sorria-demo",
    full_name: "Mariana Oliveira",
  },
  {
    id: PATIENT_USER_B_ID,
    email: "paciente2@sorria.app",
    password: "sorria-demo",
    full_name: "Camila Ferreira",
  },
  {
    id: PATIENT_USER_REVOKED_ID,
    email: "revogado@sorria.app",
    password: "sorria-demo",
    full_name: "Acesso Revogado",
  },
  {
    id: PATIENT_USER_CLINIC_B_ID,
    email: "paciente.b@odontovida.app",
    password: "sorria-demo",
    full_name: "Paciente Clinic B",
  },
] as const;

type Store = {
  accesses: PatientPortalAccess[];
  copyRequests: RecordCopyRequest[];
  notifications: PortalNotification[];
};

declare global {
  var __sorriaPortalStoreV7: Store | undefined;
}

function stamp(h = 0) {
  return new Date(Date.now() - h * 3600_000).toISOString();
}

function seed(): Store {
  const now = stamp(0);
  const accesses: PatientPortalAccess[] = [
    {
      id: "ppa-a-001",
      clinic_id: CLINIC_A_ID,
      patient_id: "p-a-001",
      auth_user_id: PATIENT_USER_A_ID,
      status: "active",
      invited_at: stamp(200),
      activated_at: stamp(180),
      revoked_at: null,
      created_at: stamp(200),
      updated_at: stamp(180),
    },
    // Mesmo auth user como responsável do menor p-a-002 (arquitetura N:N)
    {
      id: "ppa-a-002-guardian",
      clinic_id: CLINIC_A_ID,
      patient_id: "p-a-002",
      auth_user_id: PATIENT_USER_A_ID,
      status: "active",
      invited_at: stamp(150),
      activated_at: stamp(140),
      revoked_at: null,
      created_at: stamp(150),
      updated_at: stamp(140),
    },
    {
      id: "ppa-a-004",
      clinic_id: CLINIC_A_ID,
      patient_id: "p-a-004",
      auth_user_id: PATIENT_USER_B_ID,
      status: "active",
      invited_at: stamp(100),
      activated_at: stamp(90),
      revoked_at: null,
      created_at: stamp(100),
      updated_at: stamp(90),
    },
    {
      id: "ppa-a-revoked",
      clinic_id: CLINIC_A_ID,
      patient_id: "p-a-006",
      auth_user_id: PATIENT_USER_REVOKED_ID,
      status: "revoked",
      invited_at: stamp(80),
      activated_at: stamp(70),
      revoked_at: stamp(10),
      created_at: stamp(80),
      updated_at: stamp(10),
    },
    {
      id: "ppa-b-001",
      clinic_id: CLINIC_B_ID,
      patient_id: "p-b-001",
      auth_user_id: PATIENT_USER_CLINIC_B_ID,
      status: "active",
      invited_at: stamp(50),
      activated_at: stamp(40),
      revoked_at: null,
      created_at: stamp(50),
      updated_at: stamp(40),
    },
  ];

  const copyRequests: RecordCopyRequest[] = [
    {
      id: "rcr-a-1",
      clinic_id: CLINIC_A_ID,
      patient_id: "p-a-001",
      status: "requested",
      requested_at: stamp(5),
      prepared_at: null,
      available_at: null,
      delivered_at: null,
      handled_by: null,
      notes: null,
      created_at: stamp(5),
      updated_at: stamp(5),
    },
  ];

  const notifications: PortalNotification[] = [
    {
      id: "pn-1",
      clinic_id: CLINIC_A_ID,
      patient_id: "p-a-001",
      auth_user_id: PATIENT_USER_A_ID,
      kind: "appointment_proposed",
      title: "A clínica propôs um horário",
      body: "Confira a proposta em Consultas → Solicitações.",
      read_at: null,
      created_at: stamp(2),
    },
    {
      id: "pn-2",
      clinic_id: CLINIC_A_ID,
      patient_id: "p-a-001",
      auth_user_id: PATIENT_USER_A_ID,
      kind: "document_available",
      title: "Novo documento disponível",
      body: "Um documento foi liberado para você.",
      read_at: null,
      created_at: stamp(8),
    },
  ];

  void now;
  return { accesses, copyRequests, notifications };
}

export function getPortalStore() {
  if (!globalThis.__sorriaPortalStoreV7) {
    globalThis.__sorriaPortalStoreV7 = seed();
  }
  return globalThis.__sorriaPortalStoreV7;
}

export function resetPortalStore() {
  globalThis.__sorriaPortalStoreV7 = seed();
}

export function writePortalAudit(
  clinicId: string,
  actorUserId: string,
  action: string,
  targetType: string,
  targetId: string,
  metadata: Record<string, unknown> = {},
) {
  appendAudit({
    clinic_id: clinicId,
    actor_user_id: actorUserId,
    action,
    target_type: targetType,
    target_id: targetId,
    metadata,
  });
}

export function listActiveAccessesForUser(authUserId: string) {
  return getPortalStore().accesses.filter(
    (a) => a.auth_user_id === authUserId && a.status === "active",
  );
}

export function findActiveAccess(
  authUserId: string,
  clinicId: string,
  patientId: string,
) {
  return (
    getPortalStore().accesses.find(
      (a) =>
        a.auth_user_id === authUserId &&
        a.clinic_id === clinicId &&
        a.patient_id === patientId &&
        a.status === "active",
    ) ?? null
  );
}
