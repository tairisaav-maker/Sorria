import type { Metadata } from "next";
import Link from "next/link";
import { requirePermission } from "@/lib/authz/guards";
import { SUBSCRIPTION_STATUS_LABELS } from "@/types/saas-billing";
import { getSubscriptionOverview } from "@/services/saas";
import { SubscriptionClient } from "@/components/saas/subscription-client";

export const metadata: Metadata = {
  title: "Assinatura",
};

export default async function AssinaturaPage() {
  const actor = await requirePermission("clinic.settings");
  const overview = getSubscriptionOverview(actor.ctx);
  const status = overview.subscription?.status;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <section>
        <p className="text-sm text-[var(--text-muted)]">
          <Link href="/app/configuracoes" className="text-[var(--brand-primary)]">
            Configurações
          </Link>
        </p>
        <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl text-[var(--brand-ink)]">
          Assinatura
        </h1>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Plano SaaS da clínica (separado do Financeiro do consultório).
        </p>
      </section>

      <dl className="grid gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/90 p-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-[var(--text-muted)]">Plano atual</dt>
          <dd className="font-medium">{overview.plan?.name ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-[var(--text-muted)]">Status</dt>
          <dd className="font-medium">
            {status ? SUBSCRIPTION_STATUS_LABELS[status] : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-[var(--text-muted)]">Próxima renovação / fim do trial</dt>
          <dd className="font-medium">
            {overview.subscription?.current_period_end
              ? new Date(
                  overview.subscription.current_period_end,
                ).toLocaleDateString("pt-BR")
              : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-[var(--text-muted)]">Profissionais</dt>
          <dd className="font-medium">
            {overview.usage.professionals.used}
            {overview.usage.professionals.limit != null
              ? ` de ${overview.usage.professionals.limit}`
              : ""}
          </dd>
        </div>
        <div>
          <dt className="text-[var(--text-muted)]">Usuários da equipe</dt>
          <dd className="font-medium">
            {overview.usage.staff.used}
            {overview.usage.staff.limit != null
              ? ` de ${overview.usage.staff.limit}`
              : ""}
          </dd>
        </div>
      </dl>

      <SubscriptionClient
        currentPlanCode={overview.plan?.code ?? "starter"}
        cancelAtPeriodEnd={overview.subscription?.cancel_at_period_end ?? false}
      />
    </div>
  );
}
