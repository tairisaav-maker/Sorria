"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  CalendarDays,
  Package,
  Plus,
  TrendingUp,
  Wallet,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ProcedureSimulationDialog,
  SimulateProcedureButton,
} from "@/components/procedures/procedure-simulation-dialog";
import { formatBRL } from "@/lib/money";
import type { DashboardSummary } from "@/services/dashboard";

const statusTone = {
  next: { label: "Próximo", tone: "info" as const },
  in_progress: { label: "Em atendimento", tone: "warning" as const },
  completed: { label: "Concluído", tone: "success" as const },
  cancelled: { label: "Cancelado", tone: "neutral" as const },
  scheduled: { label: "Agendado", tone: "neutral" as const },
};

const iconMap = {
  calendar: CalendarDays,
  wallet: Wallet,
  receivable: TrendingUp,
  package: Package,
};

export function PremiumHomeClient({
  summary,
}: {
  summary: DashboardSummary;
}) {
  const [simOpen, setSimOpen] = useState(false);
  const [simProcedureId, setSimProcedureId] = useState<string | null>(null);

  const chartData = useMemo(
    () =>
      (summary.receipts_7d ?? []).map((p) => ({
        label: p.label,
        value: p.received_cents / 100,
      })),
    [summary.receipts_7d],
  );

  function openSim(procedureId?: string | null) {
    setSimProcedureId(procedureId ?? null);
    setSimOpen(true);
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 pb-8">
      {/* Header */}
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between animate-fade-in">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-[22px] leading-tight tracking-tight text-[var(--brand-ink)] sm:text-[26px] lg:text-[32px]">
            {summary.greeting_period}, {summary.greeting_name}
          </h1>
          <p className="mt-1.5 max-w-xl text-sm text-[var(--text-muted)]">
            Aqui está um resumo do seu consultório hoje.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {summary.permissions.can_create_appointment ? (
            <Link href="/app/agenda?nova=1">
              <Button type="button" variant="secondary">
                <Plus className="size-4" />
                Nova consulta
              </Button>
            </Link>
          ) : null}
          {summary.permissions.can_simulate ? (
            <SimulateProcedureButton onClick={() => openSim()} />
          ) : null}
        </div>
      </section>

      {/* Mobile: simulador first nudge already in header */}

      {summary.empty_procedures ? (
        <section className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface-elevated)] p-6 shadow-[var(--shadow-card)]">
          <h2 className="font-[family-name:var(--font-display)] text-xl text-[var(--brand-ink)]">
            Seu Sorria está pronto.
          </h2>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            Cadastre seu primeiro procedimento para começar a acompanhar custos
            e materiais.
          </p>
          {summary.permissions.can_create_procedure ? (
            <Link href="/app/procedimentos/novo" className="mt-4 inline-block">
              <Button>Cadastrar procedimento</Button>
            </Link>
          ) : null}
        </section>
      ) : null}

      {/* KPI cards */}
      {summary.metrics.length > 0 ? (
        <section
          aria-label="Indicadores"
          className="grid grid-cols-2 gap-3 lg:grid-cols-4 animate-rise"
        >
          {summary.metrics.map((m) => {
            const Icon = iconMap[m.icon];
            const body = (
              <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface-elevated)] p-4 shadow-[var(--shadow-card)] transition-transform hover:-translate-y-0.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium text-[var(--text-muted)]">
                    {m.label}
                  </p>
                  <Icon className="size-4 text-[var(--brand-primary)]" />
                </div>
                <p className="mt-3 font-[family-name:var(--font-display)] text-2xl tracking-tight text-[var(--brand-ink)] sm:text-3xl">
                  {m.value}
                </p>
                <p className="mt-1 text-xs text-[var(--text-subtle)]">
                  {m.hint}
                </p>
              </div>
            );
            return m.href ? (
              <Link key={m.id} href={m.href} className="block">
                {body}
              </Link>
            ) : (
              <div key={m.id}>{body}</div>
            );
          })}
        </section>
      ) : null}

      {/* Agenda + Attention */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(260px,0.8fr)]">
        <section className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface-elevated)] p-4 shadow-[var(--shadow-card)] sm:p-5 animate-rise">
          <div className="mb-4 flex items-end justify-between gap-2">
            <div>
              <h2 className="font-[family-name:var(--font-display)] text-lg text-[var(--brand-ink)]">
                Agenda de hoje
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                Linha do tempo do consultório
              </p>
            </div>
            <Link
              href="/app/agenda"
              className="text-sm text-[var(--brand-primary)] hover:underline"
            >
              Ver agenda
            </Link>
          </div>
          {summary.agenda.length === 0 ? (
            <div className="rounded-xl bg-[var(--surface-muted)]/60 px-4 py-6 text-sm text-[var(--text-muted)]">
              Nenhum atendimento agendado para hoje.
              {summary.permissions.can_create_appointment ? (
                <div className="mt-3">
                  <Link href="/app/agenda?nova=1">
                    <Button size="sm" variant="secondary">
                      + Nova consulta
                    </Button>
                  </Link>
                </div>
              ) : null}
            </div>
          ) : (
            <ol className="relative space-y-0">
              {summary.agenda.map((item, idx) => {
                const st = statusTone[item.status] ?? statusTone.scheduled;
                return (
                  <li
                    key={item.id}
                    className="relative flex gap-3 border-b border-[var(--border)] py-3 last:border-b-0"
                  >
                    <div className="flex w-14 shrink-0 flex-col items-start pt-0.5">
                      <span className="text-sm font-semibold text-[var(--brand-primary)]">
                        {item.time}
                      </span>
                      {idx < summary.agenda.length - 1 ? (
                        <span className="mt-2 ml-2 h-full w-px flex-1 bg-[var(--border)]" />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-[var(--text)]">
                        {item.patientName}
                      </p>
                      <p className="text-xs text-[var(--text-muted)]">
                        {item.procedure}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Badge tone={st.tone}>{st.label}</Badge>
                        {item.status !== "completed" &&
                        item.status !== "cancelled" ? (
                          <Link
                            href={item.ctaHref}
                            className="text-xs font-medium text-[var(--brand-primary)] hover:underline"
                          >
                            {item.ctaLabel}
                          </Link>
                        ) : (
                          <Link
                            href={item.ctaHref}
                            className="text-xs text-[var(--text-muted)] hover:underline"
                          >
                            Abrir
                          </Link>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        <section className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface-elevated)] p-4 shadow-[var(--shadow-card)] sm:p-5 animate-rise">
          <h2 className="font-[family-name:var(--font-display)] text-lg text-[var(--brand-ink)]">
            Precisa da sua atenção
          </h2>
          {summary.attention.length === 0 ? (
            <p className="mt-4 rounded-xl bg-[var(--success-soft)] px-3 py-3 text-sm text-[var(--success)]">
              Tudo certo por aqui.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {summary.attention.map((a) => (
                <li key={a.id}>
                  <Link
                    href={a.href}
                    className="block rounded-xl border border-[var(--border)] px-3 py-3 text-sm text-[var(--text)] transition-colors hover:border-[var(--brand-primary)]/35 hover:bg-[var(--surface-muted)]/50"
                  >
                    {a.title}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Quick actions */}
      <section aria-label="Ações rápidas" className="animate-rise">
        <h2 className="mb-3 font-[family-name:var(--font-display)] text-lg text-[var(--brand-ink)]">
          Ações rápidas
        </h2>
        <div className="flex flex-wrap gap-2">
          {summary.permissions.can_create_patient ? (
            <QuickLink href="/app/pacientes/novo" label="+ Paciente" />
          ) : null}
          {summary.permissions.can_create_appointment ? (
            <QuickLink href="/app/agenda?nova=1" label="+ Consulta" />
          ) : null}
          {summary.permissions.can_create_procedure ? (
            <QuickLink href="/app/procedimentos/novo" label="+ Procedimento" />
          ) : null}
          {summary.permissions.can_purchase ? (
            <QuickLink href="/app/estoque/compras?nova=1" label="+ Compra" />
          ) : null}
          {summary.permissions.can_payment ? (
            <QuickLink
              href="/app/financeiro?novo=pagamento"
              label="Registrar pagamento"
            />
          ) : null}
          {summary.permissions.can_simulate ? (
            <button
              type="button"
              onClick={() => openSim()}
              className="inline-flex min-h-10 items-center rounded-xl border border-[var(--brand-primary)]/30 bg-[var(--brand-soft)] px-3 text-sm font-medium text-[var(--brand-ink)]"
            >
              Simular procedimento
            </button>
          ) : null}
        </div>
      </section>

      {/* Frequent procedures */}
      {summary.frequent_procedures.length > 0 ? (
        <section className="animate-rise">
          <h2 className="mb-3 font-[family-name:var(--font-display)] text-lg text-[var(--brand-ink)]">
            Procedimentos em destaque
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {summary.frequent_procedures.map((p) => (
              <div
                key={p.id}
                className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface-elevated)] p-4 shadow-[var(--shadow-card)]"
              >
                <p className="text-sm font-medium text-[var(--brand-ink)]">
                  {p.name}
                </p>
                <p className="mt-2 text-sm text-[var(--text)]">
                  {p.default_price_cents != null
                    ? formatBRL(p.default_price_cents)
                    : "Sem preço"}
                </p>
                {summary.permissions.can_view_costs && p.cost_cents != null ? (
                  <p className="text-xs text-[var(--text-muted)]">
                    custo médio {formatBRL(p.cost_cents)}
                  </p>
                ) : null}
                {summary.permissions.can_simulate ? (
                  <button
                    type="button"
                    onClick={() => openSim(p.id)}
                    className="mt-3 text-xs font-medium text-[var(--brand-primary)] hover:underline"
                  >
                    Simular
                  </button>
                ) : (
                  <Link
                    href={`/app/procedimentos/${p.id}`}
                    className="mt-3 inline-block text-xs text-[var(--brand-primary)] hover:underline"
                  >
                    Abrir
                  </Link>
                )}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* Receipts chart — max 1 */}
      {summary.receipts_7d && summary.permissions.can_view_finance ? (
        <section className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface-elevated)] p-4 shadow-[var(--shadow-card)] sm:p-5 animate-rise">
          <h2 className="font-[family-name:var(--font-display)] text-lg text-[var(--brand-ink)]">
            Recebimentos — últimos 7 dias
          </h2>
          <p className="text-xs text-[var(--text-muted)]">
            Pagamentos efetivos · não é relatório completo
          </p>
          <div className="mt-4 h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={chartData}
                margin={{ top: 8, right: 8, left: -18, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="recvFill" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="0%"
                      stopColor="var(--brand-primary)"
                      stopOpacity={0.28}
                    />
                    <stop
                      offset="100%"
                      stopColor="var(--brand-primary)"
                      stopOpacity={0.02}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "var(--text-subtle)", fontSize: 12 }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "var(--text-subtle)", fontSize: 12 }}
                />
                <Tooltip
                  formatter={(v: number) =>
                    v.toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    })
                  }
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid var(--border)",
                    background: "var(--surface-elevated)",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  name="Recebido"
                  stroke="var(--brand-primary)"
                  fill="url(#recvFill)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>
      ) : null}

      <ProcedureSimulationDialog
        open={simOpen}
        onClose={() => setSimOpen(false)}
        initialProcedureId={simProcedureId}
      />
    </div>
  );
}

function QuickLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-10 items-center rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] px-3 text-sm font-medium text-[var(--brand-ink)] hover:bg-[var(--surface-muted)]/70"
    >
      {label}
    </Link>
  );
}
