export type ReportPeriodPreset =
  | "today"
  | "7d"
  | "30d"
  | "month"
  | "3m"
  | "6m"
  | "year"
  | "custom";

export type ReportSection =
  | "overview"
  | "operational"
  | "procedures"
  | "materials"
  | "patients"
  | "patient_ops"
  | "treatments"
  | "schedule"
  | "financial"
  | "pricing";

export type ReportPeriod = {
  preset: ReportPeriodPreset;
  /** Inclusive start (UTC ISO) — interval [start, end) */
  start: string;
  /** Exclusive end (UTC ISO) */
  end: string;
  label: string;
  timezone: string;
};

export type MetricComparison = {
  previous_value: number;
  delta_percent: number | null;
  /** false when previous is 0 and current > 0 */
  has_baseline: boolean;
  label: string;
};

export type MetricValue = {
  key: string;
  title: string;
  value: number;
  format: "number" | "percent" | "currency_cents";
  comparison?: MetricComparison | null;
  tooltip?: string;
  drilldown?: "pending_returns" | "overdue" | "pending_decisions" | null;
};

export type TimeSeriesPoint = {
  key: string;
  label: string;
  value: number;
  secondary?: number;
};

export type NamedCount = {
  key: string;
  label: string;
  value: number;
};

export type OverviewMetrics = {
  completed_appointments: MetricValue;
  new_patients: MetricValue;
  accepted_plans: MetricValue;
  received_cents: MetricValue | null;
  no_shows: MetricValue | null;
  cancellations: MetricValue | null;
  receivable_cents: MetricValue | null;
  overdue_cents: MetricValue | null;
  insights: string[];
};

export type ScheduleMetrics = {
  scheduled_in_period: MetricValue;
  completed: MetricValue;
  cancelled: MetricValue;
  no_shows: MetricValue;
  attendance_rate: MetricValue;
  no_show_rate: MetricValue;
  occupancy: {
    available: boolean;
    message: string;
    rate: number | null;
  };
  by_status: NamedCount[];
  completed_over_time: TimeSeriesPoint[];
};

export type PatientMetrics = {
  new_patients: MetricValue;
  active_registered: MetricValue;
  by_referral: NamedCount[];
  pending_returns: MetricValue;
};

export type TreatmentMetrics = {
  presented: MetricValue;
  accepted: MetricValue;
  rejected: MetricValue;
  awaiting_decision: MetricValue;
  in_progress: MetricValue;
  completed: MetricValue;
  acceptance_rate: MetricValue;
  presented_value_cents: MetricValue;
  accepted_value_cents: MetricValue;
  received_cents_note: MetricValue | null;
  progress_distribution: NamedCount[];
};

export type FinancialMetrics = {
  received_cents: MetricValue;
  receivable_cents: MetricValue;
  overdue_cents: MetricValue;
  expense_cents: MetricValue;
  period_result_cents: MetricValue;
  overdue_patients: MetricValue;
  by_method: NamedCount[];
  cashflow_over_time: TimeSeriesPoint[];
};

export type PendingReturnRow = {
  patient_id: string;
  patient_name: string;
  /** Clinical indication only when caller has clinical permission */
  indication: string | null;
  indicated_at: string;
  interval_days: number | null;
  last_appointment_at: string | null;
  mode: "clinical" | "administrative_contact";
};

export type OverdueAccountRow = {
  patient_id: string;
  patient_name: string;
  overdue_cents: number;
  oldest_due_date: string;
  overdue_installments: number;
};

export type PendingDecisionRow = {
  plan_id: string;
  patient_id: string;
  patient_name: string;
  title: string;
  presented_at: string | null;
  total_cents: number;
  status: string;
};

export const PERIOD_PRESET_LABELS: Record<ReportPeriodPreset, string> = {
  today: "Hoje",
  "7d": "7 dias",
  "30d": "30 dias",
  month: "Este mês",
  "3m": "3 meses",
  "6m": "6 meses",
  year: "Este ano",
  custom: "Personalizado",
};
