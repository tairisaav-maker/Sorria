import type { Metadata } from "next";
import Link from "next/link";
import { requireClinic } from "@/lib/authz/guards";
import { can } from "@/lib/authz/can";
import { APP_VERSION } from "@/lib/version";
import { getSorriaEnv, isPilotMode, pilotEnvWarnings } from "@/lib/pilot/env";
import {
  getPilotCoverageMetrics,
  getPilotPreparationChecklist,
  listPilotFeedback,
} from "@/services/pilot";

export const metadata: Metadata = {
  title: "Piloto",
};

export default async function PilotoPage() {
  const actor = await requireClinic();
  const checklist = getPilotPreparationChecklist(actor.ctx);
  const metrics = getPilotCoverageMetrics(actor.ctx);
  const canSeeFeedback =
    can(actor.ctx, "clinic.settings").allowed ||
    can(actor.ctx, "audit.view").allowed;
  let feedback: Awaited<ReturnType<typeof listPilotFeedback>> = [];
  if (canSeeFeedback) {
    try {
      feedback = listPilotFeedback(actor.ctx, 20);
    } catch {
      feedback = [];
    }
  }
  const warnings = pilotEnvWarnings();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <section>
        <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight text-[var(--brand-ink)]">
          Piloto controlado
        </h1>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Sorria {APP_VERSION} · env {getSorriaEnv()}
          {isPilotMode() ? " · modo piloto" : ""}
        </p>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Objetivo: uso real → observar → medir → corrigir → simplificar. Sem
          novos módulos.
        </p>
      </section>

      {warnings.length > 0 ? (
        <ul className="rounded-2xl border border-[var(--danger)]/40 bg-[var(--danger-soft)] px-4 py-3 text-sm text-[var(--danger)]">
          {warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      ) : null}

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/90 p-4">
        <h2 className="font-medium text-[var(--brand-ink)]">
          Checklist de preparação
        </h2>
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          {checklist.ready_count}/{checklist.total} prontos — cadastro
          progressivo (5–10 procedimentos bastam no início)
        </p>
        <ul className="mt-3 space-y-2">
          {checklist.items.map((item) => (
            <li
              key={item.key}
              className="flex items-center justify-between gap-2 text-sm"
            >
              <span>
                <span aria-hidden>{item.done ? "☑" : "☐"} </span>
                {item.label}
              </span>
              <Link
                href={item.href}
                className="text-[var(--brand-primary)] hover:underline"
              >
                Abrir
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/90 p-4">
        <h2 className="font-medium text-[var(--brand-ink)]">
          Cobertura do fluxo
        </h2>
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          Avalia o produto — não a dentista.
        </p>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-[var(--text-muted)]">Atendimentos concluídos</dt>
            <dd className="font-medium">{metrics.appointments_completed}</dd>
          </div>
          <div>
            <dt className="text-[var(--text-muted)]">Procedimentos</dt>
            <dd className="font-medium">{metrics.procedures_registered}</dd>
          </div>
          <div>
            <dt className="text-[var(--text-muted)]">Consumo confirmado</dt>
            <dd className="font-medium">
              {metrics.consumption_confirmed}/{metrics.procedures_registered}
              {metrics.consumption_confirmed_pct != null
                ? ` (${metrics.consumption_confirmed_pct}%)`
                : ""}
            </dd>
          </div>
          <div>
            <dt className="text-[var(--text-muted)]">Evolução registrada</dt>
            <dd className="font-medium">
              {metrics.evolution_registered}/{metrics.procedures_registered}
              {metrics.evolution_registered_pct != null
                ? ` (${metrics.evolution_registered_pct}%)`
                : ""}
            </dd>
          </div>
          <div>
            <dt className="text-[var(--text-muted)]">Financeiro definido</dt>
            <dd className="font-medium">
              {metrics.finance_defined}/{metrics.procedures_registered}
              {metrics.finance_defined_pct != null
                ? ` (${metrics.finance_defined_pct}%)`
                : ""}
            </dd>
          </div>
          <div>
            <dt className="text-[var(--text-muted)]">Custo completo</dt>
            <dd className="font-medium">
              {metrics.cost_complete}/{metrics.procedures_registered}
              {metrics.cost_complete_pct != null
                ? ` (${metrics.cost_complete_pct}%)`
                : ""}
            </dd>
          </div>
        </dl>
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/90 p-4">
        <h2 className="font-medium text-[var(--brand-ink)]">Semanas do piloto</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-[var(--text-muted)]">
          <li>Agenda · Pacientes · Procedimentos · Consumo · Estoque</li>
          <li>Evolução · Custo · Valor cobrado · Financeiro</li>
          <li>Relatórios · Reposição · Margem · Custo operacional</li>
        </ol>
      </section>

      {canSeeFeedback ? (
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/90 p-4">
          <h2 className="font-medium text-[var(--brand-ink)]">
            Feedback recente
          </h2>
          {feedback.length === 0 ? (
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              Nenhum feedback ainda. Use o botão “Enviar feedback”.
            </p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {feedback.map((f) => (
                <li
                  key={f.id}
                  className="rounded-xl border border-[var(--border)] px-3 py-2"
                >
                  <p className="text-xs text-[var(--text-subtle)]">
                    {f.kind} · impacto {f.impact} · {f.route}
                  </p>
                  <p className="mt-1">{f.what_happened}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      <p className="text-xs text-[var(--text-subtle)]">
        Ver também PILOT_CHECKLIST.md · PILOT_RUNBOOK.md · PILOT_REPORT.md
      </p>
    </div>
  );
}
