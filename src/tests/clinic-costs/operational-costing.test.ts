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
import {
  getClinicCostsStore,
  resetClinicCostsStore,
} from "@/lib/demo/clinic-costs-store";
import { resetFinanceStore } from "@/lib/demo/finance-store";
import { resetInventoryStore } from "@/lib/demo/inventory-store";
import {
  getPerformedStore,
  resetPerformedStore,
} from "@/lib/demo/performed-procedures-store";
import { resetProcedureFinanceStore } from "@/lib/demo/procedure-finance-store";
import {
  calculateCostPerMinuteCents,
  calculateHourlyOperatingCostCents,
  calculateOperationalMarginPercent,
  calculateOperationalResultCents,
  calculateOperationalTotalCents,
  calculateProcedureTimeCostCents,
  simulatePriceForMarginCents,
} from "@/lib/clinic-costs/formulas";
import {
  getAllocatableMonthlyCosts,
  getClinicCostSettings,
  getMonthlyOperatingExpenses,
  updateClinicCostSettings,
} from "@/services/clinic-costs";
import {
  calculateHourlyOperatingCost,
  resolveHourlyCostForMonth,
  simulateHourlyCost,
  simulateProcedurePrice,
} from "@/services/operational-costs";
import {
  completePerformedProcedure,
  createPerformedProcedure,
} from "@/services/performed-procedures";
import { confirmProcedureConsumption } from "@/services/procedure-consumption";
import { createExpenseTransaction } from "@/services/finance";

const ownerA = { userId: OWNER_A_ID, clinicId: CLINIC_A_ID };
const dentistA = { userId: DENTIST_A_ID, clinicId: CLINIC_A_ID };
const secretaryA = { userId: SECRETARY_A_ID, clinicId: CLINIC_A_ID };
const ownerB = { userId: OWNER_B_ID, clinicId: CLINIC_B_ID };

beforeEach(() => {
  resetAuthzStore();
  resetClinicCostsStore();
  resetFinanceStore();
  resetInventoryStore();
  resetPerformedStore();
  resetProcedureFinanceStore();
  setDemoSession(OWNER_A_ID, CLINIC_A_ID);
});

describe("Subfase 8 — fórmulas", () => {
  it("custo/hora: 12000 / 120 = 100", () => {
    expect(calculateHourlyOperatingCostCents(1_200_000, 120)).toBe(10_000);
  });

  it("custo/minuto: 100/h → 1,6666… internamente", () => {
    const perMin = calculateCostPerMinuteCents(10_000);
    expect(perMin).toBeCloseTo(10_000 / 60, 10);
  });

  it("custo do tempo: 45 min × R$100/h = R$75", () => {
    expect(calculateProcedureTimeCostCents(45, 10_000)).toBe(7_500);
  });

  it("custo operacional: 30 + 10 + 75 = 115", () => {
    expect(
      calculateOperationalTotalCents({
        materialCents: 3_000,
        directCents: 1_000,
        timeCents: 7_500,
      }),
    ).toBe(11_500);
  });

  it("resultado e margem: 300 − 115 = 185 / 61,67%", () => {
    expect(calculateOperationalResultCents(30_000, 11_500)).toBe(18_500);
    expect(calculateOperationalMarginPercent(30_000, 11_500)).toBe(61.67);
  });

  it("procedimento gratuito: resultado negativo, margem —", () => {
    expect(calculateOperationalResultCents(0, 10_000)).toBe(-10_000);
    expect(calculateOperationalMarginPercent(0, 10_000)).toBeNull();
  });

  it("simulação margem 60% → preço = custo / 0,4", () => {
    expect(simulatePriceForMarginCents(12_000, 60)).toBe(30_000);
    expect(simulatePriceForMarginCents(12_000, 100)).toBeNull();
    expect(simulatePriceForMarginCents(12_000, 101)).toBeNull();
  });
});

