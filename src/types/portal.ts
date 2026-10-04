export type PortalAccessStatus = "invited" | "active" | "revoked";

export type AppointmentRequestType =
  | "new_appointment"
  | "reschedule"
  | "cancellation";

export type RecordCopyStatus =
  | "requested"
  | "preparing"
  | "available"
  | "delivered"
  | "cancelled";

export type PatientPortalAccess = {
  id: string;
  clinic_id: string;
  patient_id: string;
  auth_user_id: string;
  status: PortalAccessStatus;
  invited_at: string | null;
  activated_at: string | null;
  revoked_at: string | null;
  created_at: string;
  updated_at: string;
};

export type RecordCopyRequest = {
  id: string;
  clinic_id: string;
  patient_id: string;
  status: RecordCopyStatus;
  requested_at: string;
  prepared_at: string | null;
  available_at: string | null;
  delivered_at: string | null;
  handled_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type PortalNotification = {
  id: string;
  clinic_id: string;
  patient_id: string;
  auth_user_id: string;
  kind: string;
  title: string;
  body: string | null;
  read_at: string | null;
  created_at: string;
};

export type PortalContext = {
  authUserId: string;
  clinicId: string;
  clinicName: string;
  patientId: string;
  patientName: string;
  preferredName: string | null;
  accessId: string;
  accesses: Array<{
    accessId: string;
    clinicId: string;
    clinicName: string;
    patientId: string;
    patientName: string;
  }>;
};

export const PORTAL_REQUEST_STATUS_LABELS: Record<string, string> = {
  new: "Enviada",
  under_review: "Em análise",
  proposed: "Horário proposto",
  approved: "Confirmada",
  rejected: "Recusada",
  cancelled: "Cancelada",
};

export const RECORD_COPY_STATUS_LABELS: Record<RecordCopyStatus, string> = {
  requested: "Solicitada",
  preparing: "Em preparação",
  available: "Disponível",
  delivered: "Entregue",
  cancelled: "Cancelada",
};

export const PORTAL_NAV = [
  { href: "/portal/inicio", label: "Início", icon: "home" },
  { href: "/portal/consultas", label: "Consultas", icon: "calendar" },
  { href: "/portal/tratamento", label: "Tratamento", icon: "activity" },
  { href: "/portal/prontuario", label: "Prontuário", icon: "file" },
  { href: "/portal/financeiro", label: "Financeiro", icon: "wallet" },
] as const;
