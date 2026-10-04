import { beforeEach, describe, expect, it } from "vitest";
import { can } from "@/lib/authz/can";
import {
  CLINIC_A_ID,
  CLINIC_B_ID,
  OWNER_A_ID,
  OWNER_B_ID,
  SECRETARY_A_ID,
  getAuthzStore,
  resetAuthzStore,
  setDemoSession,
} from "@/lib/demo/authz-store";
import { getFinanceStore, resetFinanceStore } from "@/lib/demo/finance-store";
import { resetInventoryStore } from "@/lib/demo/inventory-store";
import {
  getPerformedStore,
  resetPerformedStore,
} from "@/lib/demo/performed-procedures-store";
import { resetProcedureFinanceStore } from "@/lib/demo/procedure-finance-store";
import { resetTreatmentsStore } from "@/lib/demo/treatments-store";
import {
  costCoverage,
  grossMarginPercent,
  grossResult,
  periodDeltaPercent,
  plannedVsActual,
} from "@/lib/reports/operational-formulas";
import { registerPayment, reversePayment } from "@/services/finance";
import { createFinancialChargeFromPerformedProcedure } from "@/services/patient-procedure-finance";
import {
  completePerformedProcedure,
  createPerformedProcedure,
} from "@/services/performed-procedures";
import { confirmProcedureConsumption } from "@/services/procedure-consumption";
import { exportReport } from "@/services/reports";
import {
  getCostCoverageReport,
  getMaterialConsumptionReport,
  getOperationalBundle,
  getOperationalOverview,
  getPatientOperationalReport,
  getProcedurePerformanceReport,
} from "@/services/reports/operational";

const ownerA = { userId: OWNER_A_ID, clinicId: CLINIC_A_ID };
const secretaryA = { userId: SECRETARY_A_ID, clinicId: CLINIC_A_ID };
const ownerB = { userId: OWNER_B_ID, clinicId: CLINIC_B_ID };

function forceActualCost(id: string, cents: number) {
  const row = getPerformedStore().performedProcedures.find((p) => p.id === id)!;
  row.actual_total_cost_cents = cents;
  row.consumption_confirmed = true;
}

function seedCompleted(opts: {
  chargedReais: number;
  costCents: number;
  procedureId?: string;
  patientId?: string;
  tooth?: number;
}) {
  const created = createPerformedProcedure(ownerA, {
    patient_id: opts.patientId ?? "p-a-001",
    appointment_id: "appt-a-1",
    procedure_id: opts.procedureId ?? "proc-a-restoration",
    tooth_number: opts.tooth,
    charged_amount_reais: opts.chargedReais,
  });
  const id = created.procedure.id;
  confirmProcedureConsumption(ownerA, {
    performed_procedure_id: id,
    confirm_insufficient_stock: true,
  });
  forceActualCost(id, opts.costCents);
  completePerformedProcedure(ownerA, id);
  return id;
}

beforeEach(() => {
  resetAuthzStore();
  resetInventoryStore();
  resetPerformedStore();
  resetProcedureFinanceStore();
  resetFinanceStore();
  resetTreatmentsStore();
  setDemoSession(OWNER_A_ID, CLINIC_A_ID);
});

describe("Subfase 6 — fórmulas operacionais", () => {
  it("resultado bruto e margem 3000−300 → 2700 / 90%", () => {
    expect(grossResult(300000, 30000)).toBe(270000);
    expect(grossMarginPercent(300000, 30000)).toBe(90);
  });

  it("cobrado zero não calcula margem", () => {
    expect(grossResult(0, 4000)).toBe(-4000);
    expect(grossMarginPercent(0, 4000)).toBeNull();
  });

  it("previsto×real +20% e −20%", () => {
    expect(plannedVsActual({ planned: 10, actual: 12 })).toEqual({
      difference: 2,
      percent: 20,
    });
    expect(plannedVsActual({ planned: 10, actual: 8 })).toEqual({
      difference: -2,
      percent: -20,
    });
  });

  it("cobertura 80/100 = 80%", () => {
    expect(costCoverage(80, 100)).toBe(80);
  });

  it("período anterior zero → sem base", () => {
    const d = periodDeltaPercent(10, 0);
    expect(d.has_baseline).toBe(false);
    expect(d.label).toMatch(/Sem base/);
  });
});

