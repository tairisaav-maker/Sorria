import type { InventoryUnit } from "@/types/inventory";

export const REPLENISHMENT_HORIZONS = ["7d", "15d", "30d", "custom"] as const;
export type ReplenishmentHorizon = (typeof REPLENISHMENT_HORIZONS)[number];

export const REPLENISHMENT_HORIZON_LABELS: Record<ReplenishmentHorizon, string> =
  {
    "7d": "Próximos 7 dias",
    "15d": "Próximos 15 dias",
    "30d": "Próximos 30 dias",
    custom: "Personalizado",
  };

export const REPLENISHMENT_STATUSES = [
  "ok",
  "attention",
  "reorder",
  "critical",
  "unknown",
] as const;

export type ReplenishmentStatus = (typeof REPLENISHMENT_STATUSES)[number];

export const REPLENISHMENT_STATUS_LABELS: Record<ReplenishmentStatus, string> = {
  ok: "Estoque adequado",
  attention: "Atenção",
  reorder: "Repor",
  critical: "Crítico",
  unknown: "Dados insuficientes",
};

export const DATA_CONFIDENCE_LEVELS = ["high", "medium", "low"] as const;
export type DataConfidence = (typeof DATA_CONFIDENCE_LEVELS)[number];

export const PURCHASE_LIST_STATUSES = [
  "draft",
  "ready",
  "partially_purchased",
  "completed",
  "cancelled",
] as const;

export type PurchaseListStatus = (typeof PURCHASE_LIST_STATUSES)[number];

export const PURCHASE_LIST_STATUS_LABELS: Record<PurchaseListStatus, string> = {
  draft: "Rascunho",
  ready: "Pronta",
  partially_purchased: "Compra parcial",
  completed: "Concluída",
  cancelled: "Cancelada",
};

export const PURCHASE_LIST_ITEM_STATUSES = [
  "pending",
  "purchased",
  "skipped",
  "cancelled",
] as const;

export type PurchaseListItemStatus =
  (typeof PURCHASE_LIST_ITEM_STATUSES)[number];

/** Mínimo de ocorrências para análise histórica comparável. */
export const HISTORICAL_SAMPLE_MIN = 5;

export type CostEstimateSource = "last_purchase" | "average_cost" | null;

export type ReplenishmentNeedRow = {
  inventory_item_id: string;
  item_name: string;
  category: string | null;
  consumption_unit: InventoryUnit;
  purchase_unit: InventoryUnit;
  units_per_purchase_unit: number;
  current_quantity: number;
  /** Estoque efetivamente útil no horizonte (considera validade quando confiável). */
  effective_quantity: number;
  minimum_quantity: number | null;
  forecast_quantity: number;
  /** Previsão oficial (ficha técnica). */
  recommended_replenishment_quantity: number;
  recommended_packages: number;
  purchased_quantity_if_suggested: number;
  surplus_quantity: number;
  projected_quantity_after_purchase: number;
  estimated_package_cost_cents: number | null;
  estimated_total_cost_cents: number | null;
  cost_source: CostEstimateSource;
  status: ReplenishmentStatus;
  confidence: DataConfidence;
  warnings: string[];
  historical: {
    sample_size: number;
    reliable: boolean;
    avg_actual_per_use: number | null;
    avg_planned_per_use: number | null;
    deviation_percent: number | null;
    historical_forecast_quantity: number | null;
  };
  used_in_procedures: string[];
  open_list_hint: string | null;
  last_supplier_name: string | null;
  last_purchase_package_cost_cents: number | null;
  expiring_soon_quantity: number | null;
  patient_breakdown: Array<{
    patient_id: string | null;
    patient_name: string | null;
    appointment_id: string;
    procedure_name: string;
    quantity: number;
  }>;
};

export type ReplenishmentSummary = {
  start_date: string;
  end_date: string;
  horizon: ReplenishmentHorizon;
  appointments_eligible: number;
  appointments_with_procedures: number;
  agenda_coverage_percent: number | null;
  procedures_planned: number;
  procedures_with_bom: number;
  bom_coverage_percent: number | null;
  materials_needing_attention: number;
  materials_critical: number;
  materials_reorder: number;
  estimated_list_total_cents: number | null;
  items_without_cost: number;
  items: ReplenishmentNeedRow[];
  warnings: string[];
};

export type PurchaseList = {
  id: string;
  clinic_id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: PurchaseListStatus;
  estimated_total_cents: number | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

export type PurchaseListItem = {
  id: string;
  clinic_id: string;
  purchase_list_id: string;
  inventory_item_id: string;
  item_name_snapshot: string;
  forecast_quantity: number;
  minimum_quantity_snapshot: number | null;
  current_quantity_snapshot: number;
  recommended_consumption_quantity: number;
  recommended_purchase_packages: number;
  selected_purchase_packages: number;
  selected: boolean;
  purchase_unit: InventoryUnit;
  consumption_unit: InventoryUnit;
  units_per_purchase_unit_snapshot: number;
  estimated_unit_purchase_cost_cents: number | null;
  estimated_total_cost_cents: number | null;
  status: PurchaseListItemStatus;
  notes: string | null;
  inventory_purchase_item_id: string | null;
  created_at: string;
  updated_at: string;
};
