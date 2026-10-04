"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MetricCard } from "@/components/reports/metric-card";
import { formatBRL } from "@/lib/money";
import type {
  MaterialConsumptionRow,
  OperationalOverview,
  PatientOperationalRow,
  ProcedurePerformanceRow,
  FinancialOperationalReport,
  CostCoverageReport,
} from "@/types/operational-reports";
import {
  PERIOD_PRESET_LABELS,
  type MetricValue,
  type ReportPeriodPreset,
} from "@/types/reports";

function opMetric(
  key: string,
  title: string,
  value: number,
  format: MetricValue["format"] = "number",
  tooltip?: string,
): MetricValue {
  return { key, title, value, format, tooltip };
}

type Tab =
  | "overview"
  | "procedures"
  | "materials"
  | "patients"
  | "financial";

type Bundle = {
  period: { label: string; start: string; end: string };
  clinicName: string;
  overview: OperationalOverview;
  coverage: CostCoverageReport;
  procedures: ProcedurePerformanceRow[];
  materials: MaterialConsumptionRow[] | null;
  patients: PatientOperationalRow[] | null;
  financial: FinancialOperationalReport | null;
  capabilities: {
    costs: boolean;
    materials: boolean;
    patientFinancial: boolean;
    financial: boolean;
    export: boolean;
    patients: boolean;
  };
};

const PRESETS: ReportPeriodPreset[] = [
  "today",
  "7d",
  "30d",
  "month",
  "3m",
  "6m",
  "year",
  "custom",
];

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "overview", label: "Visão geral" },
  { id: "procedures", label: "Procedimentos" },
  { id: "materials", label: "Materiais" },
  { id: "patients", label: "Pacientes" },
  { id: "financial", label: "Financeiro" },
];

