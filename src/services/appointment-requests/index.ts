import { assertPermission } from "@/lib/authz/guards";
import type { AuthzContext } from "@/lib/authz/can";
import { getMembership } from "@/lib/demo/authz-store";
import {
  getAgendaStore,
  withPatient,
  withRequestPatient,
  writeAgendaAudit,
} from "@/lib/demo/agenda-store";
import { getPatientRecord } from "@/lib/demo/patients-store";
import { assertRequestTransition } from "@/lib/agenda/state-machines";
import {
  createAppointmentRequestSchema,
  proposeAppointmentSchema,
  rejectAppointmentRequestSchema,
} from "@/lib/validations/agenda";
import { checkAvailability } from "@/services/appointments/availability";
import type {
  Appointment,
  AppointmentRequest,
  AppointmentRequestStatus,
} from "@/types/agenda";

export type RequestFilter = "pending" | "proposed" | "done" | "all";

function assertPatientTenant(ctx: AuthzContext, patientId: string) {
  const patient = getPatientRecord(patientId);
  if (!patient || patient.clinic_id !== ctx.clinicId) {
    throw new Error("PATIENT_TENANT_MISMATCH");
  }
}

function assertProfessionalTenant(ctx: AuthzContext, professionalId: string) {
  const membership = getMembership(professionalId, ctx.clinicId);
  if (
    !membership ||
    membership.status !== "active" ||
    (membership.role_key !== "owner" && membership.role_key !== "dentist")
  ) {
    throw new Error("PROFESSIONAL_TENANT_MISMATCH");
  }
}

export function listAppointmentRequests(
  ctx: AuthzContext,
  filter: RequestFilter = "pending",
) {
  assertPermission(ctx, "appointment_requests.view");

  const pending: AppointmentRequestStatus[] = ["new", "under_review"];
  const proposed: AppointmentRequestStatus[] = ["proposed"];
  const done: AppointmentRequestStatus[] = [
    "approved",
    "rejected",
    "cancelled",
  ];

  return getAgendaStore()
    .requests
    .filter((r) => {
      if (r.clinic_id !== ctx.clinicId) return false;
      if (filter === "pending") return pending.includes(r.status);
      if (filter === "proposed") return proposed.includes(r.status);
      if (filter === "done") return done.includes(r.status);
      return true;
    })
    .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
    .map(withRequestPatient);
}

export function countPendingRequests(ctx: AuthzContext) {
  return listAppointmentRequests(ctx, "pending").length;
}

export function getAppointmentRequest(ctx: AuthzContext, id: string) {
  assertPermission(ctx, "appointment_requests.view");
  const request = getAgendaStore().requests.find((r) => r.id === id);
  if (!request || request.clinic_id !== ctx.clinicId) {
    throw new Error("REQUEST_NOT_FOUND");
  }
  return withRequestPatient(request);
}

export function createAppointmentRequest(
  ctx: AuthzContext,
  raw: Record<string, unknown>,
) {
  assertPermission(ctx, "appointment_requests.manage");
  const parsed = createAppointmentRequestSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Dados inválidos");
  }
  assertPatientTenant(ctx, parsed.data.patient_id);

  const now = new Date().toISOString();
  const request: AppointmentRequest = {
    id: crypto.randomUUID(),
    clinic_id: ctx.clinicId,
    patient_id: parsed.data.patient_id,
    request_type: "new_appointment",
    related_appointment_id: null,
    requested_date: parsed.data.requested_date || null,
    preferred_period: parsed.data.preferred_period,
    reason: parsed.data.reason,
    custom_reason: parsed.data.custom_reason || null,
    notes: parsed.data.notes || null,
    status: "new",
    proposed_start_at: null,
    proposed_end_at: null,
    proposed_professional_id: null,
    reviewed_by: null,
    reviewed_at: null,
    rejection_reason: null,
    created_at: now,
    updated_at: now,
    cancelled_at: null,
  };

  getAgendaStore().requests.unshift(request);
  writeAgendaAudit(
    ctx.clinicId,
    ctx.userId,
    "appointment_request.created",
    "appointment_request",
    request.id,
    {},
  );
  return withRequestPatient(request);
}

