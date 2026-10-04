"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatBRL } from "@/lib/money";
import {
  PERFORMED_PROCEDURE_STATUS_LABELS,
  type PerformedProcedureStatus,
} from "@/types/performed-procedure";
import { PERFORMED_FINANCIAL_STATUS_LABELS } from "@/types/patient-procedure-finance";

type Row = {
  id: string;
  procedure_name_snapshot: string;
  tooth_number: number | null;
  region: string | null;
  status: PerformedProcedureStatus;
  charged_amount_cents: number | null;
  actual_total_cost_cents: number | null;
  received_cents: number | null;
  outstanding_cents: number | null;
  financial_status?: string;
  professional_name: string;
  created_at: string;
  completed_at: string | null;
  appointment_id: string | null;
  clinical_entry_id: string | null;
};

type Summary = {
  procedures_count: number;
  direct_cost_cents: number | null;
  charged_cents: number | null;
  received_cents: number | null;
  outstanding_cents: number | null;
};

export function PatientProceduresClient({
  patientId,
  canViewCosts,
  canViewFinance,
}: {
  patientId: string;
  canViewCosts: boolean;
  canViewFinance?: boolean;
}) {
  const [items, setItems] = useState<Row[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    fetch(
      `/api/demo/patient-procedure-finance?view=patient-procedures&patientId=${patientId}`,
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
          O que foi feito, quanto custou, quanto foi cobrado e quanto falta
        </p>
      </div>

      {summary ? (
        <div className="grid gap-2 rounded-2xl border border-[var(--border)] p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <p>
            <span className="text-[var(--text-muted)]">Realizados</span>
            <br />
            <span className="font-medium">{summary.procedures_count}</span>
          </p>
          {canViewCosts && summary.direct_cost_cents != null ? (
            <p>
              <span className="text-[var(--text-muted)]">Custo direto</span>
              <br />
              <span className="font-medium">
                {formatBRL(summary.direct_cost_cents)}
              </span>
            </p>
          ) : null}
          {summary.charged_cents != null ? (
            <p>
              <span className="text-[var(--text-muted)]">Cobrado</span>
              <br />
              <span className="font-medium">
                {formatBRL(summary.charged_cents)}
              </span>
            </p>
          ) : null}
          {canViewFinance && summary.received_cents != null ? (
            <p>
              <span className="text-[var(--text-muted)]">Recebido / a receber</span>
              <br />
              <span className="font-medium">
                {formatBRL(summary.received_cents)}
                {summary.outstanding_cents != null
                  ? ` / ${formatBRL(summary.outstanding_cents)}`
                  : ""}
              </span>
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-2xl border border-[var(--border)]">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-[var(--border)] text-xs uppercase tracking-wide text-[var(--text-subtle)]">
            <tr>
              <th className="px-3 py-2">Data</th>
              <th className="px-3 py-2">Procedimento</th>
              <th className="px-3 py-2">Dente</th>
              <th className="px-3 py-2">Profissional</th>
              {canViewCosts ? <th className="px-3 py-2">Custo real</th> : null}
              <th className="px-3 py-2">Cobrado</th>
              {canViewFinance ? <th className="px-3 py-2">Recebido</th> : null}
              {canViewFinance ? <th className="px-3 py-2">Saldo</th> : null}
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td
                  colSpan={9}
                  className="px-3 py-5 text-[var(--text-muted)]"
                >
                  Nenhum procedimento registrado.
                </td>
              </tr>
            ) : (
              items.map((p) => (
                <tr key={p.id} className="border-b border-[var(--border)]">
                  <td className="px-3 py-2">
                    {new Date(
                      p.completed_at ?? p.created_at,
                    ).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="px-3 py-2">
                    <p className="font-medium">{p.procedure_name_snapshot}</p>
                    <div className="mt-1 flex flex-wrap gap-2 text-xs">
                      {p.appointment_id ? (
                        <Link
                          href={`/app/agenda/atendimento/${p.appointment_id}`}
                          className="text-[var(--brand-primary)]"
                        >
                          Ver consumo
                        </Link>
                      ) : null}
                      {p.clinical_entry_id ? (
                        <Link
                          href={`/app/pacientes/${patientId}/prontuario`}
                          className="text-[var(--brand-primary)]"
                        >
                          Ver evolução
                        </Link>
                      ) : null}
                      {canViewFinance && p.charged_amount_cents ? (
                        <Link
                          href={`/app/pacientes/${patientId}/financeiro`}
                          className="text-[var(--brand-primary)]"
                        >
                          Ver financeiro
                        </Link>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-3 py-2">{p.tooth_number ?? "—"}</td>
                  <td className="px-3 py-2">{p.professional_name}</td>
                  {canViewCosts ? (
                    <td className="px-3 py-2">
                      {p.actual_total_cost_cents != null
                        ? formatBRL(p.actual_total_cost_cents)
                        : "—"}
                    </td>
                  ) : null}
                  <td className="px-3 py-2">
                    {p.charged_amount_cents != null
                      ? formatBRL(p.charged_amount_cents)
                      : "—"}
                  </td>
                  {canViewFinance ? (
                    <td className="px-3 py-2">
                      {p.received_cents != null
                        ? formatBRL(p.received_cents)
                        : "—"}
                    </td>
                  ) : null}
                  {canViewFinance ? (
                    <td className="px-3 py-2">
                      {p.outstanding_cents != null
                        ? formatBRL(p.outstanding_cents)
                        : "—"}
                    </td>
                  ) : null}
                  <td className="px-3 py-2 text-xs">
                    {PERFORMED_PROCEDURE_STATUS_LABELS[p.status]}
                    {p.financial_status
                      ? ` · ${
                          PERFORMED_FINANCIAL_STATUS_LABELS[
                            p.financial_status as keyof typeof PERFORMED_FINANCIAL_STATUS_LABELS
                          ] ?? p.financial_status
                        }`
                      : ""}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
