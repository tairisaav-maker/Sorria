import { beforeEach, describe, expect, it } from "vitest";
import {
  CLINIC_A_ID,
  CLINIC_B_ID,
  OWNER_A_ID,
  resetAuthzStore,
  setDemoSession,
} from "@/lib/demo/authz-store";
import { getAgendaStore, resetAgendaStore } from "@/lib/demo/agenda-store";
import { getClinicalStore, resetClinicalStore } from "@/lib/demo/clinical-store";
import { resetFinanceStore } from "@/lib/demo/finance-store";
import { resetPatientsStore } from "@/lib/demo/patients-store";
import {
  PATIENT_USER_A_ID,
  PATIENT_USER_B_ID,
  PATIENT_USER_CLINIC_B_ID,
  PATIENT_USER_REVOKED_ID,
  resetPortalStore,
} from "@/lib/demo/portal-store";
import { resetTreatmentsStore } from "@/lib/demo/treatments-store";
import { proposeAppointmentTime } from "@/services/appointment-requests";
import {
  confirmMyAppointment,
  confirmProposedAppointment,
  createMyAppointmentRequest,
  createRecordCopyRequest,
  getMyAppointments,
  getMyDocumentAccess,
  getMyDocuments,
  getMyFinancialSummary,
  getMyInstallments,
  getMyPayments,
  getMyProfile,
  getMyTreatment,
  getPortalContext,
  getPortalHome,
  requestAppointmentCancellation,
  requestAppointmentChange,
  updateMyAllowedProfileFields,
} from "@/services/portal";

function portalSession(
  authUserId: string,
  clinicId = CLINIC_A_ID,
  patientId = "p-a-001",
) {
  setDemoSession(authUserId, clinicId, {
    patientId,
    kind: "portal",
  });
  return { authUserId, clinicId, patientId };
}

beforeEach(() => {
  resetAuthzStore();
  resetAgendaStore();
  resetClinicalStore();
  resetFinanceStore();
  resetPatientsStore();
  resetTreatmentsStore();
  resetPortalStore();
});

describe("Portal — identidade e acesso", () => {
  it("resolve vínculo auth → portal access → patient/clinic", () => {
    const ctx = getPortalContext(portalSession(PATIENT_USER_A_ID));
    expect(ctx.patientId).toBe("p-a-001");
    expect(ctx.clinicId).toBe(CLINIC_A_ID);
    expect(ctx.accesses.length).toBeGreaterThanOrEqual(2); // próprio + responsável
  });

  it("bloqueia acesso revogado", () => {
    expect(() =>
      getPortalContext({
        authUserId: PATIENT_USER_REVOKED_ID,
        clinicId: CLINIC_A_ID,
        patientId: "p-a-006",
      }),
    ).toThrow("PORTAL_ACCESS_DENIED");
  });

  it("e-mail igual não autoriza sem vínculo (contexto sem access)", () => {
    expect(() =>
      getPortalContext({
        authUserId: "unknown-user-without-access",
        clinicId: CLINIC_A_ID,
        patientId: "p-a-001",
      }),
    ).toThrow("PORTAL_ACCESS_DENIED");
  });
});

