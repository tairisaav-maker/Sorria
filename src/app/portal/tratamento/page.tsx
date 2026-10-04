import type { Metadata } from "next";
import { PortalTreatmentClient } from "@/components/portal/portal-treatment-client";

export const metadata: Metadata = { title: "Tratamento — Portal" };

export default function PortalTratamentoPage() {
  return <PortalTreatmentClient />;
}
