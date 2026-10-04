"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { formatBRL } from "@/lib/money";
import type { PricingReport } from "@/types/pricing";

export function PricingTab({
  queryString,
}: {
  queryString: string;
}) {
  const [data, setData] = useState<PricingReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showBelow, setShowBelow] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/demo/procedure-pricing?resource=report&${queryString}`,
      );
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Sem permissão para preços e margens.");
        setData(null);
        return;
      }
      setData(json);
    } catch {
      setError("Não foi possível carregar a análise de preços.");
    } finally {
      setLoading(false);
    }
  }, [queryString]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return <p className="text-sm text-[var(--text-muted)]">Carregando…</p>;
  }
  if (error) {
    return (
      <p className="rounded-xl bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger)]">
        {error}
      </p>
    );
  }
  if (!data || data.completed === 0) {
    return (
      <EmptyState title="Ainda não há procedimentos suficientes neste período." />
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-[var(--text-muted)]">{data.disclaimer}</p>
        <div className="flex gap-2 text-sm">
          <a
            className="text-[var(--brand-primary)] hover:underline"
            href={`/api/demo/reports?resource=export&format=csv&section=pricing&${queryString}`}
          >
            CSV
          </a>
          <a
            className="text-[var(--brand-primary)] hover:underline"
            href={`/api/demo/reports?resource=export&format=xlsx&section=pricing&${queryString}`}
          >
            XLSX
          </a>
          <a
            className="text-[var(--brand-primary)] hover:underline"
            href={`/api/demo/reports?resource=export&format=pdf&section=pricing&${queryString}`}
          >
            PDF
          </a>
        </div>
      </div>

      {data.pricing_coverage_percent != null ? (
        <p className="text-sm">
          Cobertura da análise de margem: {data.pricing_coverage_percent}%
          {data.incomplete_count > 0
            ? ` · ${data.incomplete_count} procedimento(s) sem dados completos (${Math.round(100 - (data.pricing_coverage_percent ?? 0))}% do período)`
            : ""}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={`rounded-xl px-3 py-1.5 text-sm ${
            showBelow
              ? "bg-[var(--brand-primary)] text-white"
              : "border border-[var(--border)]"
          }`}
          onClick={() => setShowBelow((v) => !v)}
        >
          Abaixo do custo operacional ({data.below_operational.length})
        </button>
      </div>

      {showBelow ? (
        data.below_operational.length === 0 ? (
          <EmptyState title="Nenhum procedimento abaixo do custo operacional neste período." />
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-[var(--border)]">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b text-xs uppercase text-[var(--text-subtle)]">
                <tr>
                  <th className="px-3 py-2">Procedimento</th>
                  <th className="px-3 py-2">Data</th>
                  <th className="px-3 py-2">Cobrado</th>
                  <th className="px-3 py-2">Custo operacional</th>
                  <th className="px-3 py-2">Diferença</th>
                </tr>
              </thead>
              <tbody>
                {data.below_operational.map((r) => (
                  <tr key={r.performed_procedure_id} className="border-b">
                    <td className="px-3 py-2">
                      {r.procedure_name}
                      {r.patient_id ? (
                        <Link
                          href={`/app/pacientes/${r.patient_id}`}
                          className="mt-0.5 block text-xs text-[var(--brand-primary)]"
                        >
                          Ver paciente
                        </Link>
                      ) : null}
                    </td>
                    <td className="px-3 py-2">
                      {r.completed_at?.slice(0, 10) ?? "—"}
                    </td>
                    <td className="px-3 py-2">
                      {r.charged_amount_cents != null
                        ? formatBRL(r.charged_amount_cents)
                        : "—"}
                    </td>
                    <td className="px-3 py-2">
                      {r.operational_total_cost_cents != null
                        ? formatBRL(r.operational_total_cost_cents)
                        : "—"}
                    </td>
                    <td className="px-3 py-2">
                      {r.operational_result_cents != null
                        ? formatBRL(r.operational_result_cents)
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : null}

      <div className="overflow-x-auto rounded-2xl border border-[var(--border)]">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b text-xs uppercase text-[var(--text-subtle)]">
            <tr>
              <th className="px-3 py-2">Procedimento</th>
              <th className="px-3 py-2">Preço padrão atual</th>
              <th className="px-3 py-2">Padrão médio (período)</th>
              <th className="px-3 py-2">Cobrado médio</th>
              <th className="px-3 py-2">Custo op. médio</th>
              <th className="px-3 py-2">Resultado agregado</th>
              <th className="px-3 py-2">Margem agregada</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r) => (
              <tr key={r.procedure_id} className="border-b">
                <td className="px-3 py-2">
                  <Link
                    href={`/app/procedimentos/${r.procedure_id}`}
                    className="font-medium text-[var(--brand-primary)]"
                  >
                    {r.procedure_name}
                  </Link>
                  {r.below_operational_count > 0 ? (
                    <p className="text-xs text-[var(--text-muted)]">
                      {r.below_operational_count} abaixo do custo operacional
                    </p>
                  ) : null}
                  {r.count < 3 && r.charged_count > 0 ? (
                    <p className="text-xs text-[var(--text-muted)]">
                      Amostra pequena — valores individuais, sem mediana
                    </p>
                  ) : null}
                </td>
                <td className="px-3 py-2">
                  {r.current_default_price_cents != null
                    ? formatBRL(r.current_default_price_cents)
                    : "—"}
                </td>
                <td className="px-3 py-2">
                  {r.avg_standard_snapshot_cents != null
                    ? formatBRL(r.avg_standard_snapshot_cents)
                    : "—"}
                </td>
                <td className="px-3 py-2">
                  {r.avg_charged_cents != null
                    ? formatBRL(r.avg_charged_cents)
                    : "—"}
                  {r.median_charged_cents != null ? (
                    <span className="block text-xs text-[var(--text-muted)]">
                      mediana {formatBRL(r.median_charged_cents)}
                    </span>
                  ) : null}
                </td>
                <td className="px-3 py-2">
                  {r.avg_operational_cost_cents != null
                    ? formatBRL(r.avg_operational_cost_cents)
                    : "Não calculável"}
                  <span className="block text-xs text-[var(--text-muted)]">
                    {r.with_operational_count}/{r.count} com dado
                  </span>
                </td>
                <td className="px-3 py-2">
                  {r.aggregate_result_cents != null
                    ? formatBRL(r.aggregate_result_cents)
                    : "—"}
                </td>
                <td className="px-3 py-2">
                  {r.aggregate_margin_percent != null
                    ? `${r.aggregate_margin_percent}%`
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data.margin_bands.some((b) => b.count > 0) ? (
        <section>
          <h3 className="mb-2 text-sm font-medium">Faixa de margens</h3>
          <ul className="flex flex-wrap gap-3 text-sm">
            {data.margin_bands.map((b) => (
              <li key={b.band}>
                {b.band}: {b.count}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
