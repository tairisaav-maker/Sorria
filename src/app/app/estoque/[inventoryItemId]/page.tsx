import type { Metadata } from "next";
import { InventoryItemClient } from "@/components/inventory/inventory-item-client";
import { can } from "@/lib/authz/can";
import { requirePermission } from "@/lib/authz/guards";

export const metadata: Metadata = {
  title: "Item de estoque",
};

export default async function InventoryItemPage({
  params,
}: {
  params: Promise<{ inventoryItemId: string }>;
}) {
  const { inventoryItemId } = await params;
  const actor = await requirePermission("inventory.view");
  return (
    <InventoryItemClient
      itemId={inventoryItemId}
      canAdjust={can(actor.ctx, "inventory.adjust").allowed}
    />
  );
}
