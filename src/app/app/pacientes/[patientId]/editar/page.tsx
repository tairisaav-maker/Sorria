import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PatientForm } from "@/components/patients/patient-form";
import { requireClinic } from "@/lib/authz/guards";
import { can } from "@/lib/authz/can";
import { redirect } from "next/navigation";
import { getPatient } from "@/services/patients";

export const metadata: Metadata = {
  title: "Editar paciente",
};

export default async function EditarPacientePage({
  params,
}: {
  params: Promise<{ patientId: string }>;
}) {
  const { patientId } = await params;
  const actor = await requireClinic();

  const allowed =
    can(actor.ctx, "patients.demographics.update").allowed ||
    can(actor.ctx, "patients.contact.update").allowed ||
    can(actor.ctx, "patients.administrative.update").allowed;

  if (!allowed) redirect("/forbidden");

  try {
    const patient = getPatient(actor.ctx, patientId);
    return (
      <div className="mx-auto w-full max-w-2xl space-y-5">
        <section>
          <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight text-[var(--brand-ink)]">
            Editar paciente
          </h1>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            Atualize o cadastro administrativo de {patient.full_name}.
          </p>
        </section>
        <PatientForm mode="edit" initial={patient} />
      </div>
    );
  } catch {
    notFound();
  }
}
