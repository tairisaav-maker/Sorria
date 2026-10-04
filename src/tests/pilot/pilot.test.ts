import { beforeEach, describe, expect, it } from "vitest";
import {
  CLINIC_A_ID,
  OWNER_A_ID,
  SECRETARY_A_ID,
  resetAuthzStore,
  setDemoSession,
} from "@/lib/demo/authz-store";
import { resetPilotStore, getPilotStore } from "@/lib/demo/pilot-store";
import { resetInventoryStore } from "@/lib/demo/inventory-store";
import { resetPerformedStore } from "@/lib/demo/performed-procedures-store";
import { resetPatientsStore } from "@/lib/demo/patients-store";
import { resetAgendaStore } from "@/lib/demo/agenda-store";
import { sanitizePilotMeta } from "@/lib/pilot/events";
import { APP_CHANNEL, APP_VERSION } from "@/lib/version";
import {
  getPilotCoverageMetrics,
  getPilotPreparationChecklist,
  getProcedureMaterialVariance,
  submitPilotFeedback,
  trackPilotEvent,
} from "@/services/pilot";
import {
  completePerformedProcedure,
  createPerformedProcedure,
} from "@/services/performed-procedures";
import { confirmProcedureConsumption } from "@/services/procedure-consumption";

const ownerA = { userId: OWNER_A_ID, clinicId: CLINIC_A_ID };
const secretaryA = { userId: SECRETARY_A_ID, clinicId: CLINIC_A_ID };

beforeEach(() => {
  resetAuthzStore();
  resetPilotStore();
  resetInventoryStore();
  resetPerformedStore();
  resetPatientsStore();
  resetAgendaStore();
  setDemoSession(OWNER_A_ID, CLINIC_A_ID);
});

describe("piloto — versão", () => {
  it("canal pilot 0.9.0-pilot", () => {
    expect(APP_VERSION).toBe("0.9.0-pilot");
    expect(APP_CHANNEL).toBe("pilot");
  });
});

describe("piloto — eventos sem PHI", () => {
  it("sanitize remove campos clínicos e CPF", () => {
    const clean = sanitizePilotMeta({
      appointment_id: "a1",
      cpf: "52998224725",
      chief_complaint: "dor",
      clinical_exam: "exame longo",
      count: 2,
    });
    expect(clean.appointment_id).toBe("a1");
    expect(clean.count).toBe(2);
    expect(clean.cpf).toBeUndefined();
    expect(clean.chief_complaint).toBeUndefined();
    expect(clean.clinical_exam).toBeUndefined();
  });

  it("track e feedback funcionam", () => {
    trackPilotEvent(ownerA, {
      name: "appointment.started",
      route: "/app/agenda/atendimento/x",
      meta: { appointment_id: "x" },
    });
    expect(getPilotStore().events[0]?.name).toBe("appointment.started");

    const fb = submitPilotFeedback(ownerA, {
      kind: "friction",
      what_happened: "Muitos cliques no consumo",
      what_expected: "Um botão só",
      impact: "much",
      route: "/app/agenda/atendimento/x",
    });
    expect(fb.ok).toBe(true);
    expect(getPilotStore().feedback).toHaveLength(1);
  });

  it("rejeita evento desconhecido", () => {
    expect(() =>
      trackPilotEvent(ownerA, { name: "hack.event" }),
    ).toThrow();
  });
});

describe("piloto — checklist e métricas", () => {
  it("checklist tem 9 itens", () => {
    const c = getPilotPreparationChecklist(ownerA);
    expect(c.total).toBe(9);
    expect(c.items.some((i) => i.key === "procedures")).toBe(true);
  });

  it("cobertura sobe após consumo confirmado", () => {
    const before = getPilotCoverageMetrics(ownerA);
    const created = createPerformedProcedure(ownerA, {
      patient_id: "p-a-001",
      appointment_id: "appt-a-1",
      procedure_id: "proc-a-prophylaxis",
      charged_amount_reais: 150,
    });
    confirmProcedureConsumption(ownerA, {
      performed_procedure_id: created.procedure.id,
      confirm_insufficient_stock: true,
    });
    completePerformedProcedure(ownerA, created.procedure.id);
    const after = getPilotCoverageMetrics(ownerA);
    expect(after.procedures_registered).toBeGreaterThan(
      before.procedures_registered,
    );
    expect(after.consumption_confirmed).toBeGreaterThan(0);
  });

  it("variance não sugere revisão com poucas amostras", () => {
    const created = createPerformedProcedure(ownerA, {
      patient_id: "p-a-001",
      appointment_id: "appt-a-1",
      procedure_id: "proc-a-restoration",
      tooth_number: 16,
    });
    confirmProcedureConsumption(ownerA, {
      performed_procedure_id: created.procedure.id,
      confirm_insufficient_stock: true,
    });
    const v = getProcedureMaterialVariance(ownerA, "proc-a-restoration");
    expect(v.performed_count).toBeGreaterThanOrEqual(1);
    expect(v.has_review_suggestion).toBe(false);
  });
});

describe("piloto — permissões feedback list", () => {
  it("secretária sem clinic.settings não lista feedback", async () => {
    submitPilotFeedback(ownerA, {
      kind: "bug",
      what_happened: "Erro ao salvar",
      what_expected: "Salvar",
      impact: "some",
      route: "/app/home",
    });
    const { listPilotFeedback } = await import("@/services/pilot");
    expect(() => listPilotFeedback(secretaryA)).toThrow();
  });
});
