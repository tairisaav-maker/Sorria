import { can, type AuthzContext } from "@/lib/authz/can";
import { assertPermission } from "@/lib/authz/guards";
import { getClinicalStore } from "@/lib/demo/clinical-store";
import { getFinanceStore } from "@/lib/demo/finance-store";
import {
  getPerformedStore,
  writePerformedAudit,
} from "@/lib/demo/performed-procedures-store";
import {
  getProcedureFinanceStore,
  writeProcedureFinanceAudit,
} from "@/lib/demo/procedure-finance-store";
import { getTreatmentsStore } from "@/lib/demo/treatments-store";
import {
  allocatePaymentAcrossProcedureAmounts,
  calculateDiscount,
} from "@/lib/finance/allocation";
import { reaisToCents } from "@/lib/money";
import {
  allocateTransactionSchema,
  createChargeFromProcedureSchema,
  linkClinicalEntrySchema,
  linkToTransactionSchema,
  linkTreatmentItemSchema,
  markNoChargeSchema,
  setChargedAmountSchema,
} from "@/lib/validations/patient-procedure-finance";
import { createClinicalEntry } from "@/services/clinical/entries";
import { canViewProcedureCosts } from "@/services/performed-procedures/costs";
import { createIncomeTransaction, getFinancialTransaction } from "@/services/finance";
import { completeTreatmentItem } from "@/services/treatments";
import type {
  AppointmentCompletionSummary,
  PerformedFinancialStatus,
  PerformedProcedureFinancialLink,
  ProcedureFinanceBreakdown,
} from "@/types/patient-procedure-finance";

function now() {
  return new Date().toISOString();
}

function canViewFinance(ctx: AuthzContext) {
  return (
    can(ctx, "finance.view_authorized").allowed ||
    can(ctx, "finance.view_administrative").allowed
  );
}

function findPerformed(ctx: AuthzContext, id: string) {
  const row = getPerformedStore().performedProcedures.find((p) => p.id === id);
  if (!row || row.clinic_id !== ctx.clinicId) {
    throw new Error("PERFORMED_PROCEDURE_NOT_FOUND");
  }
  return row;
}

function activeLinksForProcedure(clinicId: string, procedureId: string) {
  return getProcedureFinanceStore().links.filter(
    (l) =>
      l.clinic_id === clinicId &&
      l.performed_procedure_id === procedureId &&
      !l.cancelled_at,
  );
}

function activeLinksForTransaction(clinicId: string, txId: string) {
  return getProcedureFinanceStore().links.filter(
    (l) =>
      l.clinic_id === clinicId &&
      l.financial_transaction_id === txId &&
      !l.cancelled_at,
  );
}

function paidCentsForTransaction(txId: string): number {
  const store = getFinanceStore();
  const tx = store.transactions.find((t) => t.id === txId);
  if (!tx || tx.cancelled_at) return 0;
  return store.payments
    .filter(
      (p) =>
        p.financial_transaction_id === txId &&
        !p.reversed_at &&
        p.clinic_id === tx.clinic_id,
    )
    .reduce((s, p) => s + p.amount_cents, 0);
}

export function setPerformedProcedureChargedAmount(
  ctx: AuthzContext,
  input: unknown,
) {
  assertPermission(ctx, "performed_procedures.update");
  const data = setChargedAmountSchema.parse(input);
  const row = findPerformed(ctx, data.id);
  row.charged_amount_cents = reaisToCents(data.charged_amount_reais);
  if (data.charge_note !== undefined) row.charge_note = data.charge_note;
  if (data.financial_status) {
    row.financial_status = data.financial_status;
  } else if (row.charged_amount_cents === 0) {
    row.financial_status = "no_charge";
  } else if (row.financial_status === "no_charge") {
    row.financial_status = "pending_charge";
  }
  row.updated_at = now();

  const discount = calculateDiscount(
    row.standard_price_snapshot_cents,
    row.charged_amount_cents,
  );

  writePerformedAudit({
    clinic_id: ctx.clinicId,
    actor_user_id: ctx.userId,
    action: "performed_procedure.charged_amount_set",
    target_type: "performed_procedure",
    target_id: row.id,
    metadata: {
      charged_amount_cents: row.charged_amount_cents,
      ...discount,
    },
  });
  return getProcedureFinanceBreakdown(ctx, row.id);
}

