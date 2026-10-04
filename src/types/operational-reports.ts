export type CostCompleteness = "complete" | "incomplete" | "unknown";

export type OperationalOverview = {
  procedures_completed: number;
  materials_cost_cents: number | null;
  charged_cents: number | null;
  received_cents: number | null;
  gross_result_charged_cents: number | null;
  gross_result_received_cents: number | null;
  receivable_cents: number | null;
  cost_coverage_percent: number | null;
  incomplete_cost_procedures: number;
  planned_vs_actual_percent: number | null;
  planned_vs_actual_label: string | null;
  previous_comparison: {
    procedures: { current: number; previous: number; label: string };
    materials_cost: { current: number | null; previous: number | null; label: string };
    received: { current: number | null; previous: number | null; label: string };
  };
};

export type ProcedurePerformanceRow = {
  procedure_id: string;
  procedure_name: string;
  count: number;
  charged_count: number;
  avg_actual_cost_cents: number | null;
  avg_planned_cost_cents: number | null;
  avg_charged_cents: number | null;
  total_charged_cents: number | null;
  total_received_cents: number | null;
  total_actual_cost_cents: number | null;
  gross_result_cents: number | null;
  margin_percent: number | null;
  cost_deviation_percent: number | null;
  incomplete_cost_count: number;
};

export type ProcedurePerformanceDetail = ProcedurePerformanceRow & {
  standard_price_cents: number | null;
  monthly_series: Array<{ key: string; label: string; count: number; avg_cost_cents: number | null }>;
  recent: Array<{
    id: string;
    patient_id: string;
    patient_name: string | null;
    tooth_number: number | null;
    completed_at: string | null;
    charged_amount_cents: number | null;
    actual_total_cost_cents: number | null;
  }>;
};

export type MaterialConsumptionRow = {
  inventory_item_id: string;
  item_name: string;
  consumption_unit: string;
  planned_quantity: number;
  actual_quantity: number;
  difference: number;
  difference_percent: number | null;
  cost_consumed_cents: number | null;
  cost_incomplete: boolean;
  procedures_count: number;
  current_stock: number | null;
  average_unit_cost_cents: number | null;
};

export type MaterialConsumptionDetail = MaterialConsumptionRow & {
  usages: Array<{
    performed_procedure_id: string;
    procedure_name: string;
    patient_id: string | null;
    patient_name: string | null;
    planned_quantity: number;
    actual_quantity: number;
    cost_cents: number | null;
  }>;
  recent_purchases: Array<{
    id: string;
    purchase_date: string;
    quantity: number;
    total_cost_cents: number | null;
  }>;
};

export type PatientOperationalRow = {
  patient_id: string;
  patient_name: string;
  procedures_count: number;
  direct_cost_cents: number | null;
  charged_cents: number | null;
  received_cents: number | null;
  outstanding_cents: number | null;
  gross_result_cents: number | null;
};

export type FinancialOperationalReport = {
  charged_cents: number | null;
  received_cents: number | null;
  receivable_cents: number | null;
  overdue_cents: number | null;
  direct_cost_cents: number | null;
  gross_result_charged_cents: number | null;
  gross_result_received_cents: number | null;
  series: Array<{
    key: string;
    label: string;
    charged_cents: number;
    received_cents: number;
    direct_cost_cents: number;
  }>;
};

export type CostCoverageReport = {
  completed: number;
  with_complete_cost: number;
  coverage_percent: number | null;
  incomplete_count: number;
  without_bom_count: number;
  without_unit_cost_count: number;
};
