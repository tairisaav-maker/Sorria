import { beforeEach, describe, expect, it } from "vitest";
import {
  CLINIC_A_ID,
  DENTIST_A_ID,
  OWNER_A_ID,
  SECRETARY_A_ID,
  resetAuthzStore,
  setDemoSession,
} from "@/lib/demo/authz-store";
import { resetInventoryStore } from "@/lib/demo/inventory-store";
import { resetProcedureLibraryStore } from "@/lib/demo/procedure-library-store";
import { getDashboardSummary } from "@/services/dashboard";
import {
  getQuickSimulationContext,
  listSimulationProcedures,
} from "@/services/procedure-simulation";
import {
  computeDiscountedPrice,
  computePriceForMargin,
  computeQuickSimulation,
} from "@/lib/pricing/quick-simulate";
import { can } from "@/lib/authz/can";
import { updateProcedureDefaultPrice } from "@/services/procedure-pricing";
import { getInventoryStore } from "@/lib/demo/inventory-store";

beforeEach(() => {
  resetAuthzStore();
  resetInventoryStore();
  resetProcedureLibraryStore();
  setDemoSession(OWNER_A_ID, CLINIC_A_ID);
});

const ownerA = { userId: OWNER_A_ID, clinicId: CLINIC_A_ID };
const dentistA = { userId: DENTIST_A_ID, clinicId: CLINIC_A_ID };
const secretaryA = { userId: SECRETARY_A_ID, clinicId: CLINIC_A_ID };

describe("dashboard summary", () => {
  it("retorna métricas e agenda sem inventar alertas", () => {
    const summary = getDashboardSummary(ownerA, {
      userName: "Dra. Mariana Silva",
      clinicName: "Clínica Teste Sorria",
    });
    expect(summary.greeting_name).toContain("Dra.");
    expect(summary.metrics.length).toBeGreaterThan(0);
    expect(summary.metrics.some((m) => m.id === "today")).toBe(true);
    expect(Array.isArray(summary.agenda)).toBe(true);
    expect(Array.isArray(summary.attention)).toBe(true);
    expect(summary.permissions.can_simulate).toBe(true);
  });

  it("oculta financeiro para dentista sem visão administrativa", () => {
    const summary = getDashboardSummary(dentistA, {
      userName: "Dr. Carlos",
      clinicName: "Clínica Teste Sorria",
    });
    expect(summary.metrics.some((m) => m.id === "received_today")).toBe(false);
    expect(summary.receipts_7d).toBeNull();
  });

  it("secretaria vê financeiro e não precisa de simulate", () => {
    expect(can(secretaryA, "finance.view_administrative").allowed).toBe(true);
    const summary = getDashboardSummary(secretaryA, {
      userName: "Mariana",
      clinicName: "Clínica Teste",
    });
    expect(summary.permissions.can_view_finance).toBe(true);
  });
});

describe("simulador rápido — matemática", () => {
  it("custo 120 / preço 300 → resultado 180 e margem 60%", () => {
    const sim = computeQuickSimulation({
      cost_cents: 12_000,
      simulated_price_cents: 30_000,
      default_price_cents: 35_000,
    });
    expect(sim.result_cents).toBe(18_000);
    expect(sim.margin_percent).toBe(60);
    expect(sim.break_even_cents).toBe(12_000);
  });

  it("desconto 10% em 350 → 315", () => {
    expect(computeDiscountedPrice(35_000, 10)).toBe(31_500);
  });

  it("margem alvo 60% com custo 120 → preço 300", () => {
    expect(computePriceForMargin(12_000, 60)).toBe(30_000);
  });

  it("sem custo não inventa margem", () => {
    const sim = computeQuickSimulation({
      cost_cents: null,
      simulated_price_cents: 30_000,
      default_price_cents: 35_000,
    });
    expect(sim.margin_percent).toBeNull();
    expect(sim.result_cents).toBeNull();
    expect(sim.partial).toBe(true);
  });
});

describe("simulador rápido — serviço", () => {
  it("lista prioriza favoritos/mais usados", () => {
    const items = listSimulationProcedures(ownerA);
    expect(items.length).toBeGreaterThan(0);
    expect(items[0]?.favorited || items[0]!.use_count > 0).toBe(true);
  });

  it("contexto de restauração média traz custos autorizados", () => {
    const ctx = getQuickSimulationContext(ownerA, {
      procedureId: "proc-a-restoration",
    });
    expect(ctx.procedure_name).toContain("Restauração");
    expect(ctx.default_price_cents).toBe(35_000);
    expect(ctx.direct_cost_cents).toBeGreaterThan(0);
    expect(ctx.can_update_price).toBe(true);
  });

  it("simulação não persiste até confirmar preço", () => {
    const before = getInventoryStore().procedures.find(
      (p) => p.id === "proc-a-restoration",
    )!.default_price_cents;
    // apenas contexto — zero write
    getQuickSimulationContext(ownerA, { procedureId: "proc-a-restoration" });
    expect(
      getInventoryStore().procedures.find((p) => p.id === "proc-a-restoration")!
        .default_price_cents,
    ).toBe(before);

    updateProcedureDefaultPrice(ownerA, {
      procedure_id: "proc-a-restoration",
      new_price_reais: 300,
      confirm: true,
    });
    expect(
      getInventoryStore().procedures.find((p) => p.id === "proc-a-restoration")!
        .default_price_cents,
    ).toBe(30_000);
  });

  it("dentista pode simular", () => {
    expect(can(dentistA, "procedure_pricing.simulate").allowed).toBe(true);
    const ctx = getQuickSimulationContext(dentistA, {
      procedureId: "proc-a-restoration",
    });
    expect(ctx.procedure_id).toBe("proc-a-restoration");
  });
});
