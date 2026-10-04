import { assertPermission } from "@/lib/authz/guards";
import type { AuthzContext } from "@/lib/authz/can";
import {
  getClinicalStore,
  snapshotOf,
  writeClinicalAudit,
} from "@/lib/demo/clinical-store";
import { getPatientRecord } from "@/lib/demo/patients-store";
import { getAgendaStore } from "@/lib/demo/agenda-store";
import { getProfile } from "@/lib/demo/authz-store";
import {
  clinicalEntryCorrectionSchema,
  clinicalEntryDraftSchema,
  clinicalEntryFinalizeSchema,
} from "@/lib/validations/clinical";
import type { ClinicalEntry, ClinicalEntryVersion } from "@/types/clinical";

function assertPatient(ctx: AuthzContext, patientId: string) {
  const patient = getPatientRecord(patientId);
  if (!patient || patient.clinic_id !== ctx.clinicId) {
    throw new Error("PATIENT_NOT_FOUND");
  }
}

function findEntry(ctx: AuthzContext, id: string) {
  const entry = getClinicalStore().entries.find((e) => e.id === id);
  if (!entry || entry.clinic_id !== ctx.clinicId) {
    throw new Error("CLINICAL_ENTRY_NOT_FOUND");
  }
  return entry;
}

function assertOptimistic(entry: ClinicalEntry, expected?: string) {
  if (expected && entry.updated_at !== expected) {
    throw new Error("CONCURRENCY_CONFLICT");
  }
}

export function listClinicalEntries(ctx: AuthzContext, patientId: string) {
  assertPermission(ctx, "clinical_evolution.view");
  assertPatient(ctx, patientId);
  return getClinicalStore()
    .entries
    .filter((e) => e.clinic_id === ctx.clinicId && e.patient_id === patientId)
    .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
    .map((e) => ({
      ...e,
      professional_name: getProfile(e.professional_id)?.full_name ?? "Profissional",
    }));
}

export function getClinicalEntry(ctx: AuthzContext, id: string) {
  assertPermission(ctx, "clinical_evolution.view");
  const entry = findEntry(ctx, id);
  return {
    ...entry,
    professional_name: getProfile(entry.professional_id)?.full_name ?? "Profissional",
  };
}

export function getClinicalEntryVersions(ctx: AuthzContext, entryId: string) {
  assertPermission(ctx, "clinical_evolution.view");
  findEntry(ctx, entryId);
  return getClinicalStore()
    .versions
    .filter((v) => v.clinical_entry_id === entryId)
    .sort((a, b) => b.version_number - a.version_number)
    .map((v) => ({
      ...v,
      changed_by_name: v.changed_by
        ? getProfile(v.changed_by)?.full_name ?? "Profissional"
        : null,
    }));
}

export function createClinicalEntry(
  ctx: AuthzContext,
  raw: Record<string, unknown>,
) {
  assertPermission(ctx, "clinical_evolution.create");
  const parsed = clinicalEntryDraftSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Dados inválidos");
  }
  const values = parsed.data;
  assertPatient(ctx, values.patient_id);

  if (values.appointment_id) {
    const appt = getAgendaStore().appointments.find(
      (a) => a.id === values.appointment_id,
    );
    if (!appt || appt.clinic_id !== ctx.clinicId || appt.patient_id !== values.patient_id) {
      throw new Error("APPOINTMENT_NOT_FOUND");
    }
  }

  const now = new Date().toISOString();
  const entry: ClinicalEntry = {
    id: crypto.randomUUID(),
    clinic_id: ctx.clinicId,
    patient_id: values.patient_id,
    appointment_id: values.appointment_id ?? null,
    professional_id: ctx.userId,
    status: "draft",
    chief_complaint: values.chief_complaint || null,
    clinical_exam: values.clinical_exam || null,
    procedure_done: values.procedure_done || null,
    conduct: values.conduct || null,
    guidance: values.guidance || null,
    next_step: values.next_step || null,
    related_teeth: values.related_teeth,
    follow_up_required: values.follow_up_required,
    follow_up_interval_days: values.follow_up_required
      ? values.follow_up_interval_days ?? null
      : null,
    version_number: 1,
    signed_at: null,
    created_by: ctx.userId,
    created_at: now,
    updated_at: now,
  };

  getClinicalStore().entries.unshift(entry);
  writeClinicalAudit(ctx.clinicId, ctx.userId, "clinical_entry.created", "clinical_entry", entry.id);
  return getClinicalEntry(ctx, entry.id);
}

