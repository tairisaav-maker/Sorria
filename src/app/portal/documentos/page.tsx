import type { Metadata } from "next";
import { PortalRecordsClient } from "@/components/portal/portal-records-client";

export const metadata: Metadata = { title: "Documentos — Portal" };

export default function PortalDocumentosPage() {
  return <PortalRecordsClient />;
}
