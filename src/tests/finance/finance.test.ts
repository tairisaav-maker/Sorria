import { beforeEach, describe, expect, it } from "vitest";
import { can } from "@/lib/authz/can";
import {
  CLINIC_A_ID,
  DENTIST_A_ID,
  OWNER_A_ID,
  SECRETARY_A_ID,
  ensureDentistWithoutFinance,
  getAuthzStore,
  resetAuthzStore,
  setDemoSession,
} from "@/lib/demo/authz-store";
import { resetAgendaStore } from "@/lib/demo/agenda-store";
import { resetClinicalStore } from "@/lib/demo/clinical-store";
import { resetFinanceStore, getFinanceStore } from "@/lib/demo/finance-store";
import { resetPatientsStore } from "@/lib/demo/patients-store";
import { resetTreatmentsStore } from "@/lib/demo/treatments-store";
import { splitAmountIntoInstallments } from "@/lib/money";
import { deriveFinancialStatus } from "@/lib/finance/status";
import { getAnamnesis } from "@/services/anamnesis";
import {
  createIncomeTransaction,
  createInstallmentPlan,
  getFinancialDashboard,
  getFinancialTransaction,
  getPatientFinancialSummary,
  listFinancialTransactions,
  registerPayment,
  reversePayment,
} from "@/services/finance";
import { acceptTreatmentPlan, getTreatmentPlan } from "@/services/treatments";
import { getClinicalSummary } from "@/services/clinical";

const ownerA = { userId: OWNER_A_ID, clinicId: CLINIC_A_ID };
const dentistA = { userId: DENTIST_A_ID, clinicId: CLINIC_A_ID };
const secretaryA = { userId: SECRETARY_A_ID, clinicId: CLINIC_A_ID };

beforeEach(() => {
  resetAuthzStore();
  resetPatientsStore();
  resetAgendaStore();
  resetClinicalStore();
  resetTreatmentsStore();
  resetFinanceStore();
  setDemoSession(OWNER_A_ID, CLINIC_A_ID);
});

describe("parcelamento e arredondamento", () => {
  it("divide 1500 em 3×500", () => {
    expect(splitAmountIntoInstallments(150000, 3)).toEqual([50000, 50000, 50000]);
  });

  it("residual na última parcela para 100/3", () => {
    const parts = splitAmountIntoInstallments(10000, 3);
    expect(parts).toEqual([3333, 3333, 3334]);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(10000);
  });
});

describe("status derivado", () => {
  it("vencido quando due_date < hoje e saldo > 0", () => {
    expect(
      deriveFinancialStatus({
        amountCents: 50000,
        paidCents: 0,
        dueDate: "2020-01-01",
      }),
    ).toBe("overdue");
  });

  it("parcialmente pago", () => {
    expect(
      deriveFinancialStatus({
        amountCents: 50000,
        paidCents: 30000,
        dueDate: "2099-01-01",
      }),
    ).toBe("partially_paid");
  });
});

describe("pagamento parcial e múltiplo", () => {
  it("R$ 500 com R$ 300 → parcial; depois PIX+cartão completa", () => {
    const tx = createIncomeTransaction(ownerA, {
      type: "income",
      description: "Teste parcial",
      patient_id: "p-a-003",
      gross_amount_reais: 500,
      installments_count: 1,
      due_date: "2099-06-01",
    });
    const inst = tx.installments[0]!;
    const first = registerPayment(ownerA, {
      installment_id: inst.id,
      amount_reais: 300,
      paid_at: "2026-10-01",
      payment_method: "pix",
      client_request_id: "pay-partial-001",
    });
    expect(first.transaction.installments[0]!.paid_cents).toBe(30000);
    expect(first.transaction.installments[0]!.balance_cents).toBe(20000);
    expect(first.transaction.installments[0]!.status).toBe("partially_paid");

    registerPayment(ownerA, {
      installment_id: inst.id,
      amount_reais: 200,
      paid_at: "2026-10-02",
      payment_method: "credit_card",
      client_request_id: "pay-partial-002",
    });
    const after = getFinancialTransaction(ownerA, tx.id);
    expect(after.installments[0]!.balance_cents).toBe(0);
    expect(after.installments[0]!.status).toBe("paid");
    expect(after.status).toBe("paid");
  });

  it("bloqueia valor acima do saldo", () => {
    const tx = createIncomeTransaction(ownerA, {
      type: "income",
      description: "Saldo",
      patient_id: "p-a-003",
      gross_amount_reais: 100,
      installments_count: 1,
      due_date: "2099-01-01",
    });
    expect(() =>
      registerPayment(ownerA, {
        installment_id: tx.installments[0]!.id,
        amount_reais: 150,
        paid_at: "2026-10-01",
        payment_method: "cash",
      }),
    ).toThrow("AMOUNT_EXCEEDS_BALANCE");
  });
});

