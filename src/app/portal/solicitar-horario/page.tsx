import type { Metadata } from "next";
import { PortalRequestClient } from "@/components/portal/portal-request-client";

export const metadata: Metadata = { title: "Solicitar horário — Portal" };

export default function PortalSolicitarHorarioPage() {
  return <PortalRequestClient />;
}