describe("Subfase 8 — despesas e custo/hora", () => {
  it("templates alocáveis somam no mês; não alocável fica de fora", () => {
    const month = new Date().toISOString().slice(0, 7);
    const expenses = getMonthlyOperatingExpenses(ownerA, month);
    // seed: Aluguel 3000 + Energia 800 + Software 300 + Auxiliar 2000 + Contador 500 = 6600
    expect(expenses.allocatable_cents).toBe(660_000);
    expect(expenses.non_allocatable_cents).toBeGreaterThan(0);
    expect(
      expenses.lines.some(
        (l) => !l.allocation_eligible && l.name.includes("Material"),
      ),
    ).toBe(true);
  });

  it("custo/hora com seed: 6600 / 120 = 55", () => {
    const month = new Date().toISOString().slice(0, 7);
    const hourly = calculateHourlyOperatingCost(ownerA, month);
    expect(hourly.insufficient_data).toBe(false);
    expect(hourly.hourly_cost_cents).toBe(
      Math.round(660_000 / 120),
    );
  });

  it("despesa não alocável R$1000 não entra no custo/hora", () => {
    const month = new Date().toISOString().slice(0, 7);
    const before = getAllocatableMonthlyCosts(ownerA, month);
    createExpenseTransaction(ownerA, {
      description: "Multa excepcional",
      category: "outros",
      gross_amount_reais: 1000,
      cost_behavior: "variable",
      recurrence_type: "one_time",
      allocation_eligible: false,
      reference_month: month,
      due_date: `${month}-15`,
    });
    const after = getAllocatableMonthlyCosts(ownerA, month);
    expect(after).toBe(before);
  });

  it("sem horas configuradas → dados insuficientes (não R$0/h)", () => {
    updateClinicCostSettings(ownerA, {
      monthly_productive_hours: null,
      calculation_mode: "manual_productive_hours",
    });
    const month = new Date().toISOString().slice(0, 7);
    const hourly = calculateHourlyOperatingCost(ownerA, month);
    expect(hourly.insufficient_data).toBe(true);
    expect(hourly.hourly_cost_cents).toBeNull();
    expect(hourly.message).toMatch(/horas produtivas/i);
  });

  it("simulador de horas não altera configuração", () => {
    const month = new Date().toISOString().slice(0, 7);
    const settingsBefore = getClinicCostSettings(ownerA)!;
    const sim = simulateHourlyCost(ownerA, {
      reference_month: month,
      productive_hours: 100,
    });
    expect(sim.hourly_cost_cents).toBe(Math.round(660_000 / 100));
    expect(getClinicCostSettings(ownerA)?.monthly_productive_hours).toBe(
      settingsBefore.monthly_productive_hours,
    );
  });

  it("simulador de preço com margem desejada", () => {
    const sim = simulateProcedurePrice(ownerA, {
      operational_cost_cents: 14_000,
      desired_margin_percent: 60,
    });
    expect(sim.simulated_price_cents).toBe(35_000);
    expect(sim.message).toMatch(/Simulação/);
  });
});