describe("Subfase 6 — desempenho por procedimento", () => {
  it("10 restaurações: custo médio 30, cobrado médio 300, resultado 2700, margem 90%", () => {
    for (let i = 0; i < 10; i++) {
      seedCompleted({
        chargedReais: 300,
        costCents: 3000,
        tooth: 11 + i,
      });
    }
    const rows = getProcedurePerformanceReport(ownerA, { preset: "month" });
    const rest = rows.find((r) => r.procedure_id === "proc-a-restoration")!;
    expect(rest.count).toBe(10);
    expect(rest.avg_actual_cost_cents).toBe(3000);
    expect(rest.avg_charged_cents).toBe(30000);
    expect(rest.gross_result_cents).toBe(270000);
    expect(rest.margin_percent).toBe(90);
  });

  it("procedimento gratuito: resultado −40, margem nula", () => {
    const id = seedCompleted({ chargedReais: 0, costCents: 4000, tooth: 21 });
    const row = getPerformedStore().performedProcedures.find((p) => p.id === id)!;
    row.financial_status = "no_charge";
    row.charged_amount_cents = 0;
    const rows = getProcedurePerformanceReport(ownerA, { preset: "month" });
    const rest = rows.find((r) => r.procedure_id === "proc-a-restoration")!;
    expect(rest.gross_result_cents).toBe(-4000);
    expect(rest.margin_percent).toBeNull();
  });
});

describe("Subfase 6 — cobertura e dados incompletos", () => {
  it("cobertura 80% com 20 sem custo completo", () => {
    for (let i = 0; i < 80; i++) {
      seedCompleted({ chargedReais: 100, costCents: 1000, tooth: (i % 32) + 1 });
    }
    for (let i = 0; i < 20; i++) {
      const created = createPerformedProcedure(ownerA, {
        patient_id: "p-a-001",
        appointment_id: "appt-a-1",
        procedure_id: "proc-a-prophylaxis",
        charged_amount_reais: 150,
      });
      // Concluído sem custo completo (sem confirmação de consumo)
      const row = getPerformedStore().performedProcedures.find(
        (p) => p.id === created.procedure.id,
      )!;
      row.status = "completed";
      row.completed_at = new Date().toISOString();
      row.consumption_confirmed = false;
      row.actual_total_cost_cents = null;
    }
    const cov = getCostCoverageReport(ownerA, { preset: "month" });
    expect(cov.completed).toBe(100);
    expect(cov.with_complete_cost).toBe(80);
    expect(cov.coverage_percent).toBe(80);
  });

  it("material sem custo unitário válido marca incompleto", () => {
    const created = createPerformedProcedure(ownerA, {
      patient_id: "p-a-001",
      appointment_id: "appt-a-1",
      procedure_id: "proc-a-restoration",
      tooth_number: 16,
      charged_amount_reais: 300,
    });
    const store = getPerformedStore();
    for (const line of store.procedureConsumptions) {
      if (line.performed_procedure_id === created.procedure.id) {
        line.unit_cost_snapshot_cents = 0;
        line.actual_cost_cents = 0;
        line.actual_quantity = 2;
        line.status = "confirmed";
        line.confirmed_at = new Date().toISOString();
      }
    }
    const pp = store.performedProcedures.find(
      (p) => p.id === created.procedure.id,
    )!;
    pp.consumption_confirmed = true;
    pp.actual_total_cost_cents = null;
    completePerformedProcedure(ownerA, created.procedure.id);

    const mats = getMaterialConsumptionReport(ownerA, { preset: "month" });
    const resin = mats.find((m) => m.item_name.includes("Resina"));
    expect(resin?.cost_incomplete).toBe(true);
    expect(resin?.cost_consumed_cents).toBeNull();
  });
});

describe("Subfase 6 — paciente e financeiro", () => {
  it("Mariana: 3 procs custo 150 cobrado 600 recebido 400 saldo 200", () => {
    const ids = [
      seedCompleted({ chargedReais: 200, costCents: 5000, tooth: 11 }),
      seedCompleted({ chargedReais: 200, costCents: 5000, tooth: 12 }),
      seedCompleted({ chargedReais: 200, costCents: 5000, tooth: 13 }),
    ];
    for (const id of ids) {
      createFinancialChargeFromPerformedProcedure(ownerA, {
        performed_procedure_id: id,
        charged_amount_reais: 200,
      });
    }
    const txs = getFinanceStore().transactions.filter(
      (t) => t.clinic_id === CLINIC_A_ID && t.patient_id === "p-a-001",
    );
    // Paga 200 na 1ª e 200 na 2ª cobrança → recebido 400, saldo 200
    for (const tx of txs.slice(0, 2)) {
      const inst = getFinanceStore().installments.find(
        (i) => i.financial_transaction_id === tx.id,
      )!;
      registerPayment(ownerA, {
        installment_id: inst.id,
        amount_reais: 200,
        payment_method: "pix",
        paid_at: new Date().toISOString(),
      });
    }

    const rows = getPatientOperationalReport(ownerA, { preset: "month" });
    const mariana = rows.find((r) => r.patient_id === "p-a-001")!;
    expect(mariana.procedures_count).toBe(3);
    expect(mariana.direct_cost_cents).toBe(15000);
    expect(mariana.charged_cents).toBe(60000);
    expect(mariana.received_cents).toBe(40000);
    expect(mariana.outstanding_cents).toBe(20000);
    expect(mariana.gross_result_cents).toBe(45000);
  });

  it("pagamento estornado não entra em recebido", () => {
    const id = seedCompleted({ chargedReais: 300, costCents: 3000, tooth: 16 });
    createFinancialChargeFromPerformedProcedure(ownerA, {
      performed_procedure_id: id,
      charged_amount_reais: 300,
    });
    const tx = getFinanceStore().transactions.find(
      (t) => t.clinic_id === CLINIC_A_ID,
    )!;
    const inst = getFinanceStore().installments.find(
      (i) => i.financial_transaction_id === tx.id,
    )!;
    const pay = registerPayment(ownerA, {
      installment_id: inst.id,
      amount_reais: 300,
      payment_method: "pix",
      paid_at: new Date().toISOString(),
    });
    reversePayment(ownerA, {
      payment_id: pay.payment.id,
      reversal_reason: "teste",
    });
    const overview = getOperationalOverview(ownerA, { preset: "month" });
    expect(overview.received_cents).toBe(0);
  });
});

