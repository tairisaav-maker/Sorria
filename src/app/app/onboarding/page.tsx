import type { Metadata } from "next";
import { Suspense } from "react";
import { OnboardingClient } from "@/components/settings/onboarding-client";
import { requireClinic } from "@/lib/authz/guards";

export const metadata: Metadata = {
  title: "Começar no Sorria",
};

export default async function OnboardingPage() {
  await requireClinic();
  return (
    <Suspense fallback={<p className="text-sm text-[var(--text-muted)]">Carregando…</p>}>
      <OnboardingClient />
    </Suspense>
  );
}
