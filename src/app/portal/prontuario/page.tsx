import type { Metadata } from "next";
import { PortalRecordsClient } from "@/components/portal/portal-records-client";

export const metadata: Metadata = { title: "Prontuário — Portal" };

export default function PortalProntuarioPage() {
  return <PortalRecordsClient />;
}
