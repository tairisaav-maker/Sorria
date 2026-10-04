import { can, type AuthzContext } from "@/lib/authz/can";
import { assertPermission } from "@/lib/authz/guards";
import { getClinicalStore } from "@/lib/demo/clinical-store";
import { getPatientRecord } from "@/lib/demo/patients-store";
import {
  getTreatmentsStore,
  snapshotPlan,
  writeTreatmentAudit,
} from "@/lib/demo/treatments-store";
import { calculatePlanTotals, lineTotalCents, reaisToCents } from "@/lib/treatments/money";
import {
  assertItemTransition,
  assertPlanTransition,
} from "@/lib/treatments/state-machine";
import {
  createTreatmentPlanSchema,
  rejectTreatmentPlanSchema,
  treatmentItemSchema,
  updateTreatmentPlanSchema,
} from "@/lib/validations/treatment";
import type {
  TreatmentItem,
  TreatmentPlan,
  TreatmentPlanStatus,
  TreatmentPlanWithItems,
} from "@/types/treatment";
import { ACTIVE_PLAN_STATUSES } from "@/types/treatment";

function assertPatient(ctx: AuthzContext, patientId: string) {
  const patient = getPatientRecord(patientId);
  if (!patient || patient.clinic_id !== ctx.clinicId) {
    throw new Error("PATIENT_NOT_FOUND");
  }
  return patient;
}

function requireView(ctx: AuthzContext) {
  if (
    !can(ctx, "treatments.view").allowed &&
    !can(ctx, "treatments.administrative_view").allowed
  ) {
    throw new Error("AUTHORIZATION_DENIED");
  }
}

function findPlan(ctx: AuthzContext, id: string) {
  const plan = getTreatmentsStore().plans.find((p) => p.id === id);
  if (!plan || plan.clinic_id !== ctx.clinicId) {
    throw new Error("TREATMENT_PLAN_NOT_FOUND");
  }
  return plan;
}

function assertOptimistic(plan: TreatmentPlan, expected?: string) {
  if (expected && plan.updated_at !== expected) {
    throw new Error("CONCURRENCY_CONFLICT");
  }
}

function isExpired(plan: TreatmentPlan) {
  if (!plan.valid_until) return false;
  const end = new Date(`${plan.valid_until}T23:59:59`);
  return end.getTime() < Date.now();
}

function planItems(planId: string) {
  return getTreatmentsStore()
    .items
    .filter((i) => i.treatment_plan_id === planId)
    .sort((a, b) => a.sort_order - b.sort_order);
}

function progressOf(items: TreatmentItem[]) {
  const relevant = items.filter((i) => i.status !== "cancelled");
  const completed = relevant.filter((i) => i.status === "completed").length;
  const total = relevant.length;
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
  return { completed, total, percent };
}

function recalculate(plan: TreatmentPlan) {
  const items = planItems(plan.id);
  const totals = calculatePlanTotals({
    items,
    discount_type: plan.discount_type,
    discount_percent: plan.discount_percent,
    discount_value_cents: plan.discount_value_cents,
  });
  plan.subtotal_cents = totals.subtotal_cents;
  plan.total_cents = totals.total_cents;
  plan.updated_at = new Date().toISOString();
  for (const item of items) {
    item.total_price_cents = lineTotalCents(item.quantity, item.unit_price_cents);
  }
}

function withItems(plan: TreatmentPlan): TreatmentPlanWithItems {
  const items = planItems(plan.id);
  return {
    ...plan,
    items,
    progress: progressOf(items),
    is_expired: isExpired(plan),
  };
}

