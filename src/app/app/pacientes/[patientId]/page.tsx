import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PatientProfileClient } from "@/components/patients/patient-profile-client";
import { can } from "@/lib/authz/can";
import { requirePermission } from "@/lib/authz/guards";
import {
  getPatientLastAppointment,
  getPatientNextAppointment,
} from "@/services/appointments";
import { getPatientFollowUp } from "@/services/clinical";
import { getPatient } from "@/services/patients";

export const metadata: Metadata = {
  title: "Paciente",
};

export default async function PacientePerfilPage({
  params,
}: {
  params: Promise<{ patientId: string }>;
}) {
  const { patientId } = await params;
  const actor = await requirePermission("patients.demographics.view");

  try {
    const patient = getPatient(actor.ctx, patientId);
    const canViewAgenda = can(actor.ctx, "appointments.view").allowed;
    const canViewClinical = can(actor.ctx, "clinical_record.view").allowed;
    const nextAppointment = canViewAgenda
      ? getPatientNextAppointment(actor.ctx, patientId)
      : null;
    const lastAppointment = canViewAgenda
      ? getPatientLastAppointment(actor.ctx, patientId)
      : null;

    let followUp: { intervalDays: number | null; pending: boolean } | null =
      null;
    if (canViewClinical) {
      const fu = getPatientFollowUp(actor.ctx, patientId);
      if (fu) {
        followUp = {
          intervalDays: fu.intervalDays,
          pending: fu.pending,
        };
      }
    }

    return (
      <PatientProfileClient
        patient={patient}
        canEdit={
          can(actor.ctx, "patients.demographics.update").allowed ||
          can(actor.ctx, "patients.contact.update").allowed ||
          can(actor.ctx, "patients.administrative.update").allowed
        }
        canArchive={can(actor.ctx, "patients.administrative.update").allowed}
        canCreateAppointment={can(actor.ctx, "appointments.create").allowed}
        canViewClinical={canViewClinical}
        nextAppointment={nextAppointment}
        lastAppointment={lastAppointment}
        followUp={followUp}
      />
    );
  } catch {
    notFound();
  }
}
