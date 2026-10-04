import { can, type AuthzContext } from "@/lib/authz/can";
import { assertPermission } from "@/lib/authz/guards";
import { getClinic } from "@/lib/demo/authz-store";
import {
  getFinanceStore,
  writeFinanceAudit,
} from "@/lib/demo/finance-store";
import { getPatientRecord } from "@/lib/demo/patients-store";
import { getTreatmentsStore } from "@/lib/demo/treatments-store";
import {
  calculateInstallmentBalance,
  deriveFinancialStatus,
} from "@/lib/finance/status";
import { reaisToCents, splitAmountIntoInstallments, sumCents } from "@/lib/money";
import {
  expenseSchema,
  financialFilterSchema,
  financialTransactionSchema,
  installmentPlanSchema,
  paymentReversalSchema,
  paymentSchema,
} from "@/lib/validations/finance";
import type {
  FinancialDashboard,
  FinancialStatus,
  FinancialTransaction,
  InstallmentWithBalance,
  PatientFinancialSummary,
  Payment,
  PaymentInstallment,
  TransactionWithDetails,
} from "@/types/finance";
import { addMonths, format, startOfMonth, subMonths } from "date-fns";

function requireFinanceView(ctx: AuthzContext) {
  if (
    !can(ctx, "finance.view_administrative").allowed &&
    !can(ctx, "finance.view_authorized").allowed
  ) {
    throw new Error("AUTHORIZATION_DENIED");
  }
}

function requireAdminFinance(ctx: AuthzContext) {
  assertPermission(ctx, "finance.view_administrative");
}

function assertSameClinicRefs(
  ctx: AuthzContext,
  refs: {
    patient_id?: string | null;
    treatment_plan_id?: string | null;
    appointment_id?: string | null;
  },
) {
  if (refs.patient_id) {
    const patient = getPatientRecord(refs.patient_id);
    if (!patient || patient.clinic_id !== ctx.clinicId) {
      throw new Error("REF_TENANT_MISMATCH");
    }
  }
  if (refs.treatment_plan_id) {
    const plan = getTreatmentsStore().plans.find(
      (p) => p.id === refs.treatment_plan_id,
    );
    if (!plan || plan.clinic_id !== ctx.clinicId) {
      throw new Error("REF_TENANT_MISMATCH");
    }
    if (refs.patient_id && plan.patient_id !== refs.patient_id) {
      throw new Error("REF_TENANT_MISMATCH");
    }
  }
}

function validPaymentsForInstallment(installmentId: string) {
  return getFinanceStore().payments.filter(
    (p) =>
      p.payment_installment_id === installmentId &&
      p.clinic_id &&
      !p.reversed_at,
  );
}

function paidCentsForInstallment(installmentId: string) {
  return sumCents(
    validPaymentsForInstallment(installmentId).map((p) => p.amount_cents),
  );
}

export function recalculateTransactionStatus(txId: string) {
  const store = getFinanceStore();
  const tx = store.transactions.find((t) => t.id === txId);
  if (!tx || tx.status === "cancelled") return;

  const installments = store.installments.filter(
    (i) => i.financial_transaction_id === txId,
  );
  for (const inst of installments) {
    const paid = paidCentsForInstallment(inst.id);
    inst.status = deriveFinancialStatus({
      amountCents: inst.amount_cents,
      paidCents: paid,
      dueDate: inst.due_date,
      cancelled: false,
    });
    inst.updated_at = new Date().toISOString();
  }

  const paid = sumCents(
    installments.map((i) => paidCentsForInstallment(i.id)),
  );
  const earliestOpen = installments
    .filter((i) => i.status !== "paid" && i.status !== "cancelled")
    .sort((a, b) => a.due_date.localeCompare(b.due_date))[0];

  tx.status = deriveFinancialStatus({
    amountCents: tx.net_amount_cents,
    paidCents: paid,
    dueDate: earliestOpen?.due_date ?? tx.due_date,
    cancelled: Boolean(tx.cancelled_at),
  });
  tx.updated_at = new Date().toISOString();
}

