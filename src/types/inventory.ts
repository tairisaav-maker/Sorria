export const INVENTORY_UNITS = [
  "un",
  "par",
  "caixa",
  "pacote",
  "seringa",
  "frasco",
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
  /** Template global de origem (se importado) — não obriga marca */
  source_material_template_id: string | null;
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
  /** Snapshot do template Sorria — alterações futuras no global NÃO sobrescrevem */
  source_template_id: string | null;
  source_template_version: number | null;
  favorited: boolean;
  use_count: number;
  last_used_at: string | null;
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
  /** Quantidade depende da situação clínica — confirmar no atendimento */
  clinically_variable: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
  source_material_template_id: string | null;
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

export const MOVEMENT_TYPES = [
  "purchase",
  "initial_balance",
  "manual_adjustment",
  "loss",
  "expiration",
  "return",
  "correction",
  "procedure_consumption",
] as const;

export type MovementType = (typeof MOVEMENT_TYPES)[number];

export const MOVEMENT_TYPE_LABELS: Record<MovementType, string> = {
  purchase: "Compra",
  initial_balance: "Estoque inicial",
  manual_adjustment: "Ajuste",
  loss: "Perda",
  expiration: "Vencimento",
  return: "Devolução",
  correction: "Correção",
  procedure_consumption: "Consumo clínico",
};

export const ADJUSTMENT_REASONS = [
  "contagem_fisica",
  "perda",
  "quebra",
  "vencimento",
  "correcao",
  "outro",
] as const;

export type AdjustmentReason = (typeof ADJUSTMENT_REASONS)[number];

export const ADJUSTMENT_REASON_LABELS: Record<AdjustmentReason, string> = {
  contagem_fisica: "Contagem física",
  perda: "Perda",
  quebra: "Quebra",
  vencimento: "Vencimento",
  correcao: "Correção",
  outro: "Outro",
};

export type InventoryPurchase = {
  id: string;
  clinic_id: string;
  supplier_name: string | null;
  invoice_number: string | null;
  purchase_date: string;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  cancelled_at: string | null;
  cancelled_by: string | null;
  cancellation_reason: string | null;
};

export type InventoryPurchaseItem = {
  id: string;
  clinic_id: string;
  inventory_purchase_id: string;
  inventory_item_id: string;
  purchase_quantity: number;
  purchase_unit: InventoryUnit;
  units_per_purchase_unit_snapshot: number;
  consumption_quantity_received: number;
  /** Total em centavos */
  total_cost_cents: number;
  /** Centavos por unidade de compra */
  cost_per_purchase_unit_cents: number;
  /** Centavos por unidade de consumo */
  cost_per_consumption_unit_cents: number;
  lot_number: string | null;
  expiration_date: string | null;
  created_at: string;
};

export type InventoryMovement = {
  id: string;
  clinic_id: string;
  inventory_item_id: string;
  movement_type: MovementType;
  /** +entrada / -saída em unidade de consumo */
  quantity_delta: number;
  unit_cost_snapshot_cents: number | null;
  resulting_quantity: number | null;
  reference_type: string | null;
  reference_id: string | null;
  reason: string | null;
  created_by: string;
  created_at: string;
};

export type InventoryLot = {
  id: string;
  clinic_id: string;
  inventory_item_id: string;
  lot_number: string | null;
  expiration_date: string | null;
  quantity_received: number;
  quantity_remaining: number;
  unit_cost_cents: number;
  source_purchase_item_id: string | null;
  created_at: string;
};

export type InventoryItemStatus =
  | "normal"
  | "low"
  | "empty"
  | "expiring";

export const INVENTORY_STATUS_LABELS: Record<InventoryItemStatus, string> = {
  normal: "Normal",
  low: "Estoque baixo",
  empty: "Sem estoque",
  expiring: "Próximo do vencimento",
};
