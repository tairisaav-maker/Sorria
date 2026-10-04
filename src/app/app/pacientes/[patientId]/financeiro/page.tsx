import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PatientFinanceClient } from "@/components/finance/patient-finance-client";
import { can } from "@/lib/authz/can";
import { requireClinic } from "@/lib/authz/guards";
import { getPatient } from "@/services/patients";

export const metadata: Metadata = {
  title: "Financeiro do paciente",
};

export default async function PatientFinancePage({
  params,
}: {
  params: Promise<{ patientId: string }>;
}) {
  const { patientId } = await params;
  const actor = await requireClinic();
  const canView =
    can(actor.ctx, "finance.view_administrative").allowed ||
    can(actor.ctx, "finance.view_authorized").allowed;
  if (!canView) notFound();

  try {
    const patient = getPatient(actor.ctx, patientId);
    return (
      <PatientFinanceClient
        patientId={patient.id}
        patientName={patient.full_name}
        canPay={can(actor.ctx, "finance.payment_create").allowed}
        canReverse={can(actor.ctx, "finance.payment_reverse").allowed}
      />
    );
  } catch {
    notFound();
  }
}
