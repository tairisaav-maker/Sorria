"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatBRL } from "@/lib/money";
import type {
  PurchaseList,
  PurchaseListItem,
  ReplenishmentHorizon,
  ReplenishmentNeedRow,
  ReplenishmentSummary,
} from "@/types/replenishment";
import {
  PURCHASE_LIST_STATUS_LABELS,
  REPLENISHMENT_HORIZON_LABELS,
  REPLENISHMENT_STATUS_LABELS,
} from "@/types/replenishment";

const HORIZONS: ReplenishmentHorizon[] = ["7d", "15d", "30d", "custom"];

type Selection = Record<
  string,
  { selected: boolean; packages: number }
>;

export function ReplenishmentClient() {
  const [horizon, setHorizon] = useState<ReplenishmentHorizon>("7d");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [summary, setSummary] = useState<ReplenishmentSummary | null>(null);
  const [selection, setSelection] = useState<Selection>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [groupBy, setGroupBy] = useState<"priority" | "category">("priority");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [lists, setLists] = useState<
    Array<PurchaseList & { items_count: number }>
  >([]);
  const [activeList, setActiveList] = useState<{
    list: PurchaseList;
    items: PurchaseListItem[];
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [canCreate, setCanCreate] = useState(true);

  const qs = useCallback(() => {
    const p = new URLSearchParams({ horizon });
    if (horizon === "custom") {
      if (from) p.set("from", from);
      if (to) p.set("to", to);
    }
    return p.toString();
  }, [horizon, from, to]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [needsRes, listsRes] = await Promise.all([
        fetch(`/api/demo/replenishment?resource=needs&${qs()}`),
        fetch(`/api/demo/replenishment?resource=lists`),
      ]);
      const needs = await needsRes.json();
      const listsData = await listsRes.json();
      if (!needsRes.ok) {
        setError(
          needs.error ?? "Não foi possível carregar a reposição. Tente novamente.",
        );
        setSummary(null);
        return;
      }
      setSummary(needs);
      const sel: Selection = {};
      for (const row of needs.items as ReplenishmentNeedRow[]) {
        sel[row.inventory_item_id] = {
          selected: row.recommended_packages > 0,
          packages: row.recommended_packages,
        };
      }
      setSelection(sel);
      if (listsRes.ok) setLists(listsData.lists ?? []);
    } catch {
      setError("Não foi possível carregar a reposição. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }, [qs]);

  useEffect(() => {
    void load();
  }, [load]);

  const estimate = useMemo(() => {
    if (!summary) return { total: null as number | null, missing: 0 };
    let total = 0;
    let any = false;
    let missing = 0;
    for (const row of summary.items) {
      const sel = selection[row.inventory_item_id];
      if (!sel?.selected || sel.packages <= 0) continue;
      if (row.estimated_package_cost_cents != null) {
        total += sel.packages * row.estimated_package_cost_cents;
        any = true;
      } else {
        missing += 1;
      }
    }
    return { total: any ? total : null, missing };
  }, [summary, selection]);

  async function createList() {
    if (!summary) return;
    setBusy(true);
    try {
      const itemIds = summary.items
        .filter((r) => selection[r.inventory_item_id]?.selected)
        .map((r) => r.inventory_item_id);
      const overrides: Record<string, number> = {};
      for (const id of itemIds) {
        overrides[id] = selection[id]?.packages ?? 0;
      }
      const res = await fetch("/api/demo/replenishment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_list",
          horizon,
          from: horizon === "custom" ? from : undefined,
          to: horizon === "custom" ? to : undefined,
          item_ids: itemIds,
          package_overrides: overrides,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Não foi possível criar a lista.");
        if (res.status === 403) setCanCreate(false);
        return;
      }
      setActiveList({ list: data.list, items: data.items });
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function openList(id: string) {
    const res = await fetch(
      `/api/demo/replenishment?resource=list&id=${id}`,
    ).then((r) => r.json());
    if (res.list) setActiveList({ list: res.list, items: res.items });
  }

  async function convertPurchase() {
    if (!activeList) return;
    setBusy(true);
    try {
      const lines = activeList.items
        .filter((i) => i.selected && i.status === "pending" && i.selected_purchase_packages > 0)
        .map((i) => ({
          purchase_list_item_id: i.id,
          purchase_quantity: i.selected_purchase_packages,
          total_cost_reais:
            i.estimated_total_cost_cents != null
              ? i.estimated_total_cost_cents / 100
              : 0,
        }));
      const res = await fetch("/api/demo/replenishment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "convert_to_purchase",
          purchase_list_id: activeList.list.id,
          purchase_date: new Date().toISOString().slice(0, 10),
          lines,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Não foi possível registrar a compra.");
        return;
      }
      setActiveList({ list: data.list, items: activeList.items.map((i) => {
        const bought = lines.some((l) => l.purchase_list_item_id === i.id);
        return bought ? { ...i, status: "purchased" as const } : i;
      }) });
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function cancelList() {
    if (!activeList) return;
    setBusy(true);
    try {
      await fetch("/api/demo/replenishment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "cancel_list",
          purchase_list_id: activeList.list.id,
        }),
      });
      setActiveList(null);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function refreshList() {
    if (!activeList) return;
    setBusy(true);
    try {
      const res = await fetch("/api/demo/replenishment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "refresh_list",
          purchase_list_id: activeList.list.id,
        }),
      }).then((r) => r.json());
      if (res.list) {
        setActiveList({ list: res.list, items: res.items });
      }
      await load();
    } finally {
      setBusy(false);
    }
  }

  const detail = summary?.items.find((i) => i.inventory_item_id === detailId);

  const grouped = useMemo(() => {
    if (!summary) return [] as Array<{ key: string; rows: ReplenishmentNeedRow[] }>;
    if (groupBy === "category") {
      const map = new Map<string, ReplenishmentNeedRow[]>();
      for (const row of summary.items) {
        const k = row.category ?? "Outros";
        const list = map.get(k) ?? [];
        list.push(row);
        map.set(k, list);
      }
      return [...map.entries()].map(([key, rows]) => ({ key, rows }));
    }
    return [{ key: "Por prioridade", rows: summary.items }];
  }, [summary, groupBy]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <header>
        <p className="text-sm text-[var(--text-muted)]">
          <Link href="/app/estoque" className="hover:underline">
            Estoque
          </Link>{" "}
          / Reposição
        </p>
        <h1 className="font-[family-name:var(--font-display)] text-3xl text-[var(--brand-ink)]">
          Reposição
        </h1>
        <p className="mt-1 text-[var(--text-muted)]">
          Veja o que pode faltar e prepare sua próxima compra.
        </p>
      </header>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <Label htmlFor="horizon">Horizonte</Label>
          <select
            id="horizon"
            className="mt-1 h-10 rounded-xl border border-[var(--border)] bg-white px-3 text-sm"
            value={horizon}
            onChange={(e) => setHorizon(e.target.value as ReplenishmentHorizon)}
          >
            {HORIZONS.map((h) => (
              <option key={h} value={h}>
                {REPLENISHMENT_HORIZON_LABELS[h]}
              </option>
            ))}
          </select>
        </div>
        {horizon === "custom" ? (
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
        <div>
          <Label htmlFor="group">Agrupar</Label>
          <select
            id="group"
            className="mt-1 h-10 rounded-xl border border-[var(--border)] bg-white px-3 text-sm"
            value={groupBy}
            onChange={(e) =>
              setGroupBy(e.target.value as "priority" | "category")
            }
          >
            <option value="priority">Prioridade</option>
            <option value="category">Categoria</option>
          </select>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-[var(--text-muted)]">Carregando…</p>
      ) : null}
      {error ? (
        <p className="rounded-xl bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger)]">
          {error}
        </p>
      ) : null}

      {summary ? (
        <div className="space-y-2 text-sm text-[var(--text-muted)]">
          <p>
            Cobertura da Agenda:{" "}
            {summary.agenda_coverage_percent != null
              ? `${summary.agenda_coverage_percent}%`
              : "—"}{" "}
            · Cobertura das fichas:{" "}
            {summary.bom_coverage_percent != null
              ? `${summary.bom_coverage_percent}%`
              : "—"}
          </p>
          {summary.warnings.map((w) => (
            <p key={w} className="rounded-xl border border-[var(--border)] px-3 py-2">
              {w}
            </p>
          ))}
        </div>
      ) : null}

      {!loading && summary && summary.items.length === 0 ? (
        <EmptyState title="Nenhuma necessidade de reposição neste horizonte." />
      ) : null}

      {!loading && summary && summary.items.length > 0 ? (
        <>
          {grouped.map((g) => (
            <section key={g.key} className="space-y-2">
              <h2 className="font-medium text-[var(--brand-ink)]">{g.key}</h2>
              <div className="overflow-x-auto rounded-2xl border border-[var(--border)]">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b text-xs uppercase text-[var(--text-subtle)]">
                    <tr>
                      <th className="px-3 py-2" />
                      <th className="px-3 py-2">Material</th>
                      <th className="px-3 py-2">Estoque</th>
                      <th className="px-3 py-2">Necessário</th>
                      <th className="px-3 py-2">Mínimo</th>
                      <th className="px-3 py-2">Repor</th>
                      <th className="px-3 py-2">Compra sugerida</th>
                      <th className="px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.rows.map((row) => {
                      const sel = selection[row.inventory_item_id] ?? {
                        selected: false,
                        packages: 0,
                      };
                      return (
                        <tr
                          key={row.inventory_item_id}
                          className="border-b border-[var(--border)]"
                        >
                          <td className="px-3 py-2">
                            <input
                              type="checkbox"
                              checked={sel.selected}
                              onChange={(e) =>
                                setSelection((s) => ({
                                  ...s,
                                  [row.inventory_item_id]: {
                                    ...sel,
                                    selected: e.target.checked,
                                  },
                                }))
                              }
                            />
                          </td>
                          <td className="px-3 py-2">
                            <button
                              type="button"
                              className="font-medium text-[var(--brand-primary)] hover:underline"
                              onClick={() =>
                                setDetailId(row.inventory_item_id)
                              }
                            >
                              {row.item_name}
                            </button>
                            {row.warnings[0] ? (
                              <p className="text-xs text-[var(--warning)]">
                                {row.warnings[0]}
                              </p>
                            ) : null}
                          </td>
                          <td className="px-3 py-2">
                            {row.effective_quantity} {row.consumption_unit}
                          </td>
                          <td className="px-3 py-2">
                            {row.forecast_quantity} {row.consumption_unit}
                            {row.historical.historical_forecast_quantity !=
                            null ? (
                              <p className="text-xs text-[var(--text-muted)]">
                                Histórico:{" "}
                                {row.historical.historical_forecast_quantity}{" "}
                                {row.consumption_unit}
                              </p>
                            ) : null}
                          </td>
                          <td className="px-3 py-2">
                            {row.minimum_quantity != null
                              ? `${row.minimum_quantity} ${row.consumption_unit}`
                              : "—"}
                          </td>
                          <td className="px-3 py-2">
                            {row.recommended_replenishment_quantity}{" "}
                            {row.consumption_unit}
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                min={0}
                                className="w-20"
                                value={sel.packages}
                                onChange={(e) =>
                                  setSelection((s) => ({
                                    ...s,
                                    [row.inventory_item_id]: {
                                      selected: Number(e.target.value) > 0,
                                      packages: Math.max(
                                        0,
                                        Number(e.target.value) || 0,
                                      ),
                                    },
                                  }))
                                }
                              />
                              <span className="text-xs text-[var(--text-muted)]">
                                {row.purchase_unit}
                                {row.estimated_total_cost_cents != null &&
                                sel.packages > 0 &&
                                row.estimated_package_cost_cents != null
                                  ? ` · ${formatBRL(sel.packages * row.estimated_package_cost_cents)}`
                                  : ""}
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            {REPLENISHMENT_STATUS_LABELS[row.status]}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          ))}

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--border)] px-4 py-3">
            <div className="text-sm">
              {estimate.total != null ? (
                <>
                  <span className="font-medium">
                    {estimate.missing > 0
                      ? "Estimativa parcial"
                      : "Estimativa da lista"}
                    : {formatBRL(estimate.total)}
                  </span>
                  {estimate.missing > 0 ? (
                    <span className="ml-2 text-[var(--text-muted)]">
                      {estimate.missing} item(ns) sem preço de referência
                    </span>
                  ) : null}
                </>
              ) : (
                <span className="text-[var(--text-muted)]">
                  Estimativa indisponível (sem preços ou sem permissão de custo)
                </span>
              )}
            </div>
            {canCreate ? (
              <Button
                type="button"
                disabled={busy}
                onClick={() => void createList()}
              >
                Criar lista de compras
              </Button>
            ) : null}
          </div>
        </>
      ) : null}

      {detail ? (
        <aside className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] p-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">{detail.item_name}</h3>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setDetailId(null)}
            >
              Fechar
            </Button>
          </div>
          <ul className="mt-3 space-y-1 text-sm text-[var(--text-muted)]">
            <li>
              Estoque útil: {detail.effective_quantity}{" "}
              {detail.consumption_unit}
            </li>
            <li>
              Previsto (ficha): {detail.forecast_quantity}{" "}
              {detail.consumption_unit}
            </li>
            {detail.historical.historical_forecast_quantity != null ? (
              <li>
                Considerando histórico:{" "}
                {detail.historical.historical_forecast_quantity}{" "}
                {detail.consumption_unit}
              </li>
            ) : null}
            <li>
              Sugestão: {detail.recommended_packages} {detail.purchase_unit} (
              {detail.purchased_quantity_if_suggested}{" "}
              {detail.consumption_unit}; excedente{" "}
              {detail.surplus_quantity} {detail.consumption_unit})
            </li>
            {detail.estimated_package_cost_cents != null ? (
              <li>
                Custo estimado:{" "}
                {formatBRL(detail.estimated_total_cost_cents ?? 0)} (
                {detail.cost_source === "last_purchase"
                  ? "última compra"
                  : "custo médio"}
                )
              </li>
            ) : null}
            {detail.last_supplier_name ? (
              <li>Último fornecedor: {detail.last_supplier_name}</li>
            ) : null}
            {detail.open_list_hint ? <li>{detail.open_list_hint}</li> : null}
            {detail.used_in_procedures.length > 0 ? (
              <li>
                Usada principalmente em:{" "}
                {detail.used_in_procedures.join(", ")}
              </li>
            ) : null}
          </ul>
          {detail.patient_breakdown.length > 0 ? (
            <ul className="mt-3 max-h-40 space-y-1 overflow-auto text-sm">
              {detail.patient_breakdown.map((p, idx) => (
                <li key={`${p.appointment_id}-${idx}`}>
                  {p.patient_name ?? "Paciente"} — {p.quantity}{" "}
                  {detail.consumption_unit} ({p.procedure_name})
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-xs text-[var(--text-muted)]">
              Demanda agregada sem detalhe de paciente (sem permissão ou sem
              agenda).
            </p>
          )}
        </aside>
      ) : null}

      {lists.length > 0 ? (
        <section className="space-y-2">
          <h2 className="font-medium">Listas de compras</h2>
          <ul className="space-y-2 text-sm">
            {lists.map((l) => (
              <li
                key={l.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border)] px-3 py-2"
              >
                <span>
                  {l.name} · {PURCHASE_LIST_STATUS_LABELS[l.status]} ·{" "}
                  {l.items_count} item(ns)
                  {l.estimated_total_cents != null
                    ? ` · ${formatBRL(l.estimated_total_cents)}`
                    : ""}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => void openList(l.id)}
                >
                  Abrir
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {activeList ? (
        <section className="space-y-3 rounded-2xl border border-[var(--border)] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-medium">{activeList.list.name}</h2>
              <p className="text-sm text-[var(--text-muted)]">
                {PURCHASE_LIST_STATUS_LABELS[activeList.list.status]} · snapshot
                do período {activeList.list.start_date} –{" "}
                {activeList.list.end_date}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={busy}
                onClick={() => void refreshList()}
              >
                Atualizar recomendações
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={busy || activeList.list.status === "cancelled"}
                onClick={() => void convertPurchase()}
              >
                Registrar compra a partir desta lista
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() => void cancelList()}
              >
                Cancelar lista
              </Button>
            </div>
          </div>
          <p className="text-xs text-[var(--text-muted)]">
            Criar lista ≠ registrar compra. O estoque só muda quando a compra
            real for confirmada. Preços estimados são referência — informe o
            valor pago.
          </p>
          <ul className="space-y-1 text-sm">
            {activeList.items.map((i) => (
              <li key={i.id} className="flex justify-between gap-2 border-b py-1">
                <span>
                  {i.item_name_snapshot} · {i.selected_purchase_packages}{" "}
                  {i.purchase_unit} · {i.status}
                </span>
                <span className="text-[var(--text-muted)]">
                  {i.estimated_total_cost_cents != null
                    ? formatBRL(i.estimated_total_cost_cents)
                    : "—"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