function applyDiscountFields(
  plan: TreatmentPlan,
  data: {
    discount_type?: "percent" | "fixed" | null;
    discount_percent?: number | null;
    discount_value_reais?: number | null;
  },
) {
  if (data.discount_type === undefined) return;
  plan.discount_type = data.discount_type;
  if (data.discount_type === "percent") {
    plan.discount_percent = data.discount_percent ?? 0;
    plan.discount_value_cents = null;
  } else if (data.discount_type === "fixed") {
    plan.discount_value_cents = reaisToCents(data.discount_value_reais ?? 0);
    plan.discount_percent = null;
  } else {
    plan.discount_percent = null;
    plan.discount_value_cents = null;
  }
}

/** Alteração material após apresentação exige revisão. */
function ensureEditableOrRevise(ctx: AuthzContext, plan: TreatmentPlan) {
  if (plan.status === "draft") return "draft" as const;
  if (plan.status === "rejected" || plan.status === "completed") {
    throw new Error("Plano não pode ser editado neste status");
  }
  // presented / accepted / in_progress → criar revisão
  return createTreatmentPlanRevision(ctx, plan.id, "Alteração material do plano");
}

export function calculateTreatmentPlanTotals(planId: string) {
  const plan = getTreatmentsStore().plans.find((p) => p.id === planId);
  if (!plan) throw new Error("TREATMENT_PLAN_NOT_FOUND");
  return calculatePlanTotals({
    items: planItems(planId),
    discount_type: plan.discount_type,
    discount_percent: plan.discount_percent,
    discount_value_cents: plan.discount_value_cents,
  });
}

export function listTreatmentPlans(
  ctx: AuthzContext,
  patientId: string,
  filter: "all" | "active" | "completed" | "rejected" = "all",
) {
  requireView(ctx);
  assertPatient(ctx, patientId);
  return getTreatmentsStore()
    .plans
    .filter((p) => {
      if (p.clinic_id !== ctx.clinicId || p.patient_id !== patientId) return false;
      if (filter === "active") return ACTIVE_PLAN_STATUSES.includes(p.status);
      if (filter === "completed") return p.status === "completed";
      if (filter === "rejected") return p.status === "rejected";
      return true;
    })
    .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
    .map(withItems);
}

export function getTreatmentPlan(ctx: AuthzContext, id: string) {
  requireView(ctx);
  return withItems(findPlan(ctx, id));
}

export function createTreatmentPlan(
  ctx: AuthzContext,
  raw: Record<string, unknown>,
) {
  assertPermission(ctx, "treatments.create");
  const parsed = createTreatmentPlanSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Dados inválidos");
  }
  assertPatient(ctx, parsed.data.patient_id);
  const now = new Date().toISOString();
  const plan: TreatmentPlan = {
    id: crypto.randomUUID(),
    clinic_id: ctx.clinicId,
    patient_id: parsed.data.patient_id,
    title: parsed.data.title,
    description: parsed.data.description || null,
    notes: parsed.data.notes || null,
    status: "draft",
    version_number: 1,
    subtotal_cents: 0,
    discount_type: parsed.data.discount_type ?? null,
    discount_value_cents:
      parsed.data.discount_type === "fixed"
        ? reaisToCents(parsed.data.discount_value_reais ?? 0)
        : null,
    discount_percent:
      parsed.data.discount_type === "percent"
        ? parsed.data.discount_percent ?? 0
        : null,
    total_cents: 0,
    valid_until: parsed.data.valid_until || null,
    created_by: ctx.userId,
    presented_by: null,
    presented_at: null,
    accepted_at: null,
    accepted_version: null,
    rejected_at: null,
    rejection_reason: null,
    created_at: now,
    updated_at: now,
    archived_at: null,
  };
  getTreatmentsStore().plans.unshift(plan);
  writeTreatmentAudit(ctx.clinicId, ctx.userId, "treatment_plan.created", "treatment_plan", plan.id);
  return withItems(plan);
}

