import {
  CLINIC_A_ID,
  CLINIC_B_ID,
  OWNER_A_ID,
  SECRETARY_A_ID,
  DENTIST_B_ID,
  appendAudit,
} from "@/lib/demo/authz-store";
import type {
  FinancialTransaction,
  Payment,
  PaymentInstallment,
} from "@/types/finance";

type Store = {
  transactions: FinancialTransaction[];
  installments: PaymentInstallment[];
  payments: Payment[];
};

declare global {
  var __sorriaFinanceStoreV6: Store | undefined;
}

function stamp(h = 0) {
  return new Date(Date.now() - h * 3600_000).toISOString();
}

function dateOffset(days: number) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function seed(): Store {
  const cash: FinancialTransaction = {
    id: "ft-a-cash",
    clinic_id: CLINIC_A_ID,
    patient_id: "p-a-008",
    treatment_plan_id: "tp-a-done",
    appointment_id: null,
    type: "income",
    description: "Profilaxia — à vista",
    category: null,
    cost_behavior: null,
    recurrence_type: null,
    allocation_eligible: null,
    reference_month: null,
    competence_date: null,
    gross_amount_cents: 18000,
    discount_amount_cents: 0,
    net_amount_cents: 18000,
    status: "paid",
    due_date: dateOffset(-20),
    notes: null,
    created_by: OWNER_A_ID,
    created_at: stamp(480),
    updated_at: stamp(470),
    cancelled_at: null,
    cancelled_by: null,
    cancellation_reason: null,
  };

  const parcelado: FinancialTransaction = {
    id: "ft-a-parcelado",
    clinic_id: CLINIC_A_ID,
    patient_id: "p-a-001",
    treatment_plan_id: "tp-a-progress",
    appointment_id: null,
    type: "income",
    description: "Plano Outubro — 3 parcelas",
    category: null,
    cost_behavior: null,
    recurrence_type: null,
    allocation_eligible: null,
    reference_month: null,
    competence_date: null,
    gross_amount_cents: 180000,
    discount_amount_cents: 0,
    net_amount_cents: 180000,
    status: "partially_paid",
    due_date: dateOffset(-10),
    notes: "Condição a partir do plano aceito",
    created_by: OWNER_A_ID,
    created_at: stamp(200),
    updated_at: stamp(24),
    cancelled_at: null,
    cancelled_by: null,
    cancellation_reason: null,
  };

  const overdueTx: FinancialTransaction = {
    id: "ft-a-overdue",
    clinic_id: CLINIC_A_ID,
    patient_id: "p-a-004",
    treatment_plan_id: "tp-a-presented",
    appointment_id: null,
    type: "income",
    description: "Entrada — restaurações",
    category: null,
    cost_behavior: null,
    recurrence_type: null,
    allocation_eligible: null,
    reference_month: null,
    competence_date: null,
    gross_amount_cents: 50000,
    discount_amount_cents: 0,
    net_amount_cents: 50000,
    status: "overdue",
    due_date: dateOffset(-8),
    notes: null,
    created_by: SECRETARY_A_ID,
    created_at: stamp(300),
    updated_at: stamp(300),
    cancelled_at: null,
    cancelled_by: null,
    cancellation_reason: null,
  };

  const manual: FinancialTransaction = {
    id: "ft-a-manual",
    clinic_id: CLINIC_A_ID,
    patient_id: "p-a-002",
    treatment_plan_id: null,
    appointment_id: null,
    type: "income",
    description: "Avaliação avulsa",
    category: null,
    cost_behavior: null,
    recurrence_type: null,
    allocation_eligible: null,
    reference_month: null,
    competence_date: null,
    gross_amount_cents: 15000,
    discount_amount_cents: 0,
    net_amount_cents: 15000,
    status: "pending",
    due_date: dateOffset(5),
    notes: "Receita manual",
    created_by: SECRETARY_A_ID,
    created_at: stamp(40),
    updated_at: stamp(40),
    cancelled_at: null,
    cancelled_by: null,
    cancellation_reason: null,
  };

  const expense: FinancialTransaction = {
    id: "ft-a-expense",
    clinic_id: CLINIC_A_ID,
    patient_id: null,
    treatment_plan_id: null,
    appointment_id: null,
    type: "expense",
    description: "Material descartável",
    category: "material",
    cost_behavior: "fixed",
    recurrence_type: "one_time",
    allocation_eligible: false,
    reference_month: new Date().toISOString().slice(0, 7),
    competence_date: dateOffset(-3),
    gross_amount_cents: 32000,
    discount_amount_cents: 0,
    net_amount_cents: 32000,
    status: "paid",
    due_date: dateOffset(-3),
    notes: null,
    created_by: OWNER_A_ID,
    created_at: stamp(72),
    updated_at: stamp(70),
    cancelled_at: null,
    cancelled_by: null,
    cancellation_reason: null,
  };

  const clinicB: FinancialTransaction = {
    id: "ft-b-1",
    clinic_id: CLINIC_B_ID,
    patient_id: "p-b-001",
    treatment_plan_id: "tp-b-1",
    appointment_id: null,
    type: "income",
    description: "Avaliação Clinic B",
    category: null,
    cost_behavior: null,
    recurrence_type: null,
    allocation_eligible: null,
    reference_month: null,
    competence_date: null,
    gross_amount_cents: 50000,
    discount_amount_cents: 0,
    net_amount_cents: 50000,
    status: "pending",
    due_date: dateOffset(3),
    notes: null,
    created_by: DENTIST_B_ID,
    created_at: stamp(20),
    updated_at: stamp(20),
    cancelled_at: null,
    cancelled_by: null,
    cancellation_reason: null,
  };

  const installments: PaymentInstallment[] = [
    inst(cash.id, 1, 18000, dateOffset(-20), "paid"),
    inst(parcelado.id, 1, 60000, dateOffset(-10), "paid"),
    inst(parcelado.id, 2, 60000, dateOffset(20), "partially_paid"),
    inst(parcelado.id, 3, 60000, dateOffset(50), "pending"),
    inst(overdueTx.id, 1, 50000, dateOffset(-8), "overdue"),
    inst(manual.id, 1, 15000, dateOffset(5), "pending"),
    inst(expense.id, 1, 32000, dateOffset(-3), "paid"),
    inst(clinicB.id, 1, 50000, dateOffset(3), "pending"),
  ];

  const payments: Payment[] = [
    pay(cash.id, installments[0]!.id, 18000, "cash", stamp(470), null),
    pay(parcelado.id, installments[1]!.id, 60000, "pix", stamp(100), null),
    pay(parcelado.id, installments[2]!.id, 30000, "credit_card", stamp(24), null),
    // Estorno demonstrativo em pagamento antigo
    (() => {
      const p = pay(
        parcelado.id,
        installments[1]!.id,
        10000,
        "pix",
        stamp(90),
        "req-reversed-demo",
      );
      p.reversed_at = stamp(88);
      p.reversed_by = OWNER_A_ID;
      p.reversal_reason = "Lançamento duplicado (demo)";
      return p;
    })(),
    pay(expense.id, installments[6]!.id, 32000, "bank_transfer", stamp(70), null),
  ];

  return {
    transactions: [parcelado, overdueTx, cash, manual, expense, clinicB],
    installments,
    payments,
  };
}

