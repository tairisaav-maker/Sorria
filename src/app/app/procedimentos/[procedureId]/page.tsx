import type { Metadata } from "next";
import { ProcedureDetailClient } from "@/components/procedures/procedure-detail-client";
import { can } from "@/lib/authz/can";
import { requirePermission } from "@/lib/authz/guards";

export const metadata: Metadata = {
  title: "Procedimento",
};

export default async function ProcedureDetailPage({
  params,
}: {
  params: Promise<{ procedureId: string }>;
}) {
  const { procedureId } = await params;
  const actor = await requirePermission("procedures.view");
  return (
    <ProcedureDetailClient
      procedureId={procedureId}
      canEdit={can(actor.ctx, "procedures.update").allowed}
      canEditCosts={can(actor.ctx, "procedure_costs.update").allowed}
      canSeeCosts={can(actor.ctx, "procedure_costs.view").allowed}
      canViewPricing={
        can(actor.ctx, "procedure_pricing.view").allowed ||
        can(actor.ctx, "procedure_pricing.manage").allowed
      }
      canManagePrice={
        can(actor.ctx, "procedures.update_price").allowed ||
        can(actor.ctx, "procedure_pricing.manage").allowed
      }
    />
  );
}