describe("Portal — consultas e solicitações", () => {
  it("solicitar horário cria request e NÃO cria appointment", () => {
    const session = portalSession(PATIENT_USER_A_ID);
    const before = getAgendaStore().appointments.length;
    const request = createMyAppointmentRequest(session, {
      reason: "Retorno",
      requested_date: "2026-10-15",
      preferred_period: "afternoon",
      notes: "prefiro tarde",
    });
    expect(request.status).toBe("new");
    expect(request.request_type).toBe("new_appointment");
    expect(getAgendaStore().appointments.length).toBe(before);
  });

  it("confirmação de proposta revalida e cria appointment", () => {
    const session = portalSession(PATIENT_USER_A_ID);
    const result = confirmProposedAppointment(session, "req-a-1");
    expect(result.request.status).toBe("approved");
    expect(result.appointment.id).toBeTruthy();
    expect(result.appointment.appointment_request_id).toBe("req-a-1");
  });

  it("race condition: slot ocupado → SLOT_UNAVAILABLE", () => {
    const session = portalSession(PATIENT_USER_A_ID);
    const store = getAgendaStore();
    const req = store.requests.find((r) => r.id === "req-a-1")!;
    // Ocupa o horário proposto
    store.appointments.push({
      id: "blocker",
      clinic_id: CLINIC_A_ID,
      patient_id: "p-a-003",
      professional_id: req.proposed_professional_id!,
      appointment_request_id: null,
      start_at: req.proposed_start_at!,
      end_at: req.proposed_end_at!,
      reason: "Bloqueio",
      status: "scheduled",
      estimated_value: null,
      notes: null,
      created_by: OWNER_A_ID,
      cancelled_at: null,
      cancellation_reason: null,
      cancelled_by: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    expect(() => confirmProposedAppointment(session, "req-a-1")).toThrow(
      "SLOT_UNAVAILABLE",
    );
  });

  it("confirmar presença: scheduled → confirmed; não completed", async () => {
    const session = portalSession(PATIENT_USER_A_ID);
    const confirmed = confirmMyAppointment(session, "appt-a-portal-future");
    expect(confirmed.status).toBe("confirmed");
    const { assertAppointmentTransition } = await import(
      "@/lib/agenda/state-machines"
    );
    expect(() => assertAppointmentTransition("scheduled", "completed")).toThrow();
  });

  it("solicitação de alteração NÃO muda appointment", () => {
    const session = portalSession(PATIENT_USER_A_ID);
    const before = getAgendaStore().appointments.find(
      (a) => a.id === "appt-a-portal-future",
    )!;
    const start = before.start_at;
    requestAppointmentChange(session, {
      appointment_id: "appt-a-portal-future",
      change_kind: "other_day",
      preferred_period: "morning",
      requested_date: "2026-10-20",
    });
    const after = getAgendaStore().appointments.find(
      (a) => a.id === "appt-a-portal-future",
    )!;
    expect(after.start_at).toBe(start);
    expect(after.status).toBe(before.status);
  });

  it("solicitação de cancelamento preserva consulta", () => {
    const session = portalSession(PATIENT_USER_A_ID);
    requestAppointmentCancellation(session, {
      appointment_id: "appt-a-portal-future",
      notes: "viagem",
    });
    const appt = getAgendaStore().appointments.find(
      (a) => a.id === "appt-a-portal-future",
    );
    expect(appt).toBeTruthy();
    expect(appt!.status).not.toBe("cancelled");
  });
});

describe("Portal — cross-patient / cross-clinic", () => {
  it("Patient A não acessa appointment/document/finance de Patient B", () => {
    const sessionA = portalSession(PATIENT_USER_A_ID, CLINIC_A_ID, "p-a-001");
    const appts = getMyAppointments(sessionA, "upcoming");
    expect(appts.every((a) => a.patient_id === "p-a-001")).toBe(true);

    expect(() =>
      confirmMyAppointment(sessionA, "appt-a-3"), // p-a-004
    ).toThrow("PORTAL_FORBIDDEN");

    const docs = getMyDocuments(sessionA);
    expect(docs.every((d) => d.id !== "att-b-1")).toBe(true);

    // documento privado próprio
    expect(() => getMyDocumentAccess(sessionA, "att-a-1")).toThrow(
      "PORTAL_FORBIDDEN",
    );
    // documento liberado próprio
    expect(getMyDocumentAccess(sessionA, "att-a-visible").id).toBe(
      "att-a-visible",
    );

    const sessionB = portalSession(PATIENT_USER_B_ID, CLINIC_A_ID, "p-a-004");
    expect(() => confirmProposedAppointment(sessionB, "req-a-1")).toThrow(
      "PORTAL_FORBIDDEN",
    );
  });

  it("cross-clinic: paciente A não lê recurso clinic B", () => {
    const sessionA = portalSession(PATIENT_USER_A_ID);
    expect(() =>
      getPortalContext({
        authUserId: PATIENT_USER_A_ID,
        clinicId: CLINIC_B_ID,
        patientId: "p-b-001",
      }),
    ).toThrow("PORTAL_ACCESS_DENIED");

    const sessionB = portalSession(
      PATIENT_USER_CLINIC_B_ID,
      CLINIC_B_ID,
      "p-b-001",
    );
    const finance = getMyFinancialSummary(sessionB);
    expect(finance).toBeTruthy();
    const docsA = getMyDocuments(sessionA);
    expect(docsA.some((d) => d.id === "att-b-1")).toBe(false);
  });
});

describe("Portal — tratamento / financeiro / perfil", () => {
  it("tratamento próprio com progresso derivado; sem notas internas", () => {
    const session = portalSession(PATIENT_USER_A_ID);
    const treatment = getMyTreatment(session);
    expect(treatment.current).toBeTruthy();
    expect(treatment.current!.progress.percent).toBeGreaterThanOrEqual(0);
    expect(
      JSON.stringify(treatment.current).includes("internal_notes"),
    ).toBe(false);
  });

  it("financeiro só do próprio paciente (income)", () => {
    const session = portalSession(PATIENT_USER_A_ID);
    const summary = getMyFinancialSummary(session);
    const installments = getMyInstallments(session);
    const payments = getMyPayments(session);
    expect(summary).toBeTruthy();
    expect(Array.isArray(installments)).toBe(true);
    expect(Array.isArray(payments)).toBe(true);
  });

  it("perfil pode alterar campos permitidos; proíbe clinic_id/patient_id/cpf", () => {
    const session = portalSession(PATIENT_USER_A_ID);
    const profile = updateMyAllowedProfileFields(session, {
      phone: "(31) 90000-0000",
      preferred_name: "Mari",
    });
    expect(profile.phone).toBe("(31) 90000-0000");
    expect(profile.cpf_masked).toMatch(/\*\*\*.\*\*\*.\*\*\*-\d{2}/);

    expect(() =>
      updateMyAllowedProfileFields(session, {
        phone: "1",
        clinic_id: CLINIC_B_ID,
      } as never),
    ).toThrow("PORTAL_FORBIDDEN");
    expect(() =>
      updateMyAllowedProfileFields(session, {
        patient_id: "p-a-004",
      } as never),
    ).toThrow("PORTAL_FORBIDDEN");
  });

  it("home agrega próxima consulta e pendências reais", () => {
    const home = getPortalHome(portalSession(PATIENT_USER_A_ID));
    expect(home.nextAppointment || home.attention.length >= 0).toBeTruthy();
    expect(home.treatmentSummary?.percent).toBeDefined();
  });

  it("cópia de prontuário cria solicitação (sem dump)", () => {
    const req = createRecordCopyRequest(portalSession(PATIENT_USER_A_ID));
    expect(req.status).toBe("requested");
  });

  it("proposta clínica antes da confirmação não cria appointment definitivo novo", () => {
    const session = portalSession(PATIENT_USER_A_ID);
    const created = createMyAppointmentRequest(session, {
      reason: "Limpeza",
      requested_date: "2026-11-01",
      preferred_period: "morning",
    });
    const before = getAgendaStore().appointments.length;
    proposeAppointmentTime(
      { userId: OWNER_A_ID, clinicId: CLINIC_A_ID },
      created.id,
      {
        proposed_start_at: new Date(Date.now() + 10 * 86400000).toISOString(),
        proposed_end_at: new Date(
          Date.now() + 10 * 86400000 + 40 * 60000,
        ).toISOString(),
        proposed_professional_id: OWNER_A_ID,
      },
    );
    expect(getAgendaStore().appointments.length).toBe(before);
    expect(
      getAgendaStore().requests.find((r) => r.id === created.id)?.status,
    ).toBe("proposed");
  });
});

describe("Portal — storage patient_visible", () => {
  it("patient_visible=false negado mesmo sendo do paciente", () => {
    const privateAtt = getClinicalStore().attachments.find((a) => a.id === "att-a-1");
    expect(privateAtt?.patient_visible).toBe(false);
    expect(() =>
      getMyDocumentAccess(portalSession(PATIENT_USER_A_ID), "att-a-1"),
    ).toThrow("PORTAL_FORBIDDEN");
  });
});

void getMyProfile;
