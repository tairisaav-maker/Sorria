import { assertPermission } from "@/lib/authz/guards";
import type { AuthzContext } from "@/lib/authz/can";
import { ALL_PERMANENT_TEETH } from "@/lib/clinical/teeth";
import {
  getClinicalStore,
  writeClinicalAudit,
} from "@/lib/demo/clinical-store";
import { getPatientRecord } from "@/lib/demo/patients-store";
import { odontogramEntrySchema } from "@/lib/validations/clinical";
import type { OdontogramEntry, ToothCondition } from "@/types/clinical";

function assertPatient(ctx: AuthzContext, patientId: string) {
  const patient = getPatientRecord(patientId);
  if (!patient || patient.clinic_id !== ctx.clinicId) {
    throw new Error("PATIENT_NOT_FOUND");
  }
}

export function getOdontogram(ctx: AuthzContext, patientId: string) {
  assertPermission(ctx, "odontogram.view");
  assertPatient(ctx, patientId);
  const existing = getClinicalStore().odontogram.filter(
    (e) => e.clinic_id === ctx.clinicId && e.patient_id === patientId,
  );
  const byTooth = new Map(existing.map((e) => [e.tooth_number, e]));
  const teeth = ALL_PERMANENT_TEETH.map((n) => {
    return (
      byTooth.get(n) ??
      ({
        id: `virtual-${patientId}-${n}`,
        clinic_id: ctx.clinicId,
        patient_id: patientId,
        tooth_number: n,
        condition: "healthy" as ToothCondition,
        planned_procedure: null,
        notes: null,
        created_by: null,
        created_at: "",
        updated_at: "",
      } satisfies OdontogramEntry)
    );
  });
  const updatedAt =
    existing
      .map((e) => e.updated_at)
      .sort()
      .at(-1) ?? null;
  return { teeth, updatedAt };
}

export function updateTooth(ctx: AuthzContext, raw: Record<string, unknown>) {
  assertPermission(ctx, "odontogram.update");
  const parsed = odontogramEntrySchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Dados inválidos");
  }
  assertPatient(ctx, parsed.data.patient_id);

  const store = getClinicalStore();
  const index = store.odontogram.findIndex(
    (e) =>
      e.clinic_id === ctx.clinicId &&
      e.patient_id === parsed.data.patient_id &&
      e.tooth_number === parsed.data.tooth_number,
  );

  const now = new Date().toISOString();
  const previous = index >= 0 ? store.odontogram[index] : null;
  const next: OdontogramEntry = {
    id: previous?.id ?? crypto.randomUUID(),
    clinic_id: ctx.clinicId,
    patient_id: parsed.data.patient_id,
    tooth_number: parsed.data.tooth_number,
    condition: parsed.data.condition,
    planned_procedure: parsed.data.planned_procedure || null,
    notes: parsed.data.notes || null,
    created_by: previous?.created_by ?? ctx.userId,
    created_at: previous?.created_at ?? now,
    updated_at: now,
  };

  if (index >= 0) store.odontogram[index] = next;
  else store.odontogram.push(next);

  writeClinicalAudit(ctx.clinicId, ctx.userId, "odontogram.updated", "odontogram_entry", next.id, {
    tooth: next.tooth_number,
    from: previous?.condition ?? null,
    to: next.condition,
  });

  return next;
}