export function markPerformedProcedureNoCharge(ctx: AuthzContext, input: unknown) {
  assertPermission(ctx, "performed_procedures.update");
  const data = markNoChargeSchema.parse(input);
  const row = findPerformed(ctx, data.id);
  if (activeLinksForProcedure(ctx.clinicId, row.id).length > 0) {
    throw new Error("HAS_ACTIVE_FINANCIAL_LINKS");
  }
  row.charged_amount_cents = 0;
  row.financial_status = "no_charge";
  row.charge_note = data.reason;
  row.charged_zero_reason = data.reason;
  row.updated_at = now();
  writePerformedAudit({
    clinic_id: ctx.clinicId,
    actor_user_id: ctx.userId,
    action: "performed_procedure.charged_amount_set",
    target_type: "performed_procedure",
    target_id: row.id,
    metadata: { financial_status: "no_charge", reason: data.reason },
  });
  return getProcedureFinanceBreakdown(ctx, row.id);
}

export function linkPerformedProcedureToTreatmentItem(
  ctx: AuthzContext,
  input: unknown,
) {
  assertPermission(ctx, "performed_procedures.update");
  const data = linkTreatmentItemSchema.parse(input);
  const row = findPerformed(ctx, data.performed_procedure_id);
  const item = getTreatmentsStore().items.find(
    (i) => i.id === data.treatment_item_id,
  );
  const plan = item
    ? getTreatmentsStore().plans.find((p) => p.id === item.treatment_plan_id)
    : null;
  if (
    !item ||
    !plan ||
    plan.clinic_id !== ctx.clinicId ||
    plan.patient_id !== row.patient_id
  ) {
    throw new Error("TREATMENT_ITEM_NOT_FOUND");
  }
  row.treatment_item_id = item.id;
  const planBilled = getFinanceStore().transactions.some(
    (t) =>
      t.clinic_id === ctx.clinicId &&
      t.treatment_plan_id === plan.id &&
      !t.cancelled_at,
  );
  if (planBilled) {
    row.financial_status = "included_in_plan";
  }
  row.updated_at = now();
  return row;
}

function assertCanCharge(ctx: AuthzContext, procedureId: string) {
  const row = findPerformed(ctx, procedureId);
  if (row.financial_status === "no_charge") {
    throw new Error("PROCEDURE_MARKED_NO_CHARGE");
  }
  if (row.financial_status === "included_in_plan") {
    throw new Error("INCLUDED_IN_PLAN");
  }
  if (activeLinksForProcedure(ctx.clinicId, procedureId).length > 0) {
    throw new Error("ALREADY_LINKED_TO_FINANCE");
  }
  if (row.treatment_item_id) {
    const item = getTreatmentsStore().items.find(
      (i) => i.id === row.treatment_item_id,
    );
    const plan = item
      ? getTreatmentsStore().plans.find((p) => p.id === item.treatment_plan_id)
      : null;
    if (plan) {
      const planBilled = getFinanceStore().transactions.some(
        (t) =>
          t.clinic_id === ctx.clinicId &&
          t.treatment_plan_id === plan.id &&
          !t.cancelled_at,
      );
      if (planBilled) {
        row.financial_status = "included_in_plan";
        throw new Error("INCLUDED_IN_PLAN");
      }
    }
  }
  return row;
}

