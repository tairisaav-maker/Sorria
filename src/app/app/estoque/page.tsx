import type { Metadata } from "next";
import { InventoryClient } from "@/components/inventory/inventory-client";
import { can } from "@/lib/authz/can";
import { requirePermission } from "@/lib/authz/guards";

export const metadata: Metadata = {
  title: "Estoque",
};

export default async function EstoquePage() {
  const actor = await requirePermission("inventory.view");
  return (
    <InventoryClient
      canCreate={can(actor.ctx, "inventory.create").allowed}
      canUpdate={can(actor.ctx, "inventory.update").allowed}
      canPurchase={can(actor.ctx, "inventory.purchase_create").allowed}
      canAdjust={can(actor.ctx, "inventory.adjust").allowed}
    />
  );
}
