import type { HomeKpi } from "@/lib/mock/home";

export function KpiRow({ items }: { items: HomeKpi[] }) {
  return (
    <section aria-label="Indicadores do dia" className="animate-rise">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {items.map((item, index) => (
          <div
            key={item.id}
            className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/90 px-4 py-4 transition-transform duration-300 hover:-translate-y-0.5"
            style={{ animationDelay: `${index * 60}ms` }}
          >
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-subtle)]">
              {item.label}
            </p>
            <p className="mt-2 font-[family-name:var(--font-display)] text-2xl text-[var(--brand-ink)]">
              {item.value}
            </p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">{item.hint}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