function enrichInstallment(inst: PaymentInstallment): InstallmentWithBalance {
  const payments = validPaymentsForInstallment(inst.id).concat(
    getFinanceStore().payments.filter(
      (p) => p.payment_installment_id === inst.id && Boolean(p.reversed_at),
    ),
  );
  const paid = paidCentsForInstallment(inst.id);
  const status = deriveFinancialStatus({
    amountCents: inst.amount_cents,
    paidCents: paid,
    dueDate: inst.due_date,
    cancelled: inst.status === "cancelled",
  });
  return {
    ...inst,
    status,
    paid_cents: paid,
    balance_cents: calculateInstallmentBalance(inst.amount_cents, paid),
    payments: payments.sort(
      (a, b) => +new Date(b.paid_at) - +new Date(a.paid_at),
    ),
  };
}

function enrichTransaction(tx: FinancialTransaction): TransactionWithDetails {
  const installments = getFinanceStore()
    .installments
    .filter((i) => i.financial_transaction_id === tx.id)
    .sort((a, b) => a.installment_number - b.installment_number)
    .map(enrichInstallment);
  const paid = sumCents(installments.map((i) => i.paid_cents));
  const patient = tx.patient_id ? getPatientRecord(tx.patient_id) : null;
  const plan = tx.treatment_plan_id
    ? getTreatmentsStore().plans.find((p) => p.id === tx.treatment_plan_id)
    : null;
  return {
    ...tx,
    installments,
    paid_cents: paid,
    balance_cents: calculateInstallmentBalance(tx.net_amount_cents, paid),
    patient_name: patient?.full_name ?? null,
    treatment_title: plan?.title ?? null,
  };
}

function createInstallmentsForTx(
  ctx: AuthzContext,
  tx: FinancialTransaction,
  parts: Array<{ amount_cents: number; due_date: string }>,
) {
  const store = getFinanceStore();
  const now = new Date().toISOString();
  parts.forEach((part, idx) => {
    const inst: PaymentInstallment = {
      id: crypto.randomUUID(),
      clinic_id: ctx.clinicId,
      financial_transaction_id: tx.id,
      installment_number: idx + 1,
      amount_cents: part.amount_cents,
      due_date: part.due_date,
      status: "pending",
      created_at: now,
      updated_at: now,
    };
    store.installments.push(inst);
  });
  recalculateTransactionStatus(tx.id);
}

function resolveInstallmentParts(
  netCents: number,
  input: {
    installments_count?: number;
    custom_installments?: Array<{ amount_reais: number; due_date: string }>;
    first_due_date?: string | null;
    due_date?: string | null;
  },
) {
  if (input.custom_installments?.length) {
    const parts = input.custom_installments.map((c) => ({
      amount_cents: reaisToCents(c.amount_reais),
      due_date: c.due_date,
    }));
    if (sumCents(parts.map((p) => p.amount_cents)) !== netCents) {
      throw new Error("INSTALLMENTS_SUM_MISMATCH");
    }
    return parts;
  }
  const count = input.installments_count ?? 1;
  const amounts = splitAmountIntoInstallments(netCents, count);
  const start = input.first_due_date || input.due_date || new Date().toISOString().slice(0, 10);
  return amounts.map((amount_cents, idx) => {
    const d = new Date(`${start}T12:00:00`);
    d.setMonth(d.getMonth() + idx);
    return {
      amount_cents,
      due_date: d.toISOString().slice(0, 10),
    };
  });
}

export function calculateTransactionBalance(txId: string) {
  const tx = enrichTransaction(
    getFinanceStore().transactions.find((t) => t.id === txId)!,
  );
  return {
    paid_cents: tx.paid_cents,
    balance_cents: tx.balance_cents,
    status: tx.status,
  };
}

export function calculatePatientBalance(ctx: AuthzContext, patientId: string) {
  return getPatientFinancialSummary(ctx, patientId);
}

function periodRange(filter: {
  period?: string;
  from?: string;
  to?: string;
}): { from: Date; to: Date } {
  const now = new Date();
  const to = filter.to ? new Date(`${filter.to}T23:59:59`) : now;
  let from: Date;
  switch (filter.period) {
    case "7d":
      from = new Date(now);
      from.setDate(from.getDate() - 7);
      break;
    case "30d":
      from = new Date(now);
      from.setDate(from.getDate() - 30);
      break;
    case "6m":
      from = subMonths(startOfMonth(now), 5);
      break;
    case "year":
      from = new Date(now.getFullYear(), 0, 1);
      break;
    case "custom":
      from = filter.from
        ? new Date(`${filter.from}T00:00:00`)
        : startOfMonth(now);
      break;
    case "month":
    default:
      from = startOfMonth(now);
      break;
  }
  return { from, to };
}

