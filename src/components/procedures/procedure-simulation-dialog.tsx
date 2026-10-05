"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Calculator, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatBRL } from "@/lib/money";
import {
  computeDiscountedPrice,
  computePriceForMargin,
  computeQuickSimulation,
} from "@/lib/pricing/quick-simulate";
import type { QuickSimulationContext } from "@/services/procedure-simulation";

type ProcOption = {
  id: string;
  name: string;
  category: string | null;
  default_price_cents: number | null;
  favorited: boolean;
  use_count: number;
};

function parseReais(value: string): number {
  const n = Number(value.replace(",", ".").replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

export function ProcedureSimulationDialog({
  open,
  onClose,
  initialProcedureId,
  performedProcedureId,
}: {
  open: boolean;
  onClose: () => void;
  initialProcedureId?: string | null;
  performedProcedureId?: string | null;
}) {
  const [step, setStep] = useState<"pick" | "sim">("pick");
  const [query, setQuery] = useState("");
  const [list, setList] = useState<ProcOption[]>([]);
  const [ctx, setCtx] = useState<QuickSimulationContext | null>(null);
  const [priceStr, setPriceStr] = useState("");
  const [mode, setMode] = useState<"price" | "margin">("price");
  const [marginStr, setMarginStr] = useState("60");
  const [confirmSave, setConfirmSave] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setMessage(null);
    setConfirmSave(false);
    setQuery("");

    if (performedProcedureId) {
      void loadContext({ performedId: performedProcedureId });
      return;
    }
    if (initialProcedureId) {
      void loadContext({ procedureId: initialProcedureId });
      return;
    }
    setStep("pick");
    setCtx(null);
    void fetch("/api/demo/procedure-pricing?resource=simulate_list")
      .then((r) => r.json())
      .then((j) => setList(j.items ?? []));
  }, [open, initialProcedureId, performedProcedureId]);

  async function loadContext(opts: {
    procedureId?: string;
    performedId?: string;
  }) {
    setError(null);
    const params = new URLSearchParams({ resource: "quick_simulate" });
    if (opts.procedureId) params.set("procedureId", opts.procedureId);
    if (opts.performedId) params.set("performedId", opts.performedId);
    const res = await fetch(`/api/demo/procedure-pricing?${params}`);
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Não foi possível carregar a simulação.");
      return;
    }
    setCtx(json);
    const seed =
      json.default_price_cents != null
        ? (json.default_price_cents / 100).toFixed(2)
        : "";
    setPriceStr(seed);
    setStep("sim");
  }

  const costCents = useMemo(() => {
    if (!ctx) return null;
    if (ctx.can_view_operational && ctx.operational_cost_cents != null) {
      return ctx.operational_cost_cents;
    }
    if (ctx.can_view_costs && ctx.direct_cost_cents != null) {
      return ctx.direct_cost_cents;
    }
    return null;
  }, [ctx]);

  const simulatedCents = parseReais(priceStr);
  const result = useMemo(
    () =>
      computeQuickSimulation({
        cost_cents: costCents,
        simulated_price_cents: simulatedCents,
        default_price_cents: ctx?.default_price_cents ?? null,
      }),
    [costCents, simulatedCents, ctx?.default_price_cents],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return list.slice(0, 12);
    return list
      .filter((p) => p.name.toLowerCase().includes(q))
      .slice(0, 12);
  }, [list, query]);

  function applyDiscount(pct: number) {
    if (ctx?.default_price_cents == null) return;
    const next = computeDiscountedPrice(ctx.default_price_cents, pct);
    if (next != null) setPriceStr((next / 100).toFixed(2));
  }

  function applyTargetMargin() {
    if (costCents == null) return;
    const m = Number(marginStr.replace(",", "."));
    const price = computePriceForMargin(costCents, m);
    if (price != null) {
      setPriceStr((price / 100).toFixed(2));
      setMode("price");
    }
  }

  async function confirmPriceUpdate() {
    if (!ctx || !ctx.can_update_price) return;
    setSaving(true);
    setError(null);
    const res = await fetch("/api/demo/procedure-pricing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update_price",
        procedure_id: ctx.procedure_id,
        new_price_reais: simulatedCents / 100,
      }),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(json.error ?? "Não foi possível atualizar o preço.");
      return;
    }
    setMessage("Preço padrão atualizado.");
    setConfirmSave(false);
    setCtx({
      ...ctx,
      default_price_cents: simulatedCents,
    });
  }

  if (!open) return null;

  const costBar = costCents ?? 0;
  const priceBar = Math.max(simulatedCents, costBar, 1);
  const costPct = Math.min(100, Math.round((costBar / priceBar) * 100));
  const resultPct = Math.max(0, 100 - costPct);

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Simular procedimento"
        className="flex max-h-[94dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-[var(--surface-elevated)] shadow-[var(--shadow-card)] sm:rounded-2xl animate-rise"
      >
        <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
          <div className="flex items-center gap-2">
            <Calculator className="size-4 text-[var(--brand-primary)]" />
            <h2 className="font-medium text-[var(--brand-ink)]">
              Simular procedimento
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-[var(--text-subtle)] hover:bg-[var(--surface-muted)]"
            aria-label="Fechar"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="overflow-y-auto px-4 py-4">
          {error ? (
            <p className="mb-3 rounded-xl bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger)]">
              {error}
            </p>
          ) : null}
          {message ? (
            <p className="mb-3 rounded-xl bg-[var(--success-soft)] px-3 py-2 text-sm text-[var(--success)]">
              {message}
            </p>
          ) : null}

          {step === "pick" ? (
            <div className="space-y-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--text-subtle)]" />
                <Input
                  className="h-12 pl-10 text-base"
                  placeholder="Buscar procedimento…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  autoFocus
                />
              </div>
              <p className="text-xs text-[var(--text-muted)]">
                Favoritos e mais usados primeiro
              </p>
              <ul className="space-y-2">
                {filtered.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => void loadContext({ procedureId: p.id })}
                      className="flex w-full items-center justify-between rounded-xl border border-[var(--border)] px-3 py-3 text-left hover:border-[var(--brand-primary)]/40 hover:bg-[var(--surface-muted)]/50"
                    >
                      <span>
                        <span className="block text-sm font-medium text-[var(--brand-ink)]">
                          {p.name}
                        </span>
                        <span className="text-xs text-[var(--text-muted)]">
                          {p.category ?? "Procedimento"}
                          {p.favorited ? " · favorito" : ""}
                        </span>
                      </span>
                      <span className="text-sm text-[var(--text-muted)]">
                        {p.default_price_cents != null
                          ? formatBRL(p.default_price_cents)
                          : "—"}
                      </span>
                    </button>
                  </li>
                ))}
                {filtered.length === 0 ? (
                  <li className="py-6 text-center text-sm text-[var(--text-muted)]">
                    Nenhum procedimento encontrado.
                  </li>
                ) : null}
              </ul>
            </div>
          ) : null}

          {step === "sim" && ctx ? (
            <div className="space-y-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-[var(--text-subtle)]">
                  {ctx.mode === "performed"
                    ? "Procedimento deste paciente"
                    : "Procedimento padrão"}
                </p>
                <h3 className="mt-1 font-[family-name:var(--font-display)] text-xl text-[var(--brand-ink)]">
                  {ctx.procedure_name}
                  {ctx.tooth_number ? ` — dente ${ctx.tooth_number}` : ""}
                </h3>
                {!performedProcedureId ? (
                  <button
                    type="button"
                    className="mt-1 text-xs text-[var(--brand-primary)]"
                    onClick={() => {
                      setStep("pick");
                      setCtx(null);
                      if (list.length === 0) {
                        void fetch(
                          "/api/demo/procedure-pricing?resource=simulate_list",
                        )
                          .then((r) => r.json())
                          .then((j) => setList(j.items ?? []));
                      }
                    }}
                  >
                    Trocar procedimento
                  </button>
                ) : null}
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded-xl bg-[var(--surface-muted)]/70 px-2 py-2">
                  <p className="text-[var(--text-subtle)]">Preço padrão</p>
                  <p className="mt-1 font-medium text-[var(--brand-ink)]">
                    {ctx.default_price_cents != null
                      ? formatBRL(ctx.default_price_cents)
                      : "—"}
                  </p>
                </div>
                <div className="rounded-xl bg-[var(--surface-muted)]/70 px-2 py-2">
                  <p className="text-[var(--text-subtle)]">Custo direto</p>
                  <p className="mt-1 font-medium text-[var(--brand-ink)]">
                    {ctx.can_view_costs && ctx.direct_cost_cents != null
                      ? formatBRL(ctx.direct_cost_cents)
                      : ctx.can_view_costs
                        ? "Custo não calculado"
                        : "—"}
                  </p>
                </div>
                <div className="rounded-xl bg-[var(--surface-muted)]/70 px-2 py-2">
                  <p className="text-[var(--text-subtle)]">Operacional</p>
                  <p className="mt-1 font-medium text-[var(--brand-ink)]">
                    {ctx.can_view_operational &&
                    ctx.operational_cost_cents != null
                      ? formatBRL(ctx.operational_cost_cents)
                      : ctx.can_view_operational
                        ? "Incompleto"
                        : "—"}
                  </p>
                </div>
              </div>

              {ctx.operational_incomplete && ctx.can_view_operational ? (
                <p className="rounded-xl bg-[var(--warning-soft)] px-3 py-2 text-xs text-[var(--warning)]">
                  Custo operacional: configuração incompleta.{" "}
                  <Link
                    href="/app/financeiro/custos"
                    className="underline"
                  >
                    Configurar custo/hora
                  </Link>
                </p>
              ) : null}

              {ctx.materials_without_cost > 0 ? (
                <p className="text-xs text-[var(--text-muted)]">
                  {ctx.materials_without_cost} materiais sem custo cadastrado —
                  resultado parcial.
                </p>
              ) : null}

              <div className="flex gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setMode("price")}
                  className={[
                    "rounded-full px-3 py-1.5",
                    mode === "price"
                      ? "bg-[var(--brand-primary)] text-white"
                      : "bg-[var(--surface-muted)] text-[var(--text-muted)]",
                  ].join(" ")}
                >
                  Por preço
                </button>
                <button
                  type="button"
                  onClick={() => setMode("margin")}
                  className={[
                    "rounded-full px-3 py-1.5",
                    mode === "margin"
                      ? "bg-[var(--brand-primary)] text-white"
                      : "bg-[var(--surface-muted)] text-[var(--text-muted)]",
                  ].join(" ")}
                >
                  Calcular por margem
                </button>
              </div>

              {mode === "price" ? (
                <div className="space-y-1.5">
                  <Label htmlFor="sim-price">Quanto pretende cobrar?</Label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--text-muted)]">
                      R$
                    </span>
                    <Input
                      id="sim-price"
                      inputMode="decimal"
                      className="h-14 pl-10 text-xl font-medium"
                      value={priceStr}
                      onChange={(e) => setPriceStr(e.target.value)}
                      placeholder="300,00"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="space-y-1.5">
                    <Label>Margem desejada (%)</Label>
                    <Input
                      inputMode="decimal"
                      className="h-12"
                      value={marginStr}
                      onChange={(e) => setMarginStr(e.target.value)}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={applyTargetMargin}
                    disabled={costCents == null}
                  >
                    Ver preço para a margem informada
                  </Button>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {[5, 10, 15].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => applyDiscount(pct)}
                    className="rounded-full border border-[var(--border)] px-3 py-1 text-xs text-[var(--text-muted)] hover:bg-[var(--surface-muted)]"
                  >
                    −{pct}%
                  </button>
                ))}
              </div>

              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-[var(--text-subtle)]">
                      Valor simulado
                    </p>
                    <p className="mt-1 font-[family-name:var(--font-display)] text-2xl text-[var(--brand-ink)]">
                      {formatBRL(simulatedCents)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-[var(--text-subtle)]">
                      Custo estimado
                    </p>
                    <p className="mt-1 font-[family-name:var(--font-display)] text-2xl text-[var(--brand-ink)]">
                      {costCents != null ? formatBRL(costCents) : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-[var(--text-subtle)]">
                      Resultado operacional
                      {result.partial ? " (parcial)" : ""}
                    </p>
                    <p className="mt-1 font-[family-name:var(--font-display)] text-2xl text-[var(--brand-primary)]">
                      {result.result_cents != null
                        ? formatBRL(result.result_cents)
                        : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-[var(--text-subtle)]">Margem</p>
                    <p className="mt-1 font-[family-name:var(--font-display)] text-2xl text-[var(--brand-ink)]">
                      {result.margin_percent != null
                        ? `${result.margin_percent}%`
                        : "—"}
                    </p>
                  </div>
                </div>

                {costCents != null ? (
                  <div className="mt-4 space-y-1.5">
                    <div className="flex h-2 overflow-hidden rounded-full bg-[var(--surface-muted)]">
                      <div
                        className="bg-[var(--brand-soft)]"
                        style={{ width: `${costPct}%` }}
                        title="Custo"
                      />
                      <div
                        className="bg-[var(--brand-primary)]"
                        style={{ width: `${resultPct}%` }}
                        title="Resultado"
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-[var(--text-subtle)]">
                      <span>Custo</span>
                      <span>Resultado</span>
                    </div>
                  </div>
                ) : null}

                {result.break_even_cents != null ? (
                  <p
                    className="mt-3 text-xs text-[var(--text-muted)]"
                    title="Valor que cobre o custo operacional estimado."
                  >
                    Ponto de equilíbrio {formatBRL(result.break_even_cents)}
                  </p>
                ) : null}

                {result.vs_standard_cents != null &&
                ctx.default_price_cents != null ? (
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    {result.vs_standard_cents === 0
                      ? "Igual ao preço atual da clínica"
                      : result.vs_standard_cents < 0
                        ? `${formatBRL(Math.abs(result.vs_standard_cents))} abaixo do preço padrão`
                        : `${formatBRL(result.vs_standard_cents)} acima do preço padrão`}
                  </p>
                ) : null}
              </div>

              {ctx.default_price_cents != null && costCents != null ? (
                <div className="overflow-x-auto text-xs">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-[var(--text-subtle)]">
                        <th className="py-1 pr-2 font-medium" />
                        <th className="py-1 pr-2 font-medium">Atual</th>
                        <th className="py-1 font-medium">Simulação</th>
                      </tr>
                    </thead>
                    <tbody className="text-[var(--text)]">
                      <tr>
                        <td className="py-1 pr-2 text-[var(--text-muted)]">
                          Preço
                        </td>
                        <td className="py-1 pr-2">
                          {formatBRL(ctx.default_price_cents)}
                        </td>
                        <td className="py-1">{formatBRL(simulatedCents)}</td>
                      </tr>
                      <tr>
                        <td className="py-1 pr-2 text-[var(--text-muted)]">
                          Custo
                        </td>
                        <td className="py-1 pr-2">{formatBRL(costCents)}</td>
                        <td className="py-1">{formatBRL(costCents)}</td>
                      </tr>
                      <tr>
                        <td className="py-1 pr-2 text-[var(--text-muted)]">
                          Resultado
                        </td>
                        <td className="py-1 pr-2">
                          {formatBRL(ctx.default_price_cents - costCents)}
                        </td>
                        <td className="py-1">
                          {result.result_cents != null
                            ? formatBRL(result.result_cents)
                            : "—"}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              ) : null}

              <p className="text-[11px] text-[var(--text-subtle)]">
                {ctx.disclaimer}
              </p>

              {confirmSave ? (
                <div className="space-y-2 rounded-xl border border-[var(--border)] p-3">
                  <p className="text-sm font-medium text-[var(--brand-ink)]">
                    Confirmar novo preço padrão
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">
                    Preço atual{" "}
                    {ctx.default_price_cents != null
                      ? formatBRL(ctx.default_price_cents)
                      : "—"}{" "}
                    → Novo preço {formatBRL(simulatedCents)}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      loading={saving}
                      onClick={() => void confirmPriceUpdate()}
                    >
                      Confirmar alteração
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setConfirmSave(false)}
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2 border-t border-[var(--border)] px-4 py-3">
          <Button type="button" variant="secondary" onClick={onClose}>
            Fechar
          </Button>
          {step === "sim" &&
          ctx?.can_update_price &&
          ctx.mode === "catalog" &&
          !confirmSave ? (
            <Button
              type="button"
              onClick={() => setConfirmSave(true)}
              disabled={simulatedCents < 0}
            >
              Usar este valor como preço padrão
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** Botão padrão para abrir o simulador */
export function SimulateProcedureButton({
  onClick,
  className,
  variant = "primary",
  size = "md",
}: {
  onClick: () => void;
  className?: string;
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
}) {
  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      onClick={onClick}
      className={className}
    >
      <Calculator className="size-4" />
      Simular procedimento
    </Button>
  );
}
