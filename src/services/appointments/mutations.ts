import { assertPermission } from "@/lib/authz/guards";
import type { AuthzContext } from "@/lib/authz/can";
import {
  getMembership,
  listClinicMembers,
  getProfile,
} from "@/lib/demo/authz-store";
import {
  getAgendaStore,
  withPatient,
  writeAgendaAudit,
} from "@/lib/demo/agenda-store";
import { getPatientRecord } from "@/lib/demo/patients-store";
import {
  assertAppointmentTransition,
} from "@/lib/agenda/state-machines";
import {
  cancelAppointmentSchema,
  changeAppointmentStatusSchema,
  createAppointmentSchema,
  rescheduleAppointmentSchema,
  type CreateAppointmentValues,
} from "@/lib/validations/agenda";
import { checkAvailability } from "@/services/appointments/availability";
import type {
  Appointment,
  AppointmentStatus,
  AppointmentStatusHistory,
} from "@/types/agenda";

function assertSameClinicPatient(ctx: AuthzContext, patientId: string) {
  const patient = getPatientRecord(patientId);
  if (!patient || patient.clinic_id !== ctx.clinicId) {
    throw new Error("PATIENT_TENANT_MISMATCH");
  }
  return patient;
}

function assertSameClinicProfessional(
  ctx: AuthzContext,
  professionalId: string,
) {
  const membership = getMembership(professionalId, ctx.clinicId);
  if (!membership || membership.status !== "active") {
    throw new Error("PROFESSIONAL_TENANT_MISMATCH");
  }
  if (
    membership.role_key !== "owner" &&
    membership.role_key !== "dentist"
  ) {
    // secretaries can be created_by but not professional performing care by default
    // allow owner/dentist only as professional_id
    throw new Error("PROFESSIONAL_TENANT_MISMATCH");
  }
  if (!getProfile(professionalId)) {
    throw new Error("PROFESSIONAL_TENANT_MISMATCH");
  }
  return membership;
}

function pushHistory(
  appointment: Appointment,
  from: AppointmentStatus | null,
  to: AppointmentStatus,
  changedBy: string,
  reason?: string | null,
) {
  const entry: AppointmentStatusHistory = {
    id: crypto.randomUUID(),
    appointment_id: appointment.id,
    clinic_id: appointment.clinic_id,
    from_status: from,
    to_status: to,
    changed_by: changedBy,
    reason: reason ?? null,
    created_at: new Date().toISOString(),
  };
  getAgendaStore().history.unshift(entry);
}

export function createAppointment(
  ctx: AuthzContext,
  raw: CreateAppointmentValues & { clinic_id?: string },
) {
  assertPermission(ctx, "appointments.create");
  if (raw.clinic_id && raw.clinic_id !== ctx.clinicId) {
    throw new Error("AUTHORIZATION_DENIED");
  }

  const parsed = createAppointmentSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Dados inválidos");
  }

  const values = parsed.data;
  assertSameClinicPatient(ctx, values.patient_id);
  assertSameClinicProfessional(ctx, values.professional_id);

  const availability = checkAvailability({
    clinicId: ctx.clinicId,
    professionalId: values.professional_id,
    startAt: values.start_at,
    endAt: values.end_at,
  });
  if (!availability.available) {
    throw new Error("SLOT_UNAVAILABLE");
  }

  const now = new Date().toISOString();
  const appointment: Appointment = {
    id: crypto.randomUUID(),
    clinic_id: ctx.clinicId,
    patient_id: values.patient_id,
    professional_id: values.professional_id,
    appointment_request_id: null,
    start_at: new Date(values.start_at).toISOString(),
    end_at: new Date(values.end_at).toISOString(),
    reason: values.reason?.trim() || null,
    status: "scheduled",
    estimated_value:
      typeof values.estimated_value === "number" &&
      !Number.isNaN(values.estimated_value)
        ? values.estimated_value
        : null,
    notes: values.notes?.trim() || null,
    created_by: ctx.userId,
    cancelled_at: null,
    cancellation_reason: null,
    cancelled_by: null,
    created_at: now,
    updated_at: now,
  };

  getAgendaStore().appointments.push(appointment);
  pushHistory(appointment, null, "scheduled", ctx.userId);
  writeAgendaAudit(
    ctx.clinicId,
    ctx.userId,
    "appointment.created",
    "appointment",
    appointment.id,
    {},
  );

  return withPatient(appointment);
}

