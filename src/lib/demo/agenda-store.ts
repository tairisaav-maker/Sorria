import {
  CLINIC_A_ID,
  CLINIC_B_ID,
  DENTIST_A_ID,
  DENTIST_B_ID,
  OWNER_A_ID,
  appendAudit,
  getProfile,
} from "@/lib/demo/authz-store";
import { getPatientRecord } from "@/lib/demo/patients-store";
import type {
  Appointment,
  AppointmentRequest,
  AppointmentStatusHistory,
  AppointmentWithPatient,
  AppointmentRequestWithPatient,
} from "@/types/agenda";

type Store = {
  appointments: Appointment[];
  requests: AppointmentRequest[];
  history: AppointmentStatusHistory[];
};

declare global {
  var __sorriaAgendaStoreV3: Store | undefined;
}

function atDay(dayOffset: number, hour: number, minute = 0) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

function stamp(offsetHours = 0) {
  return new Date(Date.now() - offsetHours * 3600_000).toISOString();
}

function seed(): Store {
  const appointments: Appointment[] = [
    {
      id: "appt-a-1",
      clinic_id: CLINIC_A_ID,
      patient_id: "p-a-001",
      professional_id: OWNER_A_ID,
      appointment_request_id: null,
      start_at: atDay(0, 9, 0),
      end_at: atDay(0, 9, 40),
      reason: "Limpeza",
      status: "confirmed",
      estimated_value: 180,
      notes: null,
      created_by: OWNER_A_ID,
      cancelled_at: null,
      cancellation_reason: null,
      cancelled_by: null,
      created_at: stamp(48),
      updated_at: stamp(2),
    },
    {
      id: "appt-a-2",
      clinic_id: CLINIC_A_ID,
      patient_id: "p-a-003",
      professional_id: OWNER_A_ID,
      appointment_request_id: null,
      start_at: atDay(0, 10, 30),
      end_at: atDay(0, 11, 0),
      reason: "Avaliação",
      status: "scheduled",
      estimated_value: null,
      notes: null,
      created_by: OWNER_A_ID,
      cancelled_at: null,
      cancellation_reason: null,
      cancelled_by: null,
      created_at: stamp(24),
      updated_at: stamp(24),
    },
    {
      id: "appt-a-3",
      clinic_id: CLINIC_A_ID,
      patient_id: "p-a-004",
      professional_id: OWNER_A_ID,
      appointment_request_id: null,
      start_at: atDay(0, 14, 0),
      end_at: atDay(0, 14, 45),
      reason: "Retorno",
      status: "arrived",
      estimated_value: 120,
      notes: null,
      created_by: OWNER_A_ID,
      cancelled_at: null,
      cancellation_reason: null,
      cancelled_by: null,
      created_at: stamp(20),
      updated_at: stamp(1),
    },
    {
      id: "appt-a-4",
      clinic_id: CLINIC_A_ID,
      patient_id: "p-a-008",
      professional_id: DENTIST_A_ID,
      appointment_request_id: null,
      start_at: atDay(0, 16, 0),
      end_at: atDay(0, 16, 30),
      reason: "Avaliação",
      status: "in_progress",
      estimated_value: null,
      notes: null,
      created_by: OWNER_A_ID,
      cancelled_at: null,
      cancellation_reason: null,
      cancelled_by: null,
      created_at: stamp(10),
      updated_at: stamp(0.5),
    },
    {
      id: "appt-a-5",
      clinic_id: CLINIC_A_ID,
      patient_id: "p-a-002",
      professional_id: OWNER_A_ID,
      appointment_request_id: "req-a-5",
      start_at: atDay(-2, 11, 0),
      end_at: atDay(-2, 11, 40),
      reason: "Avaliação",
      status: "completed",
      estimated_value: 150,
      notes: null,
      created_by: OWNER_A_ID,
      cancelled_at: null,
      cancellation_reason: null,
      cancelled_by: null,
      created_at: stamp(72),
      updated_at: stamp(48),
    },
    {
      id: "appt-a-6",
      clinic_id: CLINIC_A_ID,
      patient_id: "p-a-006",
      professional_id: OWNER_A_ID,
      appointment_request_id: null,
      start_at: atDay(-1, 15, 0),
      end_at: atDay(-1, 15, 30),
      reason: "Retorno",
      status: "no_show",
      estimated_value: null,
      notes: null,
      created_by: OWNER_A_ID,
      cancelled_at: null,
      cancellation_reason: null,
      cancelled_by: null,
      created_at: stamp(40),
      updated_at: stamp(20),
    },
    {
      id: "appt-a-7",
      clinic_id: CLINIC_A_ID,
      patient_id: "p-a-005",
      professional_id: OWNER_A_ID,
      appointment_request_id: null,
      start_at: atDay(1, 9, 0),
      end_at: atDay(1, 9, 45),
      reason: "Limpeza",
      status: "scheduled",
      estimated_value: 200,
      notes: null,
      created_by: OWNER_A_ID,
      cancelled_at: null,
      cancellation_reason: null,
      cancelled_by: null,
      created_at: stamp(5),
      updated_at: stamp(5),
    },
    {
      id: "appt-a-8",
      clinic_id: CLINIC_A_ID,
      patient_id: "p-a-001",
      professional_id: OWNER_A_ID,
      appointment_request_id: null,
      start_at: atDay(-5, 10, 0),
      end_at: atDay(-5, 10, 30),
      reason: "Avaliação",
      status: "cancelled",
      estimated_value: null,
      notes: null,
      created_by: OWNER_A_ID,
      cancelled_at: stamp(100),
      cancellation_reason: "Paciente remarcou",
      cancelled_by: OWNER_A_ID,
      created_at: stamp(120),
      updated_at: stamp(100),
    },
    {
      id: "appt-b-1",
      clinic_id: CLINIC_B_ID,
      patient_id: "p-b-001",
      professional_id: DENTIST_B_ID,
      appointment_request_id: null,
      start_at: atDay(0, 10, 0),
      end_at: atDay(0, 10, 40),
      reason: "Avaliação",
      status: "confirmed",
      estimated_value: null,
      notes: "Clinic B — isolamento",
      created_by: DENTIST_B_ID,
      cancelled_at: null,
      cancellation_reason: null,
      cancelled_by: null,
      created_at: stamp(8),
      updated_at: stamp(8),
    },
  ];

  const requests: AppointmentRequest[] = [
    {
      id: "req-a-1",
      clinic_id: CLINIC_A_ID,
      patient_id: "p-a-001",
      requested_date: atDay(3, 0).slice(0, 10),
      preferred_period: "afternoon",
      reason: "Retorno",
      custom_reason: null,
      notes: "Prefere depois das 14h",
      status: "new",
      proposed_start_at: null,
      proposed_end_at: null,
      proposed_professional_id: null,
      reviewed_by: null,
      reviewed_at: null,
      rejection_reason: null,
      created_at: stamp(3),
      updated_at: stamp(3),
      cancelled_at: null,
    },
    {
      id: "req-a-2",
      clinic_id: CLINIC_A_ID,
      patient_id: "p-a-008",
      requested_date: atDay(2, 0).slice(0, 10),
      preferred_period: "morning",
      reason: "Dor/Urgência",
      custom_reason: null,
      notes: null,
      status: "under_review",
      proposed_start_at: null,
      proposed_end_at: null,
      proposed_professional_id: null,
      reviewed_by: OWNER_A_ID,
      reviewed_at: stamp(1),
      rejection_reason: null,
      created_at: stamp(10),
      updated_at: stamp(1),
      cancelled_at: null,
    },
    {
      id: "req-a-3",
      clinic_id: CLINIC_A_ID,
      patient_id: "p-a-004",
      requested_date: atDay(4, 0).slice(0, 10),
      preferred_period: "morning",
      reason: "Limpeza",
      custom_reason: null,
      notes: null,
      status: "proposed",
      proposed_start_at: atDay(4, 9, 30),
      proposed_end_at: atDay(4, 10, 15),
      proposed_professional_id: OWNER_A_ID,
      reviewed_by: OWNER_A_ID,
      reviewed_at: stamp(2),
      rejection_reason: null,
      created_at: stamp(30),
      updated_at: stamp(2),
      cancelled_at: null,
    },
    {
      id: "req-a-4",
      clinic_id: CLINIC_A_ID,
      patient_id: "p-a-003",
      requested_date: atDay(-3, 0).slice(0, 10),
      preferred_period: "evening",
      reason: "Outro",
      custom_reason: "Dúvida sobre clareamento",
      notes: null,
      status: "rejected",
      proposed_start_at: null,
      proposed_end_at: null,
      proposed_professional_id: null,
      reviewed_by: OWNER_A_ID,
      reviewed_at: stamp(40),
      rejection_reason: "Sem disponibilidade no período",
      created_at: stamp(50),
      updated_at: stamp(40),
      cancelled_at: null,
    },
    {
      id: "req-a-5",
      clinic_id: CLINIC_A_ID,
      patient_id: "p-a-002",
      requested_date: atDay(-6, 0).slice(0, 10),
      preferred_period: "morning",
      reason: "Avaliação",
      custom_reason: null,
      notes: null,
      status: "approved",
      proposed_start_at: atDay(-2, 11, 0),
      proposed_end_at: atDay(-2, 11, 40),
      proposed_professional_id: OWNER_A_ID,
      reviewed_by: OWNER_A_ID,
      reviewed_at: stamp(70),
      rejection_reason: null,
      created_at: stamp(90),
      updated_at: stamp(48),
      cancelled_at: null,
    },
    {
      id: "req-b-1",
      clinic_id: CLINIC_B_ID,
      patient_id: "p-b-001",
      requested_date: atDay(2, 0).slice(0, 10),
      preferred_period: "afternoon",
      reason: "Avaliação",
      custom_reason: null,
      notes: "Clinic B",
      status: "new",
      proposed_start_at: null,
      proposed_end_at: null,
      proposed_professional_id: null,
      reviewed_by: null,
      reviewed_at: null,
      rejection_reason: null,
      created_at: stamp(4),
      updated_at: stamp(4),
      cancelled_at: null,
    },
  ];

  return { appointments, requests, history: [] };
}

export function getAgendaStore() {
  if (!globalThis.__sorriaAgendaStoreV3) {
    globalThis.__sorriaAgendaStoreV3 = seed();
  }
  return globalThis.__sorriaAgendaStoreV3;
}

export function resetAgendaStore() {
  globalThis.__sorriaAgendaStoreV3 = seed();
}

export function withPatient(
  appointment: Appointment,
): AppointmentWithPatient {
  const patient = getPatientRecord(appointment.patient_id);
  const professional = getProfile(appointment.professional_id);
  return {
    ...appointment,
    patient_name: patient?.full_name ?? "Paciente",
    patient_phone: patient?.phone ?? null,
    professional_name: professional?.full_name ?? "Profissional",
  };
}

export function withRequestPatient(
  request: AppointmentRequest,
): AppointmentRequestWithPatient {
  const patient = getPatientRecord(request.patient_id);
  return {
    ...request,
    patient_name: patient?.full_name ?? "Paciente",
    patient_phone: patient?.phone ?? null,
  };
}

export function writeAgendaAudit(
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
