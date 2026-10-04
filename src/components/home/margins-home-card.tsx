import Link from "next/link";

export function MarginsHomeCard({ belowCount }: { belowCount: number }) {
  if (belowCount <= 0) return null;
  return (
    <section
      aria-label="Margens"
      className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/90 p-4 animate-rise"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-[family-name:var(--font-display)] text-lg text-[var(--brand-ink)]">
          Margens
        </h2>
        <Link
          href="/app/relatorios"
          className="text-sm text-[var(--brand-primary)] hover:underline"
        >
          Ver análise
        </Link>
      </div>
      <p className="mt-2 text-sm text-[var(--text-muted)]">
        {belowCount} procedimento{belowCount === 1 ? "" : "s"} ficou
        {belowCount === 1 ? "" : "ram"} abaixo do custo operacional neste mês.
      </p>
    </section>
  );
}
