"use client";

import { useEffect, useState } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { formatBRL } from "@/lib/money";
import { METHOD_LABELS, STATUS_LABELS } from "@/types/finance";

export function PortalFinanceClient() {
  const [data, setData] = useState<{
    summary: {
      receivable_cents: number;
      overdue_cents: number;
      next_due: null | { due_date: string; balance_cents: number };
    };
    installments: Array<{
      id: string;
      description: string;
      due_date: string;
      amount_cents: number;
      balance_cents: number;
      status: string;
    }>;
    payments: Array<{
      id: string;
      amount_cents: number;
      paid_at: string;
      payment_method: keyof typeof METHOD_LABELS;
    }>;
  } | null>(null);

  useEffect(() => {
    void fetch("/api/demo/portal?resource=finance")
      .then((r) => r.json())
      .then(setData);
  }, []);

  if (!data) {
    return <div className="h-32 animate-pulse rounded-2xl bg-[var(--surface-muted)]" />;
  }

  return (
    <div className="space-y-4">
      <h1 className="font-[family-name:var(--font-display)] text-3xl text-[var(--brand-ink)]">
        Financeiro
      </h1>
      <div className="grid gap-3 sm:grid-cols-3">
        <Card title="A pagar" value={formatBRL(data.summary.receivable_cents)} />
        <Card
          title="Próximo vencimento"
          value={
            data.summary.next_due
              ? `${data.summary.next_due.due_date.split("-").reverse().join("/")} · ${formatBRL(data.summary.next_due.balance_cents)}`
              : "—"
          }
        />
        <Card title="Vencido" value={formatBRL(data.summary.overdue_cents)} warning />
      </div>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/90 p-4">
        <h2 className="font-[family-name:var(--font-display)] text-lg">Parcelas</h2>
        {data.installments.length === 0 ? (
          <EmptyState title="Nenhum pagamento pendente" />
        ) : (
          <ul className="mt-3 space-y-2">
            {data.installments.map((i) => (
              <li key={i.id} className="flex justify-between gap-2 rounded-xl bg-[var(--surface-muted)]/60 px-3 py-2 text-sm">
                <span>
                  {i.due_date.split("-").reverse().join("/")}
                  <span className="block text-xs text-[var(--text-muted)]">{i.description}</span>
                </span>
                <span className="text-right">
                  {formatBRL(i.balance_cents > 0 ? i.balance_cents : i.amount_cents)}
                  <span className="block text-xs text-[var(--text-muted)]">
                    {STATUS_LABELS[i.status as keyof typeof STATUS_LABELS] ?? i.status}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/90 p-4">
        <h2 className="font-[family-name:var(--font-display)] text-lg">Pagamentos</h2>
        {data.payments.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--text-muted)]">Nenhum pagamento registrado.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {data.payments.map((p) => (
              <li key={p.id} className="flex justify-between gap-2">
                <span>
                  {new Date(p.paid_at).toLocaleDateString("pt-BR")} ·{" "}
                  {METHOD_LABELS[p.payment_method]}
                </span>
                <span>{formatBRL(p.amount_cents)}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-[var(--text-subtle)]">
          Pagamento online não está disponível neste momento.
        </p>
      </section>
    </div>
  );
}

function Card({
  title,
  value,
  warning,
}: {
  title: string;
  value: string;
  warning?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/90 p-4">
      <p className="text-xs text-[var(--text-subtle)]">{title}</p>
      <p className={`mt-1 text-base font-semibold ${warning ? "text-[var(--danger)]" : ""}`}>
        {value}
      </p>
    </div>
  );
}
