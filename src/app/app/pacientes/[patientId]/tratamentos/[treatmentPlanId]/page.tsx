import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TreatmentPlanClient } from "@/components/treatments/treatment-plan-client";
import { can } from "@/lib/authz/can";
import { requireClinic } from "@/lib/authz/guards";
import { getPatient } from "@/services/patients";
import { getTreatmentPlan } from "@/services/treatments";

export const metadata: Metadata = {
  title: "Plano de tratamento",
};

export default async function TreatmentPlanPage({
  params,
}: {
  params: Promise<{ patientId: string; treatmentPlanId: string }>;
}) {
  const { patientId, treatmentPlanId } = await params;
  const actor = await requireClinic();
  const canView =
    can(actor.ctx, "treatments.view").allowed ||
    can(actor.ctx, "treatments.administrative_view").allowed;
  if (!canView) notFound();

  try {
    const patient = getPatient(actor.ctx, patientId);
    const plan = getTreatmentPlan(actor.ctx, treatmentPlanId);
    if (plan.patient_id !== patient.id) notFound();

    return (
      <TreatmentPlanClient
        patientId={patient.id}
        planId={plan.id}
        canUpdate={can(actor.ctx, "treatments.update").allowed}
        canPresent={can(actor.ctx, "treatments.present").allowed}
        canAcceptance={can(actor.ctx, "treatments.acceptance_manage").allowed}
        canProgress={can(actor.ctx, "treatments.progress_update").allowed}
      />
    );
  } catch {
    notFound();
  }
}
