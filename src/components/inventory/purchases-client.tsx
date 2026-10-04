"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { formatBRL } from "@/lib/money";
import { purchaseCostToConsumptionUnitCents } from "@/lib/inventory/units";

type ItemOpt = {
  id: string;
  name: string;
  purchase_unit: string;
  units_per_purchase_unit: number;
  consumption_unit: string;
};

type PurchaseRow = {
  id: string;
  purchase_date: string;
  supplier_name: string | null;
  items_count: number;
  total_cost_cents: number;
  cancelled_at: string | null;
};

type Line = {
  inventory_item_id: string;
  purchase_quantity: string;
  units_per_purchase_unit: string;
  total_cost_reais: string;
  lot_number: string;
  expiration_date: string;
};

export function PurchasesClient({
  canPurchase,
  canViewCosts,
  presetItemId,
}: {
  canPurchase: boolean;
  canViewCosts: boolean;
  presetItemId?: string;
}) {
  const [purchases, setPurchases] = useState<PurchaseRow[]>([]);
  const [items, setItems] = useState<ItemOpt[]>([]);
  const [showForm, setShowForm] = useState(Boolean(presetItemId));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [supplier, setSupplier] = useState("");
  const [invoice, setInvoice] = useState("");
  const [lines, setLines] = useState<Line[]>([
    {
      inventory_item_id: "",
      purchase_quantity: "1",
      units_per_purchase_unit: "100",
      total_cost_reais: "40",
      lot_number: "",
      expiration_date: "",
    },
  ]);

  async function load() {
    const [pRes, iRes] = await Promise.all([
      fetch("/api/demo/inventory?view=purchases").then((r) => r.json()),
      fetch("/api/demo/inventory").then((r) => r.json()),
    ]);
    setPurchases(pRes.items ?? []);
    const opts = (iRes.items ?? []).map(
      (i: {
        id: string;
        name: string;
        purchase_unit: string;
        units_per_purchase_unit: number;
        consumption_unit: string;
      }) => ({
        id: i.id,
        name: i.name,
        purchase_unit: i.purchase_unit,
        units_per_purchase_unit: i.units_per_purchase_unit,
        consumption_unit: i.consumption_unit,
      }),
    );
    setItems(opts);
    const preferred =
      (presetItemId && opts.find((o: ItemOpt) => o.id === presetItemId)) ||
      opts[0];
    if (preferred && !lines[0].inventory_item_id) {
      setLines((prev) =>
        prev.map((l, idx) =>
          idx === 0
            ? {
                ...l,
                inventory_item_id: preferred.id,
                units_per_purchase_unit: String(
                  preferred.units_per_purchase_unit,
                ),
              }
            : l,
        ),
      );
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const previews = useMemo(() => {
    return lines.map((l) => {
      const qty = Number(l.purchase_quantity.replace(",", ".")) || 0;
      const units = Number(l.units_per_purchase_unit.replace(",", ".")) || 0;
      const total = Number(l.total_cost_reais.replace(",", ".")) || 0;
      if (qty <= 0 || units <= 0) {
        return { received: 0, unitCents: 0 };
      }
      try {
        return {
          received: qty * units,
          unitCents: purchaseCostToConsumptionUnitCents({
            purchaseTotalReais: total,
            purchaseQuantity: qty,
            unitsPerPurchaseUnit: units,
          }),
        };
      } catch {
        return { received: 0, unitCents: 0 };
      }
    });
  }, [lines]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch("/api/demo/inventory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "purchase_create",
        data: {
          purchase_date: date,
          supplier_name: supplier || null,
          invoice_number: invoice || null,
          items: lines.map((l) => ({
            inventory_item_id: l.inventory_item_id,
            purchase_quantity: Number(l.purchase_quantity.replace(",", ".")),
            units_per_purchase_unit: Number(
              l.units_per_purchase_unit.replace(",", "."),
            ),
            total_cost_reais: Number(l.total_cost_reais.replace(",", ".")),
            lot_number: l.lot_number || null,
            expiration_date: l.expiration_date || null,
          })),
        },
      }),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(json.error ?? "Erro ao registrar compra");
      return;
    }
    setShowForm(false);
    await load();
  }

  async function cancelPurchase(id: string) {
    const reason = prompt("Motivo do cancelamento:");
    if (!reason || reason.trim().length < 2) return;
    const res = await fetch("/api/demo/inventory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "purchase_cancel",
        data: { id, cancellation_reason: reason.trim() },
      }),
    });
    if (!res.ok) {
      const json = await res.json();
      setError(json.error ?? "Erro ao cancelar");
      return;
    }
    await load();
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <section>
        <p className="text-sm text-[var(--text-muted)]">
          <Link href="/app/estoque" className="text-[var(--brand-primary)]">
            Estoque
          </Link>
        </p>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight text-[var(--brand-ink)]">
              Compras
            </h1>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Entrada com conversão e custo médio ponderado
            </p>
          </div>
          {canPurchase ? (
            <Button size="sm" onClick={() => setShowForm(true)}>
              Registrar compra
            </Button>
          ) : null}
        </div>
      </section>

      {error ? (
        <p className="rounded-xl bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger)]">
          {error}
        </p>
      ) : null}

      {showForm ? (
        <form
          onSubmit={submit}
          className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/90 p-4"
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Data</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Fornecedor</Label>
              <Input
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Nota / documento</Label>
              <Input
                value={invoice}
                onChange={(e) => setInvoice(e.target.value)}
              />
            </div>
          </div>

          {lines.map((line, idx) => {
            const item = items.find((i) => i.id === line.inventory_item_id);
            const preview = previews[idx];
            return (
              <div
                key={idx}
                className="space-y-2 rounded-xl border border-[var(--border)] p-3"
              >
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>Material</Label>
                    <Select
                      value={line.inventory_item_id}
                      onChange={(e) => {
                        const opt = items.find((i) => i.id === e.target.value);
                        setLines((prev) =>
                          prev.map((l, i) =>
                            i === idx
                              ? {
                                  ...l,
                                  inventory_item_id: e.target.value,
                                  units_per_purchase_unit: opt
                                    ? String(opt.units_per_purchase_unit)
                                    : l.units_per_purchase_unit,
                                }
                              : l,
                          ),
                        );
                      }}
                      required
                    >
                      {items.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>
                      Qtd compra ({item?.purchase_unit ?? "un"})
                    </Label>
                    <Input
                      value={line.purchase_quantity}
                      onChange={(e) =>
                        setLines((prev) =>
                          prev.map((l, i) =>
                            i === idx
                              ? { ...l, purchase_quantity: e.target.value }
                              : l,
                          ),
                        )
                      }
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Conteúdo / embalagem</Label>
                    <Input
                      value={line.units_per_purchase_unit}
                      onChange={(e) =>
                        setLines((prev) =>
                          prev.map((l, i) =>
                            i === idx
                              ? {
                                  ...l,
                                  units_per_purchase_unit: e.target.value,
                                }
                              : l,
                          ),
                        )
                      }
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Custo total (R$)</Label>
                    <Input
                      value={line.total_cost_reais}
                      onChange={(e) =>
                        setLines((prev) =>
                          prev.map((l, i) =>
                            i === idx
                              ? { ...l, total_cost_reais: e.target.value }
                              : l,
                          ),
                        )
                      }
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Lote</Label>
                    <Input
                      value={line.lot_number}
                      onChange={(e) =>
                        setLines((prev) =>
                          prev.map((l, i) =>
                            i === idx
                              ? { ...l, lot_number: e.target.value }
                              : l,
                          ),
                        )
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Validade</Label>
                    <Input
                      type="date"
                      value={line.expiration_date}
                      onChange={(e) =>
                        setLines((prev) =>
                          prev.map((l, i) =>
                            i === idx
                              ? { ...l, expiration_date: e.target.value }
                              : l,
                          ),
                        )
                      }
                    />
                  </div>
                </div>
                <p className="text-xs text-[var(--text-muted)]">
                  Preview: {preview.received} {item?.consumption_unit ?? "un"}{" "}
                  recebidos
                  {canViewCosts
                    ? ` · ${formatBRL(preview.unitCents)} / ${item?.consumption_unit ?? "un"}`
                    : ""}{" "}
                  (servidor recalcula ao salvar)
                </p>
              </div>
            );
          })}

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() =>
                setLines((prev) => [
                  ...prev,
                  {
                    inventory_item_id: items[0]?.id ?? "",
                    purchase_quantity: "1",
                    units_per_purchase_unit: String(
                      items[0]?.units_per_purchase_unit ?? 1,
                    ),
                    total_cost_reais: "0",
                    lot_number: "",
                    expiration_date: "",
                  },
                ])
              }
            >
              + Item
            </Button>
            <Button type="submit" loading={saving}>
              Confirmar compra
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowForm(false)}
            >
              Cancelar
            </Button>
          </div>
        </form>
      ) : null}

      <ul className="divide-y divide-[var(--border)] rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/90">
        {purchases.length === 0 ? (
          <li className="px-4 py-5 text-sm text-[var(--text-muted)]">
            Nenhuma compra registrada.
          </li>
        ) : (
          purchases.map((p) => (
            <li
              key={p.id}
              className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium">
                  {p.purchase_date}
                  {p.supplier_name ? ` · ${p.supplier_name}` : ""}
                </p>
                <p className="text-xs text-[var(--text-muted)]">
                  {p.items_count} item(ns)
                  {canViewCosts
                    ? ` · ${formatBRL(p.total_cost_cents)}`
                    : ""}
                  {p.cancelled_at ? " · Cancelada" : ""}
                </p>
              </div>
              {canPurchase && !p.cancelled_at ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => cancelPurchase(p.id)}
                >
                  Cancelar
                </Button>
              ) : null}
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
