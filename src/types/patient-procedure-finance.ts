export const PERFORMED_FINANCIAL_STATUSES = [
  "pending_charge",
  "charged",
  "no_charge",
  "included_in_plan",
] as const;

export type PerformedFinancialStatus =
  (typeof PERFORMED_FINANCIAL_STATUSES)[number];

export const PERFORMED_FINANCIAL_STATUS_LABELS: Record<
  PerformedFinancialStatus,
  string
> = {
  pending_charge: "Cobrança não definida",
  charged: "Cobrado",
  no_charge: "Não cobrar",
  included_in_plan: "Incluído no plano de tratamento",
};

export type PerformedProcedureFinancialLink = {
  id: string;
  clinic_id: string;
  performed_procedure_id: string;
  financial_transaction_id: string;
  amount_allocated_cents: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  cancelled_at: string | null;
};

export type ProcedureFinanceBreakdown = {
  performed_procedure_id: string;
  standard_price_cents: number | null;
  charged_amount_cents: number | null;
  discount_amount_cents: number | null;
  discount_percent: number | null;
  allocated_cents: number;
  received_cents: number;
  outstanding_cents: number;
  actual_total_cost_cents: number | null;
  gross_result_charged_cents: number | null;
  gross_result_received_cents: number | null;
  gross_margin_percent: number | null;
  financial_status: PerformedFinancialStatus;
  links: Array<{
    id: string;
    financial_transaction_id: string;
    amount_allocated_cents: number;
    transaction_description: string | null;
    transaction_status: string | null;
  }>;
};

export type PatientOperationalFinancialSummary = {
  patient_id: string;
  procedures_count: number;
  direct_cost_cents: number | null;
  charged_cents: number | null;
  received_cents: number | null;
  outstanding_cents: number | null;
  overdue_cents: number | null;
  last_procedure: {
    id: string;
    name: string;
    completed_at: string | null;
    tooth_number: number | null;
  } | null;
};

export type AppointmentCompletionSummary = {
  appointment_id: string;
  procedures: Array<{
    id: string;
    name: string;
    tooth_number: number | null;
    consumption_confirmed: boolean;
    has_evolution: boolean;
    financial_status: PerformedFinancialStatus;
    charged_amount_cents: number | null;
  }>;
  materials_confirmed: boolean;
  evolutions_finalized: number;
  charged_cents: number | null;
  received_cents: number | null;
  outstanding_cents: number | null;
  blockers: string[];
  warnings: string[];
};

export type TodayOperationalKpis = {
  procedures_completed: number;
  materials_cost_cents: number | null;
  charged_cents: number | null;
  received_cents: number | null;
};
