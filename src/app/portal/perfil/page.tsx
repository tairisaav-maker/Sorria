import type { Metadata } from "next";
import { PortalProfileClient } from "@/components/portal/portal-profile-client";

export const metadata: Metadata = { title: "Perfil — Portal" };

export default function PortalPerfilPage() {
  return <PortalProfileClient />;
}
