import {
  getAgendaStore,
  withPatient,
  withRequestPatient,
  writeAgendaAudit,
} from "@/lib/demo/agenda-store";
import { getClinicalStore } from "@/lib/demo/clinical-store";
import { getFinanceStore } from "@/lib/demo/finance-store";
import { getPatientRecord } from "@/lib/demo/patients-store";
import {
  PORTAL_DEMO_USERS,
  getPortalStore,
  writePortalAudit,
} from "@/lib/demo/portal-store";
import { getTreatmentsStore } from "@/lib/demo/treatments-store";
import {
  assertAppointmentTransition,
  assertRequestTransition,
} from "@/lib/agenda/state-machines";
import { formatBRL } from "@/lib/money";
import {
  portalAlternativeSchema,
  portalCancelRequestSchema,
  portalChangeRequestSchema,
  portalProfileUpdateSchema,
  portalRequestSchema,
} from "@/lib/validations/portal";
import { checkAvailability } from "@/services/appointments/availability";
import {
  assertPortalOwnsResource,
  getPortalContext,
  type PortalSession,
} from "@/services/portal/context";
import type { Appointment, AppointmentRequest } from "@/types/agenda";
import { ACTIVE_PLAN_STATUSES } from "@/types/treatment";
import type { PortalContext } from "@/types/portal";

function ctxOf(session: PortalSession) {
  return getPortalContext(session);
}

export { getPortalContext };
export type { PortalSession };

export function getPortalHome(session: PortalSession) {
  const ctx = ctxOf(session);
  const upcoming = getMyAppointments(session, "upcoming");
  const next = upcoming[0] ?? null;
  const treatment = getMyTreatment(session);
  const finance = getMyFinancialSummary(session);
  const requests = getMyAppointmentRequests(session);
  const proposed = requests.filter((r) => r.status === "proposed");
  const notifications = getMyNotifications(session);

  const attention: Array<{ id: string; title: string; href: string }> = [];
  if (next?.status === "scheduled") {
    attention.push({
      id: "confirm",
      title: "Confirmar presença na próxima consulta",
      href: "/portal/consultas",
    });
  }
  for (const p of proposed) {
    attention.push({
      id: `prop-${p.id}`,
      title: "A clínica propôs um horário",
      href: "/portal/consultas?tab=solicitacoes",
    });
  }
  if (finance.overdue_cents > 0) {
    attention.push({
      id: "overdue",
      title: `Pagamento vencido: ${formatBRL(finance.overdue_cents)}`,
      href: "/portal/financeiro",
    });
  }
  const docs = getMyDocuments(session);
  if (docs.some((d) => !d.seen)) {
    attention.push({
      id: "doc",
      title: "Documento disponibilizado para você",
      href: "/portal/documentos",
    });
  }

  return {
    context: ctx,
    nextAppointment: next,
    treatmentSummary: treatment.current
      ? {
          title: treatment.current.title,
          status: treatment.current.status,
          completed: treatment.current.progress.completed,
          total: treatment.current.progress.total,
          percent: treatment.current.progress.percent,
        }
      : null,
    nextPayment: finance.next_due,
    attention,
    unreadNotifications: notifications.filter((n) => !n.read_at).length,
  };
}

export function getMyAppointments(
  session: PortalSession,
  scope: "upcoming" | "history" = "upcoming",
) {
  const ctx = ctxOf(session);
  const now = Date.now();
  return getAgendaStore()
    .appointments
    .filter((a) => a.clinic_id === ctx.clinicId && a.patient_id === ctx.patientId)
    .filter((a) => {
      if (scope === "upcoming") {
        return (
          +new Date(a.start_at) >= now - 2 * 3600_000 &&
          !["cancelled", "completed", "no_show"].includes(a.status)
        );
      }
      return (
        ["completed", "no_show", "cancelled"].includes(a.status) ||
        +new Date(a.start_at) < now
      );
    })
    .sort((a, b) =>
      scope === "upcoming"
        ? +new Date(a.start_at) - +new Date(b.start_at)
        : +new Date(b.start_at) - +new Date(a.start_at),
    )
    .map(withPatient);
}

