import type { ConsumptionMode, InventoryUnit } from "@/types/inventory";

export const PROCEDURE_TEMPLATE_CATEGORIES = [
  "avaliacao_prevencao",
  "dentistica",
  "periodontia",
  "endodontia",
  "cirurgia",
  "clareamento",
  "protese",
  "implantodontia",
  "odontopediatria",
  "ortodontia",
  "outros",
] as const;

export type ProcedureTemplateCategory =
  (typeof PROCEDURE_TEMPLATE_CATEGORIES)[number];

export const PROCEDURE_TEMPLATE_CATEGORY_LABELS: Record<
  ProcedureTemplateCategory,
  string
> = {
  avaliacao_prevencao: "Avaliação e prevenção",
  dentistica: "Dentística",
  periodontia: "Periodontia",
  endodontia: "Endodontia",
  cirurgia: "Cirurgia oral",
  clareamento: "Clareamento / Estética",
  protese: "Prótese",
  implantodontia: "Implantodontia",
  odontopediatria: "Odontopediatria",
  ortodontia: "Ortodontia",
  outros: "Outros",
};

/** Chips curtos na UX de seleção */
export const PROCEDURE_LIBRARY_CHIP_LABELS: Record<
  ProcedureTemplateCategory | "todos" | "mais_usados" | "favoritos" | "recentes",
  string
> = {
  todos: "Todos",
  mais_usados: "Mais usados",
  favoritos: "Favoritos",
  recentes: "Recentes",
  avaliacao_prevencao: "Prevenção",
  dentistica: "Dentística",
  periodontia: "Periodontia",
  endodontia: "Endodontia",
  cirurgia: "Cirurgia",
  clareamento: "Estética",
  protese: "Prótese",
  implantodontia: "Implantes",
  odontopediatria: "Infantil",
  ortodontia: "Ortodontia",
  outros: "Outros",
};

export const MATERIAL_TEMPLATE_CATEGORIES = [
  "descartaveis",
  "dentistica",
  "anestesia",
  "endodontia",
  "periodontia",
  "cirurgia",
  "clareamento",
  "protese",
  "implante",
  "ortodontia",
  "outros",
] as const;

export type MaterialTemplateCategory =
  (typeof MATERIAL_TEMPLATE_CATEGORIES)[number];

export const MATERIAL_TEMPLATE_CATEGORY_LABELS: Record<
  MaterialTemplateCategory,
  string
> = {
  descartaveis: "Descartáveis",
  dentistica: "Dentística",
  anestesia: "Anestesia",
  endodontia: "Endodontia",
  periodontia: "Periodontia",
  cirurgia: "Cirurgia",
  clareamento: "Clareamento",
  protese: "Prótese",
  implante: "Implante",
  ortodontia: "Ortodontia",
  outros: "Outros",
};

export type MaterialTemplate = {
  id: string;
  name: string;
  category: MaterialTemplateCategory;
  suggested_purchase_unit: InventoryUnit;
  suggested_consumption_unit: InventoryUnit;
  suggested_units_per_purchase_unit: number | null;
  /** Centavos por unidade de compra — referência, NÃO custo real da clínica */
  reference_purchase_price_cents: number | null;
  reference_price_source: string | null;
  reference_price_date: string | null;
  clinically_variable: boolean;
  aliases: string[];
  search_terms: string;
  active: boolean;
  template_version: number;
  created_at: string;
  updated_at: string;
};

export type ProcedureTemplate = {
  id: string;
  name: string;
  short_name: string | null;
  category: ProcedureTemplateCategory;
  subcategory: string | null;
  description: string | null;
  default_duration_minutes: number | null;
  complexity_level: "baixa" | "media" | "alta" | null;
  active: boolean;
  search_terms: string;
  sort_order: number;
  template_version: number;
  created_at: string;
  updated_at: string;
};

export type ProcedureTemplateMaterial = {
  id: string;
  procedure_template_id: string;
  material_template_id: string;
  suggested_quantity: number | null;
  consumption_unit: InventoryUnit;
  consumption_mode: ConsumptionMode;
  optional: boolean;
  clinically_variable: boolean;
  notes: string | null;
  sort_order: number;
};

/** Preferências da clínica sobre templates / procedimentos */
export type ClinicLibraryPreference = {
  id: string;
  clinic_id: string;
  /** Preferência sobre template global (antes ou depois de importar) */
  procedure_template_id: string | null;
  /** Preferência sobre procedure já da clínica */
  procedure_id: string | null;
  favorited: boolean;
  use_count: number;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
};

export type LibrarySourceBadge = "clinic" | "template";

export type ProcedureLibraryCard = {
  /** Chave estável para UI: clinic:{id} | template:{id} */
  key: string;
  source: LibrarySourceBadge;
  procedure_id: string | null;
  procedure_template_id: string | null;
  name: string;
  category: string;
  category_key: ProcedureTemplateCategory | "clinic";
  default_duration_minutes: number | null;
  materials_count: number;
  /** Custo real da clínica em centavos, se autorizado e disponível */
  clinic_cost_cents: number | null;
  /** Estimativa de referência do template (centavos), nunca exata */
  reference_cost_cents: number | null;
  materials_without_cost: number;
  favorited: boolean;
  use_count: number;
  last_used_at: string | null;
  template_version: number | null;
  badge_label: "Meu procedimento" | "Modelo Sorria";
};

export type MaterialMatchSuggestion = {
  material_template_id: string;
  material_template_name: string;
  status: "matched" | "ambiguous" | "missing";
  inventory_item_id: string | null;
  inventory_item_name: string | null;
  candidates: Array<{ id: string; name: string }>;
  clinically_variable: boolean;
  suggested_quantity: number | null;
  consumption_unit: InventoryUnit;
  consumption_mode: ConsumptionMode;
  optional: boolean;
  notes: string | null;
  reference_unit_cost_cents: number | null;
  clinic_unit_cost_cents: number | null;
};

export type ProcedureTemplatePreview = {
  template: ProcedureTemplate;
  materials: Array<{
    material: MaterialTemplate;
    link: ProcedureTemplateMaterial;
    match: MaterialMatchSuggestion;
  }>;
  reference_cost_cents: number | null;
  materials_with_cost: number;
  materials_without_cost: number;
  already_imported_procedure_id: string | null;
};

export type ImportMaterialDecision = {
  material_template_id: string;
  /** Usar item existente */
  inventory_item_id?: string | null;
  /** Criar novo a partir do template (ou nome customizado) */
  create_new?: boolean;
  custom_name?: string | null;
  skip?: boolean;
  suggested_quantity?: number | null;
  consumption_mode?: ConsumptionMode;
  optional?: boolean;
  clinically_variable?: boolean;
};

export type ImportTemplateInput = {
  procedure_template_id: string;
  name?: string | null;
  default_duration_minutes?: number | null;
  default_price_reais?: number | null;
  materials?: ImportMaterialDecision[];
  /** Criar materiais faltantes automaticamente */
  create_missing_materials?: boolean;
};

export type ImportTemplateResult = {
  procedure_id: string;
  created_inventory_item_ids: string[];
  linked_material_count: number;
  reused_inventory_item_ids: string[];
};

export type MaterialLibraryCard = {
  key: string;
  source: LibrarySourceBadge;
  inventory_item_id: string | null;
  material_template_id: string | null;
  name: string;
  category: string;
  consumption_unit: InventoryUnit;
  current_quantity: number | null;
  clinic_unit_cost_cents: number | null;
  reference_purchase_price_cents: number | null;
  clinically_variable: boolean;
  badge_label: "Meu material" | "Modelo Sorria";
};
