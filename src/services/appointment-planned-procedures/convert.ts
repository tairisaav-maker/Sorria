import { assertPermission } from "@/lib/authz/guards";
import type { AuthzContext } from "@/lib/authz/can";
import { getAgendaStore } from "@/lib/demo/agenda-store";
import { getPerformedStore } from "@/lib/demo/performed-procedures-store";
import {
  getPlannedProceduresStore,
  writePlannedAudit,
} from "@/lib/demo/planned-procedures-store";
import { convertPlannedProceduresSchema } from "@/lib/validations/planned-procedure";
import { createPerformedProcedure } from "@/services/performed-procedures";

function activePlanned(clinicId: string, appointmentId: string) {
  return getPlannedProceduresStore().planned.filter(
    (p) =>
      p.clinic_id === clinicId &&
      p.appointment_id === appointmentId &&
      !p.cancelled_at,
  );
}

/**
 * Converte procedimentos previstos → performed_procedures.
 * Idempotente: se já existe performed com appointment_planned_procedure_id, não duplica.
 */
export function convertPlannedProceduresToPerformedProcedures(
  ctx: AuthzContext,
  input: unknown,
) {
  assertPermission(ctx, "performed_procedures.create");
  const data = convertPlannedProceduresSchema.parse(input);
  const appt = getAgendaStore().appointments.find(
    (a) => a.id === data.appointment_id,
  );
  if (!appt || appt.clinic_id !== ctx.clinicId) {
    throw new Error("APPOINTMENT_NOT_FOUND");
  }

  const planned = activePlanned(ctx.clinicId, appt.id);
  const existing = getPerformedStore().performedProcedures.filter(
    (p) =>
      p.clinic_id === ctx.clinicId &&
      p.appointment_id === appt.id &&
      p.status !== "cancelled",
  );

  const created: string[] = [];
  const reused: string[] = [];

  for (const row of planned) {
    const already = existing.find(
      (p) => p.appointment_planned_procedure_id === row.id,
    );
    if (already) {
      reused.push(already.id);
      continue;
    }

    const performed = createPerformedProcedure(ctx, {
      patient_id: appt.patient_id,
      appointment_id: appt.id,
      procedure_id: row.procedure_id,
      tooth_number: row.tooth_number,
      region: row.region,
      quantity: row.quantity,
      appointment_planned_procedure_id: row.id,
      professional_id: appt.professional_id,
    });
    created.push(performed.procedure.id);
  }

  writePlannedAudit({
    clinic_id: ctx.clinicId,
    actor_user_id: ctx.userId,
    action: "appointment_planned_procedure.converted",
    target_type: "appointment",
    target_id: appt.id,
    metadata: {
      created_count: created.length,
      reused_count: reused.length,
      planned_count: planned.length,
    },
  });

  return {
    appointment_id: appt.id,
    planned_count: planned.length,
    created_ids: created,
    reused_ids: reused,
    items: getPerformedStore().performedProcedures.filter(
      (p) =>
        p.clinic_id === ctx.clinicId &&
        p.appointment_id === appt.id &&
        p.status !== "cancelled",
    ),
  };
}
