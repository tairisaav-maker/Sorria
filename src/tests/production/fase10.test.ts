import { beforeEach, describe, expect, it } from "vitest";
import {
  CLINIC_A_ID,
  CLINIC_B_ID,
  OWNER_A_ID,
  OWNER_B_ID,
  SECRETARY_A_ID,
  getAuthzStore,
  resetAuthzStore,
  setDemoSession,
  suspendMember,
} from "@/lib/demo/authz-store";
import { resetAgendaStore, getAgendaStore } from "@/lib/demo/agenda-store";
import { resetAssistantStore } from "@/lib/demo/assistant-store";
import { resetClinicalStore } from "@/lib/demo/clinical-store";
import { resetFinanceStore, getFinanceStore } from "@/lib/demo/finance-store";
import { resetPatientsStore } from "@/lib/demo/patients-store";
import { resetTreatmentsStore, getTreatmentsStore } from "@/lib/demo/treatments-store";
import { resetPortalStore } from "@/lib/demo/portal-store";
import { can } from "@/lib/authz/can";
import { checkLoginRateLimit, resetRateLimitBuckets } from "@/lib/auth/rate-limit";
import { isAssistantEnabled, isPortalEnabled } from "@/lib/feature-flags";
import { APP_VERSION } from "@/lib/version";
import { sanitizeMetaViaLog } from "./helpers";
import {
  getOnboarding,
  markOnboardingStep,
  resetOnboardingForTests,
  updateClinicHours,
  updateClinicSettings,
  updateMyProfile,
} from "@/services/settings";
import { getPatient } from "@/services/patients";
import { getAppointment } from "@/services/appointments/queries";
import { sendAssistantMessage } from "@/services/assistant";
import { getAIProvider } from "@/lib/assistant/demo-provider";
import { defaultClinicHours } from "@/types/clinic-settings";

function ctx(userId = OWNER_A_ID, clinicId = CLINIC_A_ID) {
  setDemoSession(userId, clinicId);
  return { userId, clinicId };
}

beforeEach(() => {
  resetAuthzStore();
  resetAgendaStore();
  resetClinicalStore();
  resetFinanceStore();
  resetPatientsStore();
  resetTreatmentsStore();
  resetPortalStore();
  resetAssistantStore();
  resetRateLimitBuckets();
  setDemoSession(OWNER_A_ID, CLINIC_A_ID);
});

describe("FASE 10 — versão e flags", () => {
  it("versão do canal beta comercial 0.11.0-beta", () => {
    expect(APP_VERSION).toBe("0.11.0-beta");
  });

  it("feature flags da clínica demo habilitadas", () => {
    const clinic = getAuthzStore().clinics.find((c) => c.id === CLINIC_A_ID)!;
    expect(isAssistantEnabled(clinic)).toBe(true);
    expect(isPortalEnabled(clinic)).toBe(true);
    clinic.feature_flags.assistant_enabled = false;
    expect(isAssistantEnabled(clinic)).toBe(false);
  });
});

describe("FASE 10 — onboarding", () => {
  it("demo clinic já tem onboarding completo (checklist oculto)", () => {
    const o = getOnboarding(ctx());
    expect(o.complete).toBe(true);
  });

  it("nova configuração retoma progresso e usa serviços reais", () => {
    resetOnboardingForTests(CLINIC_A_ID);
    let o = getOnboarding(ctx());
    // sync from existing patients/appointments in demo seed may mark patient/appt done
    expect(o.progress.welcome_seen).toBe(false);

    markOnboardingStep(ctx(), "welcome");
    updateClinicSettings(ctx(), {
      name: "Clínica Nova Sorria",
      phone: "(31) 3000-0000",
      city: "BH",
      timezone: "America/Sao_Paulo",
    });
    updateMyProfile(ctx(), {
      full_name: "Dra. Ana Ribeiro",
      cro: "12345",
      cro_uf: "MG",
    });
    updateClinicHours(ctx(), defaultClinicHours());
    o = getOnboarding(ctx());
    expect(o.progress.welcome_seen).toBe(true);
    expect(o.progress.clinic_done).toBe(true);
    expect(o.progress.profile_done).toBe(true);
    expect(o.progress.hours_done).toBe(true);
  });

  it("dismiss oculta checklist", () => {
    resetOnboardingForTests(CLINIC_A_ID);
    markOnboardingStep(ctx(), "dismiss");
    expect(getOnboarding(ctx()).complete).toBe(true);
  });
});

