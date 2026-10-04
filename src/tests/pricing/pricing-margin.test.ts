import { beforeEach, describe, expect, it } from "vitest";
import { can } from "@/lib/authz/can";
import {
  CLINIC_A_ID,
  CLINIC_B_ID,
  DENTIST_A_ID,
  OWNER_A_ID,
  OWNER_B_ID,
  SECRETARY_A_ID,
  resetAuthzStore,
  setDemoSession,
} from "@/lib/demo/authz-store";
import { resetClinicCostsStore } from "@/lib/demo/clinic-costs-store";
import { resetFinanceStore } from "@/lib/demo/finance-store";
import { getInventoryStore, resetInventoryStore } from "@/lib/demo/inventory-store";
import {
  getPerformedStore,
  resetPerformedStore,
} from "@/lib/demo/performed-procedures-store";
import { resetPricingStore } from "@/lib/demo/pricing-store";
import { resetProcedureFinanceStore } from "@/lib/demo/procedure-finance-store";
import { resetTreatmentsStore } from "@/lib/demo/treatments-store";
import {
  calculateAggregateMarginPercent,
  calculateBreakEvenPriceCents,
  calculateOperationalMarginPercent,
  calculateOperationalResultCents,
  calculatePriceDifferenceCents,
  calculatePriceDifferencePercent,
  resolvePerformedPricingAlerts,
  simulateDiscountCents,
  simulatePriceByMarginCents,
  simulatePriceCents,
} from "@/lib/pricing/formulas";
import {
  analyzePerformedProcedurePricing,
  getProcedurePriceHistory,
  getProcedurePricingSummary,
  simulateDiscount,
  simulatePriceByMargin,
  updateProcedureDefaultPrice,
} from "@/services/procedure-pricing";
import {
  completePerformedProcedure,
  createPerformedProcedure,
  getPerformedProcedure,
} from "@/services/performed-procedures";
import { confirmProcedureConsumption } from "@/services/procedure-consumption";
import { getPricingPerformanceReport } from "@/services/reports/pricing";
import { getClinicCostsStore } from "@/lib/demo/clinic-costs-store";
import { acceptTreatmentPlan, getTreatmentPlan } from "@/services/treatments";

const ownerA = { userId: OWNER_A_ID, clinicId: CLINIC_A_ID };
const dentistA = { userId: DENTIST_A_ID, clinicId: CLINIC_A_ID };
const secretaryA = { userId: SECRETARY_A_ID, clinicId: CLINIC_A_ID };
const ownerB = { userId: OWNER_B_ID, clinicId: CLINIC_B_ID };

beforeEach(() => {
  resetAuthzStore();
  resetPricingStore();
  resetClinicCostsStore();
  resetFinanceStore();
  resetInventoryStore();
  resetPerformedStore();
  resetProcedureFinanceStore();
  resetTreatmentsStore();
  setDemoSession(OWNER_A_ID, CLINIC_A_ID);
});

describe("Subfase 9 — fórmulas", () => {
  it("margem 300−120 → 180 / 60%", () => {
    expect(calculateOperationalResultCents(30_000, 12_000)).toBe(18_000);
    expect(calculateOperationalMarginPercent(30_000, 12_000)).toBe(60);
  });

  it("break-even = custo operacional", () => {
    expect(calculateBreakEvenPriceCents(12_000)).toBe(12_000);
  });

  it("margem desejada 60% → preço 300", () => {
    expect(simulatePriceByMarginCents(12_000, 60)).toBe(30_000);
    expect(simulatePriceByMarginCents(12_000, 100)).toBeNull();
  });

  it("desconto 10% sobre 350 → 315", () => {
    expect(
      simulateDiscountCents({
        standardPriceCents: 35_000,
        discountPercent: 10,
      }),
    ).toBe(31_500);
  });

  it("margem após desconto: custo 140, preço 315 → 55,56%", () => {
    const sim = simulatePriceCents(14_000, 31_500);
    expect(sim.result_cents).toBe(17_500);
    expect(sim.margin_percent).toBe(55.56);
  });

  it("abaixo do custo: alerta correto", () => {
    const alerts = resolvePerformedPricingAlerts({
      chargedCents: 10_000,
      directCostCents: 8_000,
      operationalCostCents: 12_000,
    });
    expect(alerts).toContain("below_operational_cost");
  });

  it("gratuito: resultado negativo, margem —", () => {
    expect(calculateOperationalResultCents(0, 10_000)).toBe(-10_000);
    expect(calculateOperationalMarginPercent(0, 10_000)).toBeNull();
  });

  it("null ≠ zero — valor não definido", () => {
    const alerts = resolvePerformedPricingAlerts({
      chargedCents: null,
      directCostCents: 5_000,
      operationalCostCents: 10_000,
    });
    expect(alerts).toContain("charged_undefined");
  });

  it("diferença vs padrão", () => {
    expect(calculatePriceDifferenceCents(30_000, 35_000)).toBe(-5_000);
    expect(calculatePriceDifferencePercent(30_000, 35_000)).toBe(-14.29);
  });

  it("margem agregada usa sum(result)/sum(charged)", () => {
    // A: 100 cobrado, 50 custo → 50%; B: 1000 cobrado, 900 custo → 10%
    // média simples = 30%; agregada = 150/1100 = 13,64%
    expect(calculateAggregateMarginPercent(110_000, 95_000)).toBe(13.64);
  });
});

