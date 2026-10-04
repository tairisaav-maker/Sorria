import type { Metadata } from "next";
import { ProcedureFormClient } from "@/components/procedures/procedure-form-client";
import { requirePermission } from "@/lib/authz/guards";

export const metadata: Metadata = {
  title: "Novo procedimento",
};

export default async function NovoProcedimentoPage() {
  await requirePermission("procedures.create");
  return <ProcedureFormClient mode="create" />;
}
