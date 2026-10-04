import type { Metadata } from "next";
import { PatientForm } from "@/components/patients/patient-form";
import { requirePermission } from "@/lib/authz/guards";

export const metadata: Metadata = {
  title: "Novo paciente",
};

export default async function NovoPacientePage() {
  await requirePermission("patients.demographics.create");

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5">
      <section>
        <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight text-[var(--brand-ink)]">
          Novo paciente
        </h1>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Cadastro administrativo rápido. Você pode completar depois.
        </p>
      </section>
      <PatientForm mode="create" />
    </div>
  );
}