export function createFinancialChargeFromPerformedProcedure(
  ctx: AuthzContext,
  input: unknown,
) {
  assertPermission(ctx, "finance.transaction_create");
  assertPermission(ctx, "performed_procedures.update");
  const data = createChargeFromProcedureSchema.parse(input);
  const row = assertCanCharge(ctx, data.performed_procedure_id);

  const amountReais =
    data.charged_amount_reais ??
    (row.charged_amount_cents != null ? row.charged_amount_cents / 100 : null);
  if (amountReais == null || amountReais < 0) {
    throw new Error("CHARGED_AMOUNT_REQUIRED");
  }
  if (amountReais === 0) {
    throw new Error("USE_NO_CHARGE_FOR_ZERO");
  }

  row.charged_amount_cents = reaisToCents(amountReais);

  const tx = createIncomeTransaction(ctx, {
    type: "income",
    description: `${row.procedure_name_snapshot}${
      row.tooth_number ? ` — Dente ${row.tooth_number}` : ""
    }`,
    patient_id: row.patient_id,
    appointment_id: row.appointment_id,
    gross_amount_reais: amountReais,
    discount_amount_reais: 0,
    due_date: data.due_date ?? new Date().toISOString().slice(0, 10),
    installments_count: 1,
    notes: data.notes ?? null,
  });

  const link = linkPerformedProcedureToFinancialTransaction(ctx, {
    performed_procedure_id: row.id,
    financial_transaction_id: tx.id,
    amount_allocated_reais: amountReais,
  });

  return { transaction: tx, link, breakdown: getProcedureFinanceBreakdown(ctx, row.id) };
}

export function linkPerformedProcedureToFinancialTransaction(
  ctx: AuthzContext,
  input: unknown,
) {
  assertPermission(ctx, "performed_procedures.update");
  const data = linkToTransactionSchema.parse(input);
  const row = findPerformed(ctx, data.performed_procedure_id);
  const tx = getFinanceStore().transactions.find(
    (t) => t.id === data.financial_transaction_id,
  );
  if (!tx || tx.clinic_id !== ctx.clinicId || tx.cancelled_at) {
    throw new Error("FINANCE_NOT_FOUND");
  }
  if (tx.patient_id && tx.patient_id !== row.patient_id) {
    throw new Error("CROSS_PATIENT_REFERENCE");
  }

  const amount = reaisToCents(data.amount_allocated_reais);
  const existingLinks = activeLinksForTransaction(ctx.clinicId, tx.id);
  const alreadyAllocated = existingLinks
    .filter((l) => l.performed_procedure_id !== row.id)
    .reduce((s, l) => s + l.amount_allocated_cents, 0);
  if (alreadyAllocated + amount > tx.net_amount_cents) {
    throw new Error("ALLOCATION_EXCEEDS_TRANSACTION");
  }

  const dup = existingLinks.find((l) => l.performed_procedure_id === row.id);
  if (dup) {
    dup.amount_allocated_cents = amount;
    dup.updated_at = now();
    writeProcedureFinanceAudit({
      clinic_id: ctx.clinicId,
      actor_user_id: ctx.userId,
      action: "financial_allocation.updated",
      target_type: "performed_procedure_financial_link",
      target_id: dup.id,
      metadata: { amount_allocated_cents: amount },
    });
    row.financial_status = "charged";
    row.financial_transaction_id = row.financial_transaction_id ?? tx.id;
    row.updated_at = now();
    return dup;
  }

  const link: PerformedProcedureFinancialLink = {
    id: `ppfl-${crypto.randomUUID()}`,
    clinic_id: ctx.clinicId,
    performed_procedure_id: row.id,
    financial_transaction_id: tx.id,
    amount_allocated_cents: amount,
    created_by: ctx.userId,
    created_at: now(),
    updated_at: now(),
    cancelled_at: null,
  };
  getProcedureFinanceStore().links.push(link);
  row.financial_status = "charged";
  row.financial_transaction_id = row.financial_transaction_id ?? tx.id;
  row.updated_at = now();

  writeProcedureFinanceAudit({
    clinic_id: ctx.clinicId,
    actor_user_id: ctx.userId,
    action: "performed_procedure.financial_link_created",
    target_type: "performed_procedure_financial_link",
    target_id: link.id,
    metadata: {
      performed_procedure_id: row.id,
      financial_transaction_id: tx.id,
      amount_allocated_cents: amount,
    },
  });
  writeProcedureFinanceAudit({
    clinic_id: ctx.clinicId,
    actor_user_id: ctx.userId,
    action: "financial_allocation.created",
    target_type: "performed_procedure_financial_link",
    target_id: link.id,
  });

  return link;
}

