import type { Metadata } from "next";
import Link from "next/link";
import { SorriaMark } from "@/components/brand/sorria-mark";
import { Button } from "@/components/ui/button";
import { listPublicPlans } from "@/services/saas";

export const metadata: Metadata = {
  title: "Planos",
};

export default function PlanosPage() {
  const plans = listPublicPlans();

  return (
    <main className="login-atmosphere min-h-dvh px-4 py-10">
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SorriaMark size="md" showSubtitle />
          <Link href="/cadastro">
            <Button size="sm">Começar</Button>
          </Link>
        </div>
        <section>
          <h1 className="font-[family-name:var(--font-display)] text-3xl text-[var(--brand-ink)]">
            Planos
          </h1>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            Estrutura preparada para comercialização.{" "}
            <strong>Preços definitivos pendentes de decisão de produto</strong> —
            valores abaixo são placeholders internos.
          </p>
        </section>
        <div className="grid gap-4 md:grid-cols-2">
          {plans.map((p) => (
            <article
              key={p.id}
              className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/90 p-5"
            >
              <h2 className="text-xl font-medium text-[var(--brand-ink)]">
                {p.name}
              </h2>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                {p.description}
              </p>
              <p className="mt-4 text-2xl font-semibold">
                Preço sob consulta
                <span className="block text-xs font-normal text-[var(--text-subtle)]">
                  trial {p.trial_days ?? 0} dias · até {p.max_professionals ?? "—"}{" "}
                  profissionais
                </span>
              </p>
              <ul className="mt-4 space-y-1 text-sm text-[var(--text-muted)]">
                {p.entitlements.map((e) => (
                  <li key={e}>• {e.replaceAll("_", " ")}</li>
                ))}
              </ul>
              <Link href="/cadastro" className="mt-5 inline-block">
                <Button size="sm">Começar com {p.name}</Button>
              </Link>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}
