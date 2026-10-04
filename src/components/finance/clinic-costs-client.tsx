"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatBRL } from "@/lib/money";
import type {
  ClinicCostSettings,
  HourlyOperatingCost,
  MonthlyOperatingExpenses,
  RecurringExpenseTemplate,
} from "@/types/clinic-costs";
import {
  COST_BEHAVIOR_LABELS,
  EXPENSE_CATEGORY_GROUPS,
} from "@/types/clinic-costs";
import { EXPENSE_CATEGORY_LABELS } from "@/types/finance";

type Dashboard = {
  settings: ClinicCostSettings | null;
  expenses: MonthlyOperatingExpenses;
  hourly: HourlyOperatingCost;
  templates: RecurringExpenseTemplate[];
};

export function ClinicCostsClient() {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [hoursInput, setHoursInput] = useState("120");
  const [simHours, setSimHours] = useState<number | null>(null);
  const [simHourly, setSimHourly] = useState<number | null>(null);
  const [simCost, setSimCost] = useState("140");
  const [simMargin, setSimMargin] = useState("60");
  const [simPrice, setSimPrice] = useState<{
    price: number | null;
    result: number | null;
    margin: number | null;
    message: string | null;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/demo/clinic-costs?resource=dashboard&month=${month}`,
      );
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Não foi possível carregar os custos.");
        setData(null);
        return;
      }
      setData(json);
      if (json.settings?.monthly_productive_hours) {
        setHoursInput(String(json.settings.monthly_productive_hours));
      }
    } catch {
      setError("Não foi possível carregar os custos.");
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveSettings() {
    setBusy(true);
    try {
      await fetch("/api/demo/clinic-costs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_settings",
          calculation_mode: "manual_productive_hours",
          monthly_productive_hours: Number(hoursInput),
        }),
      });
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function runHourlySim() {
    const res = await fetch("/api/demo/clinic-costs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "simulate_hourly",
        month,
        productive_hours: Number(simHours ?? hoursInput),
      }),
    }).then((r) => r.json());
    setSimHourly(res.hourly_cost_cents ?? null);
  }

  async function runPriceSim() {
    const res = await fetch("/api/demo/clinic-costs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "simulate_price",
        operational_cost_cents: Math.round(Number(simCost) * 100),
        desired_margin_percent: Number(simMargin),
      }),
    }).then((r) => r.json());
    setSimPrice({
      price: res.simulated_price_cents,
      result: res.operational_result_cents,
      margin: res.operational_margin_percent,
      message: res.message,
    });
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
      <header>
        <p className="text-sm text-[var(--text-muted)]">
          <Link href="/app/financeiro" className="hover:underline">
            Financeiro
          </Link>{" "}
          / Custos
        </p>
        <h1 className="font-[family-name:var(--font-display)] text-3xl text-[var(--brand-ink)]">
          Custos do consultório
        </h1>
        <p className="mt-1 text-[var(--text-muted)]">
          Entenda quanto custa manter sua operação e realizar seus procedimentos.
        </p>
      </header>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <Label htmlFor="month">Mês de referência</Label>
          <Input
            id="month"
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </div>
        <Button type="button" variant="secondary" onClick={() => void load()}>
          Atualizar
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-[var(--text-muted)]">Carregando…</p>
      ) : null}
      {error ? (
        <p className="rounded-xl bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger)]">
          {error}
        </p>
      ) : null}

      {data ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Metric
              title="Despesas fixas do mês"
              value={formatBRL(data.expenses.fixed_cents)}
            />
            <Metric
              title="Despesas variáveis"
              value={formatBRL(data.expenses.variable_cents)}
            />
            <Metric
              title="Horas produtivas"
              value={
                data.hourly.productive_hours != null
                  ? `${data.hourly.productive_hours} h`
                  : "Não configurado"
              }
            />
            <Metric
              title="Custo operacional/hora"
              value={
                data.hourly.hourly_cost_cents != null
                  ? formatBRL(data.hourly.hourly_cost_cents)
                  : "Dados insuficientes"
              }
              hint="≠ lucro líquido"
            />
          </div>

          {data.hourly.message ? (
            <p className="rounded-xl border border-[var(--border)] px-4 py-3 text-sm">
              {data.hourly.message}
            </p>
          ) : null}

          <p className="text-xs text-[var(--text-muted)]">
            O resultado depende das despesas cadastradas pela clínica. Despesas
            marcadas como não alocáveis não entram no custo/hora.
          </p>

          <section className="space-y-3 rounded-2xl border border-[var(--border)] p-4">
            <h2 className="font-medium">Configuração de horas produtivas</h2>
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <Label htmlFor="hours">Horas clínicas produtivas / mês</Label>
                <Input
                  id="hours"
                  type="number"
                  min={1}
                  value={hoursInput}
                  onChange={(e) => setHoursInput(e.target.value)}
                />
              </div>
              <Button
                type="button"
                disabled={busy}
                onClick={() => void saveSettings()}
              >
                Salvar configuração
              </Button>
            </div>
            <p className="text-xs text-[var(--text-muted)]">
              Em média, que percentual do horário disponível você considera
              produtivo? (modo agenda disponível depois; V1 usa horas manuais.)
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-medium">Composição do custo/hora</h2>
            {data.hourly.composition.length === 0 ? (
              <EmptyState title="Nenhuma despesa alocável neste mês." />
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-[var(--border)]">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b text-xs uppercase text-[var(--text-subtle)]">
                    <tr>
                      <th className="px-3 py-2">Despesa</th>
                      <th className="px-3 py-2">Categoria</th>
                      <th className="px-3 py-2">Tipo</th>
                      <th className="px-3 py-2">Valor</th>
                      <th className="px-3 py-2">Fonte</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.hourly.composition.map((l) => (
                      <tr key={l.id} className="border-b">
                        <td className="px-3 py-2">{l.name}</td>
                        <td className="px-3 py-2">
                          {EXPENSE_CATEGORY_LABELS[l.category] ?? l.category}
                        </td>
                        <td className="px-3 py-2">
                          {COST_BEHAVIOR_LABELS[l.cost_behavior]}
                        </td>
                        <td className="px-3 py-2">
                          {formatBRL(l.amount_cents)}
                        </td>
                        <td className="px-3 py-2 text-[var(--text-muted)]">
                          {l.source === "template" ? "Recorrente (previsão)" : "Despesa"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {data.expenses.lines.some((l) => !l.allocation_eligible) ? (
              <div className="text-sm text-[var(--text-muted)]">
                <p className="font-medium text-[var(--brand-ink)]">
                  Não incluídas no custo/hora
                </p>
                <ul className="mt-1 list-disc pl-5">
                  {data.expenses.lines
                    .filter((l) => !l.allocation_eligible)
                    .map((l) => (
                      <li key={l.id}>
                        {l.name}: {formatBRL(l.amount_cents)}
                      </li>
                    ))}
                </ul>
              </div>
            ) : null}
            <p className="text-sm">
              Total alocável: {formatBRL(data.hourly.allocatable_cost_cents)}
              {data.hourly.productive_hours != null &&
              data.hourly.hourly_cost_cents != null
                ? ` ÷ ${data.hourly.productive_hours} h = ${formatBRL(data.hourly.hourly_cost_cents)}/h`
                : ""}
            </p>
          </section>

          <section className="space-y-3 rounded-2xl border border-[var(--border)] p-4">
            <h2 className="font-medium">Simular custo/hora</h2>
            <p className="text-xs text-[var(--text-muted)]">
              Cenário temporário — não altera a configuração até você salvar.
            </p>
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <Label htmlFor="simh">Horas produtivas (cenário)</Label>
                <Input
                  id="simh"
                  type="number"
                  value={simHours ?? hoursInput}
                  onChange={(e) => setSimHours(Number(e.target.value))}
                />
              </div>
              <Button type="button" variant="secondary" onClick={() => void runHourlySim()}>
                Simular
              </Button>
            </div>
            {simHourly != null ? (
              <p className="text-sm">
                Com {simHours ?? hoursInput} h →{" "}
                <span className="font-medium">{formatBRL(simHourly)}/h</span>
              </p>
            ) : null}
          </section>

          <section className="space-y-3 rounded-2xl border border-[var(--border)] p-4">
            <h2 className="font-medium">Simulação de preço</h2>
            <p className="text-xs text-[var(--text-muted)]">
              Matemática auxiliar. Nunca é “preço recomendado pelo Sorria”.
            </p>
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <Label htmlFor="simc">Custo operacional (R$)</Label>
                <Input
                  id="simc"
                  type="number"
                  value={simCost}
                  onChange={(e) => setSimCost(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="simm">Margem desejada (%)</Label>
                <Input
                  id="simm"
                  type="number"
                  max={99}
                  value={simMargin}
                  onChange={(e) => setSimMargin(e.target.value)}
                />
              </div>
              <Button type="button" variant="secondary" onClick={() => void runPriceSim()}>
                Simular
              </Button>
            </div>
            {simPrice ? (
              <p className="text-sm">
                {simPrice.price != null
                  ? `Preço simulado: ${formatBRL(simPrice.price)} · Resultado: ${formatBRL(simPrice.result ?? 0)} · Margem: ${simPrice.margin}%`
                  : simPrice.message}
                {simPrice.message ? (
                  <span className="block text-xs text-[var(--text-muted)]">
                    {simPrice.message}
                  </span>
                ) : null}
              </p>
            ) : null}
          </section>

          <section className="space-y-2">
            <h2 className="font-medium">Despesas recorrentes (templates)</h2>
            <p className="text-xs text-[var(--text-muted)]">
              Template ≠ pagamento. Entra na previsão de custo operacional do
              mês se não houver despesa correspondente.
            </p>
            {data.templates.length === 0 ? (
              <EmptyState title="Nenhum template cadastrado." />
            ) : (
              <ul className="space-y-1 text-sm">
                {data.templates.map((t) => (
                  <li
                    key={t.id}
                    className="flex justify-between border-b border-[var(--border)] py-1"
                  >
                    <span>
                      {t.name} · {EXPENSE_CATEGORY_LABELS[t.category]} ·{" "}
                      {t.allocation_eligible
                        ? "Alocável"
                        : "Não incluída no custo/hora"}
                    </span>
                    <span>{formatBRL(t.amount_cents)}/mês</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <details className="text-sm text-[var(--text-muted)]">
            <summary className="cursor-pointer">Categorias de despesa</summary>
            <ul className="mt-2 space-y-1">
              {Object.entries(EXPENSE_CATEGORY_GROUPS).map(([group, cats]) => (
                <li key={group}>
                  <span className="font-medium text-[var(--brand-ink)]">
                    {group}:
                  </span>{" "}
                  {cats.map((c) => EXPENSE_CATEGORY_LABELS[c]).join(", ")}
                </li>
              ))}
            </ul>
          </details>
        </>
      ) : null}
    </div>
  );
}

function Metric({
  title,
  value,
  hint,
}: {
  title: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/90 p-4">
      <p className="text-xs text-[var(--text-subtle)]">{title}</p>
      <p className="mt-1 font-[family-name:var(--font-display)] text-xl text-[var(--brand-ink)]">
        {value}
      </p>
      {hint ? (
        <p className="text-xs text-[var(--text-muted)]">{hint}</p>
      ) : null}
    </div>
  );
}
