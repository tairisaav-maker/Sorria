"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { formatBRL } from "@/lib/treatments/money";
import { cn } from "@/lib/utils";
import {
  ACTIVE_PLAN_STATUSES,
  PLAN_STATUS_LABELS,
  type TreatmentPlanWithItems,
} from "@/types/treatment";

type Filter = "all" | "active" | "completed" | "rejected";

export function TreatmentsClient({
  patientId,
  patientName,
  canCreate,
}: {
  patientId: string;
  patientName: string;
  canCreate: boolean;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [items, setItems] = useState<TreatmentPlanWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/demo/treatments?patientId=${patientId}&filter=${filter}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setItems(data.items ?? []);
      })
      .finally(() => setLoading(false));
  }, [patientId, filter]);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
      <section>
        <p className="text-sm text-[var(--text-muted)]">
          <Link href={`/app/pacientes/${patientId}`} className="text-[var(--brand-primary)]">
            {patientName}
          </Link>
        </p>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight text-[var(--brand-ink)]">
              Tratamentos
            </h1>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Planos propostos · aceite ≠ pagamento
            </p>
          </div>
          {canCreate ? (
            <Link
              href={`/app/pacientes/${patientId}/tratamentos/novo`}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-[var(--brand-primary)] px-4 text-sm font-medium text-white"
            >
              <Plus className="size-4" />
              Novo plano
            </Link>
          ) : null}
        </div>
      </section>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["all", "Todos"],
            ["active", "Ativos"],
            ["completed", "Concluídos"],
            ["rejected", "Recusados"],
          ] as const
        ).map(([value, label]) => (
          <Button
            key={value}
            type="button"
            size="sm"
            variant={filter === value ? "primary" : "secondary"}
            onClick={() => setFilter(value)}
          >
            {label}
          </Button>
        ))}
      </div>

      {error ? (
        <p className="rounded-xl bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger)]">
          {error}
        </p>
      ) : null}

      {loading ? (
        <div className="space-y-2" aria-busy="true">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-[var(--surface-muted)]" />
          ))}
        </div>
      ) : null}

      {!loading && items.length === 0 ? (
        <EmptyState
          title="Nenhum plano de tratamento"
          description="Crie um plano para organizar os procedimentos propostos para este paciente."
          action={
            canCreate ? (
              <Link
                href={`/app/pacientes/${patientId}/tratamentos/novo`}
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-[var(--brand-primary)] px-4 text-sm font-medium text-white"
              >
                <Plus className="size-4" />
                Novo plano
              </Link>
            ) : undefined
          }
        />
      ) : null}

      <ul className="space-y-3">
        {items.map((plan) => (
          <li key={plan.id}>
            <Link
              href={`/app/pacientes/${patientId}/tratamentos/${plan.id}`}
              className="block rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/90 p-4 transition-colors hover:bg-[var(--surface-muted)]/50"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-[var(--text)]">{plan.title}</p>
                  <p className="text-xs text-[var(--text-subtle)]">
                    {format(new Date(plan.created_at), "dd/MM/yyyy", { locale: ptBR })}
                    {plan.valid_until
                      ? ` · válido até ${plan.valid_until.split("-").reverse().join("/")}`
                      : ""}
                  </p>
                </div>
                <Badge
                  tone={
                    plan.status === "rejected"
                      ? "danger"
                      : plan.status === "completed"
                        ? "success"
                        : ACTIVE_PLAN_STATUSES.includes(plan.status)
                          ? "info"
                          : "neutral"
                  }
                >
                  {PLAN_STATUS_LABELS[plan.status]}
                </Badge>
              </div>
              <div className="mt-3 flex flex-wrap gap-4 text-sm">
                <span className="text-[var(--text-muted)]">
                  Progresso: {plan.progress.completed}/{plan.progress.total} (
                  {plan.progress.percent}%)
                </span>
                <span className="font-medium text-[var(--brand-ink)]">
                  {formatBRL(plan.total_cents)}
                </span>
                {plan.is_expired ? (
                  <span className="text-[var(--warning)]">Validade encerrada</span>
                ) : null}
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--surface-muted)]">
                <div
                  className={cn("h-full rounded-full bg-[var(--brand-primary)]")}
                  style={{ width: `${plan.progress.percent}%` }}
                />
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
