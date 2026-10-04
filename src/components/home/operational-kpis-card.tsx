import Link from "next/link";
import { formatBRL } from "@/lib/money";

export function OperationalKpisCard({
  kpis,
  title = "Operação do mês",
  plannedVsActual,
}: {
  kpis: {
    procedures_completed: number;
    materials_cost_cents: number | null;
    charged_cents: number | null;
    received_cents: number | null;
  };
  title?: string;
  plannedVsActual?: {
    percent: number | null;
    label: string | null;
  } | null;
}) {
  return (
    <section
      aria-label={title}
      className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/90 p-4 animate-rise"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-[family-name:var(--font-display)] text-lg text-[var(--brand-ink)]">
          {title}
        </h2>
        <Link
          href="/app/relatorios"
          className="text-sm text-[var(--brand-primary)] hover:underline"
        >
          Ver relatórios
        </Link>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          label="Procedimentos realizados"
          value={String(kpis.procedures_completed)}
        />
        {kpis.materials_cost_cents != null ? (
          <Metric
            label="Custo direto"
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
          />
        ) : null}
      </div>

      {plannedVsActual ? (
        <div className="mt-4 rounded-xl border border-[var(--border)] px-3 py-2 text-sm">
          {plannedVsActual.label ? (
            <>
              <span>{plannedVsActual.label}</span>{" "}
              <Link
                href="/app/relatorios"
                className="text-[var(--brand-primary)] hover:underline"
              >
                Ver materiais
              </Link>
            </>
          ) : (
            <span className="text-[var(--text-muted)]">
              Dados insuficientes para comparar consumo previsto e real.
            </span>
          )}
        </div>
      ) : null}
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