export function OperationalReportsClient() {
  const [tab, setTab] = useState<Tab>("overview");
  const [preset, setPreset] = useState<ReportPeriodPreset>("month");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [detail, setDetail] = useState<string | null>(null);
  const [detailData, setDetailData] = useState<Record<string, unknown> | null>(
    null,
  );

  const qs = useCallback(() => {
    const p = new URLSearchParams({ preset });
    if (preset === "custom") {
      if (from) p.set("from", from);
      if (to) p.set("to", to);
    }
    return p.toString();
  }, [preset, from, to]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/demo/reports?resource=operational&${qs()}`);
      const data = await res.json();
      if (!res.ok) {
        setError(
          data.error ?? "Não foi possível carregar este relatório. Tente novamente.",
        );
        setBundle(null);
        return;
      }
      setBundle(data);
    } catch {
      setError("Não foi possível carregar este relatório. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }, [qs]);

  useEffect(() => {
    void load();
  }, [load]);

  async function openProcedure(id: string) {
    setDetail(`proc:${id}`);
    const res = await fetch(
      `/api/demo/reports?resource=procedure-detail&procedureId=${id}&${qs()}`,
    ).then((r) => r.json());
    setDetailData(res);
  }

  async function openMaterial(id: string) {
    setDetail(`mat:${id}`);
    const res = await fetch(
      `/api/demo/reports?resource=material-detail&itemId=${id}&${qs()}`,
    ).then((r) => r.json());
    setDetailData(res);
  }

  function exportFile(format: "pdf" | "xlsx" | "csv") {
    window.location.href = `/api/demo/reports?resource=export&format=${format}&section=operational&${qs()}`;
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <header>
        <h1 className="font-[family-name:var(--font-display)] text-3xl text-[var(--brand-ink)]">
          Relatórios
        </h1>
        <p className="mt-1 text-[var(--text-muted)]">
          Entenda custos, consumo, procedimentos e resultados do consultório.
        </p>
      </header>

      <div className="flex flex-wrap items-end gap-3">
        <Button
          type="button"
          variant="secondary"
          className="sm:hidden"
          onClick={() => setFiltersOpen((v) => !v)}
        >
          {filtersOpen ? "Fechar filtros" : "Filtros"}
        </Button>
        <div
          className={`flex w-full flex-wrap items-end gap-3 ${
            filtersOpen ? "flex" : "hidden sm:flex"
          }`}
        >
          <div>
            <Label htmlFor="preset">Período</Label>
            <select
              id="preset"
              className="mt-1 h-10 rounded-xl border border-[var(--border)] bg-white px-3 text-sm"
              value={preset}
              onChange={(e) => setPreset(e.target.value as ReportPeriodPreset)}
            >
              {PRESETS.map((p) => (
                <option key={p} value={p}>
                  {PERIOD_PRESET_LABELS[p]}
                </option>
              ))}
            </select>
          </div>
          {preset === "custom" ? (
            <>
              <div>
                <Label htmlFor="from">De</Label>
                <Input
                  id="from"
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="to">Até</Label>
                <Input
                  id="to"
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                />
              </div>
            </>
          ) : null}
          <Button type="button" variant="secondary" onClick={() => void load()}>
            Atualizar
          </Button>
          {bundle?.capabilities.export ? (
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="ghost" onClick={() => exportFile("pdf")}>
                PDF
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => exportFile("xlsx")}>
                XLSX
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => exportFile("csv")}>
                CSV
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      {bundle ? (
        <p className="text-sm text-[var(--text-muted)]">
          {bundle.clinicName} · {bundle.period.label}
        </p>
      ) : null}

      <nav className="flex gap-1 overflow-x-auto border-b border-[var(--border)] pb-px">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setTab(t.id);
              setDetail(null);
            }}
            className={`whitespace-nowrap px-3 py-2 text-sm font-medium ${
              tab === t.id
                ? "border-b-2 border-[var(--brand-primary)] text-[var(--brand-ink)]"
                : "text-[var(--text-muted)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {loading ? (
        <p className="text-sm text-[var(--text-muted)]">Carregando…</p>
      ) : null}
      {error ? (
        <p className="rounded-xl bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger)]">
          {error}
        </p>
      ) : null}

      {!loading && bundle && tab === "overview" ? (
        <OverviewTab
          bundle={bundle}
          onOpenMaterials={() => {
            setTab("materials");
            setDetail(null);
          }}
        />
      ) : null}
      {!loading && bundle && tab === "procedures" ? (
        <ProceduresTab
          rows={bundle.procedures}
          canCosts={bundle.capabilities.costs}
          onOpen={openProcedure}
        />
      ) : null}
      {!loading && bundle && tab === "materials" ? (
        bundle.materials ? (
          <MaterialsTab rows={bundle.materials} onOpen={openMaterial} />
        ) : (
          <EmptyState title="Sem permissão para ver consumo de materiais." />
        )
      ) : null}
      {!loading && bundle && tab === "patients" ? (
        bundle.patients ? (
          <PatientsTab
            rows={bundle.patients}
            canCosts={bundle.capabilities.costs}
            canFin={bundle.capabilities.patientFinancial}
          />
        ) : (
          <EmptyState title="Sem permissão para ver pacientes." />
        )
      ) : null}
      {!loading && bundle && tab === "financial" ? (
        bundle.financial ? (
          <FinancialTab data={bundle.financial} canCosts={bundle.capabilities.costs} />
        ) : (
          <EmptyState title="Sem permissão para o relatório financeiro operacional." />
        )
      ) : null}

      {detail && detailData ? (
        <DetailPanel
          detail={detail}
          data={detailData}
          onClose={() => {
            setDetail(null);
            setDetailData(null);
          }}
        />
      ) : null}

      <p className="text-xs text-[var(--text-subtle)]">
        <Link href="/app/relatorios?classic=1" className="underline">
          Ver indicadores clássicos (agenda / tratamentos)
        </Link>
      </p>
    </div>
  );
}