export function getFinancialDashboard(
  ctx: AuthzContext,
  rawFilter: Record<string, unknown> = {},
): FinancialDashboard {
  requireAdminFinance(ctx);
  const parsed = financialFilterSchema.safeParse(rawFilter);
  const filter = parsed.success ? parsed.data : financialFilterSchema.parse({});
  const { from, to } = periodRange(filter);
  const store = getFinanceStore();

  const clinicPayments = store.payments.filter(
    (p) =>
      p.clinic_id === ctx.clinicId &&
      !p.reversed_at &&
      new Date(p.paid_at) >= from &&
      new Date(p.paid_at) <= to,
  );

  let received = 0;
  let expenses = 0;
  for (const pay of clinicPayments) {
    const tx = store.transactions.find((t) => t.id === pay.financial_transaction_id);
    if (!tx || tx.cancelled_at) continue;
    if (tx.type === "income") received += pay.amount_cents;
    if (tx.type === "expense") expenses += pay.amount_cents;
  }

  // Recalcula overdue/receivable a partir das parcelas abertas (não só período)
  let receivable = 0;
  let overdue = 0;
  for (const inst of store.installments) {
    if (inst.clinic_id !== ctx.clinicId) continue;
    const tx = store.transactions.find((t) => t.id === inst.financial_transaction_id);
    if (!tx || tx.type !== "income" || tx.cancelled_at) continue;
    const enriched = enrichInstallment(inst);
    if (enriched.balance_cents <= 0) continue;
    receivable += enriched.balance_cents;
    if (enriched.status === "overdue") overdue += enriched.balance_cents;
  }

  const seriesStart = subMonths(startOfMonth(new Date()), 5);
  const series = Array.from({ length: 6 }, (_, i) => {
    const monthDate = addMonths(seriesStart, i);
    const key = format(monthDate, "yyyy-MM");
    const label = format(monthDate, "MMM");
    let income = 0;
    let expense = 0;
    for (const pay of store.payments) {
      if (pay.clinic_id !== ctx.clinicId || pay.reversed_at) continue;
      if (format(new Date(pay.paid_at), "yyyy-MM") !== key) continue;
      const tx = store.transactions.find((t) => t.id === pay.financial_transaction_id);
      if (!tx || tx.cancelled_at) continue;
      if (tx.type === "income") income += pay.amount_cents;
      else expense += pay.amount_cents;
    }
    return {
      month: label.charAt(0).toUpperCase() + label.slice(1),
      income: income / 100,
      expense: expense / 100,
    };
  });

  const upcoming = store.installments
    .filter((i) => i.clinic_id === ctx.clinicId)
    .map(enrichInstallment)
    .filter((i) => {
      const tx = store.transactions.find((t) => t.id === i.financial_transaction_id);
      return (
        tx &&
        tx.type === "income" &&
        !tx.cancelled_at &&
        i.balance_cents > 0
      );
    })
    .sort((a, b) => a.due_date.localeCompare(b.due_date))
    .slice(0, 8)
    .map((i) => {
      const tx = store.transactions.find((t) => t.id === i.financial_transaction_id)!;
      const patient = tx.patient_id ? getPatientRecord(tx.patient_id) : null;
      return {
        id: i.id,
        due_date: i.due_date,
        amount_cents: i.amount_cents,
        balance_cents: i.balance_cents,
        description: tx.description,
        patient_name: patient?.full_name ?? null,
        status: i.status,
      };
    });

  return {
    received_cents: received,
    receivable_cents: receivable,
    overdue_cents: overdue,
    expenses_cents: expenses,
    series,
    upcoming,
  };
}

