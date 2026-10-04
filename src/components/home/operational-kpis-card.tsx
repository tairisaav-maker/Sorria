import { formatBRL } from "@/lib/money";

export function OperationalKpisCard({
  kpis,
}: {
  kpis: {
    procedures_completed: number;
    materials_cost_cents: number | null;
    charged_cents: number | null;
    received_cents: number | null;
  };
}) {
  return (
    <section
      aria-label="Operacional de hoje"
      className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/90 p-4 animate-rise"
    >
      <h2 className="font-[family-name:var(--font-display)] text-lg text-[var(--brand-ink)]">
        Operacional de hoje
      </h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          label="Procedimentos realizados"
          value={String(kpis.procedures_completed)}
        />
        {kpis.materials_cost_cents != null ? (
          <Metric
            label="Custo de materiais"
            value={formatBRL(kpis.materials_cost_cents)}
          />
        ) : null}
        {kpis.charged_cents != null ? (
          <Metric
            label="Valor cobrado"
            value={formatBRL(kpis.charged_cents)}
            hint="≠ recebido"
          />
        ) : null}
        {kpis.received_cents != null ? (
          <Metric
            label="Valor recebido"
            value={formatBRL(kpis.received_cents)}
            hint="Pagamentos do dia"
          />
        ) : null}
      </div>
    </section>
  );
}

function Metric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-[var(--text-subtle)]">
        {label}
      </p>
      <p className="mt-1 font-[family-name:var(--font-display)] text-xl text-[var(--brand-ink)]">
        {value}
      </p>
      {hint ? (
        <p className="text-xs text-[var(--text-muted)]">{hint}</p>
      ) : null}
    </div>
  );
}