export function reviewAppointmentRequest(ctx: AuthzContext, id: string) {
  assertPermission(ctx, "appointment_requests.manage");
  const store = getAgendaStore();
  const index = store.requests.findIndex((r) => r.id === id);
  if (index < 0 || store.requests[index].clinic_id !== ctx.clinicId) {
    throw new Error("REQUEST_NOT_FOUND");
  }
  const current = store.requests[index];
  assertRequestTransition(current.status, "under_review");
  const next: AppointmentRequest = {
    ...current,
    status: "under_review",
    reviewed_by: ctx.userId,
    reviewed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  store.requests[index] = next;
  writeAgendaAudit(
    ctx.clinicId,
    ctx.userId,
    "appointment_request.reviewed",
    "appointment_request",
    next.id,
    {},
  );
  return withRequestPatient(next);
}

export function proposeAppointmentTime(
  ctx: AuthzContext,
  id: string,
  raw: {
    proposed_start_at: string;
    proposed_end_at: string;
    proposed_professional_id: string;
  },
) {
  assertPermission(ctx, "appointment_requests.manage");
  const parsed = proposeAppointmentSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Dados inválidos");
  }

  const store = getAgendaStore();
  const index = store.requests.findIndex((r) => r.id === id);
  if (index < 0 || store.requests[index].clinic_id !== ctx.clinicId) {
    throw new Error("REQUEST_NOT_FOUND");
  }

  const current = store.requests[index];
  assertRequestTransition(current.status, "proposed");
  assertProfessionalTenant(ctx, parsed.data.proposed_professional_id);

  const availability = checkAvailability({
    clinicId: ctx.clinicId,
    professionalId: parsed.data.proposed_professional_id,
    startAt: parsed.data.proposed_start_at,
    endAt: parsed.data.proposed_end_at,
  });
  if (!availability.available) {
    throw new Error("SLOT_UNAVAILABLE");
  }

  // Proposta NÃO cria consulta
  const next: AppointmentRequest = {
    ...current,
    status: "proposed",
    proposed_start_at: new Date(parsed.data.proposed_start_at).toISOString(),
    proposed_end_at: new Date(parsed.data.proposed_end_at).toISOString(),
    proposed_professional_id: parsed.data.proposed_professional_id,
    reviewed_by: ctx.userId,
    reviewed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  store.requests[index] = next;
  writeAgendaAudit(
    ctx.clinicId,
    ctx.userId,
    "appointment_request.proposed",
    "appointment_request",
    next.id,
    {},
  );
  return withRequestPatient(next);
}

export function rejectAppointmentRequest(
  ctx: AuthzContext,
  id: string,
  raw: { rejection_reason?: string },
) {
  assertPermission(ctx, "appointment_requests.manage");
  const parsed = rejectAppointmentRequestSchema.safeParse(raw);
  const store = getAgendaStore();
  const index = store.requests.findIndex((r) => r.id === id);
  if (index < 0 || store.requests[index].clinic_id !== ctx.clinicId) {
    throw new Error("REQUEST_NOT_FOUND");
  }
  const current = store.requests[index];
  assertRequestTransition(current.status, "rejected");

  const next: AppointmentRequest = {
    ...current,
    status: "rejected",
    rejection_reason: parsed.success
      ? parsed.data.rejection_reason || null
      : null,
    reviewed_by: ctx.userId,
    reviewed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  store.requests[index] = next;
  writeAgendaAudit(
    ctx.clinicId,
    ctx.userId,
    "appointment_request.rejected",
    "appointment_request",
    next.id,
    {},
  );
  return withRequestPatient(next);
}

/**
 * Confirmação do paciente (simulada na clínica nesta fase).
 * Revalida disponibilidade; cria appointment atomicamente; request → approved.
 */
export function approveAppointmentRequest(ctx: AuthzContext, id: string) {
  assertPermission(ctx, "appointment_requests.manage");
  const store = getAgendaStore();
  const index = store.requests.findIndex((r) => r.id === id);
  if (index < 0 || store.requests[index].clinic_id !== ctx.clinicId) {
    throw new Error("REQUEST_NOT_FOUND");
  }

  const current = store.requests[index];
  assertRequestTransition(current.status, "approved");

  if (
    !current.proposed_start_at ||
    !current.proposed_end_at ||
    !current.proposed_professional_id
  ) {
    throw new Error("Proposta sem horário definido");
  }

  // Race condition: revalidar
  const availability = checkAvailability({
    clinicId: ctx.clinicId,
    professionalId: current.proposed_professional_id,
    startAt: current.proposed_start_at,
    endAt: current.proposed_end_at,
  });
  if (!availability.available) {
    throw new Error("SLOT_UNAVAILABLE");
  }

  const now = new Date().toISOString();
  const appointment: Appointment = {
    id: crypto.randomUUID(),
    clinic_id: ctx.clinicId,
    patient_id: current.patient_id,
    professional_id: current.proposed_professional_id,
    appointment_request_id: current.id,
    start_at: current.proposed_start_at,
    end_at: current.proposed_end_at,
    reason: current.reason,
    status: "confirmed",
    estimated_value: null,
    notes: current.notes,
    created_by: ctx.userId,
    cancelled_at: null,
    cancellation_reason: null,
    cancelled_by: null,
    created_at: now,
    updated_at: now,
  };

  const nextRequest: AppointmentRequest = {
    ...current,
    status: "approved",
    updated_at: now,
  };

  store.appointments.push(appointment);
  store.requests[index] = nextRequest;
  store.history.unshift({
    id: crypto.randomUUID(),
    appointment_id: appointment.id,
    clinic_id: ctx.clinicId,
    from_status: null,
    to_status: "confirmed",
    changed_by: ctx.userId,
    reason: "Confirmado via solicitação",
    created_at: now,
  });

  writeAgendaAudit(
    ctx.clinicId,
    ctx.userId,
    "appointment_request.approved",
    "appointment_request",
    nextRequest.id,
    { appointment_id: appointment.id },
  );
  writeAgendaAudit(
    ctx.clinicId,
    ctx.userId,
    "appointment.created",
    "appointment",
    appointment.id,
    { from_request: nextRequest.id },
  );

  return {
    request: withRequestPatient(nextRequest),
    appointment: withPatient(appointment),
  };
}

export function cancelAppointmentRequest(ctx: AuthzContext, id: string) {
  assertPermission(ctx, "appointment_requests.manage");
  const store = getAgendaStore();
  const index = store.requests.findIndex((r) => r.id === id);
  if (index < 0 || store.requests[index].clinic_id !== ctx.clinicId) {
    throw new Error("REQUEST_NOT_FOUND");
  }
  const current = store.requests[index];
  assertRequestTransition(current.status, "cancelled");
  const next: AppointmentRequest = {
    ...current,
    status: "cancelled",
    cancelled_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  store.requests[index] = next;
  writeAgendaAudit(
    ctx.clinicId,
    ctx.userId,
    "appointment_request.cancelled",
    "appointment_request",
    next.id,
    {},
  );
  return withRequestPatient(next);
}
