import type { Metadata } from "next";
import { ProfileSettingsClient } from "@/components/settings/profile-settings-client";
import { requireClinic } from "@/lib/authz/guards";

export const metadata: Metadata = { title: "Perfil" };

export default async function PerfilSettingsPage() {
  await requireClinic();
  return <ProfileSettingsClient />;
}
