import { assertPermission } from "@/lib/authz/guards";
import type { AuthzContext } from "@/lib/authz/can";
import { assertClinicCanMutate } from "@/lib/entitlements";
import {
  buildNormalizedPatient,
  getPatientRecord,
  upsertPatientRecord,
  writePatientAudit,
} from "@/lib/demo/patients-store";
import {
  createPatientSchema,
  updatePatientSchema,
  type PatientFormValues,
} from "@/lib/validations/patient";
import {
  checkPotentialDuplicates,
  hasExactCpfDuplicate,
} from "@/services/patients/duplicates";
import type { DuplicateMatch, Patient } from "@/types/patient";

function denyClinicIdTamper(
  ctx: AuthzContext,
  payloadClinicId: string | undefined,
) {
  if (payloadClinicId && payloadClinicId !== ctx.clinicId) {
    writePatientAudit(
      ctx.clinicId,
      ctx.userId,
      "authorization.denied",
      "n/a",
      { reason: "clinic_id_tamper", attempted: "patient.write" },
    );
    throw new Error("AUTHORIZATION_DENIED");
  }
}

export type CreatePatientResult =
  | { ok: true; patient: Patient }
  | { ok: false; duplicates: DuplicateMatch[] };

export function createPatient(
  ctx: AuthzContext,
  raw: PatientFormValues & { clinic_id?: string; created_by?: string },
): CreatePatientResult {
  assertPermission(ctx, "patients.demographics.create");
  assertClinicCanMutate(ctx);
  denyClinicIdTamper(ctx, raw.clinic_id);

  const parsed = createPatientSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Dados inválidos");
  }

  const values = parsed.data;
  const duplicates = checkPotentialDuplicates({
    clinicId: ctx.clinicId,
    cpf: values.cpf,
    phone: values.phone,
    email: values.email,
    full_name: values.full_name,
    birth_date: values.birth_date,
  });

  if (duplicates.length > 0 && !values.acknowledge_duplicate) {
    return { ok: false, duplicates };
  }

  const patient = buildNormalizedPatient({
    clinic_id: ctx.clinicId,
    full_name: values.full_name,
    preferred_name: values.preferred_name,
    cpf: values.cpf,
    birth_date: values.birth_date,
    phone: values.phone,
    secondary_phone: values.secondary_phone,
    email: values.email,
    postal_code: values.postal_code,
    street: values.street,
    number: values.number,
    complement: values.complement,
    neighborhood: values.neighborhood,
    city: values.city,
    state: values.state,
    guardian_name: values.guardian_name,
    guardian_phone: values.guardian_phone,
    guardian_relationship: values.guardian_relationship,
    emergency_contact_name: values.emergency_contact_name,
    emergency_contact_phone: values.emergency_contact_phone,
    emergency_contact_relationship: values.emergency_contact_relationship,
    referral_source: values.referral_source,
    administrative_notes: values.administrative_notes,
    status: values.status ?? "active",
    created_by: ctx.userId,
  });

  void raw.created_by;

  upsertPatientRecord(patient);
  writePatientAudit(ctx.clinicId, ctx.userId, "patient.created", patient.id, {
    acknowledge_duplicate: Boolean(values.acknowledge_duplicate),
    duplicate_reasons: duplicates.flatMap((d) => d.reasons),
  });

  return { ok: true, patient };
}

export function updatePatient(
  ctx: AuthzContext,
  patientId: string,
  raw: PatientFormValues & { clinic_id?: string; created_by?: string },
): Patient {
  const canDemo =
    (() => {
      try {
        assertPermission(ctx, "patients.demographics.update");
        return true;
      } catch {
        return false;
      }
    })() ||
    (() => {
      try {
        assertPermission(ctx, "patients.contact.update");
        return true;
      } catch {
        return false;
      }
    })() ||
    (() => {
      try {
        assertPermission(ctx, "patients.administrative.update");
        return true;
      } catch {
        return false;
      }
    })();

  if (!canDemo) {
    throw new Error("AUTHORIZATION_DENIED");
  }

  denyClinicIdTamper(ctx, raw.clinic_id);

  const existing = getPatientRecord(patientId);
  if (!existing || existing.clinic_id !== ctx.clinicId) {
    throw new Error("PATIENT_NOT_FOUND");
  }

  const parsed = updatePatientSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Dados inválidos");
  }

  const values = parsed.data;
  const cpfHit = hasExactCpfDuplicate(ctx.clinicId, values.cpf, patientId);
  if (cpfHit) {
    throw new Error("CPF já cadastrado nesta clínica.");
  }

  const previousStatus = existing.status;
  const next = buildNormalizedPatient({
    ...existing,
    ...values,
    id: existing.id,
    clinic_id: existing.clinic_id,
    created_by: existing.created_by,
    created_at: existing.created_at,
    status: values.status ?? existing.status,
  });

  next.created_by = existing.created_by;
  next.clinic_id = existing.clinic_id;

  if (next.status === "archived" && previousStatus !== "archived") {
    next.archived_at = new Date().toISOString();
  }
  if (next.status !== "archived") {
    next.archived_at = null;
  }

  upsertPatientRecord(next);
  writePatientAudit(ctx.clinicId, ctx.userId, "patient.updated", next.id, {});

  if (previousStatus !== next.status) {
    writePatientAudit(
      ctx.clinicId,
      ctx.userId,
      "patient.status_changed",
      next.id,
      { from: previousStatus, to: next.status },
    );
  }

  return next;
}

export function archivePatient(ctx: AuthzContext, patientId: string): Patient {
  assertPermission(ctx, "patients.administrative.update");

  const existing = getPatientRecord(patientId);
  if (!existing || existing.clinic_id !== ctx.clinicId) {
    throw new Error("PATIENT_NOT_FOUND");
  }

  const next: Patient = {
    ...existing,
    status: "archived",
    archived_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  upsertPatientRecord(next);
  writePatientAudit(ctx.clinicId, ctx.userId, "patient.archived", next.id, {});
  writePatientAudit(
    ctx.clinicId,
    ctx.userId,
    "patient.status_changed",
    next.id,
    { from: existing.status, to: "archived" },
  );
  return next;
}

export function reactivatePatient(ctx: AuthzContext, patientId: string): Patient {
  assertPermission(ctx, "patients.administrative.update");

  const existing = getPatientRecord(patientId);
  if (!existing || existing.clinic_id !== ctx.clinicId) {
    throw new Error("PATIENT_NOT_FOUND");
  }

  const next: Patient = {
    ...existing,
    status: "active",
    archived_at: null,
    updated_at: new Date().toISOString(),
  };
  upsertPatientRecord(next);
  writePatientAudit(ctx.clinicId, ctx.userId, "patient.reactivated", next.id, {});
  writePatientAudit(
    ctx.clinicId,
    ctx.userId,
    "patient.status_changed",
    next.id,
    { from: existing.status, to: "active" },
  );
  return next;
}
