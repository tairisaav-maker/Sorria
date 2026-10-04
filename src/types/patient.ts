export type PatientStatus = "active" | "inactive" | "archived";

export type ReferralSource =
  | "Instagram"
  | "Google"
  | "Indicação"
  | "Paciente antigo"
  | "Passou em frente"
  | "Outro";

export type Patient = {
  id: string;
  clinic_id: string;
  full_name: string;
  preferred_name: string | null;
  cpf: string | null;
  cpf_normalized: string | null;
  birth_date: string | null;
  phone: string | null;
  phone_normalized: string | null;
  secondary_phone: string | null;
  secondary_phone_normalized: string | null;
  email: string | null;
  email_normalized: string | null;
  postal_code: string | null;
  street: string | null;
  number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  guardian_name: string | null;
  guardian_phone: string | null;
  guardian_relationship: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  emergency_contact_relationship: string | null;
  referral_source: string | null;
  administrative_notes: string | null;
  status: PatientStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

export type PatientListItem = Pick<
  Patient,
  | "id"
  | "clinic_id"
  | "full_name"
  | "preferred_name"
  | "phone"
  | "phone_normalized"
  | "birth_date"
  | "status"
  | "updated_at"
  | "created_at"
>;

export type PatientSort =
  | "name_asc"
  | "name_desc"
  | "newest"
  | "updated";

export type PatientStatusFilter = "all" | PatientStatus;

export type DuplicateMatch = {
  patient: Patient;
  reasons: Array<"cpf" | "phone" | "email" | "name_birth">;
  severity: "high" | "medium";
};

export const REFERRAL_SOURCES: ReferralSource[] = [
  "Instagram",
  "Google",
  "Indicação",
  "Paciente antigo",
  "Passou em frente",
  "Outro",
];

export const PATIENT_STATUS_LABELS: Record<PatientStatus, string> = {
  active: "Ativo",
  inactive: "Inativo",
  archived: "Arquivado",
};