export function updateTreatmentPlanDraft(
  ctx: AuthzContext,
  raw: Record<string, unknown>,
) {
  assertPermission(ctx, "treatments.update");
  const parsed = updateTreatmentPlanSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Dados inválidos");
  }
  const plan = findPlan(ctx, parsed.data.id);
  assertOptimistic(plan, parsed.data.expected_updated_at);

  if (plan.status !== "draft") {
    ensureEditableOrRevise(ctx, plan);
    // após revisão o plano volta a draft com novo id? createTreatmentPlanRevision mutates in place
  }

  const current = findPlan(ctx, parsed.data.id);
  if (current.status !== "draft") {
    throw new Error("Edite a nova revisão do plano (status rascunho)");
  }

  current.title = parsed.data.title;
  current.description = parsed.data.description || null;
  current.notes = parsed.data.notes || null;
  current.valid_until = parsed.data.valid_until || null;
  applyDiscountFields(current, parsed.data);
  recalculate(current);
  writeTreatmentAudit(ctx.clinicId, ctx.userId, "treatment_plan.updated", "treatment_plan", current.id);
  return withItems(current);
}

export function addTreatmentItem(
  ctx: AuthzContext,
  raw: Record<string, unknown>,
) {
  assertPermission(ctx, "treatments.update");
  const parsed = treatmentItemSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Dados inválidos");
  }
  let plan = findPlan(ctx, parsed.data.treatment_plan_id);
  assertOptimistic(plan, parsed.data.expected_updated_at);

  if (plan.status !== "draft") {
    ensureEditableOrRevise(ctx, plan);
    plan = findPlan(ctx, plan.id);
    if (plan.status !== "draft") {
      throw new Error("Plano precisa estar em rascunho para adicionar itens");
    }
  }

  assertPatient(ctx, plan.patient_id);

  if (parsed.data.source_odontogram_entry_id) {
    const entry = getClinicalStore().odontogram.find(
      (e) => e.id === parsed.data.source_odontogram_entry_id,
    );
    if (
      !entry ||
      entry.clinic_id !== ctx.clinicId ||
      entry.patient_id !== plan.patient_id
    ) {
      throw new Error("SOURCE_TENANT_MISMATCH");
    }
  }
  if (parsed.data.source_clinical_entry_id) {
    const entry = getClinicalStore().entries.find(
      (e) => e.id === parsed.data.source_clinical_entry_id,
    );
    if (
      !entry ||
      entry.clinic_id !== ctx.clinicId ||
      entry.patient_id !== plan.patient_id
    ) {
      throw new Error("SOURCE_TENANT_MISMATCH");
    }
  }

  const items = planItems(plan.id);
  const unit = reaisToCents(parsed.data.unit_price_reais);
  const now = new Date().toISOString();
  const item: TreatmentItem = {
    id: crypto.randomUUID(),
    clinic_id: ctx.clinicId,
    treatment_plan_id: plan.id,
    patient_id: plan.patient_id,
    procedure_name: parsed.data.procedure_name,
    description: parsed.data.description || null,
    tooth_numbers: parsed.data.tooth_numbers,
    quantity: parsed.data.quantity,
    unit_price_cents: unit,
    total_price_cents: lineTotalCents(parsed.data.quantity, unit),
    status: "planned",
    sort_order: items.length,
    source_odontogram_entry_id: parsed.data.source_odontogram_entry_id || null,
    source_clinical_entry_id: parsed.data.source_clinical_entry_id || null,
    created_by: ctx.userId,
    created_at: now,
    updated_at: now,
  };
  getTreatmentsStore().items.push(item);
  recalculate(plan);
  writeTreatmentAudit(ctx.clinicId, ctx.userId, "treatment_item.created", "treatment_item", item.id);
  return withItems(plan);
}

