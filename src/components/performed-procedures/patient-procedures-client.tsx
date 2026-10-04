"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatBRL } from "@/lib/money";
import {
  PERFORMED_PROCEDURE_STATUS_LABELS,
  type PerformedProcedureStatus,
} from "@/types/performed-procedure";

type Row = {
  id: string;
  procedure_name_snapshot: string;
  tooth_number: number | null;
  region: string | null;
  status: PerformedProcedureStatus;
  charged_amount_cents: number | null;
  actual_total_cost_cents: number | null;
  professional_name: string;
  created_at: string;
  completed_at: string | null;
  appointment_id: string | null;
};

export function PatientProceduresClient({
  patientId,
  canViewCosts,
}: {
  patientId: string;
  canViewCosts: boolean;
}) {
  const [items, setItems] = useState<Row[]>([]);
  const [summary, setSummary] = useState<{
    procedures_count: number;
    total_actual_cost_cents: number | null;
    total_charged_cents: number | null;
  } | null>(null);

  useEffect(() => {
    fetch(
      `/api/demo/performed-procedures?view=patient&patientId=${patientId}`,
    )
      .then((r) => r.json())
      .then((data) => {
        setItems(data.items ?? []);
        setSummary(data.summary ?? null);
      });
  }, [patientId]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-[family-name:var(--font-display)] text-xl text-[var(--brand-ink)]">
          Procedimentos realizados
        </h2>
        <p className="text-sm text-[var(--text-muted)]">
          Histórico individual do paciente — custo por procedimento
        </p>
      </div>

      {summary ? (
        <p className="text-sm text-[var(--text-muted)]">
          {summary.procedures_count} concluído(s)
          {canViewCosts && summary.total_actual_cost_cents != null
            ? ` · custo direto acumulado ${formatBRL(summary.total_actual_cost_cents)}`
            : ""}
          {canViewCosts && summary.total_charged_cents != null
            ? ` · cobrado ${formatBRL(summary.total_charged_cents)}`
            : ""}
        </p>
      ) : null}

      <ul className="divide-y divide-[var(--border)] rounded-2xl border border-[var(--border)]">
        {items.length === 0 ? (
          <li className="px-4 py-5 text-sm text-[var(--text-muted)]">
            Nenhum procedimento registrado.
          </li>
        ) : (
          items.map((p) => (
            <li key={p.id} className="px-4 py-3 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">
                    {p.procedure_name_snapshot}
                    {p.tooth_number ? ` — Dente ${p.tooth_number}` : ""}
                    {p.region ? ` — ${p.region}` : ""}
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">
                    {new Date(p.completed_at ?? p.created_at).toLocaleDateString(
                      "pt-BR",
                    )}{" "}
                    · {p.professional_name} ·{" "}
                    {PERFORMED_PROCEDURE_STATUS_LABELS[p.status]}
                  </p>
                </div>
                <div className="text-right text-xs">
                  {p.charged_amount_cents != null ? (
                    <p>Cobrado {formatBRL(p.charged_amount_cents)}</p>
                  ) : null}
                  {canViewCosts && p.actual_total_cost_cents != null ? (
                    <p className="text-[var(--text-muted)]">
                      Custo {formatBRL(p.actual_total_cost_cents)}
                    </p>
                  ) : null}
                  {p.appointment_id ? (
                    <Link
                      href={`/app/agenda/atendimento/${p.appointment_id}`}
                      className="text-[var(--brand-primary)]"
                    >
                      Ver atendimento
                    </Link>
                  ) : null}
                </div>
              </div>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
