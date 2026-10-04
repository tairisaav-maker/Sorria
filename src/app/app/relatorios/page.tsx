import type { Metadata } from "next";
import Link from "next/link";
import { requireClinic } from "@/lib/authz/guards";

export const metadata: Metadata = {
  title: "Relatórios",
};

/** Stub preparado — módulo completo na Fase 8. */
export default async function RelatoriosPage() {
  await requireClinic();
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <h1 className="font-[family-name:var(--font-display)] text-3xl text-[var(--brand-ink)]">
        Relatórios
      </h1>
      <p className="text-sm text-[var(--text-muted)]">
        O módulo completo de relatórios será disponibilizado em uma próxima
        etapa. Por enquanto, use as exportações do Financeiro.
      </p>
      <Link
        href="/app/financeiro"
        className="inline-flex h-11 items-center rounded-xl bg-[var(--brand-primary)] px-4 text-sm font-medium text-white"
      >
        Ir para Financeiro
      </Link>
    </div>
  );
}