export function confirmMyAppointment(
  session: PortalSession,
  appointmentId: string,
) {
  const ctx = ctxOf(session);
  const store = getAgendaStore();
  const index = store.appointments.findIndex((a) => a.id === appointmentId);
  if (index < 0) throw new Error("PORTAL_FORBIDDEN");
  const current = store.appointments[index]!;
  assertPortalOwnsResource(ctx, current);
  assertAppointmentTransition(current.status, "confirmed");
  if (current.status !== "scheduled") {
    throw new Error("Só é possível confirmar consultas agendadas.");
  }
  const next: Appointment = {
    ...current,
    status: "confirmed",
    updated_at: new Date().toISOString(),
  };
  store.appointments[index] = next;
  store.history.unshift({
    id: crypto.randomUUID(),
    appointment_id: next.id,
    clinic_id: next.clinic_id,
    from_status: current.status,
    to_status: "confirmed",
    changed_by: ctx.authUserId,
    reason: "confirmed_by_patient",
    created_at: new Date().toISOString(),
  });
  writePortalAudit(
    ctx.clinicId,
    ctx.authUserId,
    "patient.appointment_confirmed",
    "appointment",
    next.id,
    { confirmed_by_patient: true },
  );
  return withPatient(next);
}

export function requestAppointmentChange(
  session: PortalSession,
  raw: Record<string, unknown>,
) {
  const ctx = ctxOf(session);
  const parsed = portalChangeRequestSchema.safeParse(raw);
  if (!parsed.success) throw new Error("Dados inválidos");
  const appt = getAgendaStore().appointments.find(
    (a) => a.id === parsed.data.appointment_id,
  );
  if (!appt) throw new Error("PORTAL_FORBIDDEN");
  assertPortalOwnsResource(ctx, appt);

  const now = new Date().toISOString();
  const request: AppointmentRequest = {
    id: crypto.randomUUID(),
    clinic_id: ctx.clinicId,
    patient_id: ctx.patientId,
    request_type: "reschedule",
    related_appointment_id: appt.id,
    requested_date: parsed.data.requested_date || null,
    preferred_period: parsed.data.preferred_period ?? "morning",
    reason: appt.reason || "Retorno",
    custom_reason: null,
    notes:
      [
        `Tipo: ${parsed.data.change_kind}`,
        parsed.data.notes || "",
      ]
        .filter(Boolean)
        .join(" — ") || null,
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
  writePortalAudit(
    ctx.clinicId,
    ctx.authUserId,
    "patient.appointment_change_requested",
    "appointment_request",
    request.id,
    { appointment_id: appt.id },
  );
  // Appointment NÃO muda
  return withRequestPatient(request);
}

export function requestAppointmentCancellation(
  session: PortalSession,
  raw: Record<string, unknown>,
) {
  const ctx = ctxOf(session);
  const parsed = portalCancelRequestSchema.safeParse(raw);
  if (!parsed.success) throw new Error("Dados inválidos");
  const appt = getAgendaStore().appointments.find(
    (a) => a.id === parsed.data.appointment_id,
  );
  if (!appt) throw new Error("PORTAL_FORBIDDEN");
  assertPortalOwnsResource(ctx, appt);

  const now = new Date().toISOString();
  const request: AppointmentRequest = {
    id: crypto.randomUUID(),
    clinic_id: ctx.clinicId,
    patient_id: ctx.patientId,
    request_type: "cancellation",
    related_appointment_id: appt.id,
    requested_date: appt.start_at.slice(0, 10),
    preferred_period: "morning",
    reason: "Outro",
    custom_reason: "Solicitação de cancelamento",
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
  writePortalAudit(
    ctx.clinicId,
    ctx.authUserId,
    "patient.appointment_cancellation_requested",
    "appointment_request",
    request.id,
    { appointment_id: appt.id },
  );
  return withRequestPatient(request);
}

export function createMyAppointmentRequest(
  session: PortalSession,
  raw: Record<string, unknown>,
) {
  const ctx = ctxOf(session);
  const parsed = portalRequestSchema.safeParse(raw);
  if (!parsed.success) throw new Error("Dados inválidos");
  const now = new Date().toISOString();
  const request: AppointmentRequest = {
    id: crypto.randomUUID(),
    clinic_id: ctx.clinicId,
    patient_id: ctx.patientId,
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
  writePortalAudit(
    ctx.clinicId,
    ctx.authUserId,
    "patient.appointment_request_created",
    "appointment_request",
    request.id,
    {},
  );
  return withRequestPatient(request);
}

export function getMyAppointmentRequests(session: PortalSession) {
  const ctx = ctxOf(session);
  return getAgendaStore()
    .requests
    .filter((r) => r.clinic_id === ctx.clinicId && r.patient_id === ctx.patientId)
    .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
    .map(withRequestPatient);
}

export function confirmProposedAppointment(
  session: PortalSession,
  requestId: string,
) {
  const ctx = ctxOf(session);
  const store = getAgendaStore();
  const index = store.requests.findIndex((r) => r.id === requestId);
  if (index < 0) throw new Error("PORTAL_FORBIDDEN");
  const current = store.requests[index]!;
  assertPortalOwnsResource(ctx, current);
  assertRequestTransition(current.status, "approved");

  if (
    !current.proposed_start_at ||
    !current.proposed_end_at ||
    !current.proposed_professional_id
  ) {
    throw new Error("Proposta sem horário definido");
  }

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
    patient_id: ctx.patientId,
    professional_id: current.proposed_professional_id,
    appointment_request_id: current.id,
    start_at: current.proposed_start_at,
    end_at: current.proposed_end_at,
    reason: current.reason,
    status: "confirmed",
    estimated_value: null,
    notes: current.notes,
    created_by: ctx.authUserId,
    cancelled_at: null,
    cancellation_reason: null,
    cancelled_by: null,
    created_at: now,
    updated_at: now,
  };

  store.requests[index] = { ...current, status: "approved", updated_at: now };
  store.appointments.push(appointment);
  store.history.unshift({
    id: crypto.randomUUID(),
    appointment_id: appointment.id,
    clinic_id: ctx.clinicId,
    from_status: null,
    to_status: "confirmed",
    changed_by: ctx.authUserId,
    reason: "Confirmado pelo paciente no Portal",
    created_at: now,
  });

  writePortalAudit(
    ctx.clinicId,
    ctx.authUserId,
    "patient.proposed_time_confirmed",
    "appointment_request",
    current.id,
    { appointment_id: appointment.id },
  );
  writeAgendaAudit(
    ctx.clinicId,
    ctx.authUserId,
    "appointment.created",
    "appointment",
    appointment.id,
    { from_request: current.id, source: "portal" },
  );

  return {
    request: withRequestPatient(store.requests[index]!),
    appointment: withPatient(appointment),
  };
}

export function requestAnotherAppointmentTime(
  session: PortalSession,
  raw: Record<string, unknown>,
) {
  const ctx = ctxOf(session);
  const parsed = portalAlternativeSchema.safeParse(raw);
  if (!parsed.success) throw new Error("Dados inválidos");
  const store = getAgendaStore();
  const index = store.requests.findIndex((r) => r.id === parsed.data.request_id);
  if (index < 0) throw new Error("PORTAL_FORBIDDEN");
  const current = store.requests[index]!;
  assertPortalOwnsResource(ctx, current);
  assertRequestTransition(current.status, "under_review");

  const next: AppointmentRequest = {
    ...current,
    status: "under_review",
    proposed_start_at: null,
    proposed_end_at: null,
    proposed_professional_id: null,
    requested_date: parsed.data.requested_date || current.requested_date,
    preferred_period: parsed.data.preferred_period,
    notes: parsed.data.notes || current.notes,
    updated_at: new Date().toISOString(),
  };
  store.requests[index] = next;
  writePortalAudit(
    ctx.clinicId,
    ctx.authUserId,
    "patient.alternative_time_requested",
    "appointment_request",
    next.id,
    {},
  );
  return withRequestPatient(next);
}

export function getMyTreatment(session: PortalSession) {
  const ctx = ctxOf(session);
  const plans = getTreatmentsStore()
    .plans
    .filter((p) => p.clinic_id === ctx.clinicId && p.patient_id === ctx.patientId)
    .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));

  const withProgress = plans.map((plan) => {
    const items = getTreatmentsStore()
      .items
      .filter((i) => i.treatment_plan_id === plan.id)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((i) => ({
        id: i.id,
        procedure_name: i.procedure_name,
        tooth_numbers: i.tooth_numbers,
        status: i.status,
        // sem notes internas / description clínica
      }));
    const relevant = items.filter((i) => i.status !== "cancelled");
    const completed = relevant.filter((i) => i.status === "completed").length;
    const total = relevant.length;
    return {
      id: plan.id,
      title: plan.title,
      status: plan.status,
      total_cents: plan.total_cents,
      items,
      progress: {
        completed,
        total,
        percent: total === 0 ? 0 : Math.round((completed / total) * 100),
      },
    };
  });

  const current =
    withProgress.find((p) => p.status === "in_progress") ||
    withProgress.find((p) => p.status === "accepted") ||
    withProgress.find((p) => ACTIVE_PLAN_STATUSES.includes(p.status as never)) ||
    null;

  return { current, history: withProgress };
}

