"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  CircleHelp,
  PackageMinus,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { formatBRL } from "@/lib/money";
import {
  FORECAST_STATUS_LABELS,
  type ForecastMaterialStatus,
  type ForecastSummary,
} from "@/types/forecast";

type Professional = { id: string; full_name: string };

type PeriodKey = "today" | "tomorrow" | "7" | "15" | "30" | "custom";

function rangeFor(key: PeriodKey): { start: Date; end: Date } {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  if (key === "today") {
    end.setHours(23, 59, 59, 999);
  } else if (key === "tomorrow") {
    start.setDate(start.getDate() + 1);
    end.setDate(end.getDate() + 1);
    end.setHours(23, 59, 59, 999);
  } else if (key === "7") {
    end.setDate(end.getDate() + 7);
    end.setHours(23, 59, 59, 999);
  } else if (key === "15") {
    end.setDate(end.getDate() + 15);
    end.setHours(23, 59, 59, 999);
  } else if (key === "30") {
    end.setDate(end.getDate() + 30);
    end.setHours(23, 59, 59, 999);
  }
  return { start, end };
}

function statusIcon(status: ForecastMaterialStatus) {
  if (status === "insufficient") return AlertTriangle;
  if (status === "low_after_forecast") return PackageMinus;
  if (status === "unknown") return CircleHelp;
  return CheckCircle2;
}

function statusTone(
  status: ForecastMaterialStatus,
): "danger" | "warning" | "success" | "neutral" {
  if (status === "insufficient") return "danger";
  if (status === "low_after_forecast") return "warning";
  if (status === "unknown") return "neutral";
  return "success";
}

