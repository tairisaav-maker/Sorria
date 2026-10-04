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
      <p className="mt-4 text-sm text-[var(--text-muted)]">
        Este é um placeholder. O texto jurídico final deve ser revisado antes da
        operação comercial do Sorria. Não constitui aconselhamento legal.
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
