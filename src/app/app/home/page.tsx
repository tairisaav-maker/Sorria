import type { Metadata } from "next";
import { PremiumHomeClient } from "@/components/home/premium-home-client";
import { requireClinic } from "@/lib/authz/guards";
import { getClinic, getProfile } from "@/lib/demo/authz-store";
import { getDashboardSummary } from "@/services/dashboard";

export const metadata: Metadata = {
  title: "Início",
};

export default async function HomePage() {
  const actor = await requireClinic();
  const profile = getProfile(actor.ctx.userId);
  const clinic = getClinic(actor.ctx.clinicId);
  const summary = getDashboardSummary(actor.ctx, {
    userName: profile?.full_name ?? "Profissional",
    clinicName: clinic?.name ?? "Clínica",
  });

  return <PremiumHomeClient summary={summary} />;
}