export function listFinancialTransactions(
  ctx: AuthzContext,
  rawFilter: Record<string, unknown> = {},
) {
  requireFinanceView(ctx);
  const admin = can(ctx, "finance.view_administrative").allowed;
  const parsed = financialFilterSchema.safeParse(rawFilter);
  const filter = parsed.success ? parsed.data : financialFilterSchema.parse({});
  const q = (filter.q ?? "").toLowerCase().trim();

  if (!admin && !filter.patient_id) {
    // view_authorized sem paciente: sem vazamento do financeiro geral
    return [];
  }

  return getFinanceStore()
    .transactions
    .filter((tx) => {
      if (tx.clinic_id !== ctx.clinicId) return false;
      if (filter.patient_id && tx.patient_id !== filter.patient_id) return false;
      if (!admin && tx.patient_id !== filter.patient_id) return false;
      if (filter.type !== "all" && tx.type !== filter.type) return false;
      if (filter.category !== "all" && tx.category !== filter.category) return false;
      const enriched = enrichTransaction(tx);
      if (filter.status !== "all" && enriched.status !== filter.status) return false;
      if (q) {
        const hay = `${tx.description} ${enriched.patient_name ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
    .map(enrichTransaction);
}

export function getFinancialTransaction(ctx: AuthzContext, id: string) {
  requireFinanceView(ctx);
  const tx = getFinanceStore().transactions.find((t) => t.id === id);
  if (!tx || tx.clinic_id !== ctx.clinicId) {
    throw new Error("FINANCE_NOT_FOUND");
  }
  return enrichTransaction(tx);
}

function createTransactionBase(
  ctx: AuthzContext,
  raw: Record<string, unknown>,
  forceType?: "income" | "expense",
) {
  const schema = forceType === "expense" ? expenseSchema : financialTransactionSchema;
  const parsed = schema.safeParse({ ...raw, type: forceType ?? raw.type });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Dados inválidos");
  }
  const data = parsed.data;
  assertSameClinicRefs(ctx, data);

  const gross = reaisToCents(data.gross_amount_reais);
  const discount = reaisToCents(data.discount_amount_reais ?? 0);
  if (discount > gross) throw new Error("Desconto inválido");
  const net = gross - discount;

  const now = new Date().toISOString();
  const tx: FinancialTransaction = {
    id: crypto.randomUUID(),
    clinic_id: ctx.clinicId,
    patient_id: data.patient_id ?? null,
    treatment_plan_id: data.treatment_plan_id ?? null,
    appointment_id: data.appointment_id ?? null,
    type: data.type,
    description: data.description,
    category: data.category ?? null,
    gross_amount_cents: gross,
    discount_amount_cents: discount,
    net_amount_cents: net,
    status: "pending",
    due_date: data.due_date ?? null,
    notes: data.notes ?? null,
    created_by: ctx.userId,
    created_at: now,
    updated_at: now,
    cancelled_at: null,
    cancelled_by: null,
    cancellation_reason: null,
  };
  getFinanceStore().transactions.unshift(tx);

  const parts = resolveInstallmentParts(net, data);
  createInstallmentsForTx(ctx, tx, parts);

  writeFinanceAudit(
    ctx.clinicId,
    ctx.userId,
    "financial_transaction.created",
    "financial_transaction",
    tx.id,
    { type: tx.type, net_amount_cents: net },
  );
  writeFinanceAudit(
    ctx.clinicId,
    ctx.userId,
    "installment_plan.created",
    "financial_transaction",
    tx.id,
    { count: parts.length },
  );
  return enrichTransaction(tx);
}

export function createIncomeTransaction(
  ctx: AuthzContext,
  raw: Record<string, unknown>,
) {
  assertPermission(ctx, "finance.transaction_create");
  return createTransactionBase(ctx, { ...raw, type: "income" }, "income");
}

export function createExpenseTransaction(
  ctx: AuthzContext,
  raw: Record<string, unknown>,
) {
  assertPermission(ctx, "finance.expense_create");
  const created = createTransactionBase(ctx, { ...raw, type: "expense" }, "expense");
  // Despesa à vista: registrar pagamento automático do valor total se due_date <= hoje
  // Mantém regime de caixa: despesa só conta como "gasta" após pagamento.
  // Para UX demo, se installments_count=1, usuário registra pagamento depois.
  return created;
}

export function cancelFinancialTransaction(
  ctx: AuthzContext,
  id: string,
  reason: string,
) {
  assertPermission(ctx, "finance.transaction_update");
  const tx = getFinanceStore().transactions.find((t) => t.id === id);
  if (!tx || tx.clinic_id !== ctx.clinicId) throw new Error("FINANCE_NOT_FOUND");
  if (tx.cancelled_at) throw new Error("Já cancelado");
  const paid = enrichTransaction(tx).paid_cents;
  if (paid > 0) {
    throw new Error("Estorne os pagamentos antes de cancelar");
  }
  const now = new Date().toISOString();
  tx.cancelled_at = now;
  tx.cancelled_by = ctx.userId;
  tx.cancellation_reason = reason || "Cancelado";
  tx.status = "cancelled";
  tx.updated_at = now;
  for (const inst of getFinanceStore().installments.filter(
    (i) => i.financial_transaction_id === id,
  )) {
    inst.status = "cancelled";
    inst.updated_at = now;
  }
  writeFinanceAudit(
    ctx.clinicId,
    ctx.userId,
    "financial_transaction.cancelled",
    "financial_transaction",
    id,
    { reason },
  );
  return enrichTransaction(tx);
}

export function createInstallmentPlan(
  ctx: AuthzContext,
  raw: Record<string, unknown>,
) {
  assertPermission(ctx, "finance.transaction_create");
  const parsed = installmentPlanSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Dados inválidos");
  }
  const plan = getTreatmentsStore().plans.find(
    (p) => p.id === parsed.data.treatment_plan_id,
  );
  if (!plan || plan.clinic_id !== ctx.clinicId) {
    throw new Error("REF_TENANT_MISMATCH");
  }
  if (plan.status !== "accepted" && plan.status !== "in_progress" && plan.status !== "completed") {
    throw new Error("Plano precisa estar aceito para gerar condição financeira");
  }

  const discount = reaisToCents(parsed.data.discount_amount_reais ?? 0);
  const gross = plan.total_cents;
  if (discount > gross) throw new Error("Desconto inválido");

  return createIncomeTransaction(ctx, {
    type: "income",
    description:
      parsed.data.description ||
      `Condição de pagamento — ${plan.title}`,
    patient_id: plan.patient_id,
    treatment_plan_id: plan.id,
    gross_amount_reais: gross / 100,
    discount_amount_reais: discount / 100,
    due_date: parsed.data.first_due_date ?? new Date().toISOString().slice(0, 10),
    installments_count: parsed.data.installments_count ?? 1,
    custom_installments: parsed.data.custom_installments,
    notes: parsed.data.notes,
  });
}

export function registerPayment(ctx: AuthzContext, raw: Record<string, unknown>) {
  assertPermission(ctx, "finance.payment_create");
  const parsed = paymentSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Dados inválidos");
  }
  const store = getFinanceStore();

  if (parsed.data.client_request_id) {
    const existing = store.payments.find(
      (p) =>
        p.clinic_id === ctx.clinicId &&
        p.client_request_id === parsed.data.client_request_id,
    );
    if (existing) {
      return {
        payment: existing,
        transaction: getFinancialTransaction(ctx, existing.financial_transaction_id),
        idempotent: true,
      };
    }
  }

  const inst = store.installments.find((i) => i.id === parsed.data.installment_id);
  if (!inst || inst.clinic_id !== ctx.clinicId) {
    throw new Error("FINANCE_NOT_FOUND");
  }
  const tx = store.transactions.find((t) => t.id === inst.financial_transaction_id);
  if (!tx || tx.cancelled_at) throw new Error("FINANCE_NOT_FOUND");

  const balance = enrichInstallment(inst).balance_cents;
  const amount = reaisToCents(parsed.data.amount_reais);
  if (amount > balance) {
    throw new Error("AMOUNT_EXCEEDS_BALANCE");
  }

  // Lock lógico simples (demo): recheck após "leitura"
  const balanceAgain = enrichInstallment(inst).balance_cents;
  if (amount > balanceAgain) {
    throw new Error("AMOUNT_EXCEEDS_BALANCE");
  }

  const now = new Date().toISOString();
  const payment: Payment = {
    id: crypto.randomUUID(),
    clinic_id: ctx.clinicId,
    financial_transaction_id: tx.id,
    payment_installment_id: inst.id,
    amount_cents: amount,
    paid_at: parsed.data.paid_at.includes("T")
      ? parsed.data.paid_at
      : `${parsed.data.paid_at}T12:00:00.000Z`,
    payment_method: parsed.data.payment_method,
    notes: parsed.data.notes ?? null,
    created_by: ctx.userId,
    created_at: now,
    client_request_id: parsed.data.client_request_id ?? null,
    reversed_at: null,
    reversed_by: null,
    reversal_reason: null,
  };
  store.payments.unshift(payment);
  recalculateTransactionStatus(tx.id);
  writeFinanceAudit(
    ctx.clinicId,
    ctx.userId,
    "payment.created",
    "payment",
    payment.id,
    { amount_cents: amount, installment_id: inst.id },
  );
  return {
    payment,
    transaction: enrichTransaction(tx),
    idempotent: false,
  };
}

export function reversePayment(ctx: AuthzContext, raw: Record<string, unknown>) {
  assertPermission(ctx, "finance.payment_reverse");
  const parsed = paymentReversalSchema.safeParse(raw);
  if (!parsed.success) throw new Error("Dados inválidos");
  const payment = getFinanceStore().payments.find(
    (p) => p.id === parsed.data.payment_id,
  );
  if (!payment || payment.clinic_id !== ctx.clinicId) {
    throw new Error("FINANCE_NOT_FOUND");
  }
  if (payment.reversed_at) throw new Error("Pagamento já estornado");
  payment.reversed_at = new Date().toISOString();
  payment.reversed_by = ctx.userId;
  payment.reversal_reason = parsed.data.reversal_reason;
  recalculateTransactionStatus(payment.financial_transaction_id);
  writeFinanceAudit(
    ctx.clinicId,
    ctx.userId,
    "payment.reversed",
    "payment",
    payment.id,
    {
      amount_cents: payment.amount_cents,
      reason: parsed.data.reversal_reason,
    },
  );
  return {
    payment,
    transaction: getFinancialTransaction(ctx, payment.financial_transaction_id),
  };
}

export function getPatientFinancialSummary(
  ctx: AuthzContext,
  patientId: string,
): PatientFinancialSummary {
  requireFinanceView(ctx);
  const patient = getPatientRecord(patientId);
  if (!patient || patient.clinic_id !== ctx.clinicId) {
    throw new Error("PATIENT_NOT_FOUND");
  }
  const txs = getFinanceStore().transactions.filter(
    (t) =>
      t.clinic_id === ctx.clinicId &&
      t.patient_id === patientId &&
      t.type === "income" &&
      !t.cancelled_at,
  );
  let contracted = 0;
  let received = 0;
  let receivable = 0;
  let overdue = 0;
  for (const tx of txs) {
    const enriched = enrichTransaction(tx);
    contracted += enriched.net_amount_cents;
    received += enriched.paid_cents;
    receivable += enriched.balance_cents;
    for (const inst of enriched.installments) {
      if (inst.status === "overdue") overdue += inst.balance_cents;
    }
  }
  return {
    contracted_cents: contracted,
    received_cents: received,
    receivable_cents: receivable,
    overdue_cents: overdue,
  };
}

export function getPatientFinancialHistory(ctx: AuthzContext, patientId: string) {
  requireFinanceView(ctx);
  return listFinancialTransactions(ctx, {
    period: "year",
    patient_id: patientId,
    type: "income",
  });
}

export function exportFinancialData(
  ctx: AuthzContext,
  format: "csv" | "xlsx" | "pdf",
  rawFilter: Record<string, unknown> = {},
) {
  assertPermission(ctx, "finance.export");
  const items = listFinancialTransactions(ctx, {
    ...rawFilter,
    // export usa visão administrativa
  });
  // force admin path
  if (!can(ctx, "finance.view_administrative").allowed) {
    throw new Error("AUTHORIZATION_DENIED");
  }
  const clinic = getClinic(ctx.clinicId);
  writeFinanceAudit(
    ctx.clinicId,
    ctx.userId,
    "financial_export.generated",
    "finance_export",
    crypto.randomUUID(),
    { format, count: items.length },
  );
  return {
    clinicName: clinic?.name ?? "Clínica",
    generatedAt: new Date().toISOString(),
    format,
    items,
    totals: {
      income_net_cents: sumCents(
        items.filter((i) => i.type === "income").map((i) => i.net_amount_cents),
      ),
      received_cents: sumCents(
        items.filter((i) => i.type === "income").map((i) => i.paid_cents),
      ),
      expense_cents: sumCents(
        items.filter((i) => i.type === "expense").map((i) => i.paid_cents),
      ),
    },
  };
}

export function getHomeFinanceKpis(ctx: AuthzContext) {
  if (!can(ctx, "finance.view_administrative").allowed) {
    return null;
  }
  const dash = getFinancialDashboard(ctx, { period: "month" });
  return {
    received_cents: dash.received_cents,
    receivable_cents: dash.receivable_cents,
    overdue_cents: dash.overdue_cents,
  };
}

export function getInstallment(ctx: AuthzContext, id: string) {
  requireFinanceView(ctx);
  const inst = getFinanceStore().installments.find((i) => i.id === id);
  if (!inst || inst.clinic_id !== ctx.clinicId) throw new Error("FINANCE_NOT_FOUND");
  return enrichInstallment(inst);
}

export type { FinancialStatus };
