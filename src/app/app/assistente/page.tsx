import type { Metadata } from "next";
import Link from "next/link";
import { AssistantClient } from "@/components/assistant/assistant-client";
import { requirePermission } from "@/lib/authz/guards";
import { getClinic } from "@/lib/demo/authz-store";
import { isAssistantEnabled } from "@/lib/feature-flags";

export const metadata: Metadata = {
  title: "Secretária Virtual",
};

export default async function AssistentePage() {
  const actor = await requirePermission("assistant.use");
  const clinic = getClinic(actor.ctx.clinicId);
  if (!isAssistantEnabled(clinic)) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/90 p-6">
        <h1 className="font-[family-name:var(--font-display)] text-2xl text-[var(--brand-ink)]">
          Secretária Virtual indisponível
        </h1>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Este recurso está desativado para a clínica ou ambiente. Agenda, prontuário e
          financeiro continuam funcionando normalmente.
        </p>
        <Link href="/app/home" className="mt-4 inline-block text-sm text-[var(--brand-primary)]">
          Voltar ao início
        </Link>
      </div>
    );
  }
  return <AssistantClient />;
}