describe("Subfase 6 — segurança", () => {
  it("cross-clinic: Clinic B não vê contagem da A", () => {
    seedCompleted({ chargedReais: 300, costCents: 3000, tooth: 16 });
    const a = getOperationalOverview(ownerA, { preset: "month" });
    expect(a.procedures_completed).toBe(1);
    setDemoSession(OWNER_B_ID, CLINIC_B_ID);
    const b = getOperationalOverview(ownerB, { preset: "month" });
    expect(b.procedures_completed).toBe(0);
  });

  it("secretária sem custo não recebe margem/resultado no payload", () => {
    seedCompleted({ chargedReais: 300, costCents: 3000, tooth: 16 });
    expect(can(secretaryA, "reports.procedure_costs_view").allowed).toBe(false);
    setDemoSession(SECRETARY_A_ID, CLINIC_A_ID);
    const bundle = getOperationalBundle(secretaryA, { preset: "month" });
    expect(bundle.capabilities.costs).toBe(false);
    expect(bundle.overview.materials_cost_cents).toBeNull();
    expect(bundle.overview.gross_result_charged_cents).toBeNull();
    expect(bundle.procedures[0]?.margin_percent).toBeNull();
    expect(bundle.procedures[0]?.gross_result_cents).toBeNull();
    expect(bundle.procedures[0]?.avg_actual_cost_cents).toBeNull();
  });

  it("export operacional audita report.exported e respeita período", async () => {
    seedCompleted({ chargedReais: 300, costCents: 3000, tooth: 16 });
    const file = await exportReport(
      ownerA,
      { preset: "month" },
      "csv",
      "operational",
    );
    expect(file.filename).toContain("operacional");
    expect(String(file.body)).toContain("Sorria");
    expect(String(file.body)).toContain("Procedimentos");
    expect(
      getAuthzStore().auditLogs.some((a) => a.action === "report.exported"),
    ).toBe(true);
  });
});

describe("Subfase 6 — previsto × real em materiais", () => {
  it("desvio de quantidade aparece na tabela", () => {
    const created = createPerformedProcedure(ownerA, {
      patient_id: "p-a-001",
      appointment_id: "appt-a-1",
      procedure_id: "proc-a-restoration",
      tooth_number: 16,
      charged_amount_reais: 300,
    });
    const store = getPerformedStore();
    for (const line of store.procedureConsumptions) {
      if (
        line.performed_procedure_id === created.procedure.id &&
        line.item_name_snapshot.includes("Resina")
      ) {
        line.planned_quantity = 10;
        line.actual_quantity = 12;
        line.status = "confirmed";
        line.confirmed_at = new Date().toISOString();
      } else if (line.performed_procedure_id === created.procedure.id) {
        line.actual_quantity = line.planned_quantity;
        line.status = "confirmed";
        line.confirmed_at = new Date().toISOString();
      }
    }
    const pp = store.performedProcedures.find(
      (p) => p.id === created.procedure.id,
    )!;
    pp.consumption_confirmed = true;
    pp.actual_total_cost_cents = 5000;
    completePerformedProcedure(ownerA, created.procedure.id);

    const mats = getMaterialConsumptionReport(ownerA, { preset: "month" });
    const resin = mats.find((m) => m.item_name.includes("Resina"))!;
    expect(resin.difference).toBeCloseTo(2);
    expect(resin.difference_percent).toBe(20);
  });
});
