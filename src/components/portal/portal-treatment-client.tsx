"use client";

import { useEffect, useState } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { formatBRL } from "@/lib/money";
import { ITEM_STATUS_LABELS, PLAN_STATUS_LABELS } from "@/types/treatment";

export function PortalTreatmentClient() {
  const [data, setData] = useState<{
    current: null | {
      title: string;
      status: keyof typeof PLAN_STATUS_LABELS;
      total_cents: number;
      progress: { completed: number; total: number; percent: number };
      items: Array<{
        procedure_name: string;
        tooth_numbers: number[];
        status: keyof typeof ITEM_STATUS_LABELS;
      }>;
    };
    history: Array<{ title: string; status: string; percent?: number }>;
  } | null>(null);

  useEffect(() => {
    void fetch("/api/demo/portal?resource=treatment")
      .then((r) => r.json())
      .then(setData);
  }, []);

  if (!data) {
    return <div className="h-32 animate-pulse rounded-2xl bg-[var(--surface-muted)]" />;
  }

  if (!data.current) {
    return (
      <div className="space-y-4">
        <h1 className="font-[family-name:var(--font-display)] text-3xl text-[var(--brand-ink)]">
          Tratamento
        </h1>
        <EmptyState title="Nenhum tratamento ativo" />
      </div>
    );
  }

  const plan = data.current;
  return (
    <div className="space-y-4">
      <h1 className="font-[family-name:var(--font-display)] text-3xl text-[var(--brand-ink)]">
        Tratamento
      </h1>
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/90 p-4">
        <p className="text-xs uppercase text-[var(--text-subtle)]">Seu plano de tratamento</p>
        <h2 className="mt-1 font-[family-name:var(--font-display)] text-xl">{plan.title}</h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          {PLAN_STATUS_LABELS[plan.status]} · {formatBRL(plan.total_cents)}
        </p>
        <p className="mt-3 text-sm">
          {plan.progress.completed} de {plan.progress.total} procedimentos concluídos (
          {plan.progress.percent}%)
        </p>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--surface-muted)]">
          <div
            className="h-full rounded-full bg-[var(--brand-primary)]"
            style={{ width: `${plan.progress.percent}%` }}
          />
        </div>
      </section>
      <ul className="space-y-2">
        {plan.items.map((item, idx) => (
          <li
            key={`${item.procedure_name}-${idx}`}
            className="rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)]/80 px-3 py-3 text-sm"
          >
            <p className="font-medium">
              {item.procedure_name}
              {item.tooth_numbers.length
                ? ` — Dente${item.tooth_numbers.length > 1 ? "s" : ""} ${item.tooth_numbers.join(", ")}`
                : ""}
            </p>
            <p className="text-xs text-[var(--text-muted)]">
              {ITEM_STATUS_LABELS[item.status]}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
