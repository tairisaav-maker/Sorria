"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { formatBRL, centsToReais } from "@/lib/money";
import { INVENTORY_UNITS, type InventoryItem } from "@/types/inventory";

export function InventoryClient({
  canCreate,
  canUpdate,
}: {
  canCreate: boolean;
  canUpdate: boolean;
}) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [valueCents, setValueCents] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<InventoryItem | null>(null);

  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [purchaseUnit, setPurchaseUnit] =
    useState<(typeof INVENTORY_UNITS)[number]>("caixa");
  const [consumptionUnit, setConsumptionUnit] =
    useState<(typeof INVENTORY_UNITS)[number]>("un");
  const [unitsPer, setUnitsPer] = useState("100");
  const [qty, setQty] = useState("0");
  const [minQty, setMinQty] = useState("");
  const [unitCost, setUnitCost] = useState("0.40");
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const [listRes, valueRes] = await Promise.all([
      fetch("/api/demo/inventory").then((r) => r.json()),
      fetch("/api/demo/inventory?value=1").then((r) => r.json()),
    ]);
    if (listRes.error) setError(listRes.error);
    else setItems(listRes.items ?? []);
    setValueCents(valueRes.value?.total_cents ?? 0);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  function openCreate() {
    setEditing(null);
    setName("");
    setCategory("");
    setPurchaseUnit("caixa");
    setConsumptionUnit("un");
    setUnitsPer("100");
    setQty("0");
    setMinQty("");
    setUnitCost("0.40");
    setShowForm(true);
  }

  function openEdit(item: InventoryItem) {
    setEditing(item);
    setName(item.name);
    setCategory(item.category ?? "");
    setPurchaseUnit(item.purchase_unit);
    setConsumptionUnit(item.consumption_unit);
    setUnitsPer(String(item.units_per_purchase_unit));
    setQty(String(item.current_quantity));
    setMinQty(
      item.minimum_quantity != null ? String(item.minimum_quantity) : "",
    );
    setUnitCost(centsToReais(item.average_unit_cost_cents).toFixed(4));
    setShowForm(true);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const data = {
      ...(editing ? { id: editing.id } : {}),
      name,
      category: category || null,
      purchase_unit: purchaseUnit,
      consumption_unit: consumptionUnit,
      units_per_purchase_unit: Number(unitsPer.replace(",", ".")),
      current_quantity: Number(qty.replace(",", ".")),
      minimum_quantity: minQty ? Number(minQty.replace(",", ".")) : null,
      average_unit_cost_reais: Number(unitCost.replace(",", ".")),
    };
    const res = await fetch("/api/demo/inventory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: editing ? "update" : "create",
        data,
      }),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(json.error ?? "Erro ao salvar");
      return;
    }
    setShowForm(false);
    await load();
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
      <section className="animate-fade-in">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight text-[var(--brand-ink)]">
              Estoque
            </h1>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Itens · unidade de compra ≠ consumo · valor estimado operacional
            </p>
          </div>
          {canCreate ? (
            <Button onClick={openCreate} size="md">
              <Plus className="size-4" />
              Novo item
            </Button>
          ) : null}
        </div>
        <p className="mt-3 text-sm text-[var(--text-muted)]">
          Valor estimado do estoque:{" "}
          <span className="font-medium text-[var(--brand-ink)]">
            {formatBRL(valueCents)}
          </span>
        </p>
      </section>

      {error ? (
        <p className="rounded-xl bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger)]">
          {error}
        </p>
      ) : null}

      {showForm ? (
        <form
          onSubmit={onSubmit}
          className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/90 p-4 animate-rise"
        >
          <h2 className="text-base font-medium">
            {editing ? "Editar item" : "Novo item"}
          </h2>
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
              <Label>Custo médio / un. consumo (R$)</Label>
              <Input
                value={unitCost}
                onChange={(e) => setUnitCost(e.target.value)}
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
            <div className="space-y-1.5">
              <Label>Qtd atual (consumo)</Label>
              <Input value={qty} onChange={(e) => setQty(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Estoque mínimo</Label>
              <Input
                value={minQty}
                onChange={(e) => setMinQty(e.target.value)}
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
          description="Cadastre materiais com unidade de compra e de consumo."
          action={
            canCreate ? (
              <Button onClick={openCreate}>Cadastrar item</Button>
            ) : undefined
          }
        />
      ) : (
        <ul className="divide-y divide-[var(--border)] rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/90 animate-rise">
          {items.map((item) => {
            const low =
              item.minimum_quantity != null &&
              item.current_quantity <= item.minimum_quantity;
            const empty = item.current_quantity <= 0;
            return (
              <li
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-4"
              >
                <div>
                  <p className="text-sm font-medium text-[var(--text)]">
                    {item.name}
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                    Compra: {item.purchase_unit} → consumo:{" "}
                    {item.consumption_unit} (×{item.units_per_purchase_unit})
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                    {item.current_quantity} {item.consumption_unit} ·{" "}
                    {formatBRL(item.average_unit_cost_cents)}/
                    {item.consumption_unit}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {empty ? (
                    <Badge tone="danger">Sem estoque</Badge>
                  ) : low ? (
                    <Badge tone="warning">Baixo</Badge>
                  ) : (
                    <Badge tone="success">Ok</Badge>
                  )}
                  {canUpdate ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEdit(item)}
                    >
                      Editar
                    </Button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
