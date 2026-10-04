import type { Metadata } from "next";
import { ProcedureLibraryPicker } from "@/components/procedures/procedure-library-picker";
import { requirePermission } from "@/lib/authz/guards";

export const metadata: Metadata = {
  title: "Adicionar procedimento",
};

export default async function NovoProcedimentoPage({
  searchParams,
}: {
  searchParams?: Promise<{ from?: string }>;
}) {
  await requirePermission("procedures.create");
  const sp = searchParams ? await searchParams : {};
  const mode =
    sp.from === "onboarding" ? ("onboarding" as const) : ("catalog" as const);
  return <ProcedureLibraryPicker mode={mode} />;
}
