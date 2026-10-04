import { beforeEach, describe, expect, it } from "vitest";
import { can } from "@/lib/authz/can";
import {
  CLINIC_A_ID,
  CLINIC_B_ID,
  DENTIST_A_ID,
  DENTIST_B_ID,
  OWNER_A_ID,
  SECRETARY_A_ID,
  ensureAdminOwnerWithoutClinical,
  getAuthzStore,
  resetAuthzStore,
  setDemoSession,
} from "@/lib/demo/authz-store";
import { resetAgendaStore } from "@/lib/demo/agenda-store";
import { resetClinicalStore } from "@/lib/demo/clinical-store";
import { resetPatientsStore } from "@/lib/demo/patients-store";
import {
  getTreatmentsStore,
  resetTreatmentsStore,
} from "@/lib/demo/treatments-store";
import { calculatePlanTotals, lineTotalCents, reaisToCents } from "@/lib/treatments/money";
import {
  assertPlanTransition,
  canTransitionPlan,
} from "@/lib/treatments/state-machine";
import { getAnamnesis } from "@/services/anamnesis";
import { listClinicalEntries } from "@/services/clinical";
import {
  acceptTreatmentPlan,
  addTreatmentItem,
  completeTreatmentItem,
  completeTreatmentPlan,
  createTreatmentPlan,
  createTreatmentPlanRevision,
  getTreatmentPlan,
  listTreatmentPlans,
  presentTreatmentPlan,
  rejectTreatmentPlan,
  startTreatmentItem,
  updateTreatmentPlanDraft,
} from "@/services/treatments";
import { TREATMENT_CLINICAL_PERMISSIONS } from "@/lib/permissions/keys";
import { permissionsForRole } from "@/lib/demo/authz-store";

const ownerA = { userId: OWNER_A_ID, clinicId: CLINIC_A_ID };
const dentistA = { userId: DENTIST_A_ID, clinicId: CLINIC_A_ID };
const secretaryA = { userId: SECRETARY_A_ID, clinicId: CLINIC_A_ID };
const dentistB = { userId: DENTIST_B_ID, clinicId: CLINIC_B_ID };

beforeEach(() => {
  resetAuthzStore();
  resetPatientsStore();
  resetAgendaStore();
  resetClinicalStore();
  resetTreatmentsStore();
  setDemoSession(OWNER_A_ID, CLINIC_A_ID);
});

describe("cálculos monetários", () => {
  it("quantity × unit_price em centavos", () => {
    expect(lineTotalCents(2, 15050)).toBe(30100);
    expect(reaisToCents(10.5)).toBe(1050);
    expect(reaisToCents("10,99")).toBe(1099);
  });

  it("subtotal, desconto percentual e fixo", () => {
    const items = [
      { quantity: 1, unit_price_cents: 10000 },
      { quantity: 2, unit_price_cents: 5000 },
    ];
    expect(calculatePlanTotals({ items }).subtotal_cents).toBe(20000);

    const pct = calculatePlanTotals({
      items,
      discount_type: "percent",
      discount_percent: 10,
    });
    expect(pct.discount_cents).toBe(2000);
    expect(pct.total_cents).toBe(18000);

    const fixed = calculatePlanTotals({
      items,
      discount_type: "fixed",
      discount_value_cents: 5000,
    });
    expect(fixed.total_cents).toBe(15000);
  });

  it("impede total negativo e percentual > 100", () => {
    const over = calculatePlanTotals({
      items: [{ quantity: 1, unit_price_cents: 1000 }],
      discount_type: "fixed",
      discount_value_cents: 99999,
    });
    expect(over.total_cents).toBe(0);

    const pct = calculatePlanTotals({
      items: [{ quantity: 1, unit_price_cents: 10000 }],
      discount_type: "percent",
      discount_percent: 150,
    });
    expect(pct.discount_cents).toBe(10000);
    expect(pct.total_cents).toBe(0);
  });

  it("ignora itens cancelados no subtotal", () => {
    const totals = calculatePlanTotals({
      items: [
        { quantity: 1, unit_price_cents: 10000, status: "planned" },
        { quantity: 1, unit_price_cents: 5000, status: "cancelled" },
      ],
    });
    expect(totals.subtotal_cents).toBe(10000);
  });
});