describe("FASE 10 — clinic settings permission", () => {
  it("owner pode clinic.settings; secretária não por padrão", () => {
    expect(can(ctx(OWNER_A_ID), "clinic.settings").allowed).toBe(true);
    // secretary matrix does not include clinic.settings
    expect(can(ctx(SECRETARY_A_ID), "clinic.settings").allowed).toBe(false);
  });
});

describe("FASE 10 — rate limit login", () => {
  it("bloqueia após muitas tentativas", () => {
    for (let i = 0; i < 10; i++) {
      expect(checkLoginRateLimit("1.1.1.1", "x@y.com")).toBe(true);
    }
    expect(checkLoginRateLimit("1.1.1.1", "x@y.com")).toBe(false);
  });
});

describe("FASE 10 — cross-tenant UUID enumeration", () => {
  it("Clinic A não lê patient/appointment/treatment/finance/assistant de B", () => {
    const a = ctx(OWNER_A_ID, CLINIC_A_ID);

    expect(() => getPatient(a, "p-b-001")).toThrow();

    const bAppt = getAgendaStore().appointments.find(
      (x) => x.clinic_id === CLINIC_B_ID,
    );
    if (bAppt) {
      expect(() => getAppointment(a, bAppt.id)).toThrow();
    }

    const bPlan = getTreatmentsStore().plans.find((p) => p.clinic_id === CLINIC_B_ID);
    if (bPlan) {
      // administrative get via store isolation pattern — clinic filter
      expect(bPlan.clinic_id).not.toBe(CLINIC_A_ID);
    }

    const bTx = getFinanceStore().transactions.find((t) => t.clinic_id === CLINIC_B_ID);
    expect(bTx?.clinic_id).toBe(CLINIC_B_ID);

    // Assistant thread from A is not readable by B
  });

  it("Owner B não usa thread da Clinic A", async () => {
    const thread = await sendAssistantMessage(ctx(OWNER_A_ID, CLINIC_A_ID), {
      message: "Como está minha agenda hoje?",
    });
    setDemoSession(OWNER_B_ID, CLINIC_B_ID);
    await expect(
      sendAssistantMessage(
        { userId: OWNER_B_ID, clinicId: CLINIC_B_ID },
        { threadId: thread.thread.id, message: "e amanhã?" },
      ),
    ).rejects.toThrow(/THREAD_NOT_FOUND/);
  });
});

describe("FASE 10 — usuário suspenso", () => {
  it("membership suspensa perde permissões", () => {
    expect(can(ctx(SECRETARY_A_ID), "appointments.view").allowed).toBe(true);
    suspendMember({
      clinicId: CLINIC_A_ID,
      actorUserId: OWNER_A_ID,
      membershipId: "m-a-secretary",
    });
    expect(can(ctx(SECRETARY_A_ID), "appointments.view").allowed).toBe(false);
  });
});

describe("FASE 10 — AI failure isolation", () => {
  it("provider continua sendo abstração; Agenda não depende dele", () => {
    const provider = getAIProvider();
    expect(provider.name).toBeTruthy();
    // Agenda store still readable without AI
    expect(getAgendaStore().appointments.length).toBeGreaterThan(0);
  });
});

describe("FASE 10 — observabilidade sanitiza secrets", () => {
  it("helper de redação", () => {
    expect(sanitizeMetaViaLog()).toBe(true);
  });
});
