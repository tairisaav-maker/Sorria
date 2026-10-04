import type { Metadata } from "next";
import { PortalHomeClient } from "@/components/portal/portal-home-client";

export const metadata: Metadata = { title: "Início — Portal" };

export default function PortalInicioPage() {
  return <PortalHomeClient />;
}
