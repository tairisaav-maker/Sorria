export type AnamnesisStatus = "draft" | "submitted" | "reviewed";
export type ClinicalEntryStatus = "draft" | "finalized";

export type ToothCondition =
  | "healthy"
  | "caries"
  | "restoration"
  | "missing"
  | "implant"
  | "crown"
  | "endodontics"
  | "extraction_indicated"
  | "other";

export type ClinicalAttachmentType =
  | "clinical_photo"
  | "radiograph"
  | "exam"
  | "pdf"
  | "other";

export type Anamnesis = {
  id: string;
  clinic_id: string;
  patient_id: string;
  template_version: number;
  status: AnamnesisStatus;
  answered_by: string | null;
  answered_at: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type AnamnesisAnswer = {
  id: string;
  anamnesis_id: string;
  clinic_id: string;
  question_key: string;
  value_bool: boolean | null;
  value_text: string | null;
  created_at: string;
  updated_at: string;
};

export type ClinicalEntry = {
  id: string;
  clinic_id: string;
  patient_id: string;
  appointment_id: string | null;
  performed_procedure_id: string | null;
  professional_id: string;
  status: ClinicalEntryStatus;
  chief_complaint: string | null;
  clinical_exam: string | null;
  procedure_done: string | null;
  conduct: string | null;
  guidance: string | null;
  next_step: string | null;
  related_teeth: number[];
  follow_up_required: boolean;
  follow_up_interval_days: number | null;
  version_number: number;
  signed_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ClinicalEntryVersion = {
  id: string;
  clinical_entry_id: string;
  clinic_id: string;
  version_number: number;
  snapshot_json: Record<string, unknown>;
  changed_by: string | null;
  change_reason: string | null;
  created_at: string;
};

export type OdontogramEntry = {
  id: string;
  clinic_id: string;
  patient_id: string;
  tooth_number: number;
  condition: ToothCondition;
  planned_procedure: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ClinicalAttachment = {
  id: string;
  clinic_id: string;
  patient_id: string;
  clinical_entry_id: string | null;
  type: ClinicalAttachmentType;
  storage_path: string;
  file_name: string;
  mime_type: string;
  file_size: number | null;
  description: string | null;
  patient_visible: boolean;
  uploaded_by: string | null;
  created_at: string;
  /** Demo-only payload (never public URL). */
  demo_content_base64?: string | null;
};

export type ClinicalAlert = {
  id: string;
  severity: "high" | "medium";
  label: string;
  detail: string;
};

export type ClinicalSummary = {
  alerts: ClinicalAlert[];
  anamnesisStatus: AnamnesisStatus | null;
  anamnesisLabel: string;
  lastEntry: ClinicalEntry | null;
  lastAppointment: { id: string; start_at: string; status: string } | null;
  nextAppointment: { id: string; start_at: string; status: string } | null;
  odontogramUpdatedAt: string | null;
  followUp: {
    required: boolean;
    intervalDays: number | null;
    pending: boolean;
  } | null;
};

export const ANAMNESIS_STATUS_LABELS: Record<AnamnesisStatus, string> = {
  draft: "Rascunho",
  submitted: "Respondida",
  reviewed: "Revisada",
};

export const TOOTH_CONDITION_LABELS: Record<ToothCondition, string> = {
  healthy: "Saudável",
  caries: "Cárie",
  restoration: "Restauração",
  missing: "Ausente",
  implant: "Implante",
  crown: "Coroa",
  endodontics: "Endodontia",
  extraction_indicated: "Extração indicada",
  other: "Outro",
};

export const ATTACHMENT_TYPE_LABELS: Record<ClinicalAttachmentType, string> = {
  clinical_photo: "Foto clínica",
  radiograph: "Radiografia",
  exam: "Exame",
  pdf: "PDF",
  other: "Outro",
};

export const FOLLOW_UP_PRESETS = [7, 15, 30, 60, 90] as const;
