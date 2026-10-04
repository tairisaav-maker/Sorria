import { assertPermission } from "@/lib/authz/guards";
import type { AuthzContext } from "@/lib/authz/can";
import {
  getAgendaStore,
  withPatient,
} from "@/lib/demo/agenda-store";
import { endOfDay, endOfMonth, endOfWeek, startOfDay, startOfMonth, startOfWeek } from "date-fns";
import type { AppointmentWithPatient } from "@/types/agenda";

export function listAppointments(
  ctx: AuthzContext,
  input: {
    from: string | Date;
    to: string | Date;
    professionalId?: string | "all";
  },
): AppointmentWithPatient[] {
  assertPermission(ctx, "appointments.view");
  const from = +new Date(input.from);
  const to = +new Date(input.to);

  return getAgendaStore()
    .appointments
    .filter((a) => {
      if (a.clinic_id !== ctx.clinicId) return false;
      if (
        input.professionalId &&
        input.professionalId !== "all" &&
        a.professional_id !== input.professionalId
      ) {
        return false;
      }
      const start = +new Date(a.start_at);
      return start >= from && start <= to;
    })
    .sort((a, b) => +new Date(a.start_at) - +new Date(b.start_at))
    .map(withPatient);
}

export function getAppointment(ctx: AuthzContext, id: string) {
  assertPermission(ctx, "appointments.view");
  const appt = getAgendaStore().appointments.find((a) => a.id === id);
  if (!appt || appt.clinic_id !== ctx.clinicId) {
    throw new Error("APPOINTMENT_NOT_FOUND");
  }
  return withPatient(appt);
}

export function listAppointmentsForPatient(ctx: AuthzContext, patientId: string) {
  assertPermission(ctx, "appointments.view");
  return getAgendaStore()
    .appointments
    .filter((a) => a.clinic_id === ctx.clinicId && a.patient_id === patientId)
    .sort((a, b) => +new Date(a.start_at) - +new Date(b.start_at))
    .map(withPatient);
}

export function getPatientNextAppointment(ctx: AuthzContext, patientId: string) {
  const now = Date.now();
  return (
    listAppointmentsForPatient(ctx, patientId).find(
      (a) =>
        a.status !== "cancelled" &&
        a.status !== "completed" &&
        a.status !== "no_show" &&
        +new Date(a.start_at) >= now,
    ) ?? null
  );
}

export function getPatientLastAppointment(ctx: AuthzContext, patientId: string) {
  const now = Date.now();
  const past = listAppointmentsForPatient(ctx, patientId)
    .filter(
      (a) =>
        a.status !== "cancelled" &&
        (+new Date(a.start_at) < now ||
          a.status === "completed" ||
          a.status === "no_show"),
    )
    .sort((a, b) => +new Date(b.start_at) - +new Date(a.start_at));
  return past[0] ?? null;
}

export function rangeForView(view: "day" | "week" | "month", anchor: Date) {
  if (view === "day") {
    return { from: startOfDay(anchor), to: endOfDay(anchor) };
  }
  if (view === "week") {
    return {
      from: startOfWeek(anchor, { weekStartsOn: 1 }),
      to: endOfWeek(anchor, { weekStartsOn: 1 }),
    };
  }
  return { from: startOfMonth(anchor), to: endOfMonth(anchor) };
}

export function countTodayAppointments(ctx: AuthzContext) {
  const today = new Date();
  const items = listAppointments(ctx, {
    from: startOfDay(today),
    to: endOfDay(today),
  });
  return {
    total: items.filter((a) => a.status !== "cancelled").length,
    confirmed: items.filter((a) => a.status === "confirmed").length,
  };
}