describe("state machine do plano", () => {
  it("fluxo principal e recusa", () => {
    expect(canTransitionPlan("draft", "presented")).toBe(true);
    expect(canTransitionPlan("presented", "accepted")).toBe(true);
    expect(canTransitionPlan("accepted", "in_progress")).toBe(true);
    expect(canTransitionPlan("in_progress", "completed")).toBe(true);
    expect(canTransitionPlan("presented", "rejected")).toBe(true);
    expect(canTransitionPlan("draft", "accepted")).toBe(false);
    expect(canTransitionPlan("rejected", "accepted")).toBe(false);
    expect(() => assertPlanTransition("completed", "draft")).toThrow();
  });
});

describe("criação e itens", () => {
  it("cria plano com itens, dentes e desconto", () => {
    const plan = createTreatmentPlan(dentistA, {
      patient_id: "p-a-003",
      title: "Plano teste",
      valid_until: "2026-12-31",
      discount_type: "percent",
      discount_percent: 10,
    });
    expect(plan.status).toBe("draft");
    expect(plan.total_cents).toBe(0);

    addTreatmentItem(dentistA, {
      treatment_plan_id: plan.id,
      procedure_name: "Profilaxia",
      tooth_numbers: [],
      quantity: 1,
      unit_price_reais: 100,
    });
    addTreatmentItem(dentistA, {
      treatment_plan_id: plan.id,
      procedure_name: "Restauração",
      tooth_numbers: [16],
      quantity: 1,
      unit_price_reais: 200,
    });
    const multi = addTreatmentItem(dentistA, {
      treatment_plan_id: plan.id,
      procedure_name: "Clareamento",
      tooth_numbers: [11, 12, 21, 22],
      quantity: 1,
      unit_price_reais: 500,
    });

    expect(multi.items).toHaveLength(3);
    expect(multi.subtotal_cents).toBe(80000);
    expect(multi.total_cents).toBe(72000);
    expect(multi.items[2]!.tooth_numbers).toEqual([11, 12, 21, 22]);
  });

  it("bloqueia apresentação sem itens", () => {
    const plan = createTreatmentPlan(dentistA, {
      patient_id: "p-a-003",
      title: "Vazio",
    });
    expect(() => presentTreatmentPlan(dentistA, plan.id)).toThrow(/procedimento/);
  });
});

describe("apresentação, aceite, recusa e progresso", () => {
  it("draft → presented → accepted → in_progress → completed", () => {
    const plan = createTreatmentPlan(dentistA, {
      patient_id: "p-a-003",
      title: "Fluxo completo",
    });
    addTreatmentItem(dentistA, {
      treatment_plan_id: plan.id,
      procedure_name: "Avaliação",
      quantity: 1,
      unit_price_reais: 50,
      tooth_numbers: [],
    });
    addTreatmentItem(dentistA, {
      treatment_plan_id: plan.id,
      procedure_name: "Profilaxia",
      quantity: 1,
      unit_price_reais: 80,
      tooth_numbers: [],
    });

    let current = presentTreatmentPlan(dentistA, plan.id);
    expect(current.status).toBe("presented");
    expect(current.presented_by).toBe(DENTIST_A_ID);
    expect(getTreatmentsStore().versions.some((v) => v.treatment_plan_id === plan.id)).toBe(
      true,
    );

    current = acceptTreatmentPlan(dentistA, plan.id);
    expect(current.status).toBe("accepted");
    expect(current.accepted_version).toBe(1);
    expect(current.items.every((i) => i.status === "accepted")).toBe(true);

    const first = current.items[0]!;
    current = startTreatmentItem(dentistA, first.id);
    expect(current.status).toBe("in_progress");

    current = completeTreatmentItem(dentistA, first.id);
    expect(current.items.find((i) => i.id === first.id)?.status).toBe("completed");

    const second = current.items[1]!;
    current = completeTreatmentItem(dentistA, second.id);
    current = completeTreatmentPlan(dentistA, plan.id);
    expect(current.status).toBe("completed");
  });

  it("presented → rejected preserva histórico", () => {
    const rejected = rejectTreatmentPlan(secretaryA, {
      id: "tp-a-presented",
      rejection_reason: "Questão financeira",
    });
    expect(rejected.status).toBe("rejected");
    expect(getTreatmentPlan(ownerA, "tp-a-presented").status).toBe("rejected");
  });
});