export function getMyVisibleClinicalData(session: PortalSession) {
  ctxOf(session);
  // Visão própria — sem evoluções internas / anamnese completa automática
  return {
    message:
      "Aqui você encontra informações e documentos liberados pela clínica.",
    documentsCount: getMyDocuments(session).length,
    copyRequests: getMyRecordCopyRequests(session),
  };
}

export function getMyDocuments(session: PortalSession) {
  const ctx = ctxOf(session);
  return getClinicalStore()
    .attachments
    .filter(
      (a) =>
        a.clinic_id === ctx.clinicId &&
        a.patient_id === ctx.patientId &&
        a.patient_visible === true,
    )
    .map((a) => ({
      id: a.id,
      file_name: a.file_name,
      type: a.type,
      description: a.description,
      created_at: a.created_at,
      seen: false,
    }));
}

export function getMyDocumentAccess(
  session: PortalSession,
  attachmentId: string,
) {
  const ctx = ctxOf(session);
  const att = getClinicalStore().attachments.find((a) => a.id === attachmentId);
  if (
    !att ||
    att.clinic_id !== ctx.clinicId ||
    att.patient_id !== ctx.patientId ||
    !att.patient_visible
  ) {
    throw new Error("PORTAL_FORBIDDEN");
  }
  writePortalAudit(
    ctx.clinicId,
    ctx.authUserId,
    "patient.document_viewed",
    "attachment",
    att.id,
    {},
  );
  // Signed URL simulada — bucket permanece privado
  return {
    id: att.id,
    file_name: att.file_name,
    mime_type: att.mime_type,
    signed_url: `/api/demo/portal?resource=document-content&id=${att.id}`,
    expires_in_seconds: 120,
  };
}

