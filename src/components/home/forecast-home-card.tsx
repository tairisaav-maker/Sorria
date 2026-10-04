import Link from "next/link";
import { CalendarClock, PackageSearch } from "lucide-react";

export function ForecastHomeCard({
  week,
  tomorrow,
}: {
  week: {
    materials_at_risk: number;
    procedures_planned: number;
    appointments_analyzed: number;
  };
  tomorrow: {
    appointments_analyzed: number;
    procedures_planned: number;
    materials_at_risk: number;
  };
}) {
  return (
    <section
      aria-label="Previsão de materiais"
      className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/90 p-4 animate-rise"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <PackageSearch className="size-5 text-[var(--brand-primary)]" />
          <h2 className="font-[family-name:var(--font-display)] text-lg text-[var(--brand-ink)]">
            Materiais para os próximos 7 dias
          </h2>
        </div>
        <Link
          href="/app/estoque/previsao"
          className="text-sm font-medium text-[var(--brand-primary)]"
        >
          Ver previsão
        </Link>
      </div>
      <p className="mt-3 text-sm text-[var(--text-muted)]">
        {week.materials_at_risk > 0
          ? `${week.materials_at_risk} material(is) podem faltar para os procedimentos já agendados.`
          : week.procedures_planned > 0
            ? "Estoque suficiente para os procedimentos previstos no período."
            : "Defina procedimentos previstos na Agenda para calcular materiais."}
      </p>
      <div className="mt-3 flex items-start gap-2 text-sm text-[var(--text-muted)]">
        <CalendarClock className="mt-0.5 size-4 shrink-0" aria-hidden />
        <p>
          Amanhã: {tomorrow.appointments_analyzed} consultas ·{" "}
          {tomorrow.procedures_planned} procedimentos previstos ·{" "}
          {tomorrow.materials_at_risk} material em risco
        </p>
      </div>
    </section>
  );
}
