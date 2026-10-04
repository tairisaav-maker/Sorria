"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MetricCard } from "@/components/reports/metric-card";
import {
  DualCashflow,
  HorizontalCounts,
  SeriesLine,
  StatusBars,
} from "@/components/reports/report-charts";
import { formatBRL } from "@/lib/money";
import type {
  OverdueAccountRow,
  PendingDecisionRow,
  PendingReturnRow,
  ReportPeriodPreset,
  ReportSection,
} from "@/types/reports";
import { PERIOD_PRESET_LABELS } from "@/types/reports";

type Bundle = {
  period: { label: string; start: string; end: string };
  clinicName: string;
  sections: {
    overview: {
      completed_appointments: import("@/types/reports").MetricValue;
      new_patients: import("@/types/reports").MetricValue;
      accepted_plans: import("@/types/reports").MetricValue;
      received_cents: import("@/types/reports").MetricValue | null;
      no_shows: import("@/types/reports").MetricValue | null;
      cancellations: import("@/types/reports").MetricValue | null;
      receivable_cents: import("@/types/reports").MetricValue | null;
      overdue_cents: import("@/types/reports").MetricValue | null;
      insights: string[];
    };
    schedule: import("@/types/reports").ScheduleMetrics | null;
    patients: import("@/types/reports").PatientMetrics | null;
    treatments: import("@/types/reports").TreatmentMetrics | null;
    financial: import("@/types/reports").FinancialMetrics | null;
  };
  capabilities: {
    schedule: boolean;
    patients: boolean;
    treatments: boolean;
    financial: boolean;
    export: boolean;
    clinicalReturns: boolean;
  };
};

type Tab = ReportSection;
type Drill = "pending_returns" | "overdue" | "pending_decisions" | null;

const PRESETS: ReportPeriodPreset[] = ["7d", "30d", "month", "6m", "year", "custom"];

