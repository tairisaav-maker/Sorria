import type { ConsumptionMode, InventoryUnit } from "@/types/inventory";
import type { PerformedFinancialStatus } from "@/types/patient-procedure-finance";

export const PERFORMED_PROCEDURE_STATUSES = [
  "planned",
  "in_progress",
  "completed",
  "cancelled",
] as const;

export type PerformedProcedureStatus =
  (typeof PERFORMED_PROCEDURE_STATUSES)[number];

export const PERFORMED_PROCEDURE_STATUS_LABELS: Record<
  PerformedProcedureStatus,
  string
> = {
  planned: "Planejado",
  in_progress: "Em execução",
  completed: "Concluído",
  cancelled: "Cancelado",
};

export type PerformedProcedure = {
  id: string;
  clinic_id: string;
  patient_id: string;
  appointment_id: string | null;
  procedure_id: string;
  procedure_name_snapshot: string;
  treatment_item_id: string | null;
  appointment_planned_procedure_id: string | null;
  professional_id: string;
  tooth_number: number | null;
  region: string | null;
  quantity: number;
  status: PerformedProcedureStatus;
  /** Preço padrão no momento, centavos */
  standard_price_snapshot_cents: number | null;
  /** Valor cobrado neste paciente, centavos */
  charged_amount_cents: number | null;
  charged_zero_reason: string | null;
  financial_status: PerformedFinancialStatus;
  charge_note: string | null;
  planned_material_cost_cents: number;
  actual_material_cost_cents: number | null;
  planned_shared_cost_cents: number;
  actual_shared_cost_cents: number | null;
  planned_direct_cost_cents: number;
  actual_direct_cost_cents: number | null;
  planned_total_cost_cents: number;
  actual_total_cost_cents: number | null;
  gross_result_cents: number | null;
  gross_margin_percent: number | null;
  consumption_confirmed: boolean;
  consumption_confirmed_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  clinical_entry_id: string | null;
  financial_transaction_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type ProcedureConsumption = {
  id: string;
  clinic_id: string;
  performed_procedure_id: string;
  patient_id: string;
  appointment_id: string | null;
  /** Item previsto (snapshot da ficha) */
  inventory_item_id: string;
  item_name_snapshot: string;
  /** Item realmente consumido (substituição) */
  actual_inventory_item_id: string | null;
  actual_item_name_snapshot: string | null;
  consumption_mode: ConsumptionMode;
  planned_quantity: number;
  actual_quantity: number | null;
  consumption_unit: InventoryUnit;
  unit_cost_snapshot_cents: number;
  planned_cost_cents: number;
  actual_cost_cents: number | null;
  is_extra: boolean;
  status: "planned" | "confirmed" | "corrected";
  confirmed_by: string | null;
  confirmed_at: string | null;
  inventory_movement_id: string | null;
  created_at: string;
  updated_at: string;
};

/** Materiais per_appointment — uma baixa física por atendimento. */
export type AppointmentConsumption = {
  id: string;
  clinic_id: string;
  appointment_id: string;
  patient_id: string;
  inventory_item_id: string;
  item_name_snapshot: string;
  actual_inventory_item_id: string | null;
  actual_item_name_snapshot: string | null;
  planned_quantity: number;
  actual_quantity: number | null;
  consumption_unit: InventoryUnit;
  unit_cost_snapshot_cents: number;
  planned_cost_cents: number;
  actual_cost_cents: number | null;
  status: "planned" | "confirmed" | "corrected";
  confirmed_by: string | null;
  confirmed_at: string | null;
  inventory_movement_id: string | null;
  created_at: string;
  updated_at: string;
};

export type ConsumptionDeviation = {
  inventory_item_id: string;
  item_name: string;
  planned_quantity: number;
  actual_quantity: number;
  difference: number;
  percent: number | null;
  label: "acima_do_previsto" | "abaixo_do_previsto" | "conforme_previsto";
};
