import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AttendanceClient } from "@/components/performed-procedures/attendance-client";
import { can } from "@/lib/authz/can";
import { requirePermission } from "@/lib/authz/guards";
import { getAgendaStore } from "@/lib/demo/agenda-store";
import { getPatientRecord } from "@/lib/demo/patients-store";

export const metadata: Metadata = {
  title: "Atendimento",
};

export default async function AtendimentoPage({
  params,
}: {
  params: Promise<{ appointmentId: string }>;
}) {
  const { appointmentId } = await params;
  const actor = await requirePermission("performed_procedures.view");
  const appt = getAgendaStore().appointments.find((a) => a.id === appointmentId);
  if (!appt || appt.clinic_id !== actor.ctx.clinicId) notFound();
  const patient = getPatientRecord(appt.patient_id);
  if (!patient) notFound();

  return (
    <AttendanceClient
      appointmentId={appointmentId}
      patientId={appt.patient_id}
      patientName={patient.full_name}
      canCreate={can(actor.ctx, "performed_procedures.create").allowed}
      canConfirm={can(actor.ctx, "procedure_consumption.confirm").allowed}
    />
  );
}
