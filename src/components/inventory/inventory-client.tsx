"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { formatBRL } from "@/lib/money";
import {
  INVENTORY_STATUS_LABELS,
  INVENTORY_UNITS,
  type InventoryItemStatus,
} from "@/types/inventory";

type Row = {
  id: string;
  name: string;
  current_quantity: number;
  consumption_unit: string;
  minimum_quantity: number | null;
  average_unit_cost_cents: number | null;
  stock_value_cents: number | null;
  status: InventoryItemStatus;
  purchase_unit: string;
  units_per_purchase_unit: number;
  category: string | null;
};

type Dashboard = {
  low_count: number;
  empty_count: number;
  expiring_count: number;
  estimated_value_cents: number | null;
};

export function InventoryClient({
  canCreate,
  canUpdate,
  canPurchase,
  canAdjust,
}: {
  canCreate: boolean;
  canUpdate: boolean;
  canPurchase: boolean;
  canAdjust: boolean;
}) {
  const [items, setItems] = useState<Row[]>([]);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [canViewCosts, setCanViewCosts] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [purchaseUnit, setPurchaseUnit] =
    useState<(typeof INVENTORY_UNITS)[number]>("caixa");
  const [consumptionUnit, setConsumptionUnit] =
    useState<(typeof INVENTORY_UNITS)[number]>("un");
  const [unitsPer, setUnitsPer] = useState("100");
  const [minQty, setMinQty] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const [listRes, dashRes] = await Promise.all([
      fetch("/api/demo/inventory").then((r) => r.json()),
      fetch("/api/demo/inventory?view=dashboard").then((r) => r.json()),
    ]);
    if (listRes.error) setError(listRes.error);
    else {
      setItems(listRes.items ?? []);
      setCanViewCosts(Boolean(listRes.canViewCosts));
    }
    setDashboard(dashRes.dashboard ?? null);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch("/api/demo/inventory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create",
        data: {
          name,
          category: category || null,
          purchase_unit: purchaseUnit,
          consumption_unit: consumptionUnit,
          units_per_purchase_unit: Number(unitsPer.replace(",", ".")),
          minimum_quantity: minQty ? Number(minQty.replace(",", ".")) : null,
        },
      }),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(json.error ?? "Erro ao salvar");
      return;
    }
    setShowForm(false);
    setName("");
    await load();
  }

  const statusTone = (
    s: InventoryItemStatus,
  ): "success" | "warning" | "danger" | "info" | "neutral" => {
    if (s === "empty") return "danger";
    if (s === "low") return "warning";
    if (s === "expiring") return "info";
    return "success";
  };

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
      <section className="animate-fade-in">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight text-[var(--brand-ink)]">
              Estoque
            </h1>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Itens · previsão · compras · movimentações · custo médio
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/app/estoque/previsao">
              <Button variant="secondary" size="sm">
                Previsão
              </Button>
            </Link>
            {canPurchase ? (
              <Link href="/app/estoque/compras">
                <Button variant="secondary" size="sm">
                  Compras
                </Button>
              </Link>
            ) : null}
            <Link href="/app/estoque/movimentacoes">
              <Button variant="secondary" size="sm">
                Movimentações
              </Button>
            </Link>
            {canCreate ? (
              <Button onClick={() => setShowForm(true)} size="sm">
                <Plus className="size-4" />
                Novo item
              </Button>
            ) : null}
          </div>
        </div>
      </section>

      {dashboard ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 animate-rise">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/90 px-3 py-3">
            <p className="text-xs text-[var(--text-subtle)]">
              Valor estimado do estoque
            </p>
            <p className="mt-1 font-[family-name:var(--font-display)] text-xl text-[var(--brand-ink)]">
              {canViewCosts && dashboard.estimated_value_cents != null
                ? formatBRL(dashboard.estimated_value_cents)
                : "—"}
            </p>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/90 px-3 py-3">
            <p className="text-xs text-[var(--text-subtle)]">Estoque baixo</p>
            <p className="mt-1 font-[family-name:var(--font-display)] text-xl">
              {dashboard.low_count}
            </p>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/90 px-3 py-3">
            <p className="text-xs text-[var(--text-subtle)]">Sem estoque</p>
            <p className="mt-1 font-[family-name:var(--font-display)] text-xl">
              {dashboard.empty_count}
            </p>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/90 px-3 py-3">
            <p className="text-xs text-[var(--text-subtle)]">
              Próximo do vencimento
            </p>
            <p className="mt-1 font-[family-name:var(--font-display)] text-xl">
              {dashboard.expiring_count}
            </p>
          </div>
        </div>
      ) : null}

      {error ? (
        <p className="rounded-xl bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger)]">
          {error}
        </p>
      ) : null}

      {showForm ? (
        <form
          onSubmit={onCreate}
          className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/90 p-4"
        >
          <h2 className="text-base font-medium">Novo item</h2>
          <p className="text-xs text-[var(--text-muted)]">
            Saldo e custo médio começam em zero. Use Estoque inicial ou Compra.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Nome</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <Input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Estoque mínimo</Label>
              <Input
                value={minQty}
                onChange={(e) => setMinQty(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Unidade de compra</Label>
              <Select
                value={purchaseUnit}
                onChange={(e) =>
                  setPurchaseUnit(
                    e.target.value as (typeof INVENTORY_UNITS)[number],
                  )
                }
              >
                {INVENTORY_UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Unidade de consumo</Label>
              <Select
                value={consumptionUnit}
                onChange={(e) =>
                  setConsumptionUnit(
                    e.target.value as (typeof INVENTORY_UNITS)[number],
                  )
                }
              >
                {INVENTORY_UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Un. consumo por un. compra</Label>
              <Input
                value={unitsPer}
                onChange={(e) => setUnitsPer(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="submit" loading={saving}>
              Salvar
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowForm(false)}
            >
              Cancelar
            </Button>
          </div>
        </form>
      ) : null}

      {loading ? (
        <p className="text-sm text-[var(--text-muted)]">Carregando…</p>
      ) : items.length === 0 ? (
        <EmptyState
          title="Estoque vazio"
          description="Cadastre materiais e registre estoque inicial ou compra."
        />
      ) : (
        <ul className="divide-y divide-[var(--border)] rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/90 animate-rise">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={`/app/estoque/${item.id}`}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 transition-colors hover:bg-[var(--surface-muted)]/60"
              >
                <div>
                  <p className="text-sm font-medium text-[var(--text)]">
                    {item.name}
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                    {item.current_quantity} {item.consumption_unit}
                    {item.minimum_quantity != null
                      ? ` · mín. ${item.minimum_quantity}`
                      : ""}
                    {canViewCosts && item.average_unit_cost_cents != null
                      ? ` · ${formatBRL(item.average_unit_cost_cents)}/${item.consumption_unit}`
                      : ""}
                  </p>
                  {canViewCosts && item.stock_value_cents != null ? (
                    <p className="mt-0.5 text-xs text-[var(--text-subtle)]">
                      Valor: {formatBRL(item.stock_value_cents)}
                    </p>
                  ) : null}
                </div>
                <Badge tone={statusTone(item.status)}>
                  {INVENTORY_STATUS_LABELS[item.status]}
                </Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {canAdjust ? (
        <p className="text-xs text-[var(--text-subtle)]">
          Ajustes, perdas e estoque inicial ficam no detalhe de cada item.
        </p>
      ) : null}
      {canUpdate ? null : null}
    </div>
  );
}
