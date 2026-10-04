import type { Metadata } from "next";
import { MovementsClient } from "@/components/inventory/movements-client";
import { can } from "@/lib/authz/can";
import { requirePermission } from "@/lib/authz/guards";

export const metadata: Metadata = {
  title: "Movimentações de estoque",
};

export default async function MovimentacoesEstoquePage() {
  const actor = await requirePermission("inventory.movements_view");
  return (
    <MovementsClient
      canViewCosts={can(actor.ctx, "inventory.cost_view").allowed}
    />
  );
}
