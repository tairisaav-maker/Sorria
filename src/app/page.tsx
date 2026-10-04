import type { Metadata } from "next";
import Link from "next/link";
import { SorriaMark } from "@/components/brand/sorria-mark";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Sorria — Gestão inteligente para consultórios",
  description:
    "Conheça o custo real dos seus procedimentos. Agenda, estoque, custos e financeiro conectados.",
};

export default function LandingPage() {
  return (
    <main className="login-atmosphere min-h-dvh">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-16 px-4 py-10 sm:px-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <SorriaMark size="md" showSubtitle />
          <div className="flex flex-wrap gap-2">
            <Link href="/login">
              <Button variant="ghost" size="sm">
                Entrar
              </Button>
            </Link>
            <Link href="/cadastro">
              <Button size="sm">Começar</Button>
            </Link>
          </div>
        </header>

        <section className="max-w-2xl animate-fade-in">
          <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-tight text-[var(--brand-ink)] sm:text-5xl">
            Conheça o custo real dos seus procedimentos.
          </h1>
          <p className="mt-4 text-lg text-[var(--text-muted)]">
            Gestão do consultório conectada ao que cada procedimento consome,
            custa, cobra e recebe — a partir da Agenda.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/cadastro">
              <Button size="lg">Começar</Button>
            </Link>
            <Link href="/planos">
              <Button size="lg" variant="secondary">
                Ver planos
              </Button>
            </Link>
          </div>
        </section>

        <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[
            "Saiba quanto cada procedimento consome",
            "Acompanhe estoque com consumo real",
            "Entenda custos diretos e operacionais",
            "Conecte Agenda, paciente e financeiro",
          ].map((text) => (
            <p
              key={text}
              className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/80 px-4 py-5 text-sm font-medium text-[var(--brand-ink)]"
            >
              {text}
            </p>
          ))}
        </section>

        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/80 px-5 py-6 text-sm text-[var(--text-muted)]">
          <p className="font-medium text-[var(--brand-ink)]">O Sorria não é</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>contabilidade completa ou lucro líquido exato</li>
            <li>IA clínica ou diagnóstico</li>
            <li>gestão fiscal / NF-e</li>
          </ul>
        </section>

        <footer className="flex flex-wrap gap-4 border-t border-[var(--border)] pt-6 text-xs text-[var(--text-subtle)]">
          <Link href="/privacidade" className="hover:underline">
            Privacidade
          </Link>
          <Link href="/termos" className="hover:underline">
            Termos
          </Link>
          <span>Sorria — Gestão inteligente para consultórios</span>
        </footer>
      </div>
    </main>
  );
}
