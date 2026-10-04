import type { Metadata } from "next";
import { ProceduresClient } from "@/components/procedures/procedures-client";
import { can } from "@/lib/authz/can";
import { requirePermission } from "@/lib/authz/guards";

export const metadata: Metadata = {
  title: "Procedimentos",
};

export default async function ProcedimentosPage() {
  const actor = await requirePermission("procedures.view");
  return (
    <ProceduresClient
      canCreate={can(actor.ctx, "procedures.create").allowed}
    />
  );
}
