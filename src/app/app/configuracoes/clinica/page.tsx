import type { Metadata } from "next";
import { ClinicSettingsClient } from "@/components/settings/clinic-settings-client";
import { requirePermission } from "@/lib/authz/guards";

export const metadata: Metadata = { title: "Clínica" };

export default async function ClinicaSettingsPage() {
  await requirePermission("clinic.settings");
  return <ClinicSettingsClient />;
}