export function allocateFinancialTransactionToProcedures(
  ctx: AuthzContext,
  input: unknown,
) {
  assertPermission(ctx, "performed_procedures.update");
  assertPermission(ctx, "finance.transaction_create");
  const data = allocateTransactionSchema.parse(input);
  const tx = getFinanceStore().transactions.find(
    (t) => t.id === data.financial_transaction_id,
  );
  if (!tx || tx.clinic_id !== ctx.clinicId || tx.cancelled_at) {
    throw new Error("FINANCE_NOT_FOUND");
  }

  const total = data.allocations.reduce(
    (s, a) => s + reaisToCents(a.amount_allocated_reais),
    0,
  );
  if (total > tx.net_amount_cents) {
    throw new Error("ALLOCATION_EXCEEDS_TRANSACTION");
  }

  const links = [];
  for (const alloc of data.allocations) {
    const row = findPerformed(ctx, alloc.performed_procedure_id);
    if (tx.patient_id && tx.patient_id !== row.patient_id) {
      throw new Error("CROSS_PATIENT_REFERENCE");
    }
    links.push(
      linkPerformedProcedureToFinancialTransaction(ctx, {
        performed_procedure_id: row.id,
        financial_transaction_id: tx.id,
        amount_allocated_reais: alloc.amount_allocated_reais,
      }),
    );
  }
  return { links, transaction: getFinancialTransaction(ctx, tx.id) };
}

export function calculateProcedureReceivedAmount(
  ctx: AuthzContext,
  performedProcedureId: string,
): number {
  const row = findPerformed(ctx, performedProcedureId);
  const links = activeLinksForProcedure(ctx.clinicId, row.id);
  if (links.length === 0) return 0;

  // Para cada tx, rateia o pago entre TODOS os links ativos da tx,
  // e soma só a parte deste procedimento.
  const byTx = new Map<string, typeof links>();
  for (const link of links) {
    const all = activeLinksForTransaction(
      ctx.clinicId,
      link.financial_transaction_id,
    );
    byTx.set(link.financial_transaction_id, all);
  }

  let received = 0;
  for (const [txId, allocs] of byTx) {
    const paid = paidCentsForTransaction(txId);
    const parts = allocatePaymentAcrossProcedureAmounts({
      paymentCents: paid,
      allocations: allocs.map((a) => ({
        id: a.performed_procedure_id,
        amount_allocated_cents: a.amount_allocated_cents,
      })),
    });
    received +=
      parts.find((p) => p.id === performedProcedureId)?.received_cents ?? 0;
  }
  return received;
}

export function calculateProcedureOutstandingBalance(
  ctx: AuthzContext,
  performedProcedureId: string,
): number {
  const row = findPerformed(ctx, performedProcedureId);
  if (
    row.financial_status === "no_charge" ||
    row.financial_status === "included_in_plan"
  ) {
    return 0;
  }
  const links = activeLinksForProcedure(ctx.clinicId, row.id);
  const allocated = links.reduce((s, l) => s + l.amount_allocated_cents, 0);
  const base =
    allocated > 0 ? allocated : (row.charged_amount_cents ?? 0);
  const received = calculateProcedureReceivedAmount(ctx, performedProcedureId);
  return Math.max(0, base - received);
}