export function updateTreatmentItem(
  ctx: AuthzContext,
  itemId: string,
  raw: Record<string, unknown>,
) {
  assertPermission(ctx, "treatments.update");
  const store = getTreatmentsStore();
  const index = store.items.findIndex((i) => i.id === itemId);
  if (index < 0 || store.items[index]!.clinic_id !== ctx.clinicId) {
    throw new Error("TREATMENT_ITEM_NOT_FOUND");
  }
  const item = store.items[index]!;
  let plan = findPlan(ctx, item.treatment_plan_id);
  if (plan.status !== "draft") {
    ensureEditableOrRevise(ctx, plan);
    plan = findPlan(ctx, plan.id);
  }
  if (plan.status !== "draft") {
    throw new Error("Somente rascunho permite editar itens");
  }

  if (typeof raw.procedure_name === "string") item.procedure_name = raw.procedure_name;
  if (typeof raw.description === "string" || raw.description === null) {
    item.description = (raw.description as string | null) || null;
  }
  if (Array.isArray(raw.tooth_numbers)) item.tooth_numbers = raw.tooth_numbers as number[];
  if (typeof raw.quantity === "number") item.quantity = raw.quantity;
  if (typeof raw.unit_price_reais === "number") {
    item.unit_price_cents = reaisToCents(raw.unit_price_reais);
  }
  item.total_price_cents = lineTotalCents(item.quantity, item.unit_price_cents);
  item.updated_at = new Date().toISOString();
  recalculate(plan);
  writeTreatmentAudit(ctx.clinicId, ctx.userId, "treatment_item.updated", "treatment_item", item.id);
  return withItems(plan);
}

export function removeTreatmentItem(ctx: AuthzContext, itemId: string) {
  assertPermission(ctx, "treatments.update");
  const store = getTreatmentsStore();
  const index = store.items.findIndex((i) => i.id === itemId);
  if (index < 0 || store.items[index]!.clinic_id !== ctx.clinicId) {
    throw new Error("TREATMENT_ITEM_NOT_FOUND");
  }
  const item = store.items[index]!;
  let plan = findPlan(ctx, item.treatment_plan_id);
  if (plan.status !== "draft") {
    ensureEditableOrRevise(ctx, plan);
    plan = findPlan(ctx, plan.id);
  }
  if (plan.status !== "draft") {
    throw new Error("Somente rascunho permite remover itens");
  }
  store.items.splice(index, 1);
  recalculate(plan);
  writeTreatmentAudit(ctx.clinicId, ctx.userId, "treatment_item.updated", "treatment_item", itemId, {
    removed: true,
  });
  return withItems(plan);
}

export function reorderTreatmentItems(
  ctx: AuthzContext,
  planId: string,
  orderedIds: string[],
) {
  assertPermission(ctx, "treatments.update");
  const plan = findPlan(ctx, planId);
  if (plan.status !== "draft") {
    throw new Error("Somente rascunho permite reordenar");
  }
  const items = planItems(planId);
  orderedIds.forEach((id, idx) => {
    const item = items.find((i) => i.id === id);
    if (item) item.sort_order = idx;
  });
  plan.updated_at = new Date().toISOString();
  return withItems(plan);
}

export function presentTreatmentPlan(ctx: AuthzContext, id: string) {
  assertPermission(ctx, "treatments.present");
  const plan = findPlan(ctx, id);
  assertPlanTransition(plan.status, "presented");
  const items = planItems(plan.id);
  if (items.length === 0) {
    throw new Error("Adicione ao menos um procedimento antes de apresentar");
  }
  recalculate(plan);
  const now = new Date().toISOString();
  plan.status = "presented";
  plan.presented_by = ctx.userId;
  plan.presented_at = now;
  plan.updated_at = now;

  getTreatmentsStore().versions.unshift({
    id: crypto.randomUUID(),
    treatment_plan_id: plan.id,
    clinic_id: ctx.clinicId,
    version_number: plan.version_number,
    snapshot_json: snapshotPlan(plan, items),
    presented_by: ctx.userId,
    presented_at: now,
    change_reason: null,
    created_at: now,
  });

  writeTreatmentAudit(ctx.clinicId, ctx.userId, "treatment_plan.presented", "treatment_plan", plan.id, {
    version: plan.version_number,
    total_cents: plan.total_cents,
  });
  return withItems(plan);
}

