import type { Metadata } from "next";
import { Suspense } from "react";
import { PatientsListClient } from "@/components/patients/patients-list-client";
import { Spinner } from "@/components/ui/spinner";
import { can } from "@/lib/authz/can";
import { requirePermission } from "@/lib/authz/guards";

export const metadata: Metadata = {
  title: "Pacientes",
};

export default async function PacientesPage() {
  const actor = await requirePermission("patients.demographics.view");
  const canCreate = can(actor.ctx, "patients.demographics.create").allowed;

  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      }
    >
      <PatientsListClient canCreate={canCreate} />
    </Suspense>
  );
}
