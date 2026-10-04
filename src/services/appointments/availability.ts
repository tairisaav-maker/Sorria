import { rangesOverlap } from "@/lib/agenda/overlap";
import { getAgendaStore } from "@/lib/demo/agenda-store";

export function checkAvailability(input: {
  clinicId: string;
  professionalId: string;
  startAt: string;
  endAt: string;
  excludeAppointmentId?: string;
}): { available: boolean; conflictId?: string } {
  const start = new Date(input.startAt);
  const end = new Date(input.endAt);
  if (!(end > start)) {
    return { available: false };
  }

  for (const appt of getAgendaStore().appointments) {
    if (appt.clinic_id !== input.clinicId) continue;
    if (appt.professional_id !== input.professionalId) continue;
    if (appt.status === "cancelled") continue;
    if (
      input.excludeAppointmentId &&
      appt.id === input.excludeAppointmentId
    ) {
      continue;
    }
    if (rangesOverlap(start, end, appt.start_at, appt.end_at)) {
      return { available: false, conflictId: appt.id };
    }
  }

  return { available: true };
}