export function createRecordCopyRequest(session: PortalSession) {
  const ctx = ctxOf(session);
  const now = new Date().toISOString();
  const req = {
    id: crypto.randomUUID(),
    clinic_id: ctx.clinicId,
    patient_id: ctx.patientId,
    status: "requested" as const,
    requested_at: now,
    prepared_at: null,
    available_at: null,
    delivered_at: null,
    handled_by: null,
    notes: null,
    created_at: now,
    updated_at: now,
  };
  getPortalStore().copyRequests.unshift(req);
  writePortalAudit(
    ctx.clinicId,
    ctx.authUserId,
    "patient.record_copy_requested",
    "record_copy_request",
    req.id,
    {},
  );
  return req;
}

export function getMyRecordCopyRequests(session: PortalSession) {
  const ctx = ctxOf(session);
  return getPortalStore().copyRequests.filter(
    (r) => r.clinic_id === ctx.clinicId && r.patient_id === ctx.patientId,
  );
}

export function getMyFinancialSummary(session: PortalSession) {
  const ctx = ctxOf(session);
  const txs = getFinanceStore().transactions.filter(
    (t) =>
      t.clinic_id === ctx.clinicId &&
      t.patient_id === ctx.patientId &&
      t.type === "income" &&
      !t.cancelled_at,
  );
  let receivable = 0;
  let overdue = 0;
  let nextDue: { due_date: string; balance_cents: number } | null = null;
  const today = new Date().toISOString().slice(0, 10);

  for (const tx of txs) {
    const installments = getFinanceStore().installments.filter(
      (i) => i.financial_transaction_id === tx.id,
    );
    for (const inst of installments) {
      const paid = getFinanceStore()
        .payments
        .filter(
          (p) =>
            p.payment_installment_id === inst.id && !p.reversed_at,
        )
        .reduce((s, p) => s + p.amount_cents, 0);
      const balance = Math.max(0, inst.amount_cents - paid);
      if (balance <= 0) continue;
      receivable += balance;
      if (inst.due_date < today) overdue += balance;
      if (
        !nextDue ||
        inst.due_date < nextDue.due_date
      ) {
        nextDue = { due_date: inst.due_date, balance_cents: balance };
      }
    }
  }

  return {
    receivable_cents: receivable,
    overdue_cents: overdue,
    next_due: nextDue,
  };
}

