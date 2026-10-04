"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatBRL } from "@/lib/money";
import type { ProcedurePricingSummary } from "@/types/pricing";
import type { ProcedurePriceHistory } from "@/types/pricing";

export function ProcedurePricingSection({
  procedureId,
  canManagePrice,
}: {
  procedureId: string;
  canManagePrice: boolean;
}) {
  const [summary, setSummary] = useState<ProcedurePricingSummary | null>(null);
  const [history, setHistory] = useState<ProcedurePriceHistory[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [simPrice, setSimPrice] = useState("");
  const [simMargin, setSimMargin] = useState("60");
  const [simDiscount, setSimDiscount] = useState("10");
  const [simOut, setSimOut] = useState<{
    price: number | null;
    result: number | null;
    margin: number | null;
    label: string;
  } | null>(null);
  const [newPrice, setNewPrice] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [sumRes, histRes] = await Promise.all([
        fetch(
          `/api/demo/procedure-pricing?resource=summary&procedureId=${procedureId}`,
        ),
        fetch(
          `/api/demo/procedure-pricing?resource=history&procedureId=${procedureId}`,
        ),
      ]);
      if (!sumRes.ok) {
        const j = await sumRes.json();
        setError(j.error ?? "Sem permissão ou dados indisponíveis.");
        setSummary(null);
        return;
      }
      const sum = await sumRes.json();
      setSummary(sum);
      if (sum.default_price_cents != null) {
        setNewPrice((sum.default_price_cents / 100).toFixed(2));
        setSimPrice((sum.default_price_cents / 100).toFixed(2));
      }
      if (histRes.ok) {
        const h = await histRes.json();
        setHistory(h.history ?? []);
      }
    } catch {
      setError("Não foi possível carregar preços e custos.");
    }
  }, [procedureId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function runSim(action: string, body: Record<string, unknown>) {
    const res = await fetch("/api/demo/procedure-pricing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...body }),
    }).then((r) => r.json());
    setSimOut({
      price: res.simulated_price_cents ?? null,
      result: res.result_cents ?? null,
      margin: res.margin_percent ?? null,
      label: res.label ?? res.message ?? "Simulação",
    });
  }

  if (error && !summary) {
    return (
      <p className="text-sm text-[var(--text-muted)]">{error}</p>
    );
  }
  if (!summary) {
    return (
      <p className="text-sm text-[var(--text-muted)]">Carregando preços…</p>
    );
  }

  const opCost = summary.operational_total_cents;

  return (
    <section className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/90 p-4 animate-rise">
      <div>
        <h2 className="text-lg font-medium text-[var(--brand-ink)]">
          Preço e custos
        </h2>
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          {summary.disclaimer}
        </p>
      </div>

      {summary.standard_below_operational ? (
        <p className="rounded-xl border border-[var(--border)] px-3 py-2 text-sm">
          Preço padrão abaixo do custo operacional estimado.
        </p>
      ) : null}

      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-[var(--text-muted)]">Preço padrão</dt>
          <dd className="font-medium">
            {summary.default_price_cents != null
              ? formatBRL(summary.default_price_cents)
              : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-[var(--text-muted)]">Custo de materiais</dt>
          <dd className="font-medium">
            {formatBRL(summary.materials_cost_cents)}
          </dd>
        </div>
        <div>
          <dt className="text-[var(--text-muted)]">Custo operacional estimado</dt>
          <dd className="font-medium">
            {opCost != null ? formatBRL(opCost) : "Não disponível"}
          </dd>
        </div>
        <div>
          <dt className="text-[var(--text-muted)]">Preço de equilíbrio</dt>
          <dd className="font-medium">
            {summary.break_even_cents != null
              ? formatBRL(summary.break_even_cents)
              : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-[var(--text-muted)]">
            Resultado operacional estimado
          </dt>
          <dd className="font-medium">
            {summary.operational_result_cents != null
              ? formatBRL(summary.operational_result_cents)
              : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-[var(--text-muted)]">Margem estimada</dt>
          <dd className="font-medium">
            {summary.operational_margin_percent != null
              ? `${summary.operational_margin_percent}%`
              : "—"}
          </dd>
        </div>
      </dl>

      {opCost != null && summary.default_price_cents != null ? (
        <div className="space-y-1 text-xs text-[var(--text-muted)]">
          <p>Referência visual (não é piso jurídico/comercial)</p>
          <div className="h-2 rounded-full bg-[var(--border)]">
            <div
              className="h-2 rounded-full bg-[var(--warning)]"
              style={{
                width: `${Math.min(100, (opCost / summary.default_price_cents) * 100)}%`,
              }}
            />
          </div>
          <p>
            Custo operacional {formatBRL(opCost)} · Preço padrão{" "}
            {formatBRL(summary.default_price_cents)}
          </p>
        </div>
      ) : null}

      {opCost != null ? (
        <div className="space-y-3 border-t border-[var(--border)] pt-3">
          <h3 className="text-sm font-medium">Simular preço</h3>
          <p className="text-xs text-[var(--text-muted)]">
            Matemática auxiliar. Não altera o preço padrão até você confirmar.
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <Label>Preço simulado (R$)</Label>
              <Input
                type="number"
                value={simPrice}
                onChange={(e) => setSimPrice(e.target.value)}
              />
            </div>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() =>
                void runSim("simulate_price", {
                  operational_cost_cents: opCost,
                  simulated_price_cents: Math.round(Number(simPrice) * 100),
                })
              }
            >
              Simular
            </Button>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <Label>Margem desejada (%)</Label>
              <Input
                type="number"
                max={99}
                value={simMargin}
                onChange={(e) => setSimMargin(e.target.value)}
              />
            </div>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() =>
                void runSim("simulate_margin", {
                  operational_cost_cents: opCost,
                  desired_margin_percent: Number(simMargin),
                })
              }
            >
              Simular por margem
            </Button>
          </div>
          {summary.default_price_cents != null ? (
            <div className="flex flex-wrap items-end gap-2">
              <div>
                <Label>Diferença simulada (%)</Label>
                <Input
                  type="number"
                  value={simDiscount}
                  onChange={(e) => setSimDiscount(e.target.value)}
                />
              </div>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() =>
                  void runSim("simulate_discount", {
                    standard_price_cents: summary.default_price_cents,
                    operational_cost_cents: opCost,
                    discount_percent: Number(simDiscount),
                  })
                }
              >
                Simular diferença
              </Button>
            </div>
          ) : null}
          {simOut ? (
            <p className="text-sm">
              {simOut.label}
              {simOut.price != null
                ? ` · Preço correspondente: ${formatBRL(simOut.price)}`
                : ""}
              {simOut.result != null
                ? ` · Resultado: ${formatBRL(simOut.result)}`
                : ""}
              {simOut.margin != null ? ` · Margem: ${simOut.margin}%` : ""}
            </p>
          ) : null}
        </div>
      ) : null}

      {canManagePrice ? (
        <div className="space-y-2 border-t border-[var(--border)] pt-3">
          <h3 className="text-sm font-medium">Atualizar preço padrão</h3>
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <Label>Novo preço (R$)</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
              />
            </div>
            <Button
              type="button"
              size="sm"
              onClick={() => setConfirmOpen(true)}
            >
              Confirmar alteração
            </Button>
          </div>
          {confirmOpen ? (
            <div className="rounded-xl border border-[var(--border)] p-3 text-sm">
              <p>
                Preço atual:{" "}
                {summary.default_price_cents != null
                  ? formatBRL(summary.default_price_cents)
                  : "—"}
              </p>
              <p>
                Novo preço:{" "}
                {formatBRL(Math.round(Number(newPrice) * 100))}
              </p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                Procedimentos já realizados e planos aceitos não mudam.
              </p>
              <div className="mt-2 flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  loading={busy}
                  onClick={async () => {
                    setBusy(true);
                    await fetch("/api/demo/procedure-pricing", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        action: "update_price",
                        procedure_id: procedureId,
                        new_price_reais: Number(newPrice),
                      }),
                    });
                    setBusy(false);
                    setConfirmOpen(false);
                    await load();
                  }}
                >
                  Confirmar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setConfirmOpen(false)}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {history.length > 0 ? (
        <details className="text-sm">
          <summary className="cursor-pointer text-[var(--text-muted)]">
            Histórico de preços
          </summary>
          <ul className="mt-2 space-y-1">
            {history.map((h) => (
              <li key={h.id} className="flex justify-between">
                <span>{formatBRL(h.price_cents)}</span>
                <span className="text-[var(--text-muted)]">
                  {h.valid_from.slice(0, 10)}
                  {h.valid_until ? ` → ${h.valid_until.slice(0, 10)}` : " (atual)"}
                </span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
