import type { Metadata } from "next";
import { SecuritySettingsClient } from "@/components/settings/security-settings-client";
import { can } from "@/lib/authz/can";
import { requireClinic } from "@/lib/authz/guards";

export const metadata: Metadata = { title: "Segurança" };

export default async function SegurancaPage() {
  const actor = await requireClinic();
  const canAudit = can(actor.ctx, "audit.view").allowed;
  return <SecuritySettingsClient canAudit={canAudit} />;
}