export function getMyInstallments(session: PortalSession) {
  const ctx = ctxOf(session);
  const today = new Date().toISOString().slice(0, 10);
  const rows = [];
  for (const tx of getFinanceStore().transactions) {
    if (
      tx.clinic_id !== ctx.clinicId ||
      tx.patient_id !== ctx.patientId ||
      tx.type !== "income" ||
      tx.cancelled_at
    ) {
      continue;
    }
    for (const inst of getFinanceStore().installments.filter(
      (i) => i.financial_transaction_id === tx.id,
    )) {
      const paid = getFinanceStore()
        .payments
        .filter((p) => p.payment_installment_id === inst.id && !p.reversed_at)
        .reduce((s, p) => s + p.amount_cents, 0);
      const balance = Math.max(0, inst.amount_cents - paid);
      let status = "paid";
      if (balance > 0 && paid > 0) status = "partially_paid";
      else if (balance > 0 && inst.due_date < today) status = "overdue";
      else if (balance > 0) status = "pending";
      rows.push({
        id: inst.id,
        description: tx.description,
        due_date: inst.due_date,
        amount_cents: inst.amount_cents,
        paid_cents: paid,
        balance_cents: balance,
        status,
      });
    }
  }
  return rows.sort((a, b) => a.due_date.localeCompare(b.due_date));
}

export function getMyPayments(session: PortalSession) {
  const ctx = ctxOf(session);
  const txIds = new Set(
    getFinanceStore()
      .transactions
      .filter(
        (t) =>
          t.clinic_id === ctx.clinicId &&
          t.patient_id === ctx.patientId &&
          t.type === "income",
      )
      .map((t) => t.id),
  );
  return getFinanceStore()
    .payments
    .filter(
      (p) =>
        p.clinic_id === ctx.clinicId &&
        txIds.has(p.financial_transaction_id) &&
        !p.reversed_at,
    )
    .map((p) => ({
      id: p.id,
      amount_cents: p.amount_cents,
      paid_at: p.paid_at,
      payment_method: p.payment_method,
      installment_id: p.payment_installment_id,
    }))
    .sort((a, b) => +new Date(b.paid_at) - +new Date(a.paid_at));
}

