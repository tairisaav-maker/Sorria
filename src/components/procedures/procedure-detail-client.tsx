"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { formatBRL } from "@/lib/money";
import {
  CONSUMPTION_MODE_LABELS,
  CONSUMPTION_MODES,
  type InventoryItem,
  type Procedure,
  type ProcedureMaterialLine,
  type ProcedureStandardCost,
} from "@/types/inventory";

export function ProcedureDetailClient({
  procedureId,
  canEdit,
  canEditCosts,
  canSeeCosts,
}: {
  procedureId: string;
  canEdit: boolean;
  canEditCosts: boolean;
  canSeeCosts: boolean;
}) {
  const router = useRouter();
  const [procedure, setProcedure] = useState<Procedure | null>(null);
  const [materials, setMaterials] = useState<ProcedureMaterialLine[]>([]);
  const [cost, setCost] = useState<ProcedureStandardCost | null>(null);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [itemId, setItemId] = useState("");
  const [qty, setQty] = useState("1");
  const [mode, setMode] = useState<(typeof CONSUMPTION_MODES)[number]>(
    "per_procedure",
  );
  const [saving, setSaving] = useState(false);

  async function load() {
    const [procRes, invRes] = await Promise.all([
      fetch(`/api/demo/procedures?id=${procedureId}`).then((r) => r.json()),
      fetch("/api/demo/inventory").then((r) => r.json()),
    ]);
    if (procRes.error) {
      setError(procRes.error);
      return;
    }
    setProcedure(procRes.procedure);
    setMaterials(procRes.materials ?? []);
    setCost(procRes.cost ?? null);
    setInventory(invRes.items ?? []);
    if (!itemId && invRes.items?.[0]) setItemId(invRes.items[0].id);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [procedureId]);

  async function archive() {
    if (!confirm("Arquivar este procedimento?")) return;
    const res = await fetch("/api/demo/procedures", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "archive", data: { id: procedureId } }),
    });
    if (res.ok) {
      router.push("/app/procedimentos");
      router.refresh();
    }
  }

  async function addMaterial(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch("/api/demo/procedures", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "add_material",
        data: {
          procedure_id: procedureId,
          inventory_item_id: itemId,
          standard_quantity: Number(qty.replace(",", ".")),
          consumption_mode: mode,
        },
      }),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(json.error ?? "Erro ao adicionar material");
      return;
    }
    await load();
  }

  async function removeMaterial(id: string) {
    await fetch("/api/demo/procedures", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "remove_material", data: { id } }),
    });
    await load();
  }

  if (!procedure) {
    return (
      <p className="text-sm text-[var(--text-muted)]">
        {error ?? "Carregando…"}
      </p>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <section className="animate-fade-in">
        <p className="text-sm text-[var(--text-muted)]">
          <Link
            href="/app/procedimentos"
            className="text-[var(--brand-primary)]"
          >
            Procedimentos
          </Link>
        </p>
        <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight text-[var(--brand-ink)]">
              {procedure.name}
            </h1>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              {procedure.category ?? "Sem categoria"}
              {procedure.default_duration_minutes
                ? ` · ${procedure.default_duration_minutes} min`
                : ""}
              {procedure.default_price_cents != null
                ? ` · ${formatBRL(procedure.default_price_cents)}`
                : ""}
            </p>
          </div>
          {canEdit ? (
            <div className="flex gap-2">
              <Link href={`/app/procedimentos/${procedure.id}/editar`}>
                <Button variant="secondary" size="sm">
                  Editar
                </Button>
              </Link>
              <Button variant="ghost" size="sm" onClick={archive}>
                Arquivar
              </Button>
            </div>
          ) : null}
        </div>
      </section>

      {procedure.description ? (
        <p className="text-sm text-[var(--text-muted)]">
          {procedure.description}
        </p>
      ) : null}

      <section className="animate-rise">
        <h2 className="text-lg font-medium text-[var(--brand-ink)]">
          Materiais previstos
        </h2>
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          Ficha técnica — quanto vou usar por procedimento
        </p>
        {materials.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--text-muted)]">
            Nenhum material associado.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-[var(--border)] rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/90">
            {materials.map((m) => (
              <li
                key={m.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium">{m.item_name}</p>
                  <p className="text-xs text-[var(--text-muted)]">
                    {m.standard_quantity} {m.consumption_unit} ·{" "}
                    {CONSUMPTION_MODE_LABELS[m.consumption_mode]}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {canSeeCosts ? (
                    <span className="text-sm">
                      {formatBRL(m.planned_cost_cents)}
                    </span>
                  ) : null}
                  {canEditCosts ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeMaterial(m.id)}
                    >
                      Remover
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}

        {canEditCosts ? (
          <form
            onSubmit={addMaterial}
            className="mt-4 grid gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/70 p-4 sm:grid-cols-4"
          >
            <div className="sm:col-span-2 space-y-1.5">
              <Label>Item de estoque</Label>
              <Select
                value={itemId}
                onChange={(e) => setItemId(e.target.value)}
                required
              >
                {inventory.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Qtd padrão</Label>
              <Input
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Modo</Label>
              <Select
                value={mode}
                onChange={(e) =>
                  setMode(e.target.value as (typeof CONSUMPTION_MODES)[number])
                }
              >
                {CONSUMPTION_MODES.map((m) => (
                  <option key={m} value={m}>
                    {CONSUMPTION_MODE_LABELS[m]}
                  </option>
                ))}
              </Select>
            </div>
            <div className="sm:col-span-4">
              <Button type="submit" size="sm" loading={saving}>
                Adicionar material
              </Button>
            </div>
          </form>
        ) : null}
      </section>

      {canSeeCosts && cost ? (
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/90 p-4 animate-rise">
          <h2 className="text-lg font-medium text-[var(--brand-ink)]">
            Resumo de custo padrão
          </h2>
          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <div className="flex justify-between gap-2 sm:block">
              <dt className="text-[var(--text-muted)]">Preço padrão</dt>
              <dd className="font-medium">
                {cost.default_price_cents != null
                  ? formatBRL(cost.default_price_cents)
                  : "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-2 sm:block">
              <dt className="text-[var(--text-muted)]">Custo materiais</dt>
              <dd className="font-medium">
                {formatBRL(cost.materials_cost_cents)}
              </dd>
            </div>
            <div className="flex justify-between gap-2 sm:block">
              <dt className="text-[var(--text-muted)]">Resultado bruto</dt>
              <dd className="font-medium">
                {cost.gross_result_cents != null
                  ? formatBRL(cost.gross_result_cents)
                  : "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-2 sm:block">
              <dt className="text-[var(--text-muted)]">Margem do procedimento</dt>
              <dd className="font-medium">
                {cost.margin_percent != null ? `${cost.margin_percent}%` : "—"}
              </dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-[var(--text-subtle)]">
            Estimativa operacional — não é lucro líquido. Custos reais e
            snapshot histórico virão nas próximas subfases.
          </p>
        </section>
      ) : null}

      {error ? (
        <p className="rounded-xl bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