function OverviewTab({
  bundle,
  onOpenMaterials,
}: {
  bundle: Bundle;
  onOpenMaterials: () => void;
}) {
  const o = bundle.overview;
  const c = bundle.coverage;
  if (o.procedures_completed === 0) {
    return (
      <EmptyState title="Ainda não há procedimentos suficientes neste período." />
    );
  }
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard
          metric={opMetric(
            "procedures",
            "Procedimentos realizados",
            o.procedures_completed,
            "number",
            o.previous_comparison.procedures.label,
          )}
        />
        {o.materials_cost_cents != null ? (
          <MetricCard
            metric={opMetric(
              "materials_cost",
              "Custo real de materiais",
              o.materials_cost_cents,
              "currency_cents",
              "Custos diretos confirmados",
            )}
          />
        ) : null}
        {o.charged_cents != null ? (
          <MetricCard
            metric={opMetric(
              "charged",
              "Valor cobrado",
              o.charged_cents,
              "currency_cents",
            )}
          />
        ) : null}
        {o.received_cents != null ? (
          <MetricCard
            metric={opMetric(
              "received",
              "Valor recebido",
              o.received_cents,
              "currency_cents",
              "≠ cobrado",
            )}
          />
        ) : null}
        {o.gross_result_charged_cents != null ? (
          <MetricCard
            metric={opMetric(
              "gross",
              "Resultado bruto",
              o.gross_result_charged_cents,
              "currency_cents",
              "Cobrado − custos diretos (não é lucro líquido)",
            )}
          />
        ) : null}
        {o.receivable_cents != null ? (
          <MetricCard
            metric={opMetric(
              "receivable",
              "A receber",
              o.receivable_cents,
              "currency_cents",
            )}
          />
        ) : null}
      </div>

      {c.coverage_percent != null ? (
        <p className="text-sm text-[var(--text-muted)]" title="Percentual de procedimentos concluídos que possuem dados suficientes para cálculo de custo direto.">
          Cobertura de custos: {c.coverage_percent}%
          {c.incomplete_count > 0
            ? ` · ${c.incomplete_count} procedimento(s) com custo incompleto`
            : ""}
        </p>
      ) : null}

      {o.planned_vs_actual_label ? (
        <p className="rounded-xl border border-[var(--border)] px-4 py-3 text-sm">
          {o.planned_vs_actual_label}{" "}
          <button
            type="button"
            className="text-[var(--brand-primary)] underline"
            onClick={onOpenMaterials}
          >
            Ver materiais
          </button>
        </p>
      ) : o.planned_vs_actual_percent == null ? (
        <p className="text-sm text-[var(--text-muted)]">
          Dados insuficientes para comparar consumo previsto e real.
        </p>
      ) : null}

      {bundle.procedures.length > 0 ? (
        <section>
          <h2 className="mb-2 font-medium">Procedimentos mais realizados</h2>
          <div className="h-56">
            <ResponsiveContainer>
              <BarChart
                layout="vertical"
                data={bundle.procedures.slice(0, 8).map((p) => ({
                  name: p.procedure_name,
                  qtd: p.count,
                }))}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="qtd" fill="var(--brand-primary)" radius={4} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function ProceduresTab({
  rows,
  canCosts,
  onOpen,
}: {
  rows: ProcedurePerformanceRow[];
  canCosts: boolean;
  onOpen: (id: string) => void;
}) {
  if (rows.length === 0) {
    return (
      <EmptyState title="Ainda não há procedimentos suficientes neste período." />
    );
  }
  const chartData = rows.slice(0, 8).map((r) => ({
    name: r.procedure_name,
    custo: (r.avg_actual_cost_cents ?? 0) / 100,
    cobrado: (r.avg_charged_cents ?? 0) / 100,
  }));

  return (
    <div className="space-y-5">
      {canCosts ? (
        <section>
          <h2 className="mb-2 font-medium">Custo médio × valor médio cobrado</h2>
          <div className="h-56">
            <ResponsiveContainer>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="custo" name="Custo médio (R$)" fill="var(--warning)" />
                <Bar dataKey="cobrado" name="Cobrado médio (R$)" fill="var(--brand-primary)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      ) : null}

      <div className="overflow-x-auto rounded-2xl border border-[var(--border)]">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b text-xs uppercase text-[var(--text-subtle)]">
            <tr>
              <th className="px-3 py-2">Procedimento</th>
              <th className="px-3 py-2">Realizados</th>
              {canCosts ? <th className="px-3 py-2">Custo médio real</th> : null}
              <th className="px-3 py-2">Valor médio cobrado</th>
              {canCosts ? <th className="px-3 py-2">Resultado bruto</th> : null}
              {canCosts ? <th className="px-3 py-2">Margem</th> : null}
              {canCosts ? <th className="px-3 py-2">Desvio custo</th> : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.procedure_id} className="border-b border-[var(--border)]">
                <td className="px-3 py-2">
                  <button
                    type="button"
                    className="font-medium text-[var(--brand-primary)] hover:underline"
                    onClick={() => onOpen(r.procedure_id)}
                  >
                    {r.procedure_name}
                  </button>
                  {r.incomplete_cost_count > 0 ? (
                    <p className="text-xs text-[var(--warning)]">
                      {r.incomplete_cost_count} com custo incompleto
                    </p>
                  ) : null}
                </td>
                <td className="px-3 py-2">{r.count}</td>
                {canCosts ? (
                  <td className="px-3 py-2">
                    {r.avg_actual_cost_cents != null
                      ? formatBRL(r.avg_actual_cost_cents)
                      : "—"}
                  </td>
                ) : null}
                <td className="px-3 py-2">
                  {r.avg_charged_cents != null
                    ? formatBRL(r.avg_charged_cents)
                    : "—"}
                </td>
                {canCosts ? (
                  <td className="px-3 py-2">
                    {r.gross_result_cents != null
                      ? formatBRL(r.gross_result_cents)
                      : "—"}
                  </td>
                ) : null}
                {canCosts ? (
                  <td className="px-3 py-2">
                    {r.margin_percent != null ? `${r.margin_percent}%` : "—"}
                  </td>
                ) : null}
                {canCosts ? (
                  <td className="px-3 py-2">
                    {r.cost_deviation_percent != null
                      ? `${r.cost_deviation_percent > 0 ? "+" : ""}${r.cost_deviation_percent}% acima/abaixo do previsto`.replace(
                          "acima/abaixo",
                          r.cost_deviation_percent >= 0 ? "acima" : "abaixo",
                        )
                      : "—"}
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MaterialsTab({
  rows,
  onOpen,
}: {
  rows: MaterialConsumptionRow[];
  onOpen: (id: string) => void;
}) {
  if (rows.length === 0) {
    return <EmptyState title="Nenhum consumo confirmado neste período." />;
  }
  return (
    <div className="overflow-x-auto rounded-2xl border border-[var(--border)]">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b text-xs uppercase text-[var(--text-subtle)]">
          <tr>
            <th className="px-3 py-2">Material</th>
            <th className="px-3 py-2">Previsto</th>
            <th className="px-3 py-2">Utilizado</th>
            <th className="px-3 py-2">Diferença</th>
            <th className="px-3 py-2">Custo consumido</th>
            <th className="px-3 py-2">Estoque</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.inventory_item_id} className="border-b">
              <td className="px-3 py-2">
                <button
                  type="button"
                  className="font-medium text-[var(--brand-primary)] hover:underline"
                  onClick={() => onOpen(r.inventory_item_id)}
                >
                  {r.item_name}
                </button>
                <p className="text-xs text-[var(--text-muted)]">
                  {r.procedures_count} procedimento(s)
                </p>
              </td>
              <td className="px-3 py-2">
                {r.planned_quantity} {r.consumption_unit}
              </td>
              <td className="px-3 py-2">
                {r.actual_quantity} {r.consumption_unit}
              </td>
              <td className="px-3 py-2">
                {r.difference > 0 ? "+" : ""}
                {r.difference} {r.consumption_unit}
                {r.difference_percent != null
                  ? ` (${r.difference_percent > 0 ? "+" : ""}${r.difference_percent}%)`
                  : ""}
              </td>
              <td className="px-3 py-2">
                {r.cost_incomplete
                  ? "Custo incompleto"
                  : r.cost_consumed_cents != null
                    ? formatBRL(r.cost_consumed_cents)
                    : "—"}
              </td>
              <td className="px-3 py-2">
                {r.current_stock != null
                  ? `${r.current_stock} ${r.consumption_unit}`
                  : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PatientsTab({
  rows,
  canCosts,
  canFin,
}: {
  rows: PatientOperationalRow[];
  canCosts: boolean;
  canFin: boolean;
}) {
  if (rows.length === 0) {
    return (
      <EmptyState title="Ainda não há procedimentos suficientes neste período." />
    );
  }
  return (
    <div className="overflow-x-auto rounded-2xl border border-[var(--border)]">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b text-xs uppercase text-[var(--text-subtle)]">
          <tr>
            <th className="px-3 py-2">Paciente</th>
            <th className="px-3 py-2">Procedimentos</th>
            {canCosts ? <th className="px-3 py-2">Custo direto</th> : null}
            <th className="px-3 py-2">Cobrado</th>
            {canFin ? <th className="px-3 py-2">Recebido</th> : null}
            {canFin ? <th className="px-3 py-2">Saldo</th> : null}
            {canCosts ? (
              <th className="px-3 py-2">Resultado bruto associado</th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.patient_id} className="border-b">
              <td className="px-3 py-2">
                <Link
                  href={`/app/pacientes/${r.patient_id}`}
                  className="font-medium text-[var(--brand-primary)]"
                >
                  {r.patient_name}
                </Link>
              </td>
              <td className="px-3 py-2">{r.procedures_count}</td>
              {canCosts ? (
                <td className="px-3 py-2">
                  {r.direct_cost_cents != null
                    ? formatBRL(r.direct_cost_cents)
                    : "—"}
                </td>
              ) : null}
              <td className="px-3 py-2">
                {r.charged_cents != null ? formatBRL(r.charged_cents) : "—"}
              </td>
              {canFin ? (
                <td className="px-3 py-2">
                  {r.received_cents != null ? formatBRL(r.received_cents) : "—"}
                </td>
              ) : null}
              {canFin ? (
                <td className="px-3 py-2">
                  {r.outstanding_cents != null
                    ? formatBRL(r.outstanding_cents)
                    : "—"}
                </td>
              ) : null}
              {canCosts ? (
                <td className="px-3 py-2">
                  {r.gross_result_cents != null
                    ? formatBRL(r.gross_result_cents)
                    : "—"}
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FinancialTab({
  data,
  canCosts,
}: {
  data: FinancialOperationalReport;
  canCosts: boolean;
}) {
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {data.charged_cents != null ? (
          <MetricCard
            metric={opMetric(
              "fin_charged",
              "Valor cobrado",
              data.charged_cents,
              "currency_cents",
            )}
          />
        ) : null}
        {data.received_cents != null ? (
          <MetricCard
            metric={opMetric(
              "fin_received",
              "Valor recebido",
              data.received_cents,
              "currency_cents",
            )}
          />
        ) : null}
        {data.receivable_cents != null ? (
          <MetricCard
            metric={opMetric(
              "fin_receivable",
              "A receber",
              data.receivable_cents,
              "currency_cents",
            )}
          />
        ) : null}
        {data.overdue_cents != null ? (
          <MetricCard
            metric={opMetric(
              "fin_overdue",
              "Vencido",
              data.overdue_cents,
              "currency_cents",
            )}
          />
        ) : null}
        {canCosts && data.direct_cost_cents != null ? (
          <MetricCard
            metric={opMetric(
              "fin_cost",
              "Custos diretos",
              data.direct_cost_cents,
              "currency_cents",
            )}
          />
        ) : null}
        {canCosts && data.gross_result_charged_cents != null ? (
          <MetricCard
            metric={opMetric(
              "fin_gross",
              "Resultado bruto",
              data.gross_result_charged_cents,
              "currency_cents",
              "Não é lucro líquido da clínica",
            )}
          />
        ) : null}
      </div>
      {data.series.length > 0 ? (
        <section>
          <h2 className="mb-2 font-medium">Cobrado × Recebido × Custos diretos</h2>
          <div className="h-64">
            <ResponsiveContainer>
              <LineChart
                data={data.series.map((s) => ({
                  label: s.label,
                  cobrado: s.charged_cents / 100,
                  recebido: s.received_cents / 100,
                  custos: s.direct_cost_cents / 100,
                }))}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="cobrado" name="Cobrado" stroke="var(--brand-primary)" />
                <Line type="monotone" dataKey="recebido" name="Recebido" stroke="var(--success)" />
                {canCosts ? (
                  <Line type="monotone" dataKey="custos" name="Custos" stroke="var(--warning)" />
                ) : null}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      ) : (
        <EmptyState title="Ainda não há dados suficientes para o gráfico." />
      )}
    </div>
  );
}

function DetailPanel({
  detail,
  data,
  onClose,
}: {
  detail: string;
  data: Record<string, unknown>;
  onClose: () => void;
}) {
  const isProc = detail.startsWith("proc:");
  const title = isProc
    ? String(data.procedure_name ?? "Procedimento")
    : String(data.item_name ?? "Material");

  return (
    <aside className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-medium text-[var(--brand-ink)]">{title}</h3>
        <Button type="button" size="sm" variant="ghost" onClick={onClose}>
          Fechar
        </Button>
      </div>
      <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
        {isProc ? (
          <>
            <DetailItem label="Realizados" value={String(data.count ?? "—")} />
            <DetailItem
              label="Preço padrão atual"
              value={
                typeof data.standard_price_cents === "number"
                  ? formatBRL(data.standard_price_cents)
                  : "—"
              }
            />
            <DetailItem
              label="Custo real médio"
              value={
                typeof data.avg_actual_cost_cents === "number"
                  ? formatBRL(data.avg_actual_cost_cents)
                  : "—"
              }
            />
            <DetailItem
              label="Custo previsto médio"
              value={
                typeof data.avg_planned_cost_cents === "number"
                  ? formatBRL(data.avg_planned_cost_cents)
                  : "—"
              }
            />
            <DetailItem
              label="Valor médio cobrado"
              value={
                typeof data.avg_charged_cents === "number"
                  ? formatBRL(data.avg_charged_cents)
                  : "—"
              }
            />
            <DetailItem
              label="Valor recebido"
              value={
                typeof data.total_received_cents === "number"
                  ? formatBRL(data.total_received_cents)
                  : "—"
              }
            />
            <DetailItem
              label="Resultado bruto"
              value={
                typeof data.gross_result_cents === "number"
                  ? formatBRL(data.gross_result_cents)
                  : "—"
              }
            />
            <DetailItem
              label="Margem"
              value={
                typeof data.margin_percent === "number"
                  ? `${data.margin_percent}%`
                  : "—"
              }
            />
          </>
        ) : (
          <>
            <DetailItem
              label="Estoque atual"
              value={
                data.current_stock != null
                  ? `${data.current_stock} ${data.consumption_unit ?? ""}`
                  : "—"
              }
            />
            <DetailItem
              label="Custo médio"
              value={
                typeof data.average_unit_cost_cents === "number"
                  ? formatBRL(data.average_unit_cost_cents)
                  : "—"
              }
            />
            <DetailItem
              label="Quantidade consumida"
              value={`${data.actual_quantity ?? "—"} ${data.consumption_unit ?? ""}`}
            />
            <DetailItem
              label="Custo total consumido"
              value={
                data.cost_incomplete
                  ? "Custo incompleto"
                  : typeof data.cost_consumed_cents === "number"
                    ? formatBRL(data.cost_consumed_cents)
                    : "—"
              }
            />
            <DetailItem
              label="Previsto × real"
              value={`${data.planned_quantity ?? "—"} → ${data.actual_quantity ?? "—"} ${data.consumption_unit ?? ""}`}
            />
          </>
        )}
      </dl>

      {isProc && Array.isArray(data.monthly_series) && data.monthly_series.length > 0 ? (
        <div className="mt-4 h-40">
          <ResponsiveContainer>
            <LineChart
              data={(data.monthly_series as Array<{
                label: string;
                count: number;
                avg_cost_cents: number | null;
              }>).map((s) => ({
                label: s.label,
                qtd: s.count,
                custo: (s.avg_cost_cents ?? 0) / 100,
              }))}
            >
              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Line type="monotone" dataKey="custo" name="Custo médio (R$)" stroke="var(--warning)" />
              <Line type="monotone" dataKey="qtd" name="Quantidade" stroke="var(--brand-primary)" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : null}

      {isProc && Array.isArray(data.recent) ? (
        <ul className="mt-4 max-h-48 space-y-2 overflow-auto text-sm">
          {(data.recent as Array<{
            id: string;
            patient_id: string;
            patient_name: string | null;
            completed_at: string | null;
            charged_amount_cents: number | null;
          }>).map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] py-1">
              <span>
                {r.patient_name ? (
                  <Link
                    href={`/app/pacientes/${r.patient_id}`}
                    className="text-[var(--brand-primary)]"
                  >
                    {r.patient_name}
                  </Link>
                ) : (
                  "Paciente"
                )}
              </span>
              <span className="text-[var(--text-muted)]">
                {r.charged_amount_cents != null
                  ? formatBRL(r.charged_amount_cents)
                  : "—"}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {!isProc && Array.isArray(data.usages) ? (
        <ul className="mt-4 max-h-48 space-y-2 overflow-auto text-sm">
          {(data.usages as Array<{
            performed_procedure_id: string;
            procedure_name: string;
            patient_name: string | null;
            actual_quantity: number;
            planned_quantity: number;
          }>).map((u) => (
            <li
              key={u.performed_procedure_id + u.procedure_name}
              className="border-b border-[var(--border)] py-1"
            >
              <span className="font-medium">{u.procedure_name}</span>
              {u.patient_name ? (
                <span className="text-[var(--text-muted)]"> · {u.patient_name}</span>
              ) : null}
              <span className="block text-xs text-[var(--text-muted)]">
                {u.planned_quantity} → {u.actual_quantity}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {!isProc && Array.isArray(data.recent_purchases) && data.recent_purchases.length > 0 ? (
        <div className="mt-4">
          <p className="text-xs uppercase text-[var(--text-subtle)]">Últimas compras</p>
          <ul className="mt-1 space-y-1 text-sm">
            {(data.recent_purchases as Array<{
              id: string;
              purchase_date: string;
              quantity: number;
              total_cost_cents: number | null;
            }>).map((p) => (
              <li key={p.id + p.purchase_date}>
                {p.purchase_date}: {p.quantity}
                {p.total_cost_cents != null ? ` · ${formatBRL(p.total_cost_cents)}` : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </aside>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase text-[var(--text-subtle)]">{label}</dt>
      <dd className="text-[var(--brand-ink)]">{value}</dd>
    </div>
  );
}
