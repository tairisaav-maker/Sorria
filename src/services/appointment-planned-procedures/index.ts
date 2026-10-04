import { assertPermission } from "@/lib/authz/guards";
import type { AuthzContext } from "@/lib/authz/can";
import { getAgendaStore } from "@/lib/demo/agenda-store";
import { getInventoryStore } from "@/lib/demo/inventory-store";
import { getPatientRecord } from "@/lib/demo/patients-store";
import {
  getPlannedProceduresStore,
  writePlannedAudit,
} from "@/lib/demo/planned-procedures-store";
import {
  addPlannedProcedureSchema,
  removePlannedProcedureSchema,
  updatePlannedProcedureSchema,
} from "@/lib/validations/planned-procedure";
import type { AppointmentPlannedProcedure } from "@/types/forecast";

function now() {
  return new Date().toISOString();
}

function findPlanned(
  ctx: AuthzContext,
  id: string,
): AppointmentPlannedProcedure {
  const row = getPlannedProceduresStore().planned.find((p) => p.id === id);
  if (!row || row.clinic_id !== ctx.clinicId) {
    throw new Error("PLANNED_PROCEDURE_NOT_FOUND");
  }
  return row;
}

function assertAppointment(ctx: AuthzContext, appointmentId: string) {
  const appt = getAgendaStore().appointments.find((a) => a.id === appointmentId);
  if (!appt || appt.clinic_id !== ctx.clinicId) {
    throw new Error("APPOINTMENT_NOT_FOUND");
  }
  return appt;
}

function assertProcedure(ctx: AuthzContext, procedureId: string) {
  const procedure = getInventoryStore().procedures.find(
    (p) => p.id === procedureId,
  );
  if (!procedure || procedure.clinic_id !== ctx.clinicId) {
    throw new Error("PROCEDURE_NOT_FOUND");
  }
  return procedure;
}

function withNames(rows: AppointmentPlannedProcedure[]) {
  const inv = getInventoryStore();
  return rows.map((r) => ({
    ...r,
    procedure_name:
      inv.procedures.find((p) => p.id === r.procedure_id)?.name ?? "Procedimento",
  }));
}

export function addPlannedProcedureToAppointment(
  ctx: AuthzContext,
  input: unknown,
) {
  assertPermission(ctx, "appointment_planned_procedures.create");
  const data = addPlannedProcedureSchema.parse(input);
  const appt = assertAppointment(ctx, data.appointment_id);
  const procedure = assertProcedure(ctx, data.procedure_id);
  const patient = getPatientRecord(appt.patient_id);
  if (!patient || patient.clinic_id !== ctx.clinicId) {
    throw new Error("PATIENT_NOT_FOUND");
  }

  const row: AppointmentPlannedProcedure = {
    id: `appp-${crypto.randomUUID()}`,
    clinic_id: ctx.clinicId,
    appointment_id: appt.id,
    patient_id: appt.patient_id,
    procedure_id: procedure.id,
    procedure_name: procedure.name,
    procedure_variant_id: data.procedure_variant_id ?? null,
    tooth_number: data.tooth_number ?? null,
    region: data.region ?? null,
    quantity: data.quantity ?? 1,
    notes: data.notes ?? null,
    created_by: ctx.userId,
    created_at: now(),
    updated_at: now(),
    cancelled_at: null,
  };

  getPlannedProceduresStore().planned.push(row);
  writePlannedAudit({
    clinic_id: ctx.clinicId,
    actor_user_id: ctx.userId,
    action: "appointment_planned_procedure.created",
    target_type: "appointment_planned_procedure",
    target_id: row.id,
    metadata: {
      appointment_id: appt.id,
      patient_id: appt.patient_id,
      procedure_id: procedure.id,
    },
  });
  return withNames([row])[0];
}

export function updatePlannedProcedure(ctx: AuthzContext, input: unknown) {
  assertPermission(ctx, "appointment_planned_procedures.update");
  const data = updatePlannedProcedureSchema.parse(input);
  const row = findPlanned(ctx, data.id);
  if (row.cancelled_at) throw new Error("PLANNED_PROCEDURE_CANCELLED");

  if (data.procedure_id !== undefined) {
    const procedure = assertProcedure(ctx, data.procedure_id);
    row.procedure_id = procedure.id;
    row.procedure_name = procedure.name;
  }
  if (data.procedure_variant_id !== undefined) {
    row.procedure_variant_id = data.procedure_variant_id;
  }
  if (data.tooth_number !== undefined) row.tooth_number = data.tooth_number;
  if (data.region !== undefined) row.region = data.region;
  if (data.quantity !== undefined) row.quantity = data.quantity;
  if (data.notes !== undefined) row.notes = data.notes;
  row.updated_at = now();

  writePlannedAudit({
    clinic_id: ctx.clinicId,
    actor_user_id: ctx.userId,
    action: "appointment_planned_procedure.updated",
    target_type: "appointment_planned_procedure",
    target_id: row.id,
  });
  return withNames([row])[0];
}

export function removePlannedProcedure(ctx: AuthzContext, input: unknown) {
  assertPermission(ctx, "appointment_planned_procedures.update");
  const data = removePlannedProcedureSchema.parse(input);
  const row = findPlanned(ctx, data.id);
  if (row.cancelled_at) return withNames([row])[0];
  row.cancelled_at = now();
  row.updated_at = now();
  writePlannedAudit({
    clinic_id: ctx.clinicId,
    actor_user_id: ctx.userId,
    action: "appointment_planned_procedure.removed",
    target_type: "appointment_planned_procedure",
    target_id: row.id,
  });
  return withNames([row])[0];
}

export function getAppointmentPlannedProcedures(
  ctx: AuthzContext,
  appointmentId: string,
  opts?: { includeCancelled?: boolean },
) {
  assertPermission(ctx, "appointment_planned_procedures.view");
  assertAppointment(ctx, appointmentId);
  const rows = getPlannedProceduresStore().planned.filter(
    (p) =>
      p.clinic_id === ctx.clinicId &&
      p.appointment_id === appointmentId &&
      (opts?.includeCancelled || !p.cancelled_at),
  );
  return withNames(rows).sort((a, b) =>
    a.created_at.localeCompare(b.created_at),
  );
}

export function getActivePlannedForAppointment(
  clinicId: string,
  appointmentId: string,
) {
  return getPlannedProceduresStore().planned.filter(
    (p) =>
      p.clinic_id === clinicId &&
      p.appointment_id === appointmentId &&
      !p.cancelled_at,
  );
}

export { convertPlannedProceduresToPerformedProcedures } from "@/services/appointment-planned-procedures/convert";