export function getMyProfile(session: PortalSession) {
  const ctx = ctxOf(session);
  const patient = getPatientRecord(ctx.patientId);
  if (!patient) throw new Error("PORTAL_FORBIDDEN");
  const cpf = patient.cpf_normalized;
  const maskedCpf = cpf
    ? `***.***.***-${cpf.slice(-2)}`
    : null;
  return {
    full_name: patient.full_name,
    preferred_name: patient.preferred_name,
    phone: patient.phone,
    email: patient.email,
    birth_date: patient.birth_date,
    cpf_masked: maskedCpf,
    postal_code: patient.postal_code,
    street: patient.street,
    number: patient.number,
    complement: patient.complement,
    neighborhood: patient.neighborhood,
    city: patient.city,
    state: patient.state,
    clinic_name: ctx.clinicName,
  };
}

export function updateMyAllowedProfileFields(
  session: PortalSession,
  raw: Record<string, unknown>,
) {
  const ctx = ctxOf(session);
  const parsed = portalProfileUpdateSchema.safeParse(raw);
  if (!parsed.success) throw new Error("Dados inválidos");

  // Bloquear campos proibidos mesmo se enviados
  for (const banned of [
    "patient_id",
    "clinic_id",
    "cpf",
    "created_by",
    "status",
    "id",
  ]) {
    if (banned in raw) throw new Error("PORTAL_FORBIDDEN");
  }

  const patient = getPatientRecord(ctx.patientId);
  if (!patient || patient.clinic_id !== ctx.clinicId) {
    throw new Error("PORTAL_FORBIDDEN");
  }

  if (parsed.data.preferred_name !== undefined) {
    patient.preferred_name = parsed.data.preferred_name || null;
  }
  if (parsed.data.phone !== undefined) {
    patient.phone = parsed.data.phone || null;
  }
  if (parsed.data.email !== undefined) {
    patient.email = parsed.data.email || null;
  }
  if (parsed.data.postal_code !== undefined) {
    patient.postal_code = parsed.data.postal_code || null;
  }
  if (parsed.data.street !== undefined) patient.street = parsed.data.street || null;
  if (parsed.data.number !== undefined) patient.number = parsed.data.number || null;
  if (parsed.data.complement !== undefined) {
    patient.complement = parsed.data.complement || null;
  }
  if (parsed.data.neighborhood !== undefined) {
    patient.neighborhood = parsed.data.neighborhood || null;
  }
  if (parsed.data.city !== undefined) patient.city = parsed.data.city || null;
  if (parsed.data.state !== undefined) patient.state = parsed.data.state || null;
  patient.updated_at = new Date().toISOString();

  writePortalAudit(
    ctx.clinicId,
    ctx.authUserId,
    "patient.profile_updated",
    "patient",
    patient.id,
    { fields: Object.keys(parsed.data) },
  );
  return getMyProfile(session);
}

export function getMyNotifications(session: PortalSession) {
  const ctx = ctxOf(session);
  return getPortalStore().notifications.filter(
    (n) =>
      n.auth_user_id === ctx.authUserId &&
      n.clinic_id === ctx.clinicId &&
      n.patient_id === ctx.patientId,
  );
}

export function switchPortalSubject(
  session: PortalSession,
  clinicId: string,
  patientId: string,
): PortalContext {
  return getPortalContext({
    authUserId: session.authUserId,
    clinicId,
    patientId,
  });
}

export function resolveDemoPortalUser(email: string, password: string) {
  return (
    PORTAL_DEMO_USERS.find(
      (u) => u.email === email && u.password === password,
    ) ?? null
  );
}
