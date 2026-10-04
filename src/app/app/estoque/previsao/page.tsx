import type { Metadata } from "next";
import { ForecastClient } from "@/components/inventory/forecast-client";
import { can } from "@/lib/authz/can";
import { requirePermission } from "@/lib/authz/guards";
import { listClinicProfessionals } from "@/services/appointments";

export const metadata: Metadata = {
  title: "Previsão de materiais",
};

export default async function PrevisaoEstoquePage() {
  const actor = await requirePermission("inventory.forecast_view");
  const professionals = listClinicProfessionals(actor.ctx);
  return (
    <ForecastClient
      professionals={professionals}
      canPurchase={can(actor.ctx, "inventory.purchase_create").allowed}
    />
  );
}