export function acceptTreatmentPlan(ctx: AuthzContext, id: string) {
  assertPermission(ctx, "treatments.acceptance_manage");
  const plan = findPlan(ctx, id);
  assertPlanTransition(plan.status, "accepted");
  if (isExpired(plan)) {
    throw new Error("PLAN_EXPIRED");
  }
  const now = new Date().toISOString();
  plan.status = "accepted";
  plan.accepted_at = now;
  plan.accepted_version = plan.version_number;
  plan.updated_at = now;
  for (const item of planItems(plan.id)) {
    if (item.status === "planned") item.status = "accepted";
  }
  writeTreatmentAudit(ctx.clinicId, ctx.userId, "treatment_plan.accepted", "treatment_plan", plan.id, {
    version: plan.accepted_version,
    total_cents: plan.total_cents,
  });
  return withItems(plan);
}

export function rejectTreatmentPlan(
  ctx: AuthzContext,
  raw: { id: string; rejection_reason?: string },
) {
  assertPermission(ctx, "treatments.acceptance_manage");
  const parsed = rejectTreatmentPlanSchema.safeParse(raw);
  if (!parsed.success) throw new Error("Dados inválidos");
  const plan = findPlan(ctx, parsed.data.id);
  assertPlanTransition(plan.status, "rejected");
  const now = new Date().toISOString();
  plan.status = "rejected";
  plan.rejected_at = now;
  plan.rejection_reason = parsed.data.rejection_reason || null;
  plan.updated_at = now;
  writeTreatmentAudit(ctx.clinicId, ctx.userId, "treatment_plan.rejected", "treatment_plan", plan.id);
  return withItems(plan);
}

export function startTreatmentItem(ctx: AuthzContext, itemId: string) {
  assertPermission(ctx, "treatments.progress_update");
  const store = getTreatmentsStore();
  const item = store.items.find((i) => i.id === itemId);
  if (!item || item.clinic_id !== ctx.clinicId) {
    throw new Error("TREATMENT_ITEM_NOT_FOUND");
  }
  const plan = findPlan(ctx, item.treatment_plan_id);
  if (plan.status !== "accepted" && plan.status !== "in_progress") {
    throw new Error("Plano precisa estar aceito para iniciar itens");
  }
  assertItemTransition(item.status, "in_progress");
  item.status = "in_progress";
  item.updated_at = new Date().toISOString();
  if (plan.status === "accepted") {
    assertPlanTransition(plan.status, "in_progress");
    plan.status = "in_progress";
  }
  plan.updated_at = new Date().toISOString();
  writeTreatmentAudit(ctx.clinicId, ctx.userId, "treatment_item.started", "treatment_item", item.id);
  return withItems(plan);
}

export function completeTreatmentItem(ctx: AuthzContext, itemId: string) {
  assertPermission(ctx, "treatments.progress_update");
  const item = getTreatmentsStore().items.find((i) => i.id === itemId);
  if (!item || item.clinic_id !== ctx.clinicId) {
    throw new Error("TREATMENT_ITEM_NOT_FOUND");
  }
  const plan = findPlan(ctx, item.treatment_plan_id);
  if (item.status === "accepted" || item.status === "planned") {
    assertItemTransition(item.status, "in_progress");
    item.status = "in_progress";
  }
  assertItemTransition(item.status, "completed");
  item.status = "completed";
  item.updated_at = new Date().toISOString();
  if (plan.status === "accepted") plan.status = "in_progress";
  plan.updated_at = new Date().toISOString();
  writeTreatmentAudit(ctx.clinicId, ctx.userId, "treatment_item.completed", "treatment_item", item.id);
  return withItems(plan);
}