export function updateClinicalEntryDraft(
  ctx: AuthzContext,
  id: string,
  raw: Record<string, unknown>,
) {
  assertPermission(ctx, "clinical_evolution.update");
  const entry = findEntry(ctx, id);
  if (entry.status !== "draft") {
    throw new Error("Registro finalizado não pode ser sobrescrito. Use correção.");
  }
  assertOptimistic(entry, typeof raw.expected_updated_at === "string" ? raw.expected_updated_at : undefined);

  const parsed = clinicalEntryDraftSchema.safeParse({
    ...raw,
    patient_id: entry.patient_id,
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Dados inválidos");
  }

  const values = parsed.data;
  entry.chief_complaint = values.chief_complaint || null;
  entry.clinical_exam = values.clinical_exam || null;
  entry.procedure_done = values.procedure_done || null;
  entry.conduct = values.conduct || null;
  entry.guidance = values.guidance || null;
  entry.next_step = values.next_step || null;
  entry.related_teeth = values.related_teeth;
  entry.follow_up_required = values.follow_up_required;
  entry.follow_up_interval_days = values.follow_up_required
    ? values.follow_up_interval_days ?? null
    : null;
  entry.updated_at = new Date().toISOString();

  writeClinicalAudit(ctx.clinicId, ctx.userId, "clinical_entry.updated", "clinical_entry", entry.id);
  return getClinicalEntry(ctx, entry.id);
}

export function finalizeClinicalEntry(
  ctx: AuthzContext,
  raw: { id: string; expected_updated_at?: string },
) {
  assertPermission(ctx, "clinical_evolution.update");
  const parsed = clinicalEntryFinalizeSchema.safeParse(raw);
  if (!parsed.success) throw new Error("Dados inválidos");

  const entry = findEntry(ctx, parsed.data.id);
  if (entry.status !== "draft") {
    throw new Error("Somente rascunhos podem ser finalizados");
  }
  assertOptimistic(entry, parsed.data.expected_updated_at);

  const now = new Date().toISOString();
  entry.status = "finalized";
  entry.signed_at = now;
  entry.version_number = 1;
  entry.updated_at = now;

  const version: ClinicalEntryVersion = {
    id: crypto.randomUUID(),
    clinical_entry_id: entry.id,
    clinic_id: ctx.clinicId,
    version_number: 1,
    snapshot_json: snapshotOf(entry),
    changed_by: ctx.userId,
    change_reason: null,
    created_at: now,
  };
  getClinicalStore().versions.unshift(version);

  writeClinicalAudit(ctx.clinicId, ctx.userId, "clinical_entry.finalized", "clinical_entry", entry.id);
  return getClinicalEntry(ctx, entry.id);
}

export function addClinicalEntryCorrection(
  ctx: AuthzContext,
  raw: Record<string, unknown>,
) {
  assertPermission(ctx, "clinical_evolution.update");
  const parsed = clinicalEntryCorrectionSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Dados inválidos");
  }

  const entry = findEntry(ctx, parsed.data.id);
  if (entry.status !== "finalized") {
    throw new Error("Correção só se aplica a registros finalizados");
  }
  assertOptimistic(entry, parsed.data.expected_updated_at);

  const data = parsed.data;
  if (data.chief_complaint !== undefined) entry.chief_complaint = data.chief_complaint || null;
  if (data.clinical_exam !== undefined) entry.clinical_exam = data.clinical_exam || null;
  if (data.procedure_done !== undefined) entry.procedure_done = data.procedure_done || null;
  if (data.conduct !== undefined) entry.conduct = data.conduct || null;
  if (data.guidance !== undefined) entry.guidance = data.guidance || null;
  if (data.next_step !== undefined) entry.next_step = data.next_step || null;
  if (data.related_teeth !== undefined) entry.related_teeth = data.related_teeth;
  if (data.follow_up_required !== undefined) {
    entry.follow_up_required = data.follow_up_required;
    entry.follow_up_interval_days = data.follow_up_required
      ? data.follow_up_interval_days ?? entry.follow_up_interval_days
      : null;
  }

  const now = new Date().toISOString();
  entry.version_number += 1;
  entry.updated_at = now;

  const version: ClinicalEntryVersion = {
    id: crypto.randomUUID(),
    clinical_entry_id: entry.id,
    clinic_id: ctx.clinicId,
    version_number: entry.version_number,
    snapshot_json: snapshotOf(entry),
    changed_by: ctx.userId,
    change_reason: data.change_reason,
    created_at: now,
  };
  getClinicalStore().versions.unshift(version);

  writeClinicalAudit(ctx.clinicId, ctx.userId, "clinical_entry.corrected", "clinical_entry", entry.id, {
    version: entry.version_number,
  });
  return getClinicalEntry(ctx, entry.id);
}

