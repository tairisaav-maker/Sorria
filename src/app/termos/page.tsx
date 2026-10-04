import type { Metadata } from "next";
import Link from "next/link";
import { SorriaMark } from "@/components/brand/sorria-mark";

export const metadata: Metadata = {
  title: "Termos de Uso",
};

export default function TermosPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <SorriaMark size="md" showSubtitle />
      <h1 className="mt-8 font-[family-name:var(--font-display)] text-3xl text-[var(--brand-ink)]">
        Termos de Uso
      </h1>
      <p className="mt-4 rounded-xl border border-[var(--warning)]/40 bg-[var(--warning-soft,rgba(180,120,40,0.12))] px-3 py-2 text-sm font-medium text-[var(--brand-ink)]">
        REVISÃO JURÍDICA NECESSÁRIA — texto não é termo final.
      </p>
      <p className="mt-4 text-sm text-[var(--text-muted)]">
        Placeholder estrutural. Não constitui aconselhamento legal.
      </p>
      <p className="mt-4 text-sm text-[var(--text-muted)]">
        Ao usar o Sorria, a clínica permanece responsável pelos dados de seus
        pacientes e pelo cumprimento das obrigações aplicáveis (incluindo LGPD).
      </p>
      <Link href="/login" className="mt-8 inline-block text-sm text-[var(--brand-primary)]">
        Voltar
      </Link>
    </main>
  );
}
