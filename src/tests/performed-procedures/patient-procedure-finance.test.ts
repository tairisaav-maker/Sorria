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
import { resetClinicalStore } from "@/lib/demo/clinical-store";
import { getFinanceStore, resetFinanceStore } from "@/lib/demo/finance-store";
import {
  getInventoryStore,
  resetInventoryStore,
} from "@/lib/demo/inventory-store";
import {
  getPerformedStore,
  resetPerformedStore,
} from "@/lib/demo/performed-procedures-store";
import { resetProcedureFinanceStore } from "@/lib/demo/procedure-finance-store";
import {
  getTreatmentsStore,
  resetTreatmentsStore,
} from "@/lib/demo/treatments-store";
import { allocatePaymentAcrossProcedureAmounts } from "@/lib/finance/allocation";
import {
  cancelFinancialTransaction,
  createIncomeTransaction,
  registerPayment,
  reversePayment,
} from "@/services/finance";
import {
  allocateFinancialTransactionToProcedures,
  calculateProcedureOutstandingBalance,
  calculateProcedureReceivedAmount,
  createEvolutionFromPerformedProcedure,
  createFinancialChargeFromPerformedProcedure,
  getProcedureFinanceBreakdown,
  linkPerformedProcedureToFinancialTransaction,
  markPerformedProcedureNoCharge,
  setPerformedProcedureChargedAmount,
} from "@/services/patient-procedure-finance";
import { getPatientOperationalFinancialSummary } from "@/services/patient-summary";
import {
  completePerformedProcedure,
  createPerformedProcedure,
  shouldOfferFinanceCharge,
} from "@/services/performed-procedures";
import { confirmProcedureConsumption } from "@/services/procedure-consumption";

beforeEach(() => {
  resetAuthzStore();
  resetInventoryStore();
  resetPerformedStore();
  resetProcedureFinanceStore();
  resetFinanceStore();
  resetClinicalStore();
  resetTreatmentsStore();
  setDemoSession(OWNER_A_ID, CLINIC_A_ID);
});

const ownerA = { userId: OWNER_A_ID, clinicId: CLINIC_A_ID };
const secretaryA = { userId: SECRETARY_A_ID, clinicId: CLINIC_A_ID };
const dentistA = { userId: DENTIST_A_ID, clinicId: CLINIC_A_ID };

function forceActualCost(id: string, cents: number) {
  const row = getPerformedStore().performedProcedures.find((p) => p.id === id)!;
  row.actual_total_cost_cents = cents;
}

describe("allocatePaymentAcrossProcedureAmounts", () => {
  it("residual cents soma exata 100 = 33+33+34", () => {
    const parts = allocatePaymentAcrossProcedureAmounts({
      paymentCents: 10000,
      allocations: [
        { id: "a", amount_allocated_cents: 3300 },
        { id: "b", amount_allocated_cents: 3300 },
        { id: "c", amount_allocated_cents: 3400 },
      ],
    });
    expect(parts.reduce((s, p) => s + p.received_cents, 0)).toBe(10000);
  });
});

describe("procedimento individual", () => {
  it("custo 40 cobrado 300 recebido 200 → saldo 100 resultado 260", () => {
    const created = createPerformedProcedure(ownerA, {
      patient_id: "p-a-001",
      appointment_id: "appt-a-1",
      procedure_id: "proc-a-restoration",
      tooth_number: 16,
      charged_amount_reais: 300,
    });
    const ppId = created.procedure.id;
    confirmProcedureConsumption(ownerA, {
      performed_procedure_id: ppId,
      confirm_insufficient_stock: true,
    });
    forceActualCost(ppId, 4000);
    completePerformedProcedure(ownerA, ppId);

    createFinancialChargeFromPerformedProcedure(ownerA, {
      performed_procedure_id: ppId,
      charged_amount_reais: 300,
    });
    const breakdown = getProcedureFinanceBreakdown(ownerA, ppId);
    const txId = breakdown.links[0]!.financial_transaction_id;
    const inst = getFinanceStore().installments.find(
      (i) => i.financial_transaction_id === txId,
    )!;
    registerPayment(ownerA, {
      installment_id: inst.id,
      amount_reais: 200,
      payment_method: "pix",
      paid_at: new Date().toISOString(),
    });

    const after = getProcedureFinanceBreakdown(ownerA, ppId);
    expect(after.received_cents).toBe(20000);
    expect(after.outstanding_cents).toBe(10000);
    expect(after.gross_result_charged_cents).toBe(26000);
  });
});