export function cancelTreatmentItem(ctx: AuthzContext, itemId: string) {
  assertPermission(ctx, "treatments.progress_update");
  const item = getTreatmentsStore().items.find((i) => i.id === itemId);
  if (!item || item.clinic_id !== ctx.clinicId) {
    throw new Error("TREATMENT_ITEM_NOT_FOUND");
  }
  assertItemTransition(item.status, "cancelled");
  item.status = "cancelled";
  item.updated_at = new Date().toISOString();
  const plan = findPlan(ctx, item.treatment_plan_id);
  plan.updated_at = new Date().toISOString();
  writeTreatmentAudit(ctx.clinicId, ctx.userId, "treatment_item.cancelled", "treatment_item", item.id);
  return withItems(plan);
}

export function completeTreatmentPlan(ctx: AuthzContext, id: string) {
  assertPermission(ctx, "treatments.progress_update");
  const plan = findPlan(ctx, id);
  assertPlanTransition(plan.status, "completed");
  const items = planItems(plan.id);
  const pending = items.filter(
    (i) => i.status !== "completed" && i.status !== "cancelled",
  );
  if (pending.length > 0) {
    throw new Error("Ainda há procedimentos pendentes");
  }
  plan.status = "completed";
  plan.updated_at = new Date().toISOString();
  writeTreatmentAudit(ctx.clinicId, ctx.userId, "treatment_plan.completed", "treatment_plan", plan.id);
  return withItems(plan);
}

export function createTreatmentPlanRevision(
  ctx: AuthzContext,
  planId: string,
  reason: string,
) {
  assertPermission(ctx, "treatments.update");
  const plan = findPlan(ctx, planId);
  if (plan.status === "draft") return plan.status;

  // Preserva versão apresentada; incrementa e volta a draft
  plan.version_number += 1;
  plan.status = "draft";
  plan.presented_at = null;
  plan.presented_by = null;
  plan.accepted_at = null;
  plan.accepted_version = null;
  plan.rejected_at = null;
  plan.rejection_reason = null;
  plan.updated_at = new Date().toISOString();

  // Nova revisão exige novo aceite; itens já concluídos permanecem
  for (const item of planItems(plan.id)) {
    if (item.status !== "cancelled" && item.status !== "completed") {
      item.status = "planned";
    }
  }

  writeTreatmentAudit(ctx.clinicId, ctx.userId, "treatment_plan.revised", "treatment_plan", plan.id, {
    version: plan.version_number,
    reason,
  });
  return "revised" as const;
}

export function duplicateTreatmentPlan(ctx: AuthzContext, planId: string) {
  assertPermission(ctx, "treatments.create");
  const source = withItems(findPlan(ctx, planId));
  const created = createTreatmentPlan(ctx, {
    patient_id: source.patient_id,
    title: `${source.title} (cópia)`,
    description: source.description,
    notes: source.notes,
    valid_until: source.valid_until,
    discount_type: source.discount_type,
    discount_percent: source.discount_percent,
    discount_value_reais:
      source.discount_value_cents != null
        ? source.discount_value_cents / 100
        : null,
  });
  for (const item of source.items) {
    addTreatmentItem(ctx, {
      treatment_plan_id: created.id,
      procedure_name: item.procedure_name,
      description: item.description,
      tooth_numbers: item.tooth_numbers,
      quantity: item.quantity,
      unit_price_reais: item.unit_price_cents / 100,
    });
  }
  return getTreatmentPlan(ctx, created.id);
}

export function countPlansByStatus(ctx: AuthzContext, status: TreatmentPlanStatus) {
  requireView(ctx);
  return getTreatmentsStore().plans.filter(
    (p) => p.clinic_id === ctx.clinicId && p.status === status,
  ).length;
}

export function getPatientCurrentPlan(ctx: AuthzContext, patientId: string) {
  requireView(ctx);
  assertPatient(ctx, patientId);
  const plans = listTreatmentPlans(ctx, patientId, "active");
  return (
    plans.find((p) => p.status === "in_progress") ||
    plans.find((p) => p.status === "accepted") ||
    plans.find((p) => p.status === "presented") ||
    plans[0] ||
    null
  );
}
