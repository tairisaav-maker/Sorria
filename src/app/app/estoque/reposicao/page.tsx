import type { Metadata } from "next";
import { ReplenishmentClient } from "@/components/inventory/replenishment-client";
import { requirePermission } from "@/lib/authz/guards";

export const metadata: Metadata = {
  title: "Reposição",
};

export default async function ReposicaoPage() {
  await requirePermission("inventory.replenishment_view");
  return <ReplenishmentClient />;
}