describe("pagamento parcial e total com dois procedimentos", () => {
  it("rateio 250 de 500 → 75 e 175; depois +250 zera; estorno recalcula", () => {
    const proph = createPerformedProcedure(ownerA, {
      patient_id: "p-a-001",
      appointment_id: "appt-a-1",
      procedure_id: "proc-a-prophylaxis",
      charged_amount_reais: 150,
    });
    const rest = createPerformedProcedure(ownerA, {
      patient_id: "p-a-001",
      appointment_id: "appt-a-1",
      procedure_id: "proc-a-restoration",
      tooth_number: 16,
      charged_amount_reais: 350,
    });
    for (const id of [proph.procedure.id, rest.procedure.id]) {
      confirmProcedureConsumption(ownerA, {
        performed_procedure_id: id,
        confirm_insufficient_stock: true,
      });
      completePerformedProcedure(ownerA, id);
    }

    const tx = createIncomeTransaction(ownerA, {
      type: "income",
      description: "Consulta Mariana",
      patient_id: "p-a-001",
      appointment_id: "appt-a-1",
      gross_amount_reais: 500,
      due_date: new Date().toISOString().slice(0, 10),
      installments_count: 1,
    });
    allocateFinancialTransactionToProcedures(ownerA, {
      financial_transaction_id: tx.id,
      allocations: [
        {
          performed_procedure_id: proph.procedure.id,
          amount_allocated_reais: 150,
        },
        {
          performed_procedure_id: rest.procedure.id,
          amount_allocated_reais: 350,
        },
      ],
    });

    const inst = getFinanceStore().installments.find(
      (i) => i.financial_transaction_id === tx.id,
    )!;
    registerPayment(ownerA, {
      installment_id: inst.id,
      amount_reais: 250,
      payment_method: "pix",
      paid_at: new Date().toISOString(),
    });

    expect(calculateProcedureReceivedAmount(ownerA, proph.procedure.id)).toBe(
      7500,
    );
    expect(calculateProcedureReceivedAmount(ownerA, rest.procedure.id)).toBe(
      17500,
    );

    const pay2 = registerPayment(ownerA, {
      installment_id: inst.id,
      amount_reais: 250,
      payment_method: "pix",
      paid_at: new Date().toISOString(),
    });
    expect(calculateProcedureReceivedAmount(ownerA, proph.procedure.id)).toBe(
      15000,
    );
    expect(calculateProcedureReceivedAmount(ownerA, rest.procedure.id)).toBe(
      35000,
    );
    expect(
      calculateProcedureOutstandingBalance(ownerA, proph.procedure.id) +
        calculateProcedureOutstandingBalance(ownerA, rest.procedure.id),
    ).toBe(0);

    reversePayment(ownerA, {
      payment_id: pay2.payment.id,
      reversal_reason: "Teste estorno",
    });
    expect(calculateProcedureReceivedAmount(ownerA, proph.procedure.id)).toBe(
      7500,
    );
    expect(calculateProcedureReceivedAmount(ownerA, rest.procedure.id)).toBe(
      17500,
    );
  });
});

