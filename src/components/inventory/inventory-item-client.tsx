"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { formatBRL } from "@/lib/money";
import {
  ADJUSTMENT_REASON_LABELS,
  ADJUSTMENT_REASONS,
  CONSUMPTION_MODE_LABELS,
  MOVEMENT_TYPE_LABELS,
  type AdjustmentReason,
  type ConsumptionMode,
  type MovementType,
} from "@/types/inventory";

type Item = {
  id: string;
  name: string;
  current_quantity: number;
  consumption_unit: string;
  purchase_unit: string;
  units_per_purchase_unit: number;
  minimum_quantity: number | null;
  average_unit_cost_cents: number | null;
  stock_value_cents: number | null;
};

export function InventoryItemClient({
  itemId,
  canAdjust,
}: {
  itemId: string;
  canAdjust: boolean;
}) {
  const [item, setItem] = useState<Item | null>(null);
  const [movements, setMovements] = useState<
    Array<{
      id: string;
      created_at: string;
      movement_type: MovementType;
      quantity_delta: number;
      resulting_quantity: number | null;
      reason: string | null;
    }>
  >([]);
  const [lots, setLots] = useState<
    Array<{
      id: string;
      lot_number: string | null;
      expiration_date: string | null;
      quantity_remaining: number;
    }>
  >([]);
  const [procedures, setProcedures] = useState<
    Array<{
      procedure_id: string;
      procedure_name: string;
      standard_quantity: number;
      consumption_unit: string;
      consumption_mode: ConsumptionMode;
    }>
  >([]);
  const [canViewCosts, setCanViewCosts] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [panel, setPanel] = useState<"none" | "initial" | "adjust" | "loss">(
    "none",
  );
  const [qty, setQty] = useState("");
  const [unitCost, setUnitCost] = useState("0");
  const [reason, setReason] =
    useState<AdjustmentReason>("contagem_fisica");
  const [notes, setNotes] = useState("");
  const [confirmNeg, setConfirmNeg] = useState(false);

  async function load() {
    const res = await fetch(`/api/demo/inventory?view=item&id=${itemId}`);
    const data = await res.json();
    if (data.error) {
      setError(data.error);
      return;
    }
    setItem(data.item);
    setMovements(data.movements ?? []);
    setLots(data.lots ?? []);
    setProcedures(data.procedures ?? []);
    setCanViewCosts(Boolean(data.canViewCosts));
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId]);

  async function post(action: string, data: Record<string, unknown>) {
    setError(null);
    const res = await fetch("/api/demo/inventory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, data }),
    });
    const json = await res.json();
    if (!res.ok) {
      if (json.code === "NEGATIVE_STOCK_CONFIRMATION_REQUIRED") {
        setConfirmNeg(true);
        setError(
          "Este ajuste deixará o estoque negativo. Confirme e envie novamente.",
        );
        return;
      }
      setError(json.error ?? "Erro");
      return;
    }
    setPanel("none");
    setConfirmNeg(false);
    await load();
  }

  if (!item) {
    return (
      <p className="text-sm text-[var(--text-muted)]">
        {error ?? "Carregando…"}
      </p>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <section>
        <p className="text-sm text-[var(--text-muted)]">
          <Link href="/app/estoque" className="text-[var(--brand-primary)]">
            Estoque
          </Link>
        </p>
        <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl tracking-tight text-[var(--brand-ink)]">
          {item.name}
        </h1>
      </section>

      <dl className="grid gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/90 p-4 sm:grid-cols-2">
        <div>
          <dt className="text-xs text-[var(--text-subtle)]">Estoque atual</dt>
          <dd className="text-lg font-medium">
            {item.current_quantity} {item.consumption_unit}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-[var(--text-subtle)]">Mínimo</dt>
          <dd className="text-lg font-medium">
            {item.minimum_quantity ?? "—"}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-[var(--text-subtle)]">Custo médio</dt>
          <dd className="text-lg font-medium">
            {canViewCosts && item.average_unit_cost_cents != null
              ? `${formatBRL(item.average_unit_cost_cents)}/${item.consumption_unit}`
              : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-[var(--text-subtle)]">Valor atual</dt>
          <dd className="text-lg font-medium">
            {canViewCosts && item.stock_value_cents != null
              ? formatBRL(item.stock_value_cents)
              : "—"}
          </dd>
        </div>
      </dl>

      {canAdjust ? (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => setPanel("initial")}>
            Estoque inicial
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setPanel("adjust")}>
            Ajustar estoque
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setPanel("loss")}>
            Registrar perda
          </Button>
          <Link href="/app/estoque/compras">
            <Button size="sm" variant="ghost">
              Registrar compra
            </Button>
          </Link>
        </div>
      ) : null}

      {panel === "initial" ? (
        <form
          className="space-y-3 rounded-2xl border border-[var(--border)] p-4"
          onSubmit={(e) => {
            e.preventDefault();
            void post("initial_stock", {
              inventory_item_id: itemId,
              quantity: Number(qty.replace(",", ".")),
              unit_cost_reais: Number(unitCost.replace(",", ".")),
              notes: notes || null,
              allow_when_nonzero: item.current_quantity !== 0,
            });
          }}
        >
          <h2 className="font-medium">Registrar estoque inicial</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Quantidade</Label>
              <Input value={qty} onChange={(e) => setQty(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>Custo unitário estimado (R$)</Label>
              <Input
                value={unitCost}
                onChange={(e) => setUnitCost(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Observação</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm">
              Confirmar
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setPanel("none")}>
              Fechar
            </Button>
          </div>
        </form>
      ) : null}

      {panel === "adjust" ? (
        <form
          className="space-y-3 rounded-2xl border border-[var(--border)] p-4"
          onSubmit={(e) => {
            e.preventDefault();
            void post("adjust", {
              inventory_item_id: itemId,
              counted_quantity: Number(qty.replace(",", ".")),
              reason,
              notes: notes || null,
              confirm_negative: confirmNeg,
            });
          }}
        >
          <h2 className="font-medium">Ajustar estoque</h2>
          <p className="text-xs text-[var(--text-muted)]">
            Sistema: {item.current_quantity}. Informe a quantidade contada.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Quantidade contada</Label>
              <Input value={qty} onChange={(e) => setQty(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>Motivo</Label>
              <Select
                value={reason}
                onChange={(e) => setReason(e.target.value as AdjustmentReason)}
              >
                {ADJUSTMENT_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {ADJUSTMENT_REASON_LABELS[r]}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Observação</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          {confirmNeg ? (
            <label className="flex items-center gap-2 text-sm text-[var(--danger)]">
              <input
                type="checkbox"
                checked={confirmNeg}
                onChange={(e) => setConfirmNeg(e.target.checked)}
              />
              Confirmo estoque negativo
            </label>
          ) : null}
          <div className="flex gap-2">
            <Button type="submit" size="sm">
              Confirmar ajuste
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setPanel("none")}>
              Fechar
            </Button>
          </div>
        </form>
      ) : null}

      {panel === "loss" ? (
        <form
          className="space-y-3 rounded-2xl border border-[var(--border)] p-4"
          onSubmit={(e) => {
            e.preventDefault();
            void post("loss", {
              inventory_item_id: itemId,
              quantity: Number(qty.replace(",", ".")),
              notes: notes || null,
              confirm_negative: confirmNeg,
            });
          }}
        >
          <h2 className="font-medium">Registrar perda</h2>
          <div className="space-y-1.5">
            <Label>Quantidade perdida</Label>
            <Input value={qty} onChange={(e) => setQty(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label>Motivo</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm">
              Confirmar perda
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setPanel("none")}>
              Fechar
            </Button>
          </div>
        </form>
      ) : null}

      {error ? (
        <p className="rounded-xl bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger)]">
          {error}
        </p>
      ) : null}

      {lots.length > 0 ? (
        <section>
          <h2 className="text-lg font-medium text-[var(--brand-ink)]">
            Validades / lotes
          </h2>
          <ul className="mt-2 divide-y divide-[var(--border)] rounded-2xl border border-[var(--border)]">
            {lots.map((l) => (
              <li key={l.id} className="px-4 py-3 text-sm">
                {l.lot_number ?? "Sem lote"} ·{" "}
                {l.expiration_date
                  ? `val. ${l.expiration_date}`
                  : "sem validade"}{" "}
                · {l.quantity_remaining} {item.consumption_unit}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {procedures.length > 0 ? (
        <section>
          <h2 className="text-lg font-medium text-[var(--brand-ink)]">
            Procedimentos que usam este material
          </h2>
          <ul className="mt-2 divide-y divide-[var(--border)] rounded-2xl border border-[var(--border)]">
            {procedures.map((p) => (
              <li key={p.procedure_id} className="px-4 py-3 text-sm">
                <Link
                  href={`/app/procedimentos/${p.procedure_id}`}
                  className="text-[var(--brand-primary)]"
                >
                  {p.procedure_name}
                </Link>
                {" — "}
                {p.standard_quantity} {p.consumption_unit} (
                {CONSUMPTION_MODE_LABELS[p.consumption_mode]})
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <h2 className="text-lg font-medium text-[var(--brand-ink)]">
          Histórico
        </h2>
        <ul className="mt-2 divide-y divide-[var(--border)] rounded-2xl border border-[var(--border)]">
          {movements.map((m) => (
            <li
              key={m.id}
              className="flex justify-between gap-2 px-4 py-3 text-sm"
            >
              <div>
                <p>{MOVEMENT_TYPE_LABELS[m.movement_type]}</p>
                <p className="text-xs text-[var(--text-muted)]">
                  {new Date(m.created_at).toLocaleString("pt-BR")}
                  {m.reason ? ` · ${m.reason}` : ""}
                </p>
              </div>
              <div className="text-right">
                <p>
                  {m.quantity_delta > 0 ? "+" : ""}
                  {m.quantity_delta}
                </p>
                {m.resulting_quantity != null ? (
                  <p className="text-xs text-[var(--text-subtle)]">
                    → {m.resulting_quantity}
                  </p>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
