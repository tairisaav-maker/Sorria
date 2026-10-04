import type { ExpenseCategory } from "@/types/finance";

export const COST_BEHAVIORS = ["fixed", "variable"] as const;
export type CostBehavior = (typeof COST_BEHAVIORS)[number];

export const COST_BEHAVIOR_LABELS: Record<CostBehavior, string> = {
  fixed: "Fixa",
  variable: "Variável",
};

export const RECURRENCE_TYPES = ["recurring", "one_time"] as const;
export type RecurrenceType = (typeof RECURRENCE_TYPES)[number];

export const RECURRENCE_TYPE_LABELS: Record<RecurrenceType, string> = {
  recurring: "Recorrente",
  one_time: "Eventual",
};

export const HOURLY_CALCULATION_MODES = [
  "manual_productive_hours",
  "schedule_capacity",
] as const;

export type HourlyCalculationMode =
  (typeof HOURLY_CALCULATION_MODES)[number];

export const DURATION_SOURCES = [
  "actual",
  "appointment",
  "default",
  "manual",
] as const;

export type DurationSource = (typeof DURATION_SOURCES)[number];

export const DURATION_SOURCE_LABELS: Record<DurationSource, string> = {
  actual: "Duração real",
  appointment: "Duração da consulta",
  default: "Duração padrão do procedimento",
  manual: "Ajuste manual",
};

export type ClinicCostSettings = {
  id: string;
  clinic_id: string;
  calculation_mode: HourlyCalculationMode;
  monthly_productive_hours: number | null;
  planned_utilization_percent: number | null;
  include_owner_compensation: boolean;
  created_at: string;
  updated_at: string;
};

export type RecurringExpenseTemplate = {
  id: string;
  clinic_id: string;
  name: string;
  category: ExpenseCategory;
  amount_cents: number;
  cost_behavior: CostBehavior;
  recurrence: "monthly";
  allocation_eligible: boolean;
  active: boolean;
  start_date: string;
  end_date: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type ClinicHourlyCostSnapshot = {
  id: string;
  clinic_id: string;
  reference_month: string; // YYYY-MM
  allocatable_cost_cents: number;
  productive_hours: number;
  hourly_cost_cents: number;
  calculation_method: HourlyCalculationMode;
  created_at: string;
};

export type MonthlyExpenseLine = {
  id: string;
  source: "expense" | "template";
  name: string;
  category: ExpenseCategory;
  cost_behavior: CostBehavior;
  amount_cents: number;
  allocation_eligible: boolean;
  reference_month: string;
};

export type MonthlyOperatingExpenses = {
  reference_month: string;
  fixed_cents: number;
  variable_cents: number;
  allocatable_cents: number;
  non_allocatable_cents: number;
  lines: MonthlyExpenseLine[];
};

export type HourlyOperatingCost = {
  reference_month: string;
  allocatable_cost_cents: number;
  productive_hours: number | null;
  hourly_cost_cents: number | null;
  cost_per_minute_cents: number | null;
  insufficient_data: boolean;
  message: string | null;
  composition: MonthlyExpenseLine[];
  snapshot_id: string | null;
};

export type ProcedureOperationalCost = {
  performed_procedure_id: string;
  material_cost_cents: number | null;
  direct_cost_cents: number | null;
  duration_minutes: number | null;
  duration_source: DurationSource | null;
  productive_hour_cost_snapshot_cents: number | null;
  allocated_time_cost_cents: number | null;
  operational_total_cost_cents: number | null;
  charged_amount_cents: number | null;
  gross_result_direct_cents: number | null;
  operational_result_cents: number | null;
  operational_margin_percent: number | null;
  insufficient_data: boolean;
  message: string | null;
};

export type StandardOperationalEstimate = {
  procedure_id: string;
  materials_cost_cents: number;
  direct_costs_cents: number;
  default_duration_minutes: number | null;
  hourly_cost_cents: number | null;
  time_cost_cents: number | null;
  operational_total_cents: number | null;
  default_price_cents: number | null;
  operational_result_cents: number | null;
  operational_margin_percent: number | null;
  insufficient_data: boolean;
  disclaimer: string;
};

/** Categorias agrupadas para UX. */
export const EXPENSE_CATEGORY_GROUPS: Record<
  string,
  ExpenseCategory[]
> = {
  Estrutura: ["aluguel", "energia", "internet", "agua", "telefone", "condominio"],
  Pessoas: ["pessoas", "pro_labore"],
  "Sistemas e serviços": ["software", "contador", "servicos", "limpeza", "seguranca"],
  Equipamentos: ["equipamentos", "manutencao"],
  Marketing: ["marketing"],
  Materiais: ["material", "laboratorio"],
  Outros: ["impostos", "outros"],
};
