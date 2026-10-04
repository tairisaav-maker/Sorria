export type PreferredPeriod = "morning" | "afternoon" | "evening";

export type AppointmentRequestStatus =
  | "new"
  | "under_review"
  | "proposed"
  | "approved"
  | "rejected"
  | "cancelled";

export type AppointmentStatus =
  | "scheduled"
  | "confirmed"
  | "arrived"
  | "in_progress"
  | "completed"
  | "no_show"
  | "cancelled";

export type AppointmentRequestReason =
  | "Avaliação"
  | "Limpeza"
  | "Retorno"
  | "Dor/Urgência"
  | "Continuação de tratamento"
  | "Outro";

export type AppointmentRequest = {
  id: string;
  clinic_id: string;
  patient_id: string;
  requested_date: string | null;
  preferred_period: PreferredPeriod;
  reason: string;
  custom_reason: string | null;
  notes: string | null;
  status: AppointmentRequestStatus;
  proposed_start_at: string | null;
  proposed_end_at: string | null;
  proposed_professional_id: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
  cancelled_at: string | null;
};

export type Appointment = {
  id: string;
  clinic_id: string;
  patient_id: string;
  professional_id: string;
  appointment_request_id: string | null;
  start_at: string;
  end_at: string;
  reason: string | null;
  status: AppointmentStatus;
  estimated_value: number | null;
  notes: string | null;
  created_by: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  cancelled_by: string | null;
  created_at: string;
  updated_at: string;
};

export type AppointmentStatusHistory = {
  id: string;
  appointment_id: string;
  clinic_id: string;
  from_status: AppointmentStatus | null;
  to_status: AppointmentStatus;
  changed_by: string | null;
  reason: string | null;
  created_at: string;
};

export type AppointmentWithPatient = Appointment & {
  patient_name: string;
  patient_phone: string | null;
  professional_name: string;
};

export type AppointmentRequestWithPatient = AppointmentRequest & {
  patient_name: string;
  patient_phone: string | null;
};

export const PERIOD_LABELS: Record<PreferredPeriod, string> = {
  morning: "Manhã",
  afternoon: "Tarde",
  evening: "Noite",
};

export const REQUEST_STATUS_LABELS: Record<AppointmentRequestStatus, string> = {
  new: "Nova",
  under_review: "Em análise",
  proposed: "Horário proposto",
  approved: "Aprovada",
  rejected: "Recusada",
  cancelled: "Cancelada",
};

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  scheduled: "Agendada",
  confirmed: "Confirmada",
  arrived: "Chegou",
  in_progress: "Em atendimento",
  completed: "Concluída",
  no_show: "Faltou",
  cancelled: "Cancelada",
};

export const REQUEST_REASONS: AppointmentRequestReason[] = [
  "Avaliação",
  "Limpeza",
  "Retorno",
  "Dor/Urgência",
  "Continuação de tratamento",
  "Outro",
];

export const DURATION_PRESETS_MIN = [30, 45, 60, 90] as const;