export function ReportsClient() {
  const [tab, setTab] = useState<Tab>("overview");
  const [preset, setPreset] = useState<ReportPeriodPreset>("30d");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [drill, setDrill] = useState<Drill>(null);
  const [drillRows, setDrillRows] = useState<
    PendingReturnRow[] | OverdueAccountRow[] | PendingDecisionRow[]
  >([]);

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
      const res = await fetch(`/api/demo/reports?resource=bundle&${qs()}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Não foi possível carregar os relatórios.");
        setBundle(null);
        return;
      }
      setBundle(data);
    } catch {
      setError("Não foi possível carregar os relatórios.");
    } finally {
      setLoading(false);
    }
  }, [qs]);

  useEffect(() => {
    void load();
  }, [load]);

  async function openDrill(kind: Drill) {
    if (!kind) return;
    setDrill(kind);
    const resource =
      kind === "pending_returns"
        ? "pending-returns"
        : kind === "overdue"
          ? "overdue"
          : "pending-decisions";
    const res = await fetch(`/api/demo/reports?resource=${resource}&${qs()}`);
    const data = await res.json();
    if (res.ok) setDrillRows(data.items ?? []);
    else setDrillRows([]);
  }

  async function exportFmt(format: "pdf" | "xlsx" | "csv") {
    const res = await fetch(
      `/api/demo/reports?resource=export&format=${format}&section=${tab}&${qs()}`,
    );
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Exportação negada.");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sorria-relatorio.${format === "xlsx" ? "xlsx" : format}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const tabs: Array<{ id: Tab; label: string; enabled: boolean }> = [
    { id: "overview", label: "Visão geral", enabled: true },
    {
      id: "schedule",
      label: "Agenda",
      enabled: bundle?.capabilities.schedule ?? false,
    },
    {
      id: "patients",
      label: "Pacientes",
      enabled: bundle?.capabilities.patients ?? false,
    },
    {
      id: "treatments",
      label: "Tratamentos",
      enabled: bundle?.capabilities.treatments ?? false,
    },
    {
      id: "financial",
      label: "Financeiro",
      enabled: bundle?.capabilities.financial ?? false,
    },
  ];

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
      <header className="space-y-1">
        <h1 className="font-[family-name:var(--font-display)] text-3xl text-[var(--brand-ink)]">
          Relatórios
        </h1>
        <p className="text-sm text-[var(--text-muted)]">
          Acompanhe os principais indicadores do consultório.
        </p>
        {bundle ? (
          <p className="text-xs text-[var(--text-subtle)]">
            {bundle.clinicName} · {bundle.period.label}
          </p>
        ) : null}
      </header>

      <section className="flex flex-wrap gap-2" aria-label="Período">
        {PRESETS.map((p) => (
          <Button
            key={p}
            type="button"
            size="sm"
            variant={preset === p ? "primary" : "secondary"}
            onClick={() => setPreset(p)}
          >
            {PERIOD_PRESET_LABELS[p]}
          </Button>
        ))}
      </section>

      {preset === "custom" ? (
        <div className="grid max-w-md grid-cols-2 gap-3">
          <div>
            <Label htmlFor="from">Data inicial</Label>
            <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="to">Data final</Label>
            <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Áreas">
        {tabs
          .filter((t) => t.enabled)
          .map((t) => (
            <Button
              key={t.id}
              type="button"
              size="sm"
              variant={tab === t.id ? "primary" : "secondary"}
              onClick={() => {
                setTab(t.id);
                setDrill(null);
              }}
            >
              {t.label}
            </Button>
          ))}
      </div>

      {bundle?.capabilities.export ? (
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="secondary" onClick={() => void exportFmt("pdf")}>
            Exportar PDF
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={() => void exportFmt("xlsx")}>
            Exportar XLSX
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={() => void exportFmt("csv")}>
            Exportar CSV
          </Button>
        </div>
      ) : null}

      {error ? (
        <p className="rounded-xl bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger)]" role="alert">
          {error}
        </p>
      ) : null}

      {loading || !bundle ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-[var(--surface-muted)]" />
          ))}
        </div>
      ) : (
        <>
          {tab === "overview" ? (
            <OverviewSection
              bundle={bundle}
              onDrill={(d) => void openDrill(d)}
            />
          ) : null}
          {tab === "schedule" && bundle.sections.schedule ? (
            <ScheduleSection data={bundle.sections.schedule} />
          ) : null}
          {tab === "patients" && bundle.sections.patients ? (
            <PatientsSection
              data={bundle.sections.patients}
              onDrill={() => void openDrill("pending_returns")}
            />
          ) : null}
          {tab === "treatments" && bundle.sections.treatments ? (
            <TreatmentsSection
              data={bundle.sections.treatments}
              onDrill={() => void openDrill("pending_decisions")}
            />
          ) : null}
          {tab === "financial" && bundle.sections.financial ? (
            <FinancialSection
              data={bundle.sections.financial}
              onDrill={() => void openDrill("overdue")}
            />
          ) : null}
          {tab !== "overview" &&
          ((tab === "schedule" && !bundle.sections.schedule) ||
            (tab === "patients" && !bundle.sections.patients) ||
            (tab === "treatments" && !bundle.sections.treatments) ||
            (tab === "financial" && !bundle.sections.financial)) ? (
            <p className="text-sm text-[var(--text-muted)]">
              Você não tem permissão para esta seção.
            </p>
          ) : null}
        </>
      )}

      {drill ? (
        <DrillPanel
          kind={drill}
          rows={drillRows}
          onClose={() => setDrill(null)}
        />
      ) : null}
    </div>
  );
}

function OverviewSection({
  bundle,
  onDrill,
}: {
  bundle: Bundle;
  onDrill: (d: Drill) => void;
}) {
  const o = bundle.sections.overview;
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard metric={o.completed_appointments} />
        <MetricCard metric={o.new_patients} />
        <MetricCard metric={o.accepted_plans} />
        {o.received_cents ? <MetricCard metric={o.received_cents} /> : null}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {o.no_shows ? <MetricCard metric={o.no_shows} /> : null}
        {o.cancellations ? <MetricCard metric={o.cancellations} /> : null}
        {o.receivable_cents ? <MetricCard metric={o.receivable_cents} /> : null}
        {o.overdue_cents ? (
          <MetricCard metric={o.overdue_cents} onDrill={() => onDrill("overdue")} />
        ) : null}
      </div>
      {o.insights.length > 0 ? (
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/90 p-4">
          <h2 className="font-[family-name:var(--font-display)] text-lg">Atenção</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[var(--text-muted)]">
            {o.insights.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function ScheduleSection({
  data,
}: {
  data: NonNullable<Bundle["sections"]["schedule"]>;
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard metric={data.scheduled_in_period} />
        <MetricCard metric={data.completed} />
        <MetricCard metric={data.cancelled} />
        <MetricCard metric={data.no_shows} />
        <MetricCard metric={data.attendance_rate} />
        <MetricCard metric={data.no_show_rate} />
      </div>
      <p className="rounded-xl bg-[var(--surface-muted)] px-3 py-2 text-sm text-[var(--text-muted)]">
        {data.occupancy.message}
      </p>
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/90 p-4">
        <h2 className="mb-2 font-[family-name:var(--font-display)] text-lg">
          Consultas por status
        </h2>
        <StatusBars data={data.by_status} />
      </section>
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/90 p-4">
        <h2 className="mb-2 font-[family-name:var(--font-display)] text-lg">
          Consultas realizadas
        </h2>
        <SeriesLine data={data.completed_over_time} name="Concluídas" />
      </section>
    </div>
  );
}

function PatientsSection({
  data,
  onDrill,
}: {
  data: NonNullable<Bundle["sections"]["patients"]>;
  onDrill: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard metric={data.new_patients} />
        <MetricCard metric={data.active_registered} />
        <MetricCard metric={data.pending_returns} onDrill={onDrill} />
      </div>
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/90 p-4">
        <h2 className="mb-2 font-[family-name:var(--font-display)] text-lg">
          Origem dos pacientes novos
        </h2>
        <HorizontalCounts data={data.by_referral} />
      </section>
    </div>
  );
}

function TreatmentsSection({
  data,
  onDrill,
}: {
  data: NonNullable<Bundle["sections"]["treatments"]>;
  onDrill: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard metric={data.presented} />
        <MetricCard metric={data.accepted} />
        <MetricCard metric={data.rejected} />
        <MetricCard metric={data.awaiting_decision} onDrill={onDrill} />
        <MetricCard metric={data.in_progress} />
        <MetricCard metric={data.completed} />
        <MetricCard metric={data.acceptance_rate} />
        <MetricCard metric={data.presented_value_cents} />
        <MetricCard metric={data.accepted_value_cents} />
        {data.received_cents_note ? (
          <MetricCard metric={data.received_cents_note} />
        ) : null}
      </div>
      <p className="text-xs text-[var(--text-subtle)]">
        Valor aceito ≠ valor recebido. Progresso clínico ≠ pagamento.
      </p>
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/90 p-4">
        <h2 className="mb-2 font-[family-name:var(--font-display)] text-lg">
          Progresso dos tratamentos
        </h2>
        <StatusBars data={data.progress_distribution} />
      </section>
    </div>
  );
}

function FinancialSection({
  data,
  onDrill,
}: {
  data: NonNullable<Bundle["sections"]["financial"]>;
  onDrill: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard metric={data.received_cents} />
        <MetricCard metric={data.receivable_cents} />
        <MetricCard metric={data.overdue_cents} onDrill={onDrill} />
        <MetricCard metric={data.expense_cents} />
        <MetricCard metric={data.period_result_cents} />
        <MetricCard metric={data.overdue_patients} onDrill={onDrill} />
      </div>
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/90 p-4">
        <h2 className="mb-2 font-[family-name:var(--font-display)] text-lg">
          Entradas × Despesas
        </h2>
        <DualCashflow data={data.cashflow_over_time} />
      </section>
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/90 p-4">
        <h2 className="mb-2 font-[family-name:var(--font-display)] text-lg">
          Formas de pagamento
        </h2>
        <HorizontalCounts
          data={data.by_method.map((m) => ({
            ...m,
            value: Math.round(m.value / 100),
          }))}
        />
        <p className="mt-2 text-xs text-[var(--text-subtle)]">
          Valores do gráfico em reais inteiros (arredondados) para leitura.
        </p>
      </section>
    </div>
  );
}

function DrillPanel({
  kind,
  rows,
  onClose,
}: {
  kind: NonNullable<Drill>;
  rows: PendingReturnRow[] | OverdueAccountRow[] | PendingDecisionRow[];
  onClose: () => void;
}) {
  const title =
    kind === "pending_returns"
      ? "Retornos pendentes"
      : kind === "overdue"
        ? "Pacientes com valor vencido"
        : "Planos aguardando decisão";

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-[family-name:var(--font-display)] text-lg">{title}</h2>
        <Button type="button" size="sm" variant="ghost" onClick={onClose}>
          Fechar
        </Button>
      </div>
      {rows.length === 0 ? (
        <EmptyState title="Nenhum item neste momento." />
      ) : (
        <ul className="space-y-2 text-sm">
          {kind === "pending_returns"
            ? (rows as PendingReturnRow[]).map((r) => (
                <li
                  key={r.patient_id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[var(--surface-muted)]/70 px-3 py-2"
                >
                  <div>
                    <p className="font-medium">{r.patient_name}</p>
                    <p className="text-xs text-[var(--text-muted)]">
                      {r.mode === "clinical"
                        ? `${r.indication ?? "Retorno"} · intervalo ${r.interval_days ?? "—"} dias`
                        : "Contato para agendamento"}
                      {r.last_appointment_at
                        ? ` · última consulta ${new Date(r.last_appointment_at).toLocaleDateString("pt-BR")}`
                        : ""}
                    </p>
                  </div>
                  <Link
                    href={`/app/agenda?patientId=${r.patient_id}`}
                    className="text-sm font-medium text-[var(--brand-primary)]"
                  >
                    Agendar
                  </Link>
                </li>
              ))
            : null}
          {kind === "overdue"
            ? (rows as OverdueAccountRow[]).map((r) => (
                <li
                  key={r.patient_id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[var(--surface-muted)]/70 px-3 py-2"
                >
                  <div>
                    <p className="font-medium">{r.patient_name}</p>
                    <p className="text-xs text-[var(--text-muted)]">
                      {formatBRL(r.overdue_cents)} · venc. mais antigo{" "}
                      {r.oldest_due_date.split("-").reverse().join("/")} ·{" "}
                      {r.overdue_installments} parcela(s)
                    </p>
                  </div>
                  <Link
                    href={`/app/pacientes/${r.patient_id}/financeiro`}
                    className="text-sm font-medium text-[var(--brand-primary)]"
                  >
                    Ver financeiro
                  </Link>
                </li>
              ))
            : null}
          {kind === "pending_decisions"
            ? (rows as PendingDecisionRow[]).map((r) => (
                <li
                  key={r.plan_id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[var(--surface-muted)]/70 px-3 py-2"
                >
                  <div>
                    <p className="font-medium">{r.patient_name}</p>
                    <p className="text-xs text-[var(--text-muted)]">
                      {r.title} · {formatBRL(r.total_cents)}
                      {r.presented_at
                        ? ` · apresentado ${new Date(r.presented_at).toLocaleDateString("pt-BR")}`
                        : ""}
                    </p>
                  </div>
                  <Link
                    href={`/app/pacientes/${r.patient_id}/tratamento`}
                    className="text-sm font-medium text-[var(--brand-primary)]"
                  >
                    Ver plano
                  </Link>
                </li>
              ))
            : null}
        </ul>
      )}
    </section>
  );
}