describe("idempotência e concorrência", () => {
  it("mesmo client_request_id não duplica pagamento", () => {
    const tx = createIncomeTransaction(ownerA, {
      type: "income",
      description: "Idem",
      patient_id: "p-a-003",
      gross_amount_reais: 500,
      installments_count: 1,
      due_date: "2099-01-01",
    });
    const body = {
      installment_id: tx.installments[0]!.id,
      amount_reais: 500,
      paid_at: "2026-10-01",
      payment_method: "pix" as const,
      client_request_id: "same-click",
    };
    const a = registerPayment(ownerA, body);
    const b = registerPayment(ownerA, body);
    expect(b.idempotent).toBe(true);
    expect(a.payment.id).toBe(b.payment.id);
    expect(getFinancialTransaction(ownerA, tx.id).paid_cents).toBe(50000);
  });

  it("segunda tentativa de quitar saldo já zero falha", () => {
    const tx = createIncomeTransaction(ownerA, {
      type: "income",
      description: "Race",
      patient_id: "p-a-003",
      gross_amount_reais: 500,
      installments_count: 1,
      due_date: "2099-01-01",
    });
    registerPayment(ownerA, {
      installment_id: tx.installments[0]!.id,
      amount_reais: 500,
      paid_at: "2026-10-01",
      payment_method: "pix",
      client_request_id: "race-attempt-a",
    });
    expect(() =>
      registerPayment(secretaryA, {
        installment_id: tx.installments[0]!.id,
        amount_reais: 500,
        paid_at: "2026-10-01",
        payment_method: "cash",
        client_request_id: "race-attempt-b",
      }),
    ).toThrow("AMOUNT_EXCEEDS_BALANCE");
  });
});

describe("estorno", () => {
  it("preserva pagamento, recalcula saldo e audita", () => {
    const tx = createIncomeTransaction(ownerA, {
      type: "income",
      description: "Estorno",
      patient_id: "p-a-003",
      gross_amount_reais: 500,
      installments_count: 1,
      due_date: "2099-01-01",
    });
    const { payment } = registerPayment(ownerA, {
      installment_id: tx.installments[0]!.id,
      amount_reais: 500,
      paid_at: "2026-10-01",
      payment_method: "pix",
      client_request_id: "reverse-pay-001",
    });
    const reversed = reversePayment(ownerA, {
      payment_id: payment.id,
      reversal_reason: "Erro de lançamento",
    });
    expect(reversed.payment.reversed_at).toBeTruthy();
    expect(reversed.transaction.balance_cents).toBe(50000);
    expect(reversed.transaction.status).toBe("pending");
    expect(
      getAuthzStore().auditLogs.some((a) => a.action === "payment.reversed"),
    ).toBe(true);
  });
});

describe("plano aceito ≠ receita", () => {
  it("antes da condição financeira recebido = 0", () => {
    // tp-a-accepted existe no seed de tratamentos
    const plan = getTreatmentPlan(dentistA, "tp-a-accepted");
    expect(plan.status).toBe("accepted");
    expect(plan.total_cents).toBe(95000);
    const summaryBefore = getPatientFinancialSummary(ownerA, plan.patient_id);
    // paciente pode ter outras txs; garantir que o plano em si não gerou pagamento
    const linked = getFinanceStore().transactions.filter(
      (t) => t.treatment_plan_id === plan.id,
    );
    expect(linked.length).toBe(0);

    const created = createInstallmentPlan(ownerA, {
      treatment_plan_id: plan.id,
      installments_count: 4,
      first_due_date: "2099-01-15",
    });
    expect(created.net_amount_cents).toBe(95000);
    expect(created.paid_cents).toBe(0);
    expect(created.balance_cents).toBe(95000);
    expect(created.installments).toHaveLength(4);

    registerPayment(ownerA, {
      installment_id: created.installments[0]!.id,
      amount_reais: created.installments[0]!.amount_cents / 100,
      paid_at: "2026-10-01",
      payment_method: "pix",
      client_request_id: "plan-pay-1",
    });
    const after = getFinancialTransaction(ownerA, created.id);
    expect(after.paid_cents).toBe(created.installments[0]!.amount_cents);
    expect(after.balance_cents).toBe(
      95000 - created.installments[0]!.amount_cents,
    );
    // plano não alterado
    expect(getTreatmentPlan(dentistA, plan.id).total_cents).toBe(95000);
    void summaryBefore;
  });

  it("4×500: recebido 0 depois 500", () => {
    const created = createIncomeTransaction(ownerA, {
      type: "income",
      description: "4 parcelas",
      patient_id: "p-a-003",
      gross_amount_reais: 2000,
      installments_count: 4,
      due_date: "2099-02-01",
    });
    expect(created.paid_cents).toBe(0);
    expect(created.balance_cents).toBe(200000);
    registerPayment(ownerA, {
      installment_id: created.installments[0]!.id,
      amount_reais: 500,
      paid_at: "2026-10-01",
      payment_method: "pix",
      client_request_id: "four-parcels-1",
    });
    const after = getFinancialTransaction(ownerA, created.id);
    expect(after.paid_cents).toBe(50000);
    expect(after.balance_cents).toBe(150000);
  });
});