describe("Subfase 9 — serviços", () => {
  function seedCompleted(opts: {
    charged: number | null;
    operational: number;
    duration?: number;
  }) {
    const month = new Date().toISOString().slice(0, 7);
    getClinicCostsStore().hourlySnapshots.push({
      id: `chs-${crypto.randomUUID()}`,
      clinic_id: CLINIC_A_ID,
      reference_month: month,
      allocatable_cost_cents: 1_200_000,
      productive_hours: 120,
      hourly_cost_cents: 10_000,
      calculation_method: "manual_productive_hours",
      created_at: new Date().toISOString(),
    });
    const created = createPerformedProcedure(ownerA, {
      patient_id: "p-a-001",
      appointment_id: "appt-a-1",
      procedure_id: "proc-a-restoration",
      charged_amount_reais: opts.charged == null ? undefined : opts.charged / 100,
    });
    const id = created.procedure.id;
    if (opts.charged === null) {
      const row = getPerformedStore().performedProcedures.find((p) => p.id === id)!;
      row.charged_amount_cents = null;
    }
    confirmProcedureConsumption(ownerA, {
      performed_procedure_id: id,
      confirm_insufficient_stock: true,
    });
    const row = getPerformedStore().performedProcedures.find((p) => p.id === id)!;
    row.actual_material_cost_cents = 3_000;
    row.actual_direct_cost_cents = 0;
    row.actual_shared_cost_cents = 0;
    row.actual_total_cost_cents = 3_000;
    completePerformedProcedure(ownerA, id, {
      duration_minutes: opts.duration ?? 45,
    });
    // force operational for predictable tests when needed
    if (opts.operational != null) {
      const done = getPerformedStore().performedProcedures.find((p) => p.id === id)!;
      done.operational_total_cost_cents = opts.operational;
      done.operational_result_cents =
        (done.charged_amount_cents ?? 0) - opts.operational;
      done.operational_margin_percent = calculateOperationalMarginPercent(
        done.charged_amount_cents,
        opts.operational,
      );
    }
    return id;
  }

  it("simulação por margem no serviço", () => {
    const sim = simulatePriceByMargin(ownerA, {
      operational_cost_cents: 12_000,
      desired_margin_percent: 60,
    });
    expect(sim.simulated_price_cents).toBe(30_000);
    expect(sim.label).toMatch(/margem simulada/i);
  });

  it("simulação de desconto", () => {
    const sim = simulateDiscount(ownerA, {
      standard_price_cents: 35_000,
      operational_cost_cents: 14_000,
      discount_percent: 10,
    });
    expect(sim.simulated_price_cents).toBe(31_500);
    expect(sim.margin_percent).toBe(55.56);
  });

  it("histórico de preço não altera procedimento antigo", () => {
    const id = seedCompleted({ charged: 35_000, operational: 12_000 });
    const before = getPerformedStore().performedProcedures.find((p) => p.id === id)!;
    const snap = before.standard_price_snapshot_cents;
    expect(snap).toBe(35_000);

    updateProcedureDefaultPrice(ownerA, {
      procedure_id: "proc-a-restoration",
      new_price_reais: 380,
      confirm: true,
    });
    const proc = getInventoryStore().procedures.find(
      (p) => p.id === "proc-a-restoration",
    )!;
    expect(proc.default_price_cents).toBe(38_000);
    const after = getPerformedStore().performedProcedures.find((p) => p.id === id)!;
    expect(after.standard_price_snapshot_cents).toBe(snap);
    const hist = getProcedurePriceHistory(ownerA, "proc-a-restoration");
    expect(hist.length).toBeGreaterThanOrEqual(1);
    expect(hist[0]!.price_cents).toBe(38_000);
  });

  it("plano aceito não muda com preço padrão", () => {
    const plan = getTreatmentPlan(ownerA, "tp-a-presented");
    const itemPrice = plan.items[0]?.unit_price_cents;
    expect(itemPrice).toBeDefined();
    acceptTreatmentPlan(ownerA, "tp-a-presented");
    updateProcedureDefaultPrice(ownerA, {
      procedure_id: "proc-a-restoration",
      new_price_reais: 400,
      confirm: true,
    });
    const after = getTreatmentPlan(ownerA, "tp-a-presented");
    expect(after.items[0]?.unit_price_cents).toBe(itemPrice);
  });

  it("charged null não é gratuito", () => {
    const id = seedCompleted({ charged: null, operational: 10_000 });
    const analysis = analyzePerformedProcedurePricing(ownerA, id);
    expect(analysis.charged_amount_cents).toBeNull();
    expect(analysis.message).toMatch(/não definido/i);
    expect(analysis.alerts).toContain("charged_undefined");
  });

  it("abaixo do custo operacional", () => {
    const id = seedCompleted({ charged: 10_000, operational: 12_000 });
    const analysis = analyzePerformedProcedurePricing(ownerA, id);
    expect(analysis.operational_result_cents).toBe(-2_000);
    expect(analysis.alerts).toContain("below_operational_cost");
  });

  it("resumo padrão do procedimento", () => {
    const summary = getProcedurePricingSummary(ownerA, "proc-a-restoration");
    expect(summary.default_price_cents).toBe(35_000);
    expect(summary.disclaimer).toMatch(/Não é lucro líquido/);
  });

  it("margem agregada no relatório", () => {
    seedCompleted({ charged: 10_000, operational: 5_000 });
    seedCompleted({ charged: 100_000, operational: 90_000 });
    const rows = getPricingPerformanceReport(ownerA, { preset: "month" });
    const rest = rows.find((r) => r.procedure_id === "proc-a-restoration");
    expect(rest).toBeTruthy();
    // 110000 - 95000 = 15000 → 13.64%
    expect(rest!.aggregate_margin_percent).toBe(13.64);
  });
});

