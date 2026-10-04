import type { Metadata } from "next";
import { ClinicCostsClient } from "@/components/finance/clinic-costs-client";
import { requirePermission } from "@/lib/authz/guards";

export const metadata: Metadata = {
  title: "Custos do consultório",
};

export default async function CustosPage() {
  await requirePermission("clinic_costs.view");
  return <ClinicCostsClient />;
}