describe("versionamento e aceite", () => {
  it("alteração material após apresentação gera revisão; snapshot antigo permanece", () => {
    const plan = createTreatmentPlan(dentistA, {
      patient_id: "p-a-003",
      title: "Versão R$ 2000",
    });
    addTreatmentItem(dentistA, {
      treatment_plan_id: plan.id,
      procedure_name: "Restauração",
      tooth_numbers: [16],
      quantity: 1,
      unit_price_reais: 2000,
    });
    presentTreatmentPlan(dentistA, plan.id);
    const versionBefore = getTreatmentsStore().versions.find(
      (v) => v.treatment_plan_id === plan.id && v.version_number === 1,
    );
    expect(versionBefore?.snapshot_json.total_cents).toBe(200000);

    createTreatmentPlanRevision(dentistA, plan.id, "Ajuste de valores");
    const revised = getTreatmentPlan(dentistA, plan.id);
    expect(revised.status).toBe("draft");
    expect(revised.version_number).toBe(2);
    expect(revised.accepted_at).toBeNull();
    expect(revised.accepted_version).toBeNull();

    // Snapshot v1 intacto
    const still = getTreatmentsStore().versions.find(
      (v) => v.treatment_plan_id === plan.id && v.version_number === 1,
    );
    expect(still?.snapshot_json.total_cents).toBe(200000);

    // Novo valor
    const items = getTreatmentsStore().items.filter((i) => i.treatment_plan_id === plan.id);
    items[0]!.unit_price_cents = 300000;
    updateTreatmentPlanDraft(dentistA, {
      id: plan.id,
      title: "Versão R$ 3000",
    });
    const after = getTreatmentPlan(dentistA, plan.id);
    expect(after.total_cents).toBe(300000);
    expect(after.status).toBe("draft");
  });

  it("aceite referencia versão e não cria pagamento", () => {
    const plan = acceptTreatmentPlan(dentistA, "tp-a-presented");
    expect(plan.status).toBe("accepted");
    expect(plan.accepted_version).toBe(1);
    expect(plan.accepted_at).toBeTruthy();
    const audits = getAuthzStore().auditLogs.filter(
      (a) => a.action === "treatment_plan.accepted",
    );
    expect(audits.length).toBeGreaterThan(0);
    expect(
      audits.some((a) => a.metadata && "payment" in (a.metadata as object)),
    ).toBe(false);
  });
});

describe("progresso derivado", () => {
  it("2/5 = 40% e 5/5 = 100%", () => {
    const plan = createTreatmentPlan(dentistA, {
      patient_id: "p-a-003",
      title: "Progresso",
    });
    for (let i = 0; i < 5; i++) {
      addTreatmentItem(dentistA, {
        treatment_plan_id: plan.id,
        procedure_name: `Proc ${i}`,
        quantity: 1,
        unit_price_reais: 10,
        tooth_numbers: [],
      });
    }
    presentTreatmentPlan(dentistA, plan.id);
    acceptTreatmentPlan(dentistA, plan.id);
    const items = getTreatmentPlan(dentistA, plan.id).items;
    completeTreatmentItem(dentistA, items[0]!.id);
    completeTreatmentItem(dentistA, items[1]!.id);
    let current = getTreatmentPlan(dentistA, plan.id);
    expect(current.progress).toEqual({ completed: 2, total: 5, percent: 40 });

    for (const item of current.items.slice(2)) {
      completeTreatmentItem(dentistA, item.id);
    }
    current = getTreatmentPlan(dentistA, plan.id);
    expect(current.progress.percent).toBe(100);
  });
});

