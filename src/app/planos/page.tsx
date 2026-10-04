import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FaqSection } from "@/components/marketing/faq-section";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { PlanosAnalytics } from "@/components/marketing/planos-analytics";
import { listPublicPlans } from "@/services/saas";

export const metadata: Metadata = {
  title: "Planos",
  description:
    "Planos Individual e Clínica do Sorria. Valores comerciais definitivos pendentes — trial e limites conforme configuração ativa.",
  openGraph: {
    title: "Planos | Sorria",
    description:
      "Quanto custa, o que está incluído, limite de profissionais e como cancelar.",
  },
};

const ENTITLEMENT_LABELS: Record<string, string> = {
  inventory: "Estoque conectado à Agenda",
  procedure_costing: "Custo de procedimento (materiais)",
  operational_costing: "Custo operacional estimado",
  advanced_reports: "Relatórios avançados",
  exports: "Exportações essenciais",
  replenishment: "Reposição inteligente",
  pricing_analysis: "Análise de preço e margem",
};

export default function PlanosPage() {
  const plans = listPublicPlans();

  return (
    <main className="login-atmosphere min-h-dvh">
      <PlanosAnalytics />
      <div className="mx-auto w-full max-w-4xl px-4 sm:px-6">
        <SiteHeader
          primaryCta={{ href: "/conhecer", label: "Testar Sorria" }}
        />
        <section className="py-12">
          <h1 className="font-[family-name:var(--font-display)] text-3xl text-[var(--brand-ink)] sm:text-4xl">
            Planos
          </h1>
          <p className="mt-3 max-w-2xl text-[var(--text-muted)]">
            Poucos planos, diferencial preservado.{" "}
            <strong className="font-medium text-[var(--brand-ink)]">
              Preços comerciais definitivos ainda não foram definidos
            </strong>{" "}
            — a página reflete a configuração ativa do sistema.
          </p>
        </section>

        <div className="grid gap-6 md:grid-cols-2">
          {plans.map((p) => (
            <article
              key={p.id}
              className="border-t border-[var(--border)] pt-5"
            >
              <h2 className="font-[family-name:var(--font-display)] text-2xl text-[var(--brand-ink)]">
                {p.name}
              </h2>
              <p className="mt-2 text-sm text-[var(--text-muted)]">
                {p.description}
              </p>
              <p className="mt-5 text-2xl font-semibold text-[var(--brand-ink)]">
                Preço sob consulta
              </p>
              <ul className="mt-3 space-y-1 text-sm text-[var(--text-muted)]">
                <li>
                  Período de teste:{" "}
                  <span className="text-[var(--brand-ink)]">
                    {p.trial_days ?? 0} dias
                  </span>
                </li>
                <li>
                  Profissionais:{" "}
                  <span className="text-[var(--brand-ink)]">
                    até {p.max_professionals ?? "—"}
                  </span>
                </li>
                <li>
                  Usuários da equipe:{" "}
                  <span className="text-[var(--brand-ink)]">
                    até {p.max_staff_users ?? "—"}
                  </span>
                </li>
                <li>Cancelamento: a qualquer momento, sem dark patterns</li>
              </ul>
              <ul className="mt-4 space-y-1.5 text-sm text-[var(--text-muted)]">
                {p.entitlements.map((e) => (
                  <li key={e}>
                    · {ENTITLEMENT_LABELS[e] ?? e.replaceAll("_", " ")}
                  </li>
                ))}
              </ul>
              <Link href="/conhecer" className="mt-6 inline-block">
                <Button size="sm">Começar</Button>
              </Link>
            </article>
          ))}
        </div>

        <section className="mt-16 space-y-3 text-sm text-[var(--text-muted)]">
          <h2 className="font-[family-name:var(--font-display)] text-xl text-[var(--brand-ink)]">
            Transparência
          </h2>
          <p>
            O custo de procedimento faz parte do núcleo — não fica escondido em
            um plano caro. Ofertas de trial ou preço fundador, quando usadas,
            são registradas no billing como condição comercial real.
          </p>
          <p>
            Não cobramos por paciente. Métricas possíveis: por clínica, por
            número de profissionais ou por plano.
          </p>
        </section>

        <div className="mt-16">
          <FaqSection />
        </div>
        <SiteFooter />
      </div>
    </main>
  );
}
