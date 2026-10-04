import { beforeEach, describe, expect, it } from "vitest";
import { can } from "@/lib/authz/can";
import {
  CLINIC_A_ID,
  CLINIC_B_ID,
  DENTIST_A_ID,
  DENTIST_B_ID,
  OWNER_A_ID,
  SECRETARY_A_ID,
  resetAuthzStore,
  setDemoSession,
  suspendMember,
} from "@/lib/demo/authz-store";
import { resetAgendaStore, getAgendaStore } from "@/lib/demo/agenda-store";
import { resetPatientsStore } from "@/lib/demo/patients-store";
import {
  cancelAppointment,
  changeAppointmentStatus,
  checkAvailability,
  createAppointment,
  getAppointment,
  listAppointments,
  rescheduleAppointment,
} from "@/services/appointments";
import { CLINICAL_PERMISSIONS } from "@/lib/permissions/keys";

const ownerA = { userId: OWNER_A_ID, clinicId: CLINIC_A_ID };
const secretaryA = { userId: SECRETARY_A_ID, clinicId: CLINIC_A_ID };
const dentistA = { userId: DENTIST_A_ID, clinicId: CLINIC_A_ID };

function slot(dayOffset: number, hour: number, durationMin = 60) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() + dayOffset);
  start.setHours(hour, 0, 0, 0);
  const end = new Date(start.getTime() + durationMin * 60_000);
  return { start_at: start.toISOString(), end_at: end.toISOString() };
}

beforeEach(() => {
  resetAuthzStore();
  resetPatientsStore();
  resetAgendaStore();
  setDemoSession(OWNER_A_ID, CLINIC_A_ID);
});

describe("agenda — CRUD e status", () => {
  it("cria consulta", () => {
    const times = slot(10, 8, 45);
    const appt = createAppointment(ownerA, {
      patient_id: "p-a-001",
      professional_id: OWNER_A_ID,
      ...times,
      reason: "Limpeza",
    });
    expect(appt.status).toBe("scheduled");
    expect(appt.clinic_id).toBe(CLINIC_A_ID);
  });

  it("confirma → chegada → inicia → conclui", () => {
    const times = slot(11, 9, 30);
    const created = createAppointment(ownerA, {
      patient_id: "p-a-001",
      professional_id: OWNER_A_ID,
      ...times,
      reason: "Avaliação",
    });
    changeAppointmentStatus(ownerA, created.id, { status: "confirmed" });
    changeAppointmentStatus(ownerA, created.id, { status: "arrived" });
    changeAppointmentStatus(ownerA, created.id, { status: "in_progress" });
    const done = changeAppointmentStatus(ownerA, created.id, {
      status: "completed",
    });
    expect(done.status).toBe("completed");
    expect(
      getAgendaStore().history.filter((h) => h.appointment_id === created.id)
        .length,
    ).toBeGreaterThanOrEqual(4);
  });

  it("reagenda preservando auditoria", () => {
    const times = slot(12, 10, 60);
    const created = createAppointment(ownerA, {
      patient_id: "p-a-003",
      professional_id: OWNER_A_ID,
      ...times,
      reason: "Retorno",
    });
    const next = slot(12, 15, 60);
    const moved = rescheduleAppointment(ownerA, created.id, {
      ...next,
      professional_id: OWNER_A_ID,
    });
    expect(moved.start_at).toBe(next.start_at);
    expect(getAppointment(ownerA, created.id).id).toBe(created.id);
  });

  it("cancela e marca falta", () => {
    const a = createAppointment(ownerA, {
      patient_id: "p-a-004",
      professional_id: OWNER_A_ID,
      ...slot(13, 8, 30),
      reason: "Avaliação",
    });
    const cancelled = cancelAppointment(ownerA, a.id, {
      cancellation_reason: "Paciente pediu",
    });
    expect(cancelled.status).toBe("cancelled");

    const b = createAppointment(ownerA, {
      patient_id: "p-a-004",
      professional_id: OWNER_A_ID,
      ...slot(13, 9, 30),
      reason: "Avaliação",
    });
    changeAppointmentStatus(ownerA, b.id, { status: "confirmed" });
    const missed = changeAppointmentStatus(ownerA, b.id, { status: "no_show" });
    expect(missed.status).toBe("no_show");
  });

  it("nega transição cancelled → in_progress", () => {
    const a = createAppointment(ownerA, {
      patient_id: "p-a-001",
      professional_id: OWNER_A_ID,
      ...slot(14, 8, 30),
    });
    cancelAppointment(ownerA, a.id, {});
    expect(() =>
      changeAppointmentStatus(ownerA, a.id, { status: "in_progress" }),
    ).toThrow(/inválida/);
  });
});