describe("odontograma → plano (source)", () => {
  it("aceita source da mesma clínica/paciente e nega cross-tenant", () => {
    const plan = createTreatmentPlan(dentistA, {
      patient_id: "p-a-001",
      title: "Do odontograma",
    });
    const ok = addTreatmentItem(dentistA, {
      treatment_plan_id: plan.id,
      procedure_name: "Restauração",
      tooth_numbers: [16],
      quantity: 1,
      unit_price_reais: 450,
      source_odontogram_entry_id: "odo-p-a-001-16",
    });
    expect(ok.items[0]!.source_odontogram_entry_id).toBe("odo-p-a-001-16");

    expect(() =>
      addTreatmentItem(dentistA, {
        treatment_plan_id: plan.id,
        procedure_name: "Hack",
        tooth_numbers: [21],
        quantity: 1,
        unit_price_reais: 10,
        source_odontogram_entry_id: "odo-p-b-001-21",
      }),
    ).toThrow("SOURCE_TENANT_MISMATCH");
  });
});

describe("permissões secretária e owner", () => {
  it("secretária vê administrativo do plano, não prontuário", () => {
    expect(can(secretaryA, "treatments.administrative_view").allowed).toBe(true);
    expect(can(secretaryA, "treatments.present").allowed).toBe(true);
    expect(can(secretaryA, "treatments.acceptance_manage").allowed).toBe(true);
    expect(can(secretaryA, "anamnesis.view").allowed).toBe(false);
    expect(can(secretaryA, "clinical_evolution.view").allowed).toBe(false);
    expect(can(secretaryA, "clinical_files.view").allowed).toBe(false);
    expect(() => getAnamnesis(secretaryA, "p-a-001")).toThrow("AUTHORIZATION_DENIED");
    expect(() => listClinicalEntries(secretaryA, "p-a-001")).toThrow(
      "AUTHORIZATION_DENIED",
    );
    expect(listTreatmentPlans(secretaryA, "p-a-001").length).toBeGreaterThan(0);
  });

  it("owner sem clinical_access não ganha treatments clínicos", () => {
    for (const key of TREATMENT_CLINICAL_PERMISSIONS) {
      expect(permissionsForRole("owner")).not.toContain(key);
    }
    const admin = ensureAdminOwnerWithoutClinical();
    expect(can(admin, "treatments.administrative_view").allowed).toBe(true);
    expect(can(admin, "treatments.create").allowed).toBe(false);
    expect(can(admin, "treatments.view").allowed).toBe(false);
  });
});

describe("cross-clinic", () => {
  it("usuário da Clinic A não acessa plano da Clinic B", () => {
    expect(() => getTreatmentPlan(ownerA, "tp-b-1")).toThrow("TREATMENT_PLAN_NOT_FOUND");
    expect(() => getTreatmentPlan(dentistA, "tp-b-1")).toThrow("TREATMENT_PLAN_NOT_FOUND");
  });

  it("usuário da Clinic B não acessa plano da Clinic A", () => {
    expect(() => getTreatmentPlan(dentistB, "tp-a-progress")).toThrow(
      "TREATMENT_PLAN_NOT_FOUND",
    );
  });
});

describe("plano vencido", () => {
  it("bloqueia aceite silencioso após validade", () => {
    const plan = createTreatmentPlan(dentistA, {
      patient_id: "p-a-003",
      title: "Vencido",
      valid_until: "2020-01-01",
    });
    addTreatmentItem(dentistA, {
      treatment_plan_id: plan.id,
      procedure_name: "Avaliação",
      quantity: 1,
      unit_price_reais: 10,
      tooth_numbers: [],
    });
    presentTreatmentPlan(dentistA, plan.id);
    expect(() => acceptTreatmentPlan(dentistA, plan.id)).toThrow("PLAN_EXPIRED");
  });
});

describe("concorrência otimista", () => {
  it("falha com expected_updated_at desatualizado", () => {
    expect(() =>
      updateTreatmentPlanDraft(dentistA, {
        id: "tp-a-draft",
        title: "Conflito",
        expected_updated_at: "2000-01-01T00:00:00.000Z",
      }),
    ).toThrow("CONCURRENCY_CONFLICT");
  });
});
