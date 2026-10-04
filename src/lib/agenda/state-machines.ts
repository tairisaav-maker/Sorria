import type {
  AppointmentRequestStatus,
  AppointmentStatus,
} from "@/types/agenda";

const APPOINTMENT_TRANSITIONS: Record<
  AppointmentStatus,
  AppointmentStatus[]
> = {
  scheduled: ["confirmed", "arrived", "cancelled", "no_show"],
  confirmed: ["arrived", "cancelled", "no_show"],
  arrived: ["in_progress", "cancelled", "no_show"],
  in_progress: ["completed", "cancelled"],
  completed: [],
  no_show: [],
  cancelled: [],
};

const REQUEST_TRANSITIONS: Record<
  AppointmentRequestStatus,
  AppointmentRequestStatus[]
> = {
  new: ["under_review", "proposed", "rejected", "cancelled"],
  under_review: ["proposed", "rejected", "cancelled"],
  proposed: ["approved", "rejected", "cancelled", "under_review"],
  approved: [],
  rejected: [],
  cancelled: [],
};

export function canTransitionAppointment(
  from: AppointmentStatus,
  to: AppointmentStatus,
): boolean {
  if (from === to) return true;
  return APPOINTMENT_TRANSITIONS[from].includes(to);
}

export function canTransitionRequest(
  from: AppointmentRequestStatus,
  to: AppointmentRequestStatus,
): boolean {
  if (from === to) return true;
  return REQUEST_TRANSITIONS[from].includes(to);
}

export function assertAppointmentTransition(
  from: AppointmentStatus,
  to: AppointmentStatus,
) {
  if (!canTransitionAppointment(from, to)) {
    throw new Error(`Transição de consulta inválida: ${from} → ${to}`);
  }
}

export function assertRequestTransition(
  from: AppointmentRequestStatus,
  to: AppointmentRequestStatus,
) {
  if (!canTransitionRequest(from, to)) {
    throw new Error(`Transição de solicitação inválida: ${from} → ${to}`);
  }
}