export function getProcedureFinanceBreakdown(
  ctx: AuthzContext,
  performedProcedureId: string,
): ProcedureFinanceBreakdown {
  assertPermission(ctx, "performed_procedures.view");
  const row = findPerformed(ctx, performedProcedureId);
  const showCost = canViewProcedureCosts(ctx);
  const showFinance = canViewFinance(ctx);
  const links = activeLinksForProcedure(ctx.clinicId, row.id);
  const allocated = links.reduce((s, l) => s + l.amount_allocated_cents, 0);
  const received = showFinance
    ? calculateProcedureReceivedAmount(ctx, performedProcedureId)
    : 0;
  const outstanding = showFinance
    ? calculateProcedureOutstandingBalance(ctx, performedProcedureId)
    : 0;
  const discount = calculateDiscount(
    row.standard_price_snapshot_cents,
    row.charged_amount_cents,
  );
  const cost = showCost ? row.actual_total_cost_cents : null;
  const charged = row.charged_amount_cents;
  const grossCharged =
    showCost && charged != null && cost != null ? charged - cost : null;
  const grossReceived =
    showCost && showFinance && cost != null ? received - cost : null;
  const margin =
    showCost && charged != null && charged > 0 && grossCharged != null
      ? Math.round((grossCharged / charged) * 10000) / 100
      : null;

  const store = getFinanceStore();
  return {
    performed_procedure_id: row.id,
    standard_price_cents: row.standard_price_snapshot_cents,
    charged_amount_cents: charged,
    discount_amount_cents: discount.discount_amount_cents,
    discount_percent: discount.discount_percent,
    allocated_cents: showFinance ? allocated : 0,
    received_cents: showFinance ? received : 0,
    outstanding_cents: showFinance ? outstanding : 0,
    actual_total_cost_cents: cost,
    gross_result_charged_cents: grossCharged,
    gross_result_received_cents: showFinance ? grossReceived : null,
    gross_margin_percent: margin,
    financial_status: row.financial_status,
    links: showFinance
      ? links.map((l) => {
          const tx = store.transactions.find(
            (t) => t.id === l.financial_transaction_id,
          );
          return {
            id: l.id,
            financial_transaction_id: l.financial_transaction_id,
            amount_allocated_cents: l.amount_allocated_cents,
            transaction_description: tx?.description ?? null,
            transaction_status: tx?.status ?? null,
          };
        })
      : [],
  };
}

export function linkClinicalEntryToPerformedProcedure(
  ctx: AuthzContext,
  input: unknown,
) {
  assertPermission(ctx, "clinical_evolution.update");
  const data = linkClinicalEntrySchema.parse(input);
  const entry = getClinicalStore().entries.find(
    (e) => e.id === data.clinical_entry_id,
  );
  if (!entry || entry.clinic_id !== ctx.clinicId) {
    throw new Error("CLINICAL_ENTRY_NOT_FOUND");
  }
  const row = findPerformed(ctx, data.performed_procedure_id);
  if (entry.patient_id !== row.patient_id) {
    throw new Error("CROSS_PATIENT_REFERENCE");
  }
  entry.performed_procedure_id = row.id;
  entry.updated_at = now();
  row.clinical_entry_id = entry.id;
  row.updated_at = now();
  writeProcedureFinanceAudit({
    clinic_id: ctx.clinicId,
    actor_user_id: ctx.userId,
    action: "clinical_entry.linked_to_performed_procedure",
    target_type: "clinical_entry",
    target_id: entry.id,
    metadata: { performed_procedure_id: row.id },
  });
  return { entry, procedure: row };
}

export function createEvolutionFromPerformedProcedure(
  ctx: AuthzContext,
  performedProcedureId: string,
  extra?: Record<string, unknown>,
) {
  assertPermission(ctx, "clinical_evolution.create");
  const row = findPerformed(ctx, performedProcedureId);
  const entry = createClinicalEntry(ctx, {
    patient_id: row.patient_id,
    appointment_id: row.appointment_id,
    performed_procedure_id: row.id,
    procedure_done: `${row.procedure_name_snapshot}${
      row.tooth_number ? ` — Dente ${row.tooth_number}` : ""
    }${row.region ? ` — ${row.region}` : ""}`,
    related_teeth: row.tooth_number ? [row.tooth_number] : [],
    ...extra,
  });
  row.clinical_entry_id = entry.id;
  row.updated_at = now();
  writeProcedureFinanceAudit({
    clinic_id: ctx.clinicId,
    actor_user_id: ctx.userId,
    action: "clinical_entry.linked_to_performed_procedure",
    target_type: "clinical_entry",
    target_id: entry.id,
    metadata: { performed_procedure_id: row.id, from: "create" },
  });
  return entry;
}

