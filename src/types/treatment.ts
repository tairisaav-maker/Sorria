export type TreatmentPlanStatus =
  | "draft"
  | "presented"
  | "accepted"
  | "in_progress"
  | "completed"
  | "rejected";

export type TreatmentItemStatus =
  | "planned"
  | "accepted"
  | "in_progress"
  | "completed"
  | "cancelled";

export type DiscountType = "percent" | "fixed";

/** Valores monetários em centavos (inteiro) — nunca float. */
export type TreatmentPlan = {
  id: string;
  clinic_id: string;
  patient_id: string;
  title: string;
  description: string | null;
  notes: string | null;
  status: TreatmentPlanStatus;
  version_number: number;
  subtotal_cents: number;
  discount_type: DiscountType | null;
  discount_value_cents: number | null;
  /** Para percent: 0–10000 = 0.00%–100.00% em basis points? Não — percent armazenado como inteiro 0–100 */
  discount_percent: number | null;
  total_cents: number;
  valid_until: string | null;
  created_by: string | null;
  presented_by: string | null;
  presented_at: string | null;
  accepted_at: string | null;
  accepted_version: number | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

export type TreatmentItem = {
  id: string;
  clinic_id: string;
  treatment_plan_id: string;
  patient_id: string;
  procedure_name: string;
  description: string | null;
  tooth_numbers: number[];
  quantity: number;
  unit_price_cents: number;
  total_price_cents: number;
  status: TreatmentItemStatus;
  sort_order: number;
  source_odontogram_entry_id: string | null;
  source_clinical_entry_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type TreatmentPlanVersion = {
  id: string;
  treatment_plan_id: string;
  clinic_id: string;
  version_number: number;
  snapshot_json: Record<string, unknown>;
  presented_by: string | null;
  presented_at: string | null;
  change_reason: string | null;
  created_at: string;
};

export type TreatmentPlanWithItems = TreatmentPlan & {
  items: TreatmentItem[];
  progress: { completed: number; total: number; percent: number };
  is_expired: boolean;
};

export const PLAN_STATUS_LABELS: Record<TreatmentPlanStatus, string> = {
  draft: "Rascunho",
  presented: "Apresentado",
  accepted: "Aceito",
  in_progress: "Em andamento",
  completed: "Concluído",
  rejected: "Recusado",
};

export const ITEM_STATUS_LABELS: Record<TreatmentItemStatus, string> = {
  planned: "Planejado",
  accepted: "Aceito",
  in_progress: "Em andamento",
  completed: "Concluído",
  cancelled: "Cancelado",
};

export const PROCEDURE_SUGGESTIONS = [
  "Avaliação",
  "Profilaxia",
  "Restauração",
  "Extração",
  "Tratamento endodôntico",
  "Coroa",
  "Implante",
  "Clareamento",
  "Outro",
] as const;

export const ACTIVE_PLAN_STATUSES: TreatmentPlanStatus[] = [
  "draft",
  "presented",
  "accepted",
  "in_progress",
];
