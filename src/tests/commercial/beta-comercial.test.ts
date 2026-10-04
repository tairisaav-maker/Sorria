import { beforeEach, describe, expect, it } from "vitest";
import {
  CLINIC_A_ID,
  OWNER_A_ID,
  resetAuthzStore,
  setDemoSession,
} from "@/lib/demo/authz-store";
import { resetAgendaStore } from "@/lib/demo/agenda-store";
import { resetBillingStore, getBillingStore } from "@/lib/demo/billing-store";
import {
  getCommercialStore,
  resetCommercialStore,
} from "@/lib/demo/commercial-store";
import { resetInventoryStore } from "@/lib/demo/inventory-store";
import { resetPerformedStore } from "@/lib/demo/performed-procedures-store";
import { sanitizeCommercialMeta } from "@/lib/commercial/events";
import {
  getCommercialActivation,
  getInviteOnlyStatus,
  recordCancelFeedback,
  submitLead,
  trackCommercialEventPublic,
  validateBetaInvite,
} from "@/services/commercial";
import {
  createClinicForOwner,
  listPublicPlans,
  signupAccount,
} from "@/services/saas";

beforeEach(() => {
  resetAuthzStore();
  resetBillingStore();
  resetCommercialStore();
  resetAgendaStore();
  resetInventoryStore();
  resetPerformedStore();
  setDemoSession(OWNER_A_ID, CLINIC_A_ID);
  delete process.env.COMMERCIAL_BETA_INVITE_ONLY;
});

describe("Subfase 12 — lead", () => {
  it("aceita lead válido uma vez", () => {
    const first = submitLead({
      name: "Dra. Ana",
      email: "ana@example.com",
      dentists_count: 2,
      cost_control_today: "planilha",
    });
    expect(first.ok).toBe(true);
    expect(first.duplicate).toBe(false);
    // segundo submit do mesmo e-mail após janela de lock
    getCommercialStore().lead_submit_locks = {};
    const second = submitLead({
      name: "Dra. Ana",
      email: "ana@example.com",
      dentists_count: 2,
      cost_control_today: "planilha",
    });
    expect(second.duplicate).toBe(true);
    expect(getCommercialStore().leads).toHaveLength(1);
  });

  it("bloqueia duplo clique rápido", () => {
    submitLead({
      name: "Dr. B",
      email: "b@example.com",
      dentists_count: 1,
      cost_control_today: "nao_controlo",
    });
    expect(() =>
      submitLead({
        name: "Dr. B2",
        email: "outro-mesmo-lock@example.com",
        dentists_count: 1,
        cost_control_today: "nao_controlo",
      }),
    ).not.toThrow();
    // mesmo e-mail em <4s
    expect(() =>
      submitLead({
        name: "Dr. B",
        email: "b@example.com",
        dentists_count: 1,
        cost_control_today: "nao_controlo",
      }),
    ).toThrow("LEAD_DUPLICATE_SUBMIT");
  });
});

describe("Subfase 12 — planos públicos", () => {
  it("landing/planos refletem configuração ativa", () => {
    const plans = listPublicPlans();
    expect(plans.length).toBeGreaterThanOrEqual(2);
    expect(plans.map((p) => p.name)).toEqual(
      expect.arrayContaining(["Individual", "Clínica"]),
    );
    for (const p of plans) {
      expect(p.entitlements).toContain("procedure_costing");
    }
    expect(plans.every((p) => p.price_placeholder)).toBe(true);
  });
});

describe("Subfase 12 — invite-only", () => {
  it("aberto por padrão", () => {
    expect(getInviteOnlyStatus().invite_only).toBe(false);
    expect(validateBetaInvite(null).valid).toBe(true);
  });

  it("sem convite bloqueia; com convite válido entra", () => {
    process.env.COMMERCIAL_BETA_INVITE_ONLY = "true";
    expect(validateBetaInvite(null).valid).toBe(false);
    expect(validateBetaInvite("SORRIA-BETA").valid).toBe(true);
    expect(() =>
      signupAccount({
        full_name: "Sem Convite",
        email: "sem@example.com",
        password: "senha-segura-1",
      }),
    ).toThrow("INVITE_REQUIRED");

    const ok = signupAccount({
      full_name: "Com Convite",
      email: "com@example.com",
      password: "senha-segura-1",
      invite_code: "SORRIA-BETA",
    });
    const clinic = createClinicForOwner(ok.user_id, {
      name: "Clinic Beta",
      plan_code: "starter",
      invite_code: "SORRIA-BETA",
    });
    const meta = getCommercialStore().clinic_meta.find(
      (m) => m.clinic_id === clinic.clinic.id,
    );
    expect(meta?.beta_cohort).toBeTruthy();
    expect(meta?.invite_code_used?.toUpperCase()).toBe("SORRIA-BETA");
  });
});

describe("Subfase 12 — analytics sem PHI", () => {
  it("sanitize remove e-mail e campos clínicos", () => {
    const clean = sanitizeCommercialMeta({
      email: "x@y.com",
      diagnosis: "cárie",
      cta: "hero_primary",
      dentists_count: 2,
    });
    expect(clean.email).toBeUndefined();
    expect(clean.diagnosis).toBeUndefined();
    expect(clean.cta).toBe("hero_primary");
    expect(clean.dentists_count).toBe(2);
  });

  it("aha moment só uma vez por clínica", () => {
    const a = trackCommercialEventPublic("first_procedure_cost_calculated", {
      clinicId: CLINIC_A_ID,
      meta: { source: "test" },
    });
    const b = trackCommercialEventPublic("first_procedure_cost_calculated", {
      clinicId: CLINIC_A_ID,
      meta: { source: "test" },
    });
    expect(a.duplicate).toBe(false);
    expect(b.duplicate).toBe(true);
    expect(
      getCommercialStore().events.filter(
        (e) =>
          e.name === "first_procedure_cost_calculated" &&
          e.clinic_id === CLINIC_A_ID,
      ),
    ).toHaveLength(1);
  });
});

describe("Subfase 12 — ativação e cancelamento", () => {
  it("clinic A seed já está ativada (demo)", () => {
    const act = getCommercialActivation(CLINIC_A_ID);
    expect(act.activated).toBe(true);
    expect(act.milestones).toHaveLength(5);
  });

  it("nova clínica inicia incompleta e registra cohort", () => {
    const account = signupAccount({
      full_name: "Nova",
      email: "nova-beta@example.com",
      password: "senha-segura-1",
    });
    const created = createClinicForOwner(account.user_id, {
      name: "Nova Clinica Beta",
      plan_code: "starter",
    });
    const act = getCommercialActivation(created.clinic.id);
    expect(act.activated).toBe(false);
    expect(act.milestones.find((m) => m.key === "procedure")?.done).toBe(
      false,
    );
    const meta = getCommercialStore().clinic_meta.find(
      (m) => m.clinic_id === created.clinic.id,
    );
    expect(meta?.beta_cohort).toBeTruthy();
  });

  it("feedback de cancelamento opcional e estruturado", () => {
    recordCancelFeedback({
      clinicId: CLINIC_A_ID,
      userId: OWNER_A_ID,
      reason: "preco",
    });
    expect(getCommercialStore().cancel_feedback[0]?.reason).toBe("preco");
  });
});

describe("Subfase 12 — demo isolado", () => {
  it("stores comerciais resetam sem misturar leads entre testes", () => {
    expect(getBillingStore().accounts).toHaveLength(0);
    expect(getCommercialStore().leads).toHaveLength(0);
  });
});
