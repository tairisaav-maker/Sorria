import type { Metadata } from "next";
import { PurchasesClient } from "@/components/inventory/purchases-client";
import { can } from "@/lib/authz/can";
import { requirePermission } from "@/lib/authz/guards";

export const metadata: Metadata = {
  title: "Compras de estoque",
};

export default async function ComprasEstoquePage() {
  const actor = await requirePermission("inventory.view");
  return (
    <PurchasesClient
      canPurchase={can(actor.ctx, "inventory.purchase_create").allowed}
      canViewCosts={can(actor.ctx, "inventory.cost_view").allowed}
    />
  );
}