describe("plano já financeiro e cortesia", () => {
  it("treatment item com plano cobrado → não cria cobrança", () => {
    const plan = getTreatmentsStore().plans.find(
      (p) => p.id === "tp-a-progress",
    )!;
    const item = getTreatmentsStore().items.find(
      (i) => i.treatment_plan_id === plan.id,
    )!;
    const created = createPerformedProcedure(ownerA, {
      patient_id: plan.patient_id,
      appointment_id: "appt-a-1",
      procedure_id: "proc-a-restoration",
      treatment_item_id: item.id,
      charged_amount_reais: 350,
    });
    const offer = shouldOfferFinanceCharge(ownerA, created.procedure.id);
    expect(offer.offer).toBe(false);
    expect(offer.reason).toBe("plan_already_billed");
  });

  it("charged 0 sem cobrança; custo permanece", () => {
    const created = createPerformedProcedure(ownerA, {
      patient_id: "p-a-001",
      appointment_id: "appt-a-1",
      procedure_id: "proc-a-restoration",
      charged_amount_reais: 0,
      charged_zero_reason: "Cortesia",
    });
    confirmProcedureConsumption(ownerA, {
      performed_procedure_id: created.procedure.id,
      confirm_insufficient_stock: true,
    });
    forceActualCost(created.procedure.id, 12000);
    completePerformedProcedure(ownerA, created.procedure.id);
    markPerformedProcedureNoCharge(ownerA, {
      id: created.procedure.id,
      reason: "Cortesia / retrabalho",
    });
    const b = getProcedureFinanceBreakdown(ownerA, created.procedure.id);
    expect(b.financial_status).toBe("no_charge");
    expect(b.charged_amount_cents).toBe(0);
    expect(b.actual_total_cost_cents).toBe(12000);
    expect(b.gross_result_charged_cents).toBe(-12000);
  });
});

describe("custo x cobrança negativo", () => {
  it("custo 120 cobrado 100 → resultado -20", () => {
    const created = createPerformedProcedure(ownerA, {
      patient_id: "p-a-001",
      appointment_id: "appt-a-1",
      procedure_id: "proc-a-restoration",
      charged_amount_reais: 100,
    });
    confirmProcedureConsumption(ownerA, {
      performed_procedure_id: created.procedure.id,
      confirm_insufficient_stock: true,
    });
    forceActualCost(created.procedure.id, 12000);
    completePerformedProcedure(ownerA, created.procedure.id);
    const b = getProcedureFinanceBreakdown(ownerA, created.procedure.id);
    expect(b.gross_result_charged_cents).toBe(-2000);
  });
});

describe("evolução vinculada", () => {
  it("cria clinical entry com performed_procedure_id", () => {
    const created = createPerformedProcedure(ownerA, {
      patient_id: "p-a-001",
      appointment_id: "appt-a-1",
      procedure_id: "proc-a-restoration",
      tooth_number: 16,
    });
    const entry = createEvolutionFromPerformedProcedure(
      ownerA,
      created.procedure.id,
      { conduct: "Restauração em resina composta." },
    );
    expect(entry.performed_procedure_id).toBe(created.procedure.id);
    expect(entry.patient_id).toBe("p-a-001");
    expect(entry.related_teeth).toContain(16);
    const row = getPerformedStore().performedProcedures.find(
      (p) => p.id === created.procedure.id,
    )!;
    expect(row.clinical_entry_id).toBe(entry.id);
  });
});

describe("histórico de preço padrão", () => {
  it("alterar procedure não muda snapshot", () => {
    const created = createPerformedProcedure(ownerA, {
      patient_id: "p-a-001",
      appointment_id: "appt-a-1",
      procedure_id: "proc-a-restoration",
      charged_amount_reais: 300,
    });
    const snap = created.procedure.standard_price_snapshot_cents;
    const proc = getInventoryStore().procedures.find(
      (p) => p.id === "proc-a-restoration",
    )!;
    proc.default_price_cents = 40000;
    const again = getProcedureFinanceBreakdown(ownerA, created.procedure.id);
    expect(again.standard_price_cents).toBe(snap);
    expect(again.charged_amount_cents).toBe(30000);
  });
});

describe("cross-patient e cross-clinic", () => {
  it("não vincula transação de outro paciente", () => {
    const created = createPerformedProcedure(ownerA, {
      patient_id: "p-a-001",
      appointment_id: "appt-a-1",
      procedure_id: "proc-a-restoration",
      charged_amount_reais: 200,
    });
    const tx = createIncomeTransaction(ownerA, {
      type: "income",
      description: "Outro paciente",
      patient_id: "p-a-003",
      gross_amount_reais: 200,
      due_date: new Date().toISOString().slice(0, 10),
    });
    expect(() =>
      linkPerformedProcedureToFinancialTransaction(ownerA, {
        performed_procedure_id: created.procedure.id,
        financial_transaction_id: tx.id,
        amount_allocated_reais: 200,
      }),
    ).toThrow(/CROSS_PATIENT/);
  });

  it("clinic B não acessa procedimento clinic A", () => {
    const created = createPerformedProcedure(ownerA, {
      patient_id: "p-a-001",
      appointment_id: "appt-a-1",
      procedure_id: "proc-a-restoration",
      charged_amount_reais: 200,
    });
    setDemoSession(OWNER_B_ID, CLINIC_B_ID);
    expect(() =>
      getProcedureFinanceBreakdown(
        { userId: OWNER_B_ID, clinicId: CLINIC_B_ID },
        created.procedure.id,
      ),
    ).toThrow(/PERFORMED_PROCEDURE_NOT_FOUND/);
  });
});

