"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { formatBRL } from "@/lib/money";
import type { Procedure } from "@/types/inventory";

export function ProceduresClient({ canCreate }: { canCreate: boolean }) {
  const [items, setItems] = useState<Procedure[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch("/api/demo/procedures")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setItems(data.items ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
      <section className="animate-fade-in">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight text-[var(--brand-ink)]">
              Procedimentos
            </h1>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Catálogo · ficha técnica · custo padrão estimado
            </p>
          </div>
          {canCreate ? (
            <Link
              href="/app/procedimentos/novo"
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-[var(--brand-primary)] px-4 text-sm font-medium text-white"
            >
              <Plus className="size-4" />
              Novo procedimento
            </Link>
          ) : null}
        </div>
      </section>

      {error ? (
        <p className="rounded-xl bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger)]">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-[var(--text-muted)]">Carregando…</p>
      ) : items.length === 0 ? (
        <EmptyState
          title="Nenhum procedimento"
          description="Cadastre os serviços da clínica para conectar materiais e custos."
          action={
            canCreate ? (
              <Link href="/app/procedimentos/novo">
                <Button>Criar procedimento</Button>
              </Link>
            ) : undefined
          }
        />
      ) : (
        <ul className="divide-y divide-[var(--border)] rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/90 animate-rise">
          {items.map((p) => (
            <li key={p.id}>
              <Link
                href={`/app/procedimentos/${p.id}`}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 transition-colors hover:bg-[var(--surface-muted)]/60"
              >
                <div>
                  <p className="text-sm font-medium text-[var(--text)]">
                    {p.name}
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                    {p.category ?? "Sem categoria"}
                    {p.default_duration_minutes
                      ? ` · ${p.default_duration_minutes} min`
                      : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {p.default_price_cents != null ? (
                    <span className="text-sm font-medium text-[var(--brand-ink)]">
                      {formatBRL(p.default_price_cents)}
                    </span>
                  ) : (
                    <span className="text-xs text-[var(--text-subtle)]">
                      Sem preço
                    </span>
                  )}
                  <Badge tone={p.active ? "success" : "neutral"}>
                    {p.active ? "Ativo" : "Arquivado"}
                  </Badge>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
