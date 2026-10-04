import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProcedureFormClient } from "@/components/procedures/procedure-form-client";
import { requirePermission } from "@/lib/authz/guards";
import { getProcedure } from "@/services/procedures";

export const metadata: Metadata = {
  title: "Editar procedimento",
};

export default async function EditarProcedimentoPage({
  params,
}: {
  params: Promise<{ procedureId: string }>;
}) {
  const { procedureId } = await params;
  const actor = await requirePermission("procedures.update");
  try {
    const procedure = getProcedure(actor.ctx, procedureId);
    return <ProcedureFormClient mode="edit" initial={procedure} />;
  } catch {
    notFound();
  }
}