function inst(
  txId: string,
  number: number,
  amount: number,
  due: string,
  status: PaymentInstallment["status"],
): PaymentInstallment {
  const clinic = txId.startsWith("ft-b") ? CLINIC_B_ID : CLINIC_A_ID;
  return {
    id: `inst-${txId}-${number}`,
    clinic_id: clinic,
    financial_transaction_id: txId,
    installment_number: number,
    amount_cents: amount,
    due_date: due,
    status,
    created_at: stamp(200),
    updated_at: stamp(24),
  };
}

function pay(
  txId: string,
  instId: string,
  amount: number,
  method: Payment["payment_method"],
  paidAt: string,
  clientRequestId: string | null,
): Payment {
  const clinic = txId.startsWith("ft-b") ? CLINIC_B_ID : CLINIC_A_ID;
  return {
    id: crypto.randomUUID(),
    clinic_id: clinic,
    financial_transaction_id: txId,
    payment_installment_id: instId,
    amount_cents: amount,
    paid_at: paidAt,
    payment_method: method,
    notes: null,
    created_by: OWNER_A_ID,
    created_at: paidAt,
    client_request_id: clientRequestId,
    reversed_at: null,
    reversed_by: null,
    reversal_reason: null,
  };
}

export function getFinanceStore() {
  if (!globalThis.__sorriaFinanceStoreV6) {
    globalThis.__sorriaFinanceStoreV6 = seed();
  }
  return globalThis.__sorriaFinanceStoreV6;
}

export function resetFinanceStore() {
  globalThis.__sorriaFinanceStoreV6 = seed();
}

export function writeFinanceAudit(
  clinicId: string,
  actorUserId: string,
  action: string,
  targetType: string,
  targetId: string,
  metadata: Record<string, unknown> = {},
) {
  appendAudit({
    clinic_id: clinicId,
    actor_user_id: actorUserId,
    action,
    target_type: targetType,
    target_id: targetId,
    metadata,
  });
}
