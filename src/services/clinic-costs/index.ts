import { can, type AuthzContext } from "@/lib/authz/can";
import { assertPermission } from "@/lib/authz/guards";
import {
  getClinicCostsStore,
  writeClinicCostAudit,
} from "@/lib/demo/clinic-costs-store";
import { getFinanceStore } from "@/lib/demo/finance-store";
import { getClinic } from "@/lib/demo/authz-store";
import { reaisToCents } from "@/lib/money";
import type {
  ClinicCostSettings,
  MonthlyExpenseLine,
  MonthlyOperatingExpenses,
  RecurringExpenseTemplate,
} from "@/types/clinic-costs";
import type { ExpenseCategory } from "@/types/finance";
import { z } from "zod";

function now() {
  return new Date().toISOString();
}

function canViewCosts(ctx: AuthzContext) {
  return (
    can(ctx, "clinic_costs.view").allowed ||
    can(ctx, "operational_costs.view").allowed
  );
}

function canManageCosts(ctx: AuthzContext) {
  return can(ctx, "clinic_costs.manage").allowed;
}

export function getClinicCostSettings(
  ctx: AuthzContext,
): ClinicCostSettings | null {
  if (!canViewCosts(ctx) && !canManageCosts(ctx)) {
    assertPermission(ctx, "clinic_costs.view");
  }
  return (
    getClinicCostsStore().settings.find((s) => s.clinic_id === ctx.clinicId) ??
    null
  );
}

const settingsSchema = z.object({
  calculation_mode: z
    .enum(["manual_productive_hours", "schedule_capacity"])
    .optional(),
  monthly_productive_hours: z.number().positive().max(744).optional().nullable(),
  planned_utilization_percent: z
    .number()
    .min(1)
    .max(100)
    .optional()
    .nullable(),
  include_owner_compensation: z.boolean().optional(),
});

export function updateClinicCostSettings(
  ctx: AuthzContext,
  raw: unknown,
): ClinicCostSettings {
  assertPermission(ctx, "clinic_costs.manage");
  const data = settingsSchema.parse(raw);
  const store = getClinicCostsStore();
  let row = store.settings.find((s) => s.clinic_id === ctx.clinicId);
  if (!row) {
    row = {
      id: `ccs-${crypto.randomUUID()}`,
      clinic_id: ctx.clinicId,
      calculation_mode: "manual_productive_hours",
      monthly_productive_hours: 120,
      planned_utilization_percent: 80,
      include_owner_compensation: true,
      created_at: now(),
      updated_at: now(),
    };
    store.settings.push(row);
  }
  if (data.calculation_mode) row.calculation_mode = data.calculation_mode;
  if (data.monthly_productive_hours !== undefined) {
    row.monthly_productive_hours = data.monthly_productive_hours;
  }
  if (data.planned_utilization_percent !== undefined) {
    row.planned_utilization_percent = data.planned_utilization_percent;
  }
  if (data.include_owner_compensation !== undefined) {
    row.include_owner_compensation = data.include_owner_compensation;
  }
  row.updated_at = now();
  writeClinicCostAudit({
    clinic_id: ctx.clinicId,
    actor_user_id: ctx.userId,
    action: "clinic_cost_settings.updated",
    target_type: "clinic_cost_settings",
    target_id: row.id,
    metadata: { ...data },
  });
  return row;
}

/**
 * Horas produtivas: V1 prioriza manual.
 * schedule_capacity = horas da grade × taxa de utilização.
 */
export function calculateProductiveHours(
  ctx: AuthzContext,
  settings?: ClinicCostSettings | null,
): number | null {
  const s = settings ?? getClinicCostSettings(ctx);
  if (!s) return null;
  if (
    s.calculation_mode === "manual_productive_hours" ||
    s.monthly_productive_hours != null
  ) {
    return s.monthly_productive_hours;
  }
  // schedule_capacity
  const clinic = getClinic(ctx.clinicId);
  if (!clinic?.hours) return s.monthly_productive_hours;
  let weeklyMinutes = 0;
  for (const day of Object.values(clinic.hours)) {
    if (!day.enabled) continue;
    for (const p of day.periods) {
      const [sh, sm] = p.start.split(":").map(Number);
      const [eh, em] = p.end.split(":").map(Number);
      weeklyMinutes += (eh! * 60 + (em ?? 0)) - (sh! * 60 + (sm ?? 0));
    }
  }
  const monthlyHours = (weeklyMinutes / 60) * (52 / 12);
  const util = (s.planned_utilization_percent ?? 80) / 100;
  return Math.round(monthlyHours * util * 10) / 10;
}

function templateActiveInMonth(
  t: RecurringExpenseTemplate,
  referenceMonth: string,
): boolean {
  if (!t.active) return false;
  const start = t.start_date.slice(0, 7);
  const end = t.end_date?.slice(0, 7) ?? null;
  if (referenceMonth < start) return false;
  if (end && referenceMonth > end) return false;
  return true;
}

/**
 * Despesas do mês por competência (reference_month).
 * Templates recorrentes entram como previsão se não houver despesa correspondente
 * (não contam como valor pago).
 */
