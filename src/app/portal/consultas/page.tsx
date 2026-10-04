import type { Metadata } from "next";
import { PortalAppointmentsClient } from "@/components/portal/portal-appointments-client";

export const metadata: Metadata = { title: "Consultas — Portal" };

export default async function PortalConsultasPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const sp = await searchParams;
  const tab =
    sp.tab === "historico"
      ? "historico"
      : sp.tab === "solicitacoes"
        ? "solicitacoes"
        : "proximas";
  return <PortalAppointmentsClient initialTab={tab} />;
}
