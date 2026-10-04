import { beforeEach, describe, expect, it } from "vitest";
import {
  CLINIC_A_ID,
  CLINIC_B_ID,
  OWNER_A_ID,
  OWNER_B_ID,
  SECRETARY_A_ID,
  getAuthzStore,
  getMembership,
  resetAuthzStore,
  setDemoSession,
} from "@/lib/demo/authz-store";
import { resetBillingStore, getBillingStore } from "@/lib/demo/billing-store";
import { resetPatientsStore } from "@/lib/demo/patients-store";
import { resetAgendaStore } from "@/lib/demo/agenda-store";
import {
  assertClinicCanMutate,
  hasEntitlement,
  checkPlanLimit,
} from "@/lib/entitlements";
import {
  acceptInvitation,
  changeClinicPlan,
  createClinicForOwner,
  createSecureInvitation,
  expireTrialForTests,
  handleBillingWebhook,
  listMembershipClinics,
  setSubscriptionStatusForTests,
  signupAccount,
  switchClinic,
} from "@/services/saas";
import { createPatient, listPatients } from "@/services/patients";
import { can } from "@/lib/authz/can";

const ownerA = { userId: OWNER_A_ID, clinicId: CLINIC_A_ID };
const secretaryA = { userId: SECRETARY_A_ID, clinicId: CLINIC_A_ID };

beforeEach(() => {
  resetAuthzStore();
  resetBillingStore();
  resetPatientsStore();
  resetAgendaStore();
  setDemoSession(OWNER_A_ID, CLINIC_A_ID);
});

describe("SaaS — signup e clínica", () => {
  it("signup → clinic → owner sem clinical_access automático", () => {
    const account = signupAccount({
      full_name: "Nova Owner",
      email: "nova.owner@example.com",
      password: "senha-segura-1",
    });
    const created = createClinicForOwner(account.user_id, {
      name: "Clínica Nova",
      city: "BH",
      plan_code: "starter",
    });
    expect(created.membership.role_key).toBe("owner");
    expect(created.membership.clinical_access).toBe(false);
    expect(created.subscription.status).toBe("trialing");
    expect(created.plan.code).toBe("starter");
  });

  it("segundo tenant isolado", () => {
    const a = signupAccount({
      full_name: "Owner A2",
      email: "a2@example.com",
      password: "senha-segura-1",
    });
    const clinicA = createClinicForOwner(a.user_id, {
      name: "Clinic A2",
      plan_code: "pro",
    });
    const b = signupAccount({
      full_name: "Owner B2",
      email: "b2@example.com",
      password: "senha-segura-1",
    });
    const clinicB = createClinicForOwner(b.user_id, {
      name: "Clinic B2",
      plan_code: "starter",
    });
    expect(getMembership(a.user_id, clinicB.clinic.id)).toBeFalsy();
    expect(getMembership(b.user_id, clinicA.clinic.id)).toBeFalsy();
    const clinicsA = listMembershipClinics(a.user_id);
    expect(clinicsA.every((c) => c.clinic_id === clinicA.clinic.id)).toBe(true);
  });
});

describe("SaaS — convite e switch", () => {
  it("owner convida; aceite não dá Clinic B", () => {
    const inv = createSecureInvitation(ownerA, {
      email: "convidado@example.com",
      role_key: "dentist",
      full_name: "Dr Convidado",
    });
    const userId = getAuthzStore().profiles.find(
      (p) => p.email === "convidado@example.com",
    )!.id;
    const accepted = acceptInvitation(inv.accept_token, userId);
    expect(accepted.clinic_id).toBe(CLINIC_A_ID);
    expect(getMembership(userId, CLINIC_B_ID)).toBeFalsy();
  });

  it("switch clinic valida membership", () => {
    expect(() => switchClinic(OWNER_A_ID, CLINIC_B_ID)).toThrow();
    setDemoSession(OWNER_B_ID, CLINIC_B_ID);
    expect(switchClinic(OWNER_B_ID, CLINIC_B_ID).clinic_id).toBe(CLINIC_B_ID);
  });
});

describe("SaaS — trial, upgrade, downgrade, restrito", () => {
  it("trial expirado não apaga dados e bloqueia mutação", () => {
    createPatient(ownerA, {
      full_name: "Paciente Trial",
      status: "active",
      acknowledge_duplicate: true,
    } as never);
    expireTrialForTests(CLINIC_A_ID);
    expect(() => assertClinicCanMutate(ownerA)).toThrow("SUBSCRIPTION_RESTRICTED");
    expect(
      listPatients(ownerA, { page: 1, pageSize: 50, status: "all" }).total,
    ).toBeGreaterThan(0);
  });

  it("upgrade e downgrade preservam dados", () => {
    changeClinicPlan(ownerA, "starter");
    changeClinicPlan(ownerA, "pro");
    expect(checkPlanLimit(CLINIC_A_ID, "max_professionals").limit).toBe(5);
    changeClinicPlan(ownerA, "starter");
    expect(checkPlanLimit(CLINIC_A_ID, "max_professionals").limit).toBe(2);
  });
});

describe("SaaS — entitlements vs permissions", () => {
  it("plano sem feature nega mesmo com permission", () => {
    changeClinicPlan(ownerA, "starter");
    const d = hasEntitlement(ownerA, "pricing_analysis", "reports.pricing_view");
    expect(d.allowed).toBe(false);
    expect(d.reason).toBe("plan_missing_entitlement");
  });

  it("feature no plano sem permission nega", () => {
    changeClinicPlan(ownerA, "pro");
    const d = hasEntitlement(
      secretaryA,
      "operational_costing",
      "clinic_costs.view",
    );
    expect(can(secretaryA, "clinic_costs.view").allowed).toBe(false);
    expect(d.allowed).toBe(false);
    expect(d.reason).toBe("permission_denied");
  });

  it("plano + permission permite", () => {
    changeClinicPlan(ownerA, "pro");
    const d = hasEntitlement(
      ownerA,
      "replenishment",
      "inventory.replenishment_view",
    );
    expect(d.allowed).toBe(true);
  });
});

describe("SaaS — webhooks", () => {
  it("webhook inválido rejeitado", async () => {
    await expect(
      handleBillingWebhook({
        rawBody: JSON.stringify({ id: "evt_1", type: "invoice.paid" }),
        signature: "wrong",
      }),
    ).rejects.toThrow("WEBHOOK_INVALID");
  });

  it("webhook duplicado processa uma vez", async () => {
    const payload = {
      id: "evt_dup_1",
      type: "invoice.paid",
      clinic_id: CLINIC_A_ID,
      status: "active",
      plan_code: "pro",
    };
    const first = await handleBillingWebhook({
      rawBody: JSON.stringify(payload),
      signature: "demo-secret",
    });
    const second = await handleBillingWebhook({
      rawBody: JSON.stringify(payload),
      signature: "demo-secret",
    });
    expect(first.duplicate).toBe(false);
    expect(second.duplicate).toBe(true);
    expect(
      getBillingStore().events.filter((e) => e.provider_event_id === "evt_dup_1"),
    ).toHaveLength(1);
  });
});

describe("SaaS — past_due política", () => {
  it("past_due restringe mutações", () => {
    setSubscriptionStatusForTests(CLINIC_A_ID, "past_due");
    expect(() => assertClinicCanMutate(ownerA)).toThrow();
  });
});