describe("dashboard", () => {
  it("separa recebido, a receber, vencido e despesas", () => {
    const dash = getFinancialDashboard(ownerA, { period: "6m" });
    expect(dash.received_cents).toBeGreaterThan(0);
    expect(dash.receivable_cents).toBeGreaterThan(0);
    expect(dash.overdue_cents).toBeGreaterThan(0);
    expect(dash.expenses_cents).toBeGreaterThan(0);
    expect(dash.series.length).toBe(6);
  });
});

describe("permissões e isolamento", () => {
  it("secretária acessa financeiro e não prontuário", () => {
    expect(can(secretaryA, "finance.view_administrative").allowed).toBe(true);
    expect(can(secretaryA, "finance.payment_create").allowed).toBe(true);
    expect(can(secretaryA, "anamnesis.view").allowed).toBe(false);
    expect(() => getAnamnesis(secretaryA, "p-a-001")).toThrow(
      "AUTHORIZATION_DENIED",
    );
    expect(getFinancialDashboard(secretaryA, { period: "month" }).received_cents).toBeGreaterThanOrEqual(0);
  });

  it("dentista sem financeiro administrativo é negado no dashboard", () => {
    expect(can(dentistA, "finance.view_administrative").allowed).toBe(false);
    expect(can(dentistA, "clinical_record.view").allowed).toBe(true);
    expect(() => getFinancialDashboard(dentistA, { period: "month" })).toThrow(
      "AUTHORIZATION_DENIED",
    );
  });

  it("dentista sem financeiro: prontuário ok, financeiro negado", () => {
    const dentist = ensureDentistWithoutFinance();
    expect(can(dentist, "clinical_record.view").allowed).toBe(true);
    expect(can(dentist, "finance.view_administrative").allowed).toBe(false);
    expect(can(dentist, "finance.view_authorized").allowed).toBe(false);
    expect(() => getClinicalSummary(dentist, "p-a-001")).not.toThrow();
    expect(() => getPatientFinancialSummary(dentist, "p-a-001")).toThrow(
      "AUTHORIZATION_DENIED",
    );
    expect(() => listFinancialTransactions(dentist, { patient_id: "p-a-001" })).toThrow(
      "AUTHORIZATION_DENIED",
    );
  });

  it("cross-clinic bloqueado", () => {
    expect(() => getFinancialTransaction(ownerA, "ft-b-1")).toThrow(
      "FINANCE_NOT_FOUND",
    );
  });

  it("relação maliciosa clinic A + patient B negada", () => {
    expect(() =>
      createIncomeTransaction(ownerA, {
        type: "income",
        description: "Hack",
        patient_id: "p-b-001",
        gross_amount_reais: 10,
        installments_count: 1,
        due_date: "2099-01-01",
      }),
    ).toThrow("REF_TENANT_MISMATCH");
  });

  it("relação maliciosa treatment Clinic B negada", () => {
    expect(() =>
      createInstallmentPlan(ownerA, {
        treatment_plan_id: "tp-b-1",
        installments_count: 1,
      }),
    ).toThrow("REF_TENANT_MISMATCH");
  });
});

describe("aceite de plano ainda apresentado", () => {
  it("plano apresentado pode ser aceito sem gerar pagamento", () => {
    const plan = acceptTreatmentPlan(dentistA, "tp-a-presented");
    expect(plan.status).toBe("accepted");
    const linked = getFinanceStore().transactions.filter(
      (t) => t.treatment_plan_id === plan.id && t.id.startsWith("ft-new"),
    );
    expect(linked.length).toBe(0);
  });
});
