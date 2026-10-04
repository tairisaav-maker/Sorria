import { CLINIC_A_ID, OWNER_A_ID, appendAudit } from "@/lib/demo/authz-store";
import type { AppointmentPlannedProcedure } from "@/types/forecast";

type Store = {
  planned: AppointmentPlannedProcedure[];
};

declare global {
  var __sorriaPlannedProceduresStoreV1: Store | undefined;
}

function stamp(h = 0) {
  return new Date(Date.now() - h * 3600_000).toISOString();
}

function seed(): Store {
  const now = stamp(1);
  const planned: AppointmentPlannedProcedure[] = [
    {
      id: "plan-a-mariana-16",
      clinic_id: CLINIC_A_ID,
      appointment_id: "appt-a-1",
      patient_id: "p-a-001",
      procedure_id: "proc-a-restoration",
      procedure_name: "Restauração média",
      procedure_variant_id: null,
      tooth_number: 16,
      region: null,
      quantity: 1,
      notes: "Teste V1 — previsto na Agenda",
      created_by: OWNER_A_ID,
      created_at: now,
      updated_at: now,
      cancelled_at: null,
    },
    {
      id: "plan-a-joao-26",
      clinic_id: CLINIC_A_ID,
      appointment_id: "appt-a-joao",
      patient_id: "p-a-002",
      procedure_id: "proc-a-restoration",
      procedure_name: "Restauração média",
      procedure_variant_id: null,
      tooth_number: 26,
      region: null,
      quantity: 1,
      notes: null,
      created_by: OWNER_A_ID,
      created_at: now,
      updated_at: now,
      cancelled_at: null,
    },
    {
      id: "plan-a-joao-27",
      clinic_id: CLINIC_A_ID,
      appointment_id: "appt-a-joao",
      patient_id: "p-a-002",
      procedure_id: "proc-a-restoration",
      procedure_name: "Restauração média",
      procedure_variant_id: null,
      tooth_number: 27,
      region: null,
      quantity: 1,
      notes: null,
      created_by: OWNER_A_ID,
      created_at: now,
      updated_at: now,
      cancelled_at: null,
    },
    {
      id: "plan-a-ana-proph",
      clinic_id: CLINIC_A_ID,
      appointment_id: "appt-a-2",
      patient_id: "p-a-003",
      procedure_id: "proc-a-prophylaxis",
      procedure_name: "Profilaxia",
      procedure_variant_id: null,
      tooth_number: null,
      region: null,
      quantity: 1,
      notes: null,
      created_by: OWNER_A_ID,
      created_at: now,
      updated_at: now,
      cancelled_at: null,
    },
  ];
  return { planned };
}

export function getPlannedProceduresStore(): Store {
  if (!globalThis.__sorriaPlannedProceduresStoreV1) {
    globalThis.__sorriaPlannedProceduresStoreV1 = seed();
  }
  return globalThis.__sorriaPlannedProceduresStoreV1;
}

export function resetPlannedProceduresStore() {
  globalThis.__sorriaPlannedProceduresStoreV1 = seed();
}

export function writePlannedAudit(input: {
  clinic_id: string;
  actor_user_id: string;
  action: string;
  target_type: string;
  target_id: string;
  metadata?: Record<string, unknown>;
}) {
  appendAudit({
    clinic_id: input.clinic_id,
    actor_user_id: input.actor_user_id,
    action: input.action,
    target_type: input.target_type,
    target_id: input.target_id,
    metadata: input.metadata ?? {},
  });
}
