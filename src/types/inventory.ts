export const INVENTORY_UNITS = [
  "un",
  "par",
  "caixa",
  "pacote",
  "seringa",
  "tubete",
  "capsula",
  "dose",
  "ml",
  "L",
  "g",
  "kg",
  "rolo",
  "outro",
] as const;

export type InventoryUnit = (typeof INVENTORY_UNITS)[number];

export const CONSUMPTION_MODES = [
  "per_appointment",
  "per_procedure",
  "per_unit",
  "manual",
] as const;

export type ConsumptionMode = (typeof CONSUMPTION_MODES)[number];

export const CONSUMPTION_MODE_LABELS: Record<ConsumptionMode, string> = {
  per_appointment: "Por atendimento",
  per_procedure: "Por procedimento",
  per_unit: "Por unidade/quantidade",
  manual: "Manual",
};

export type InventoryItem = {
  id: string;
  clinic_id: string;
  name: string;
  category: string | null;
  purchase_unit: InventoryUnit;
  consumption_unit: InventoryUnit;
  /** Quantas unidades de consumo existem em 1 unidade de compra. Ex.: caixa→100 un = 100 */
  units_per_purchase_unit: number;
  current_quantity: number; // always in consumption units
  minimum_quantity: number | null;
  /** Custo médio por unidade de consumo, em centavos */
  average_unit_cost_cents: number;
  last_purchase_cost_cents: number | null;
  supplier_name: string | null;
  tracks_lot: boolean;
  tracks_expiration: boolean;
  active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

export type Procedure = {
  id: string;
  clinic_id: string;
  name: string;
  description: string | null;
  category: string | null;
  default_duration_minutes: number | null;
  /** Preço padrão em centavos */
  default_price_cents: number | null;
  active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

export type ProcedureMaterial = {
  id: string;
  clinic_id: string;
  procedure_id: string;
  inventory_item_id: string;
  /** Quantidade padrão na unidade de consumo do item */
  standard_quantity: number;
  consumption_unit: InventoryUnit;
  consumption_mode: ConsumptionMode;
  optional: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type ProcedureMaterialLine = ProcedureMaterial & {
  item_name: string;
  average_unit_cost_cents: number;
  planned_cost_cents: number;
};

export type ProcedureStandardCost = {
  materials_cost_cents: number;
  direct_costs_cents: number;
  total_cost_cents: number;
  default_price_cents: number | null;
  gross_result_cents: number | null;
  margin_percent: number | null;
  lines: ProcedureMaterialLine[];
};
