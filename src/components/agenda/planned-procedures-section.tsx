"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, CircleDashed, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { formatBRL } from "@/lib/money";
import { FORECAST_STATUS_LABELS } from "@/types/forecast";

type Planned = {
  id: string;
  procedure_id: string;
  procedure_name?: string;
  tooth_number: number | null;
  region: string | null;
  quantity: number;
  notes: string | null;
};

type CatalogProc = { id: string; name: string };

type ForecastMat = {
  item_name: string;
  forecast_quantity: number;
  consumption_unit: string;
  current_quantity: number;
  status: keyof typeof FORECAST_STATUS_LABELS;
  estimated_cost_cents: number | null;
};

export function PlannedProceduresSection({
  appointmentId,
  canCreate,
  canUpdate,
  canViewForecast,
}: {
  appointmentId: string;
  canCreate: boolean;
  canUpdate: boolean;
  canViewForecast: boolean;
}) {
  const [items, setItems] = useState<Planned[]>([]);
  const [catalog, setCatalog] = useState<CatalogProc[]>([]);
  const [forecast, setForecast] = useState<{
    materials: ForecastMat[];
    materials_at_risk: number;
    estimated_total_cost_cents: number | null;
    definition_status: string;
  } | null>(null);
  const [procId, setProcId] = useState("");
  const [tooth, setTooth] = useState("");
  const [qty, setQty] = useState("1");
  const [region, setRegion] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const [listRes, procRes, forecastRes] = await Promise.all([
      fetch(
        `/api/demo/planned-procedures?appointmentId=${appointmentId}`,
      ).then((r) => r.json()),
      fetch("/api/demo/procedures").then((r) => r.json()),
      canViewForecast
        ? fetch(
            `/api/demo/planned-procedures?view=forecast&appointmentId=${appointmentId}`,
          ).then((r) => r.json())
        : Promise.resolve(null),
    ]);
    setItems(listRes.items ?? []);
    const cats = (procRes.items ?? []) as CatalogProc[];
    setCatalog(cats);
    if (!procId && cats[0]) setProcId(cats[0].id);
    setForecast(forecastRes?.forecast ?? null);
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appointmentId]);

  async function add() {
    setError(null);
    const response = await fetch("/api/demo/planned-procedures", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "add",
        data: {
          appointment_id: appointmentId,
          procedure_id: procId,
          tooth_number: tooth ? Number(tooth) : null,
          region: region || null,
          quantity: Number(qty) || 1,
        },
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error ?? "Não foi possível adicionar.");
      return;
    }
    setAdding(false);
    setTooth("");
    setRegion("");
    setQty("1");
    await load();
  }

  async function remove(id: string) {
    const ok = window.confirm("Remover este procedimento previsto?");
    if (!ok) return;
    await fetch("/api/demo/planned-procedures", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "remove", data: { id } }),
    });
    await load();
  }

  const indicator =
    items.length === 0
      ? "undefined"
      : forecast?.definition_status === "insufficient"
        ? "insufficient"
        : "calculated";

  return (
    <section className="mt-5 border-t border-[var(--border)] pt-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-[var(--brand-ink)]">
            Procedimentos previstos
          </h3>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
            {indicator === "undefined" ? (
              <>
                <CircleDashed className="size-3.5" aria-hidden />
                Procedimento não definido
              </>
            ) : indicator === "insufficient" ? (
              <>
                <AlertTriangle className="size-3.5" aria-hidden />
                Estoque insuficiente
              </>
            ) : (
              <>
                <CheckCircle2 className="size-3.5" aria-hidden />
                Materiais calculados
              </>
            )}
          </p>
        </div>
        {canCreate ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => setAdding((v) => !v)}
          >
            <Plus className="size-3.5" />
            Adicionar procedimento
          </Button>
        ) : null}
      </div>

      {loading ? (
        <p className="mt-3 text-sm text-[var(--text-muted)]">Carregando…</p>
      ) : items.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--text-muted)]">
          Nenhum procedimento previsto. A consulta entra na Agenda, mas não
          gera previsão detalhada de materiais.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-start justify-between gap-2 text-sm"
            >
              <div>
                <p className="font-medium text-[var(--brand-ink)]">
                  {item.procedure_name}
                  {item.tooth_number != null
                    ? ` — Dente ${item.tooth_number}`
                    : ""}
                  {item.region ? ` — ${item.region}` : ""}
                </p>
                <p className="text-xs text-[var(--text-muted)]">
                  Qtd. {item.quantity}
                </p>
              </div>
              {canUpdate ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => void remove(item.id)}
                >
                  Remover
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {adding ? (
        <div className="mt-3 space-y-2 rounded-xl border border-[var(--border)] p-3">
          <div>
            <Label htmlFor="planned-proc">Procedimento</Label>
            <Select
              id="planned-proc"
              value={procId}
              onChange={(e) => setProcId(e.target.value)}
            >
              {catalog.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label htmlFor="planned-tooth">Dente</Label>
              <Input
                id="planned-tooth"
                value={tooth}
                onChange={(e) => setTooth(e.target.value)}
                placeholder="16"
              />
            </div>
            <div>
              <Label htmlFor="planned-region">Região</Label>
              <Input
                id="planned-region"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="planned-qty">Qtd.</Label>
              <Input
                id="planned-qty"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
              />
            </div>
          </div>
          {error ? (
            <p className="text-sm text-[var(--danger)]">{error}</p>
          ) : null}
          <Button type="button" size="sm" onClick={() => void add()}>
            Salvar procedimento
          </Button>
        </div>
      ) : null}

      {canViewForecast && forecast && forecast.materials.length > 0 ? (
        <div className="mt-4">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-subtle)]">
            Materiais previstos
          </h4>
          <ul className="mt-2 space-y-1 text-sm">
            {forecast.materials.map((m) => (
              <li
                key={m.item_name}
                className="flex justify-between gap-2 text-[var(--text)]"
              >
                <span>
                  {m.item_name}{" "}
                  <span className="text-[var(--text-muted)]">
                    {m.forecast_quantity} {m.consumption_unit}
                  </span>
                </span>
                <span className="text-xs text-[var(--text-muted)]">
                  {FORECAST_STATUS_LABELS[m.status]}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-[var(--text-muted)]">
            {forecast.materials_at_risk === 0
              ? "Todos disponíveis"
              : `${forecast.materials_at_risk} material(is) podem estar insuficientes`}
            {forecast.estimated_total_cost_cents != null
              ? ` · Custo estimado ${formatBRL(forecast.estimated_total_cost_cents)}`
              : ""}
          </p>
        </div>
      ) : null}
    </section>
  );
}