describe("Subfase 9 — permissões e cross-clinic", () => {
  it("secretária não vê margens por padrão", () => {
    expect(can(secretaryA, "procedure_pricing.view").allowed).toBe(false);
    expect(can(secretaryA, "reports.pricing_view").allowed).toBe(false);
  });

  it("dentista vê pricing; sem manage", () => {
    expect(can(dentistA, "procedure_pricing.view").allowed).toBe(true);
    expect(can(dentistA, "procedure_pricing.manage").allowed).toBe(false);
    expect(can(dentistA, "procedures.update_price").allowed).toBe(false);
  });

  it("usuário sem permission não recebe custos operacionais no payload", () => {
    setDemoSession(SECRETARY_A_ID, CLINIC_A_ID);
    const month = new Date().toISOString().slice(0, 7);
    getClinicCostsStore().hourlySnapshots.push({
      id: "chs-sec",
      clinic_id: CLINIC_A_ID,
      reference_month: month,
      allocatable_cost_cents: 1_200_000,
      productive_hours: 120,
      hourly_cost_cents: 10_000,
      calculation_method: "manual_productive_hours",
      created_at: new Date().toISOString(),
    });
    setDemoSession(OWNER_A_ID, CLINIC_A_ID);
    const created = createPerformedProcedure(ownerA, {
      patient_id: "p-a-001",
      appointment_id: "appt-a-1",
      procedure_id: "proc-a-restoration",
      charged_amount_reais: 300,
    });
    confirmProcedureConsumption(ownerA, {
      performed_procedure_id: created.procedure.id,
      confirm_insufficient_stock: true,
    });
    completePerformedProcedure(ownerA, created.procedure.id, {
      duration_minutes: 45,
    });
    setDemoSession(SECRETARY_A_ID, CLINIC_A_ID);
    const detail = getPerformedProcedure(secretaryA, created.procedure.id);
    expect(detail.procedure.operational_total_cost_cents).toBeNull();
    expect(detail.procedure.operational_margin_percent).toBeNull();
  });

  it("Clinic B não acessa histórico da Clinic A", () => {
    updateProcedureDefaultPrice(ownerA, {
      procedure_id: "proc-a-restoration",
      new_price_reais: 360,
      confirm: true,
    });
    setDemoSession(OWNER_B_ID, CLINIC_B_ID);
    expect(() =>
      getProcedurePriceHistory(ownerB, "proc-a-restoration"),
    ).toThrow();
  });
});
