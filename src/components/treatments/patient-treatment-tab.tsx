"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatBRL } from "@/lib/treatments/money";
import {
  ACTIVE_PLAN_STATUSES,
  PLAN_STATUS_LABELS,
  type TreatmentPlanWithItems,
} from "@/types/treatment";

export function PatientTreatmentTab({
  patientId,
  canCreate,
}: {
  patientId: string;
  canCreate: boolean;
}) {
  const [current, setCurrent] = useState<TreatmentPlanWithItems | null>(null);
  const [plans, setPlans] = useState<TreatmentPlanWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/demo/treatments?patientId=${patientId}&filter=all`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) {
          setDenied(true);
          return;
        }
        const items = (data.items ?? []) as TreatmentPlanWithItems[];
        setPlans(items);
        setCurrent(
          items.find((p) => p.status === "in_progress") ||
            items.find((p) => p.status === "accepted") ||
            items.find((p) => p.status === "presented") ||
            items.find((p) => ACTIVE_PLAN_STATUSES.includes(p.status)) ||
            null,
        );
      })
      .finally(() => setLoading(false));
  }, [patientId]);

  if (loading) {
    return (
      <div className="h-32 animate-pulse rounded-2xl bg-[var(--surface-muted)]" />
    );
  }

  if (denied) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface-elevated)]/70 px-5 py-10 text-center text-sm text-[var(--text-muted)]">
        Você não tem permissão para visualizar planos de tratamento.
      </div>
    );
  }

  if (plans.length === 0) {
    return (
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
    );
  }

  return (
    <div className="space-y-4">
      {current ? (
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/90 p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-xs uppercase tracking-wide text-[var(--text-subtle)]">
                Plano atual
              </p>
              <h2 className="mt-1 font-[family-name:var(--font-display)] text-xl text-[var(--brand-ink)]">
                {current.title}
              </h2>
            </div>
            <Badge tone="info">{PLAN_STATUS_LABELS[current.status]}</Badge>
          </div>
          <p className="mt-3 text-sm text-[var(--text-muted)]">
            Progresso: {current.progress.completed} de {current.progress.total}{" "}
            procedimentos concluídos ({current.progress.percent}%)
          </p>
          <p className="mt-1 text-sm font-medium text-[var(--brand-ink)]">
            {formatBRL(current.total_cents)}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href={`/app/pacientes/${patientId}/tratamentos/${current.id}`}
              className="inline-flex h-10 items-center rounded-xl bg-[var(--brand-primary)] px-4 text-sm font-medium text-white"
            >
              Abrir plano
            </Link>
            <Link
              href={`/app/pacientes/${patientId}/tratamentos`}
              className="inline-flex h-10 items-center rounded-xl border border-[var(--border)] px-4 text-sm"
            >
              Ver todos
            </Link>
          </div>
        </section>
      ) : null}

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/90 p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="font-[family-name:var(--font-display)] text-lg text-[var(--brand-ink)]">
            Planos
          </h2>
          {canCreate ? (
            <Link
              href={`/app/pacientes/${patientId}/tratamentos/novo`}
              className="inline-flex h-9 items-center gap-1 rounded-xl border border-[var(--border)] px-3 text-sm"
            >
              <Plus className="size-3.5" />
              Novo plano
            </Link>
          ) : null}
        </div>
        <ul className="space-y-2">
          {plans.slice(0, 5).map((plan) => (
            <li key={plan.id}>
              <Link
                href={`/app/pacientes/${patientId}/tratamentos/${plan.id}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl px-2 py-2 text-sm hover:bg-[var(--surface-muted)]/60"
              >
                <span className="font-medium">{plan.title}</span>
                <span className="text-[var(--text-muted)]">
                  {PLAN_STATUS_LABELS[plan.status]} · {formatBRL(plan.total_cents)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
