import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { NewTreatmentPlanClient } from "@/components/treatments/new-treatment-plan-client";
import { requirePermission } from "@/lib/authz/guards";
import { getPatient } from "@/services/patients";

export const metadata: Metadata = {
  title: "Novo plano",
};

export default async function NovoPlanoPage({
  params,
}: {
  params: Promise<{ patientId: string }>;
}) {
  const { patientId } = await params;
  const actor = await requirePermission("treatments.create");

  try {
    const patient = getPatient(actor.ctx, patientId);
    return (
      <Suspense
        fallback={
          <div className="h-40 animate-pulse rounded-2xl bg-[var(--surface-muted)]" />
        }
      >
        <NewTreatmentPlanClient
          patientId={patient.id}
          patientName={patient.full_name}
        />
      </Suspense>
    );
  } catch {
    notFound();
  }
}