describe("conflitos", () => {
  it("nega overlap 10:00–11:00 + 10:30–11:30", () => {
    const base = slot(15, 10, 60);
    createAppointment(ownerA, {
      patient_id: "p-a-001",
      professional_id: OWNER_A_ID,
      ...base,
    });
    const conflictStart = new Date(base.start_at);
    conflictStart.setMinutes(30);
    const conflictEnd = new Date(conflictStart.getTime() + 60 * 60_000);
    expect(() =>
      createAppointment(ownerA, {
        patient_id: "p-a-003",
        professional_id: OWNER_A_ID,
        start_at: conflictStart.toISOString(),
        end_at: conflictEnd.toISOString(),
      }),
    ).toThrow("SLOT_UNAVAILABLE");
  });

  it("permite adjacente 10:00–11:00 + 11:00–12:00", () => {
    const first = slot(16, 10, 60);
    createAppointment(ownerA, {
      patient_id: "p-a-001",
      professional_id: OWNER_A_ID,
      ...first,
    });
    const second = slot(16, 11, 60);
    const ok = createAppointment(ownerA, {
      patient_id: "p-a-003",
      professional_id: OWNER_A_ID,
      ...second,
    });
    expect(ok.id).toBeTruthy();
  });

  it("consulta cancelada não bloqueia horário", () => {
    const times = slot(17, 10, 60);
    const a = createAppointment(ownerA, {
      patient_id: "p-a-001",
      professional_id: OWNER_A_ID,
      ...times,
    });
    cancelAppointment(ownerA, a.id, {});
    const again = createAppointment(ownerA, {
      patient_id: "p-a-003",
      professional_id: OWNER_A_ID,
      ...times,
    });
    expect(again.status).toBe("scheduled");
  });

  it("concorrência: segunda criação no mesmo slot falha", () => {
    const times = slot(18, 14, 60);
    createAppointment(ownerA, {
      patient_id: "p-a-001",
      professional_id: OWNER_A_ID,
      ...times,
    });
    const availability = checkAvailability({
      clinicId: CLINIC_A_ID,
      professionalId: OWNER_A_ID,
      startAt: times.start_at,
      endAt: times.end_at,
    });
    expect(availability.available).toBe(false);
    expect(() =>
      createAppointment(secretaryA, {
        patient_id: "p-a-004",
        professional_id: OWNER_A_ID,
        ...times,
      }),
    ).toThrow("SLOT_UNAVAILABLE");
  });
});

describe("segurança agenda", () => {
  it("Owner A lista Clinic A e não Clinic B", () => {
    const from = new Date();
    from.setDate(from.getDate() - 30);
    const to = new Date();
    to.setDate(to.getDate() + 30);
    const list = listAppointments(ownerA, {
      from: from.toISOString(),
      to: to.toISOString(),
    });
    expect(list.every((a) => a.clinic_id === CLINIC_A_ID)).toBe(true);
    expect(() => getAppointment(ownerA, "appt-b-1")).toThrow(
      "APPOINTMENT_NOT_FOUND",
    );
  });

  it("nega patient de outra clínica", () => {
    expect(() =>
      createAppointment(ownerA, {
        patient_id: "p-b-001",
        professional_id: OWNER_A_ID,
        ...slot(20, 9, 30),
      }),
    ).toThrow("PATIENT_TENANT_MISMATCH");
  });

  it("nega professional de outra clínica", () => {
    expect(() =>
      createAppointment(ownerA, {
        patient_id: "p-a-001",
        professional_id: DENTIST_B_ID,
        ...slot(20, 10, 30),
      }),
    ).toThrow("PROFESSIONAL_TENANT_MISMATCH");
  });

  it("secretária gerencia agenda sem prontuário", () => {
    expect(can(secretaryA, "appointments.view").allowed).toBe(true);
    expect(can(secretaryA, "appointments.create").allowed).toBe(true);
    expect(can(secretaryA, "appointment_requests.manage").allowed).toBe(true);
    for (const permission of CLINICAL_PERMISSIONS) {
      expect(can(secretaryA, permission).allowed).toBe(false);
    }
  });

  it("usuário suspenso é negado", () => {
    suspendMember({
      actorUserId: OWNER_A_ID,
      clinicId: CLINIC_A_ID,
      membershipId: "m-a-secretary",
    });
    expect(can(secretaryA, "appointments.view").allowed).toBe(false);
  });

  it("Secretary A não acessa Clinic B", () => {
    expect(
      can(
        { userId: SECRETARY_A_ID, clinicId: CLINIC_B_ID },
        "appointments.view",
      ).allowed,
    ).toBe(false);
  });

  it("dentista pode atualizar status", () => {
    const a = createAppointment(dentistA, {
      patient_id: "p-a-001",
      professional_id: DENTIST_A_ID,
      ...slot(21, 9, 30),
    });
    const confirmed = changeAppointmentStatus(dentistA, a.id, {
      status: "confirmed",
    });
    expect(confirmed.status).toBe("confirmed");
  });
});
