import { beforeEach, describe, expect, it } from "vitest";
import {
  CLINIC_A_ID,
  CLINIC_B_ID,
  OWNER_A_ID,
  SECRETARY_A_ID,
  resetAuthzStore,
  setDemoSession,
} from "@/lib/demo/authz-store";
import { resetAgendaStore, getAgendaStore } from "@/lib/demo/agenda-store";
import { resetPatientsStore } from "@/lib/demo/patients-store";
import {
  approveAppointmentRequest,
  cancelAppointmentRequest,
  createAppointmentRequest,
  listAppointmentRequests,
  proposeAppointmentTime,
  rejectAppointmentRequest,
  reviewAppointmentRequest,
} from "@/services/appointment-requests";
import { createAppointment } from "@/services/appointments";

const ownerA = { userId: OWNER_A_ID, clinicId: CLINIC_A_ID };

function futureSlot(dayOffset: number, hour: number, durationMin = 45) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() + dayOffset);
  start.setHours(hour, 0, 0, 0);
  const end = new Date(start.getTime() + durationMin * 60_000);
  return {
    proposed_start_at: start.toISOString(),
    proposed_end_at: end.toISOString(),
    proposed_professional_id: OWNER_A_ID,
  };
}

beforeEach(() => {
  resetAuthzStore();
  resetPatientsStore();
  resetAgendaStore();
  setDemoSession(OWNER_A_ID, CLINIC_A_ID);
});

describe("solicitações — fluxo", () => {
  it("new → under_review → proposed → approved cria appointment", () => {
    const created = createAppointmentRequest(ownerA, {
      patient_id: "p-a-001",
      preferred_period: "afternoon",
      reason: "Retorno",
      requested_date: "2026-10-20",
    });
    expect(created.status).toBe("new");

    reviewAppointmentRequest(ownerA, created.id);
    const proposal = futureSlot(25, 14);
    proposeAppointmentTime(ownerA, created.id, proposal);

    const result = approveAppointmentRequest(ownerA, created.id);
    expect(result.request.status).toBe("approved");
    expect(result.appointment.appointment_request_id).toBe(created.id);
    expect(result.appointment.status).toBe("confirmed");
  });

  it("new → rejected", () => {
    const created = createAppointmentRequest(ownerA, {
      patient_id: "p-a-003",
      preferred_period: "morning",
      reason: "Avaliação",
    });
    const rejected = rejectAppointmentRequest(ownerA, created.id, {
      rejection_reason: "Sem disponibilidade",
    });
    expect(rejected.status).toBe("rejected");
  });

  it("proposed → cancelled", () => {
    const created = createAppointmentRequest(ownerA, {
      patient_id: "p-a-004",
      preferred_period: "evening",
      reason: "Limpeza",
    });
    proposeAppointmentTime(ownerA, created.id, futureSlot(26, 18));
    const cancelled = cancelAppointmentRequest(ownerA, created.id);
    expect(cancelled.status).toBe("cancelled");
  });

  it("proposta NÃO cria consulta", () => {
    const before = getAgendaStore().appointments.length;
    const created = createAppointmentRequest(ownerA, {
      patient_id: "p-a-008",
      preferred_period: "morning",
      reason: "Dor/Urgência",
    });
    proposeAppointmentTime(ownerA, created.id, futureSlot(27, 9));
    expect(getAgendaStore().appointments.length).toBe(before);
  });

  it("confirmação revalida disponibilidade", () => {
    const created = createAppointmentRequest(ownerA, {
      patient_id: "p-a-001",
      preferred_period: "morning",
      reason: "Avaliação",
    });
    const proposal = futureSlot(28, 10);
    proposeAppointmentTime(ownerA, created.id, proposal);

    createAppointment(ownerA, {
      patient_id: "p-a-003",
      professional_id: OWNER_A_ID,
      start_at: proposal.proposed_start_at,
      end_at: proposal.proposed_end_at,
      reason: "Outra consulta",
    });

    expect(() => approveAppointmentRequest(ownerA, created.id)).toThrow(
      "SLOT_UNAVAILABLE",
    );
    const still = getAgendaStore().requests.find((r) => r.id === created.id);
    expect(still?.status).toBe("proposed");
  });
});

describe("solicitações — isolamento", () => {
  it("lista só do tenant", () => {
    const items = listAppointmentRequests(ownerA, "all");
    expect(items.every((r) => r.clinic_id === CLINIC_A_ID)).toBe(true);
    expect(items.some((r) => r.clinic_id === CLINIC_B_ID)).toBe(false);
  });

  it("secretária pode gerenciar na própria clínica", () => {
    const secretary = { userId: SECRETARY_A_ID, clinicId: CLINIC_A_ID };
    const created = createAppointmentRequest(secretary, {
      patient_id: "p-a-001",
      preferred_period: "afternoon",
      reason: "Retorno",
    });
    expect(created.status).toBe("new");
  });
});