/** Cancela links quando cobrança é cancelada (histórico preservado via cancelled_at). */
export function cancelLinksForTransaction(clinicId: string, txId: string) {
  const stamp = now();
  for (const link of getProcedureFinanceStore().links) {
    if (
      link.clinic_id === clinicId &&
      link.financial_transaction_id === txId &&
      !link.cancelled_at
    ) {
      link.cancelled_at = stamp;
      link.updated_at = stamp;
      const pp = getPerformedStore().performedProcedures.find(
        (p) => p.id === link.performed_procedure_id,
      );
      if (pp && pp.clinic_id === clinicId) {
        const still = activeLinksForProcedure(clinicId, pp.id);
        if (still.length === 0 && pp.financial_status === "charged") {
          pp.financial_status = "pending_charge";
          if (pp.financial_transaction_id === txId) {
            pp.financial_transaction_id = null;
          }
          pp.updated_at = stamp;
        }
      }
    }
  }
}

export function getAppointmentCompletionSummary(
  ctx: AuthzContext,
  appointmentId: string,
): AppointmentCompletionSummary {
  assertPermission(ctx, "performed_procedures.view");
  const procs = getPerformedStore().performedProcedures.filter(
    (p) =>
      p.clinic_id === ctx.clinicId &&
      p.appointment_id === appointmentId &&
      p.status !== "cancelled",
  );
  const clinical = getClinicalStore().entries;
  const showFinance = canViewFinance(ctx);
  const showCost = canViewProcedureCosts(ctx);

  const procedures = procs.map((p) => {
    const hasEvo = Boolean(
      p.clinical_entry_id ||
        clinical.some((e) => e.performed_procedure_id === p.id),
    );
    return {
      id: p.id,
      name: p.procedure_name_snapshot,
      tooth_number: p.tooth_number,
      consumption_confirmed: p.consumption_confirmed,
      has_evolution: hasEvo,
      financial_status: p.financial_status as PerformedFinancialStatus,
      charged_amount_cents: showFinance || showCost ? p.charged_amount_cents : null,
    };
  });

  const blockers: string[] = [];
  const warnings: string[] = [];
  for (const p of procedures) {
    if (!p.consumption_confirmed) warnings.push(`Consumo pendente: ${p.name}`);
    if (!p.has_evolution) warnings.push(`Evolução não registrada: ${p.name}`);
    if (p.financial_status === "pending_charge") {
      warnings.push(`Cobrança não definida: ${p.name}`);
    }
  }

  let charged = 0;
  let received = 0;
  let outstanding = 0;
  if (showFinance) {
    for (const p of procs) {
      charged += p.charged_amount_cents ?? 0;
      received += calculateProcedureReceivedAmount(ctx, p.id);
      outstanding += calculateProcedureOutstandingBalance(ctx, p.id);
    }
  }

  return {
    appointment_id: appointmentId,
    procedures,
    materials_confirmed: procedures.every((p) => p.consumption_confirmed),
    evolutions_finalized: procedures.filter((p) => p.has_evolution).length,
    charged_cents: showFinance ? charged : null,
    received_cents: showFinance ? received : null,
    outstanding_cents: showFinance ? outstanding : null,
    blockers,
    warnings,
  };
}

export function maybeCompleteLinkedTreatmentItem(
  ctx: AuthzContext,
  performedProcedureId: string,
) {
  const row = findPerformed(ctx, performedProcedureId);
  if (!row.treatment_item_id || row.status !== "completed") return null;
  if (!can(ctx, "treatments.progress_update").allowed) return null;
  try {
    return completeTreatmentItem(ctx, row.treatment_item_id);
  } catch {
    return null;
  }
}

// re-export helpers used by tests
export { allocatePaymentAcrossProcedureAmounts };
