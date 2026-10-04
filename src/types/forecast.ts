import type { ConsumptionMode, InventoryUnit } from "@/types/inventory";

export type AppointmentPlannedProcedure = {
  id: string;
  clinic_id: string;
  appointment_id: string;
  patient_id: string;
  procedure_id: string;
  procedure_name?: string;
  procedure_variant_id: string | null;
  tooth_number: number | null;
  region: string | null;
  quantity: number;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  cancelled_at: string | null;
};

export type MaterialRequirementLine = {
  inventory_item_id: string;
  item_name: string;
  consumption_unit: InventoryUnit;
  consumption_mode: ConsumptionMode;
  quantity: number;
  unit_cost_cents: number;
  cost_cents: number;
  is_estimate: boolean; // manual mode
  scope: "procedure" | "appointment";
  procedure_id?: string;
  planned_procedure_id?: string;
  patient_id?: string;
  patient_name?: string;
  tooth_number?: number | null;
};

export type ForecastMaterialStatus =
  | "sufficient"
  | "low_after_forecast"
  | "insufficient"
  | "unknown";

export const FORECAST_STATUS_LABELS: Record<ForecastMaterialStatus, string> = {
  sufficient: "Suficiente",
  low_after_forecast: "Ficará abaixo do mínimo",
  insufficient: "Insuficiente",
  unknown: "Sem previsão confiável",
};

export type ForecastMaterialRow = {
  inventory_item_id: string;
  item_name: string;
  consumption_unit: InventoryUnit;
  current_quantity: number;
  minimum_quantity: number | null;
  forecast_quantity: number;
  projected_remaining: number;
  status: ForecastMaterialStatus;
  estimated_cost_cents: number | null;
  suggested_purchase_quantity: number | null;
  appointments_count: number;
  procedures_count: number;
  patient_breakdown: Array<{
    patient_id: string;
    patient_name: string;
    appointment_id: string;
    procedure_name: string;
    tooth_number: number | null;
    quantity: number;
  }>;
};

export type ForecastSummary = {
  start_date: string;
  end_date: string;
  appointments_analyzed: number;
  appointments_without_procedures: number;
  procedures_planned: number;
  materials_at_risk: number;
  materials: ForecastMaterialRow[];
  estimated_total_cost_cents: number | null;
};
