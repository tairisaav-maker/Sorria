import type { Metadata } from "next";
import Link from "next/link";
import { SorriaMark } from "@/components/brand/sorria-mark";

export const metadata: Metadata = {
  title: "Política de Privacidade",
};

export default function PrivacidadePage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <SorriaMark size="md" showSubtitle />
      <h1 className="mt-8 font-[family-name:var(--font-display)] text-3xl text-[var(--brand-ink)]">
        Política de Privacidade
      </h1>
      <p className="mt-4 text-sm text-[var(--text-muted)]">
        Placeholder — conteúdo jurídico a ser revisado antes da comercialização.
        Controles técnicos (acesso, auditoria, isolamento por clínica) estão
        documentados em SECURITY.md; isso não equivale a declaração automática
        de conformidade total com a LGPD.
      </p>
      <Link href="/login" className="mt-8 inline-block text-sm text-[var(--brand-primary)]">
        Voltar
      </Link>
    </main>
  );
}