export function listDraftsForAppointment(ctx: AuthzContext, appointmentId: string) {
  assertPermission(ctx, "clinical_evolution.view");
  return getClinicalStore().entries.filter(
    (e) =>
      e.clinic_id === ctx.clinicId &&
      e.appointment_id === appointmentId &&
      e.status === "draft",
  );
}

export function countPendingFollowUps(ctx: AuthzContext) {
  assertPermission(ctx, "clinical_evolution.view");
  const now = Date.now();
  const store = getClinicalStore();
  const agenda = getAgendaStore();

  const byPatient = new Map<string, ClinicalEntry>();
  for (const entry of store.entries) {
    if (entry.clinic_id !== ctx.clinicId) continue;
    if (entry.status !== "finalized" || !entry.follow_up_required) continue;
    const prev = byPatient.get(entry.patient_id);
    if (!prev || +new Date(entry.signed_at ?? entry.created_at) > +new Date(prev.signed_at ?? prev.created_at)) {
      byPatient.set(entry.patient_id, entry);
    }
  }

  let count = 0;
  for (const [patientId] of byPatient) {
    const hasFuture = agenda.appointments.some(
      (a) =>
        a.clinic_id === ctx.clinicId &&
        a.patient_id === patientId &&
        a.status !== "cancelled" &&
        a.status !== "no_show" &&
        a.status !== "completed" &&
        +new Date(a.start_at) >= now,
    );
    if (!hasFuture) count += 1;
  }
  return count;
}

export function getPatientFollowUp(ctx: AuthzContext, patientId: string) {
  assertPermission(ctx, "clinical_evolution.view");
  assertPatient(ctx, patientId);
  const entries = listClinicalEntries(ctx, patientId).filter(
    (e) => e.status === "finalized" && e.follow_up_required,
  );
  const latest = entries[0];
  if (!latest) return null;

  const now = Date.now();
  const hasFuture = getAgendaStore().appointments.some(
    (a) =>
      a.clinic_id === ctx.clinicId &&
      a.patient_id === patientId &&
      a.status !== "cancelled" &&
      a.status !== "no_show" &&
      a.status !== "completed" &&
      +new Date(a.start_at) >= now,
  );

  return {
    required: true,
    intervalDays: latest.follow_up_interval_days,
    pending: !hasFuture,
    entryId: latest.id,
  };
}
