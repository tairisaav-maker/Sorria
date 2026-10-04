import type { PricingAlert } from "@/lib/pricing/formulas";

export type ProcedurePriceHistory = {
  id: string;
  clinic_id: string;
  procedure_id: string;
  price_cents: number;
  valid_from: string;
  valid_until: string | null;
  changed_by: string;
  created_at: string;
};

export type ProcedurePricingSummary = {
  procedure_id: string;
  procedure_name: string;
  default_price_cents: number | null;
  materials_cost_cents: number;
  direct_costs_cents: number;
  default_duration_minutes: number | null;
  hourly_cost_cents: number | null;
  time_cost_cents: number | null;
  operational_total_cents: number | null;
  operational_result_cents: number | null;
  operational_margin_percent: number | null;
  break_even_cents: number | null;
  insufficient_data: boolean;
  standard_below_operational: boolean;
  disclaimer: string;
};

export type PerformedPricingAnalysis = {
  performed_procedure_id: string;
  procedure_name: string;
  patient_id: string;
  completed_at: string | null;
  standard_price_snapshot_cents: number | null;
  charged_amount_cents: number | null;
  price_difference_cents: number | null;
  price_difference_percent: number | null;
  direct_cost_cents: number | null;
  operational_total_cost_cents: number | null;
  direct_result_cents: number | null;
  operational_result_cents: number | null;
  operational_margin_percent: number | null;
  received_cents: number | null;
  outstanding_cents: number | null;
  result_considering_received_cents: number | null;
  break_even_cents: number | null;
  alerts: PricingAlert[];
  calculable: boolean;
  message: string | null;
};

export type PricingPerformanceRow = {
  procedure_id: string;
  procedure_name: string;
  count: number;
  charged_count: number;
  with_operational_count: number;
  current_default_price_cents: number | null;
  avg_standard_snapshot_cents: number | null;
  avg_charged_cents: number | null;
  min_charged_cents: number | null;
  median_charged_cents: number | null;
  max_charged_cents: number | null;
  avg_operational_cost_cents: number | null;
  aggregate_result_cents: number | null;
  aggregate_margin_percent: number | null;
  avg_price_difference_cents: number | null;
  below_operational_count: number;
};

export type PricingReport = {
  period_label: string;
  rows: PricingPerformanceRow[];
  below_operational: PerformedPricingAnalysis[];
  pricing_coverage_percent: number | null;
  completed: number;
  with_complete_pricing: number;
  incomplete_count: number;
  margin_bands: Array<{ band: string; count: number }>;
  disclaimer: string;
};

export type PriceSimulation = {
  operational_cost_cents: number;
  simulated_price_cents: number | null;
  result_cents: number | null;
  margin_percent: number | null;
  break_even_cents: number;
  label: string;
  message: string | null;
};
