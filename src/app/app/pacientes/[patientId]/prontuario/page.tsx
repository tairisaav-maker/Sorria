import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ClinicalChartClient } from "@/components/clinical/clinical-chart-client";
import { can } from "@/lib/authz/can";
import { requirePermission } from "@/lib/authz/guards";
import { getPatient } from "@/services/patients";

export const metadata: Metadata = {
  title: "Prontuário",
};

export default async function ProntuarioPage({
  params,
  searchParams,
}: {
  params: Promise<{ patientId: string }>;
  searchParams: Promise<{ appointmentId?: string }>;
}) {
  const { patientId } = await params;
  const query = await searchParams;
  const actor = await requirePermission("clinical_record.view");

  try {
    const patient = getPatient(actor.ctx, patientId);
    return (
      <ClinicalChartClient
        patientId={patient.id}
        patientName={patient.full_name}
        appointmentId={query.appointmentId}
        canCreate={
          can(actor.ctx, "clinical_evolution.create").allowed ||
          can(actor.ctx, "anamnesis.create").allowed
        }
        canUpdate={
          can(actor.ctx, "clinical_evolution.update").allowed ||
          can(actor.ctx, "anamnesis.update").allowed ||
          can(actor.ctx, "odontogram.update").allowed
        }
        canUpload={can(actor.ctx, "clinical_files.upload").allowed}
      />
    );
  } catch {
    notFound();
  }
}
