"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Select } from "@/components/ui/select";
import { formatBRL } from "@/lib/money";
import {
  MOVEMENT_TYPE_LABELS,
  MOVEMENT_TYPES,
  type MovementType,
} from "@/types/inventory";

type Row = {
  id: string;
  created_at: string;
  item_name: string;
  movement_type: MovementType;
  quantity_delta: number;
  resulting_quantity: number | null;
  unit_cost_snapshot_cents: number | null;
  reason: string | null;
  reference_type: string | null;
};

export function MovementsClient({ canViewCosts }: { canViewCosts: boolean }) {
  const [items, setItems] = useState<Row[]>([]);
  const [type, setType] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const qs = new URLSearchParams({ view: "movements" });
    if (type) qs.set("type", type);
    fetch(`/api/demo/inventory?${qs}`)
      .then((r) => r.json())
      .then((data) => setItems(data.items ?? []))
      .finally(() => setLoading(false));
  }, [type]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <section>
        <p className="text-sm text-[var(--text-muted)]">
          <Link href="/app/estoque" className="text-[var(--brand-primary)]">
            Estoque
          </Link>
        </p>
        <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl tracking-tight text-[var(--brand-ink)]">
          Movimentações
        </h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Histórico imutável — +entrada / −saída
        </p>
      </section>

      <div className="max-w-xs">
        <Select value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">Todos os tipos</option>
          {MOVEMENT_TYPES.filter((t) => t !== "procedure_consumption").map(
            (t) => (
              <option key={t} value={t}>
                {MOVEMENT_TYPE_LABELS[t]}
              </option>
            ),
          )}
        </Select>
      </div>

      {loading ? (
        <p className="text-sm text-[var(--text-muted)]">Carregando…</p>
      ) : (
        <ul className="divide-y divide-[var(--border)] rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/90">
          {items.length === 0 ? (
            <li className="px-4 py-5 text-sm text-[var(--text-muted)]">
              Nenhuma movimentação.
            </li>
          ) : (
            items.map((m) => (
              <li key={m.id} className="px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">{m.item_name}</p>
                    <p className="text-xs text-[var(--text-muted)]">
                      {new Date(m.created_at).toLocaleString("pt-BR")} ·{" "}
                      {MOVEMENT_TYPE_LABELS[m.movement_type]}
                      {m.reason ? ` · ${m.reason}` : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p
                      className={`text-sm font-medium ${
                        m.quantity_delta >= 0
                          ? "text-[var(--success)]"
                          : "text-[var(--danger)]"
                      }`}
                    >
                      {m.quantity_delta > 0 ? "+" : ""}
                      {m.quantity_delta}
                    </p>
                    {m.resulting_quantity != null ? (
                      <p className="text-xs text-[var(--text-subtle)]">
                        Saldo {m.resulting_quantity}
                      </p>
                    ) : null}
                    {canViewCosts && m.unit_cost_snapshot_cents != null ? (
                      <p className="text-xs text-[var(--text-subtle)]">
                        {formatBRL(m.unit_cost_snapshot_cents)}/un
                      </p>
                    ) : null}
                  </div>
                </div>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
