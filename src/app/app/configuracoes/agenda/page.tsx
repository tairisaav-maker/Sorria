import type { Metadata } from "next";
import { AgendaSettingsClient } from "@/components/settings/agenda-settings-client";
import { requirePermission } from "@/lib/authz/guards";

export const metadata: Metadata = { title: "Agenda — Configurações" };

export default async function AgendaSettingsPage() {
  await requirePermission("clinic.settings");
  return <AgendaSettingsClient />;
}