export function getMonthlyOperatingExpensesInternal(
  clinicId: string,
  referenceMonth: string,
): MonthlyOperatingExpenses {
  const finance = getFinanceStore();
  const costs = getClinicCostsStore();
  const settings =
    costs.settings.find((s) => s.clinic_id === clinicId) ?? null;
  const lines: MonthlyExpenseLine[] = [];

  for (const tx of finance.transactions) {
    if (tx.clinic_id !== clinicId || tx.type !== "expense") continue;
    if (tx.cancelled_at) continue;
    const month = tx.reference_month ?? tx.competence_date?.slice(0, 7);
    if (month !== referenceMonth) continue;
    if (
      tx.category === "pro_labore" &&
      settings &&
      !settings.include_owner_compensation
    ) {
      continue;
    }
    lines.push({
      id: tx.id,
      source: "expense",
      name: tx.description,
      category: tx.category ?? "outros",
      cost_behavior: tx.cost_behavior ?? "fixed",
      amount_cents: tx.net_amount_cents,
      allocation_eligible: tx.allocation_eligible ?? true,
      reference_month: referenceMonth,
    });
  }

  const expenseNames = new Set(lines.map((l) => l.name.toLowerCase()));
  for (const t of costs.templates) {
    if (t.clinic_id !== clinicId) continue;
    if (!templateActiveInMonth(t, referenceMonth)) continue;
    if (expenseNames.has(t.name.toLowerCase())) continue;
    if (
      t.category === "pro_labore" &&
      settings &&
      !settings.include_owner_compensation
    ) {
      continue;
    }
    lines.push({
      id: t.id,
      source: "template",
      name: t.name,
      category: t.category,
      cost_behavior: t.cost_behavior,
      amount_cents: t.amount_cents,
      allocation_eligible: t.allocation_eligible,
      reference_month: referenceMonth,
    });
  }

  let fixed = 0;
  let variable = 0;
  let allocable = 0;
  let nonAlloc = 0;
  for (const l of lines) {
    if (l.cost_behavior === "fixed") fixed += l.amount_cents;
    else variable += l.amount_cents;
    if (l.allocation_eligible) allocable += l.amount_cents;
    else nonAlloc += l.amount_cents;
  }

  return {
    reference_month: referenceMonth,
    fixed_cents: fixed,
    variable_cents: variable,
    allocatable_cents: allocable,
    non_allocatable_cents: nonAlloc,
    lines: lines.sort((a, b) => a.name.localeCompare(b.name)),
  };
}

export function getMonthlyOperatingExpenses(
  ctx: AuthzContext,
  referenceMonth: string,
): MonthlyOperatingExpenses {
  assertPermission(ctx, "clinic_costs.view");
  return getMonthlyOperatingExpensesInternal(ctx.clinicId, referenceMonth);
}

export function getAllocatableMonthlyCosts(
  ctx: AuthzContext,
  referenceMonth: string,
): number {
  assertPermission(ctx, "clinic_costs.view");
  return getMonthlyOperatingExpensesInternal(ctx.clinicId, referenceMonth)
    .allocatable_cents;
}

const templateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  category: z.string(),
  amount_reais: z.number().min(0),
  cost_behavior: z.enum(["fixed", "variable"]).optional().default("fixed"),
  allocation_eligible: z.boolean().optional().default(true),
  start_date: z.string().min(8),
  end_date: z.string().optional().nullable(),
  active: z.boolean().optional().default(true),
});

export function createRecurringExpenseTemplate(
  ctx: AuthzContext,
  raw: unknown,
): RecurringExpenseTemplate {
  assertPermission(ctx, "clinic_costs.manage");
  const data = templateSchema.parse(raw);
  const row: RecurringExpenseTemplate = {
    id: `ret-${crypto.randomUUID()}`,
    clinic_id: ctx.clinicId,
    name: data.name,
    category: data.category as ExpenseCategory,
    amount_cents: reaisToCents(data.amount_reais),
    cost_behavior: data.cost_behavior,
    recurrence: "monthly",
    allocation_eligible: data.allocation_eligible,
    active: data.active,
    start_date: data.start_date,
    end_date: data.end_date ?? null,
    created_by: ctx.userId,
    created_at: now(),
    updated_at: now(),
  };
  getClinicCostsStore().templates.unshift(row);
  writeClinicCostAudit({
    clinic_id: ctx.clinicId,
    actor_user_id: ctx.userId,
    action: "recurring_expense_template.created",
    target_type: "recurring_expense_template",
    target_id: row.id,
    metadata: { name: row.name },
  });
  return row;
}

export function listRecurringExpenseTemplates(
  ctx: AuthzContext,
): RecurringExpenseTemplate[] {
  assertPermission(ctx, "clinic_costs.view");
  return getClinicCostsStore().templates.filter(
    (t) => t.clinic_id === ctx.clinicId,
  );
}

export function setRecurringTemplateActive(
  ctx: AuthzContext,
  id: string,
  active: boolean,
) {
  assertPermission(ctx, "clinic_costs.manage");
  const row = getClinicCostsStore().templates.find((t) => t.id === id);
  if (!row || row.clinic_id !== ctx.clinicId) {
    throw new Error("TEMPLATE_NOT_FOUND");
  }
  row.active = active;
  row.updated_at = now();
  return row;
}