export function ForecastClient({
  professionals,
  canPurchase,
}: {
  professionals: Professional[];
  canPurchase: boolean;
}) {
  const [period, setPeriod] = useState<PeriodKey>("7");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [professionalId, setProfessionalId] = useState("all");
  const [forecast, setForecast] = useState<ForecastSummary | null>(null);
  const [canViewCosts, setCanViewCosts] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const bounds = useMemo(() => {
    if (period === "custom" && customStart && customEnd) {
      const start = new Date(customStart);
      start.setHours(0, 0, 0, 0);
      const end = new Date(customEnd);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }
    return rangeFor(period === "custom" ? "7" : period);
  }, [period, customStart, customEnd]);

  async function load() {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({
      start: bounds.start.toISOString(),
      end: bounds.end.toISOString(),
    });
    if (professionalId !== "all") {
      params.set("professionalId", professionalId);
    }
    const res = await fetch(`/api/demo/forecast?${params}`).then((r) =>
      r.json(),
    );
    if (res.error) setError(res.error);
    else {
      setForecast(res.forecast);
      setCanViewCosts(Boolean(res.canViewCosts));
    }
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bounds.start.toISOString(), bounds.end.toISOString(), professionalId]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <header>
        <p className="text-sm text-[var(--text-muted)]">
          <Link href="/app/estoque" className="hover:underline">
            Estoque
          </Link>{" "}
          / Previsão
        </p>
        <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl text-[var(--brand-ink)]">
          Previsão de materiais
        </h1>
        <p className="mt-1 max-w-2xl text-[var(--text-muted)]">
          Veja quanto material será necessário para os procedimentos agendados.
        </p>
      </header>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <Label htmlFor="period">Período</Label>
          <Select
            id="period"
            value={period}
            onChange={(e) => setPeriod(e.target.value as PeriodKey)}
          >
            <option value="today">Hoje</option>
            <option value="tomorrow">Amanhã</option>
            <option value="7">Próximos 7 dias</option>
            <option value="15">Próximos 15 dias</option>
            <option value="30">Próximos 30 dias</option>
            <option value="custom">Personalizado</option>
          </Select>
        </div>
        {period === "custom" ? (
          <>
            <div>
              <Label htmlFor="cstart">De</Label>
              <Input
                id="cstart"
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="cend">Até</Label>
              <Input
                id="cend"
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
              />
            </div>
          </>
        ) : null}
        <div>
          <Label htmlFor="prof">Profissional</Label>
          <Select
            id="prof"
            value={professionalId}
            onChange={(e) => setProfessionalId(e.target.value)}
          >
            <option value="all">Todos</option>
            {professionals.map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name}
              </option>
            ))}
          </Select>
        </div>
        <Button type="button" variant="secondary" onClick={() => void load()}>
          Atualizar
        </Button>
      </div>

      {error ? (
        <p className="rounded-xl bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger)]">
          {error}
        </p>
      ) : null}

      {forecast ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label="Consultas analisadas"
            value={String(forecast.appointments_analyzed)}
          />
          <Stat
            label="Procedimentos previstos"
            value={String(forecast.procedures_planned)}
          />
          <Stat
            label="Materiais em risco"
            value={String(forecast.materials_at_risk)}
          />
          <Stat
            label="Procedimentos sem definição"
            value={String(forecast.appointments_without_procedures)}
          />
        </div>
      ) : null}

      {canViewCosts && forecast?.estimated_total_cost_cents != null ? (
        <p className="text-sm text-[var(--text-muted)]">
          Custo estimado dos materiais:{" "}
          <span className="font-medium text-[var(--brand-ink)]">
            {formatBRL(forecast.estimated_total_cost_cents)}
          </span>{" "}
          <span className="text-xs">(estimado)</span>
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-[var(--border)] text-xs uppercase tracking-wide text-[var(--text-subtle)]">
            <tr>
              <th className="px-4 py-3">Material</th>
              <th className="px-4 py-3">Estoque atual</th>
              <th className="px-4 py-3">Necessário</th>
              <th className="px-4 py-3">Saldo projetado</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-[var(--text-muted)]">
                  Calculando previsão…
                </td>
              </tr>
            ) : !forecast || forecast.materials.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-[var(--text-muted)]">
                  Nenhum material previsto no período. Defina procedimentos
                  previstos nas consultas da Agenda.
                </td>
              </tr>
            ) : (
              forecast.materials.map((row) => {
                const Icon = statusIcon(row.status);
                const open = expanded === row.inventory_item_id;
                return (
                  <tr
                    key={row.inventory_item_id}
                    className="border-b border-[var(--border)] last:border-0"
                  >
                    <td className="px-4 py-3 align-top">
                      <button
                        type="button"
                        className="text-left font-medium text-[var(--brand-ink)] hover:underline"
                        onClick={() =>
                          setExpanded(open ? null : row.inventory_item_id)
                        }
                      >
                        {row.item_name}
                      </button>
                      {open ? (
                        <ul className="mt-2 space-y-1 text-xs text-[var(--text-muted)]">
                          {row.patient_breakdown.map((b, idx) => (
                            <li key={`${b.appointment_id}-${idx}`}>
                              {b.patient_name} — {b.procedure_name}
                              {b.tooth_number != null
                                ? ` ${b.tooth_number}`
                                : ""}{" "}
                              — {b.quantity} {row.consumption_unit}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 align-top">
                      {row.current_quantity} {row.consumption_unit}
                    </td>
                    <td className="px-4 py-3 align-top">
                      {row.forecast_quantity} {row.consumption_unit}
                    </td>
                    <td className="px-4 py-3 align-top">
                      {row.projected_remaining} {row.consumption_unit}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <Badge tone={statusTone(row.status)}>
                        <Icon className="mr-1 size-3.5" aria-hidden />
                        {FORECAST_STATUS_LABELS[row.status]}
                      </Badge>
                      {row.suggested_purchase_quantity != null &&
                      row.suggested_purchase_quantity > 0 ? (
                        <p className="mt-1 text-xs text-[var(--text-muted)]">
                          Sugestão de reposição:{" "}
                          {row.suggested_purchase_quantity}{" "}
                          {row.consumption_unit}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 align-top">
                      {canPurchase &&
                      (row.status === "insufficient" ||
                        row.status === "low_after_forecast") ? (
                        <Link
                          href={`/app/estoque/compras?itemId=${row.inventory_item_id}`}
                          className="text-sm font-medium text-[var(--brand-primary)]"
                        >
                          Registrar compra
                        </Link>
                      ) : null}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] p-4">
      <p className="text-xs uppercase tracking-wide text-[var(--text-subtle)]">
        {label}
      </p>
      <p className="mt-1 font-[family-name:var(--font-display)] text-2xl text-[var(--brand-ink)]">
        {value}
      </p>
    </div>
  );
}