export function rescheduleAppointment(
  ctx: AuthzContext,
  appointmentId: string,
  raw: { start_at: string; end_at: string; professional_id: string },
) {
  assertPermission(ctx, "appointments.update");
  const store = getAgendaStore();
  const index = store.appointments.findIndex((a) => a.id === appointmentId);
  if (index < 0 || store.appointments[index].clinic_id !== ctx.clinicId) {
    throw new Error("APPOINTMENT_NOT_FOUND");
  }

  const current = store.appointments[index];
  if (current.status === "cancelled" || current.status === "completed") {
    throw new Error("Transição de consulta inválida");
  }

  const parsed = rescheduleAppointmentSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Dados inválidos");
  }

  assertSameClinicProfessional(ctx, parsed.data.professional_id);
  const availability = checkAvailability({
    clinicId: ctx.clinicId,
    professionalId: parsed.data.professional_id,
    startAt: parsed.data.start_at,
    endAt: parsed.data.end_at,
    excludeAppointmentId: appointmentId,
  });
  if (!availability.available) {
    throw new Error("SLOT_UNAVAILABLE");
  }

  const previous = {
    start_at: current.start_at,
    end_at: current.end_at,
    professional_id: current.professional_id,
  };

  const next: Appointment = {
    ...current,
    start_at: new Date(parsed.data.start_at).toISOString(),
    end_at: new Date(parsed.data.end_at).toISOString(),
    professional_id: parsed.data.professional_id,
    updated_at: new Date().toISOString(),
  };
  store.appointments[index] = next;

  writeAgendaAudit(
    ctx.clinicId,
    ctx.userId,
    "appointment.rescheduled",
    "appointment",
    next.id,
    { previous, next: {
      start_at: next.start_at,
      end_at: next.end_at,
      professional_id: next.professional_id,
    } },
  );

  return withPatient(next);
}

export function changeAppointmentStatus(
  ctx: AuthzContext,
  appointmentId: string,
  raw: { status: AppointmentStatus; reason?: string },
) {
  if (raw.status === "cancelled") {
    assertPermission(ctx, "appointments.cancel");
  } else {
    assertPermission(ctx, "appointments.update");
  }

  const store = getAgendaStore();
  const index = store.appointments.findIndex((a) => a.id === appointmentId);
  if (index < 0 || store.appointments[index].clinic_id !== ctx.clinicId) {
    throw new Error("APPOINTMENT_NOT_FOUND");
  }

  const parsed = changeAppointmentStatusSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Dados inválidos");
  }

  const current = store.appointments[index];
  assertAppointmentTransition(current.status, parsed.data.status);

  const next: Appointment = {
    ...current,
    status: parsed.data.status,
    updated_at: new Date().toISOString(),
    cancelled_at:
      parsed.data.status === "cancelled"
        ? new Date().toISOString()
        : current.cancelled_at,
    cancelled_by:
      parsed.data.status === "cancelled" ? ctx.userId : current.cancelled_by,
    cancellation_reason:
      parsed.data.status === "cancelled"
        ? parsed.data.reason || current.cancellation_reason
        : current.cancellation_reason,
  };

  store.appointments[index] = next;
  pushHistory(
    next,
    current.status,
    parsed.data.status,
    ctx.userId,
    parsed.data.reason,
  );
  writeAgendaAudit(
    ctx.clinicId,
    ctx.userId,
    "appointment.status_changed",
    "appointment",
    next.id,
    { from: current.status, to: parsed.data.status },
  );

  return withPatient(next);
}

export function cancelAppointment(
  ctx: AuthzContext,
  appointmentId: string,
  raw: { cancellation_reason?: string },
) {
  const parsed = cancelAppointmentSchema.safeParse(raw);
  return changeAppointmentStatus(ctx, appointmentId, {
    status: "cancelled",
    reason: parsed.success ? parsed.data.cancellation_reason : "",
  });
}

export function listClinicProfessionals(ctx: AuthzContext) {
  return listClinicMembers(ctx.clinicId)
    .filter(
      (m) =>
        m.status === "active" &&
        (m.role_key === "owner" || m.role_key === "dentist"),
    )
    .map((m) => {
      const profile = getProfile(m.user_id);
      return {
        id: m.user_id,
        full_name: profile?.full_name ?? "Profissional",
        role_key: m.role_key,
      };
    });
}