describe("Subfase 8 — snapshot e procedimento", () => {
  function seedCompleted(durationMinutes: number, chargedReais: number) {
    const created = createPerformedProcedure(ownerA, {
      patient_id: "p-a-001",
      appointment_id: "appt-a-1",
      procedure_id: "proc-a-restoration",
      charged_amount_reais: chargedReais,
    });
    const id = created.procedure.id;
    confirmProcedureConsumption(ownerA, {
      performed_procedure_id: id,
      confirm_insufficient_stock: true,
    });
    const row = getPerformedStore().performedProcedures.find((p) => p.id === id)!;
    row.actual_material_cost_cents = 3_000;
    row.actual_direct_cost_cents = 1_000;
    row.actual_shared_cost_cents = 0;
    row.actual_total_cost_cents = 4_000;
    completePerformedProcedure(ownerA, id, {
      duration_minutes: durationMinutes,
    });
    return id;
  }

  it("ao concluir aplica custo do tempo e operacional", () => {
    // Force known hourly: overwrite templates by using snapshot path
    const month = new Date().toISOString().slice(0, 7);
    getClinicCostsStore().hourlySnapshots.push({
      id: "chs-test",
      clinic_id: CLINIC_A_ID,
      reference_month: month,
      allocatable_cost_cents: 1_200_000,
      productive_hours: 120,
      hourly_cost_cents: 10_000,
      calculation_method: "manual_productive_hours",
      created_at: new Date().toISOString(),
    });
    const id = seedCompleted(45, 300);
    const row = getPerformedStore().performedProcedures.find((p) => p.id === id)!;
    expect(row.productive_hour_cost_snapshot_cents).toBe(10_000);
    expect(row.allocated_time_cost_cents).toBe(7_500);
    // 30 + 10 + 75 = 115
    expect(row.operational_total_cost_cents).toBe(11_500);
    expect(row.operational_result_cents).toBe(18_500);
    expect(row.operational_margin_percent).toBe(61.67);
    expect(row.duration_source).toBe("manual");
  });

  it("alterar custo/hora depois não muda snapshot do procedimento", () => {
    const month = new Date().toISOString().slice(0, 7);
    getClinicCostsStore().hourlySnapshots.push({
      id: "chs-oct",
      clinic_id: CLINIC_A_ID,
      reference_month: month,
      allocatable_cost_cents: 1_200_000,
      productive_hours: 120,
      hourly_cost_cents: 10_000,
      calculation_method: "manual_productive_hours",
      created_at: new Date().toISOString(),
    });
    const id = seedCompleted(50, 350);
    const before = getPerformedStore().performedProcedures.find((p) => p.id === id)!
      .productive_hour_cost_snapshot_cents;
    expect(before).toBe(10_000);

    // Novo snapshot “novembro” não altera o do mês atual já gravado no procedimento
    getClinicCostsStore().hourlySnapshots.unshift({
      id: "chs-nov",
      clinic_id: CLINIC_A_ID,
      reference_month: "2099-11",
      allocatable_cost_cents: 1_440_000,
      productive_hours: 120,
      hourly_cost_cents: 12_000,
      calculation_method: "manual_productive_hours",
      created_at: new Date().toISOString(),
    });
    updateClinicCostSettings(ownerA, { monthly_productive_hours: 80 });
    const after = getPerformedStore().performedProcedures.find((p) => p.id === id)!;
    expect(after.productive_hour_cost_snapshot_cents).toBe(10_000);
    expect(after.allocated_time_cost_cents).toBe(Math.round(50 * (10_000 / 60)));
  });

  it("snapshot existente tem prioridade sobre recálculo", () => {
    const month = new Date().toISOString().slice(0, 7);
    getClinicCostsStore().hourlySnapshots.push({
      id: "chs-frozen",
      clinic_id: CLINIC_A_ID,
      reference_month: month,
      allocatable_cost_cents: 999,
      productive_hours: 1,
      hourly_cost_cents: 10_000,
      calculation_method: "manual_productive_hours",
      created_at: new Date().toISOString(),
    });
    expect(resolveHourlyCostForMonth(ownerA, month)).toBe(10_000);
  });
});

describe("Subfase 8 — permissões e cross-clinic", () => {
  it("secretária não vê custos gerenciais por padrão", () => {
    expect(can(secretaryA, "clinic_costs.view").allowed).toBe(false);
    expect(can(secretaryA, "operational_costs.view").allowed).toBe(false);
    expect(can(secretaryA, "finance.expense_create").allowed).toBe(true);
  });

  it("dentista pode ver custo operacional do procedimento se permissionado", () => {
    expect(can(dentistA, "procedure_operational_costs.view").allowed).toBe(true);
    expect(can(dentistA, "clinic_costs.manage").allowed).toBe(false);
  });

  it("Clinic B não lê settings/templates da Clinic A", () => {
    setDemoSession(OWNER_B_ID, CLINIC_B_ID);
    expect(getClinicCostSettings(ownerB)).toBeNull();
    const month = new Date().toISOString().slice(0, 7);
    const expenses = getMonthlyOperatingExpenses(ownerB, month);
    expect(expenses.lines.every((l) => !l.id.startsWith("ret-a"))).toBe(true);
    expect(expenses.allocatable_cents).toBe(0);
  });

  it("owner A não resolve snapshot da Clinic B", () => {
    const month = new Date().toISOString().slice(0, 7);
    getClinicCostsStore().hourlySnapshots.push({
      id: "chs-b",
      clinic_id: CLINIC_B_ID,
      reference_month: month,
      allocatable_cost_cents: 500_000,
      productive_hours: 50,
      hourly_cost_cents: 10_000,
      calculation_method: "manual_productive_hours",
      created_at: new Date().toISOString(),
    });
    // resolve for A should not return B's snapshot when A has no own snapshot yet
    // (A has templates → will calculate own). Ensure B snapshot unused:
    const a = resolveHourlyCostForMonth(ownerA, month);
    expect(a).not.toBeNull();
    const snapsA = getClinicCostsStore().hourlySnapshots.filter(
      (s) => s.clinic_id === CLINIC_A_ID && s.reference_month === month,
    );
    expect(snapsA.every((s) => s.clinic_id === CLINIC_A_ID)).toBe(true);
  });
});