describe("permissões", () => {
  it("secretária sem custo não vê margem", () => {
    const created = createPerformedProcedure(dentistA, {
      patient_id: "p-a-001",
      appointment_id: "appt-a-1",
      procedure_id: "proc-a-restoration",
      charged_amount_reais: 300,
    });
    confirmProcedureConsumption(dentistA, {
      performed_procedure_id: created.procedure.id,
      confirm_insufficient_stock: true,
    });
    forceActualCost(created.procedure.id, 4000);
    completePerformedProcedure(dentistA, created.procedure.id);

    expect(can(secretaryA, "procedure_costs.view").allowed).toBe(false);
    const b = getProcedureFinanceBreakdown(secretaryA, created.procedure.id);
    expect(b.actual_total_cost_cents).toBeNull();
    expect(b.gross_result_charged_cents).toBeNull();
  });

  it("usuário com financeiro vê recebido/saldo", () => {
    const created = createPerformedProcedure(ownerA, {
      patient_id: "p-a-001",
      appointment_id: "appt-a-1",
      procedure_id: "proc-a-restoration",
      charged_amount_reais: 300,
    });
    createFinancialChargeFromPerformedProcedure(ownerA, {
      performed_procedure_id: created.procedure.id,
    });
    const bDent = getProcedureFinanceBreakdown(dentistA, created.procedure.id);
    expect(bDent.charged_amount_cents).toBe(30000);
    expect(bDent.received_cents).toBe(0);

    const bSec = getProcedureFinanceBreakdown(secretaryA, created.procedure.id);
    expect(bSec.received_cents).toBe(0);
    expect(bSec.outstanding_cents).toBe(30000);
  });
});

describe("cancelamento de cobrança", () => {
  it("tx cancelada remove links ativos", () => {
    const created = createPerformedProcedure(ownerA, {
      patient_id: "p-a-001",
      appointment_id: "appt-a-1",
      procedure_id: "proc-a-restoration",
      charged_amount_reais: 300,
    });
    const { transaction } = createFinancialChargeFromPerformedProcedure(
      ownerA,
      { performed_procedure_id: created.procedure.id },
    );
    cancelFinancialTransaction(ownerA, transaction.id, "Erro de lançamento");
    const b = getProcedureFinanceBreakdown(ownerA, created.procedure.id);
    expect(b.links).toHaveLength(0);
    expect(b.financial_status).toBe("pending_charge");
  });
});

describe("resumo paciente", () => {
  it("agrega procedimentos e financeiro", () => {
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
    forceActualCost(created.procedure.id, 4000);
    completePerformedProcedure(ownerA, created.procedure.id);
    const summary = getPatientOperationalFinancialSummary(ownerA, "p-a-001");
    expect(summary.procedures_count).toBeGreaterThanOrEqual(1);
    expect(summary.direct_cost_cents).toBeGreaterThanOrEqual(4000);
    expect(summary.charged_cents).toBeGreaterThanOrEqual(30000);
  });
});

describe("set charged amount", () => {
  it("calcula desconto implícito", () => {
    const created = createPerformedProcedure(ownerA, {
      patient_id: "p-a-001",
      appointment_id: "appt-a-1",
      procedure_id: "proc-a-restoration",
      charged_amount_reais: 350,
    });
    const b = setPerformedProcedureChargedAmount(ownerA, {
      id: created.procedure.id,
      charged_amount_reais: 300,
      charge_note: "Negociação",
    });
    expect(b.discount_amount_cents).toBe(5000);
    expect(b.discount_percent).toBeCloseTo(14.29, 1);
  });
});
