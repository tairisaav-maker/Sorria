import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TreatmentsClient } from "@/components/treatments/treatments-client";
import { can } from "@/lib/authz/can";
import { requireClinic } from "@/lib/authz/guards";
import { getPatient } from "@/services/patients";

export const metadata: Metadata = {
  title: "Tratamentos",
};

export default async function TratamentosPage({
  params,
}: {
  params: Promise<{ patientId: string }>;
}) {
  const { patientId } = await params;
  const actor = await requireClinic();
  const canView =
    can(actor.ctx, "treatments.view").allowed ||
    can(actor.ctx, "treatments.administrative_view").allowed;
  if (!canView) {
    notFound();
  }

  try {
    const patient = getPatient(actor.ctx, patientId);
    return (
      <TreatmentsClient
        patientId={patient.id}
        patientName={patient.full_name}
        canCreate={can(actor.ctx, "treatments.create").allowed}
      />
    );
  } catch {
    notFound();
  }
}
