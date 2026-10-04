"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { formatBRL } from "@/lib/money";

type HomeData = {
  nextAppointment: null | {
    id: string;
    start_at: string;
    professional_name: string;
    reason: string | null;
    status: string;
  };
  treatmentSummary: null | {
    title: string;
    completed: number;
    total: number;
    percent: number;
  };
  nextPayment: null | { due_date: string; balance_cents: number };
  attention: Array<{ id: string; title: string; href: string }>;
};

export function PortalHomeClient() {
  const [data, setData] = useState<HomeData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/demo/portal?resource=home");
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Você não tem acesso a esta informação.");
      return;
    }
    setData(json);
  }

  useEffect(() => {
    void load();
  }, []);

  if (error) {
    return <p className="text-sm text-[var(--danger)]">{error}</p>;
  }
  if (!data) {
    return <div className="h-40 animate-pulse rounded-2xl bg-[var(--surface-muted)]" />;
  }

  return (
    <div className="space-y-5">
      <section>
        <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight text-[var(--brand-ink)]">
          Olá
        </h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Acompanhe suas consultas, tratamento e pagamentos.
        </p>
      </section>

      {message ? (
        <p className="rounded-xl bg-[var(--success-soft)] px-3 py-2 text-sm text-[var(--success)]" role="status">
          {message}
        </p>
      ) : null}

      <Link
        href="/portal/solicitar-horario"
        className="flex h-12 items-center justify-center rounded-2xl bg-[var(--brand-primary)] text-sm font-semibold text-white"
      >
        Solicitar horário
      </Link>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/90 p-4">
        <h2 className="font-[family-name:var(--font-display)] text-lg">Próxima consulta</h2>
        {!data.nextAppointment ? (
          <EmptyState
            title="Você não tem consulta agendada"
            description="Envie uma preferência para a clínica analisar."
            action={
              <Link
                href="/portal/solicitar-horario"
                className="inline-flex h-11 items-center rounded-xl bg-[var(--brand-primary)] px-4 text-sm font-medium text-white"
              >
                Solicitar horário
              </Link>
            }
          />
        ) : (
          <div className="mt-3 space-y-2">
            <p className="text-lg font-medium">
              {format(new Date(data.nextAppointment.start_at), "dd 'de' MMMM", {
                locale: ptBR,
              })}
            </p>
            <p className="text-sm text-[var(--text-muted)]">
              {format(new Date(data.nextAppointment.start_at), "HH:mm")} ·{" "}
              {data.nextAppointment.professional_name}
            </p>
            <p className="text-sm">{data.nextAppointment.reason || "Consulta"}</p>
            <p className="text-xs text-[var(--text-subtle)]">
              Status:{" "}
              {data.nextAppointment.status === "confirmed"
                ? "Confirmada"
                : data.nextAppointment.status === "scheduled"
                  ? "Agendada"
                  : data.nextAppointment.status}
            </p>
            {data.nextAppointment.status === "scheduled" ? (
              <Button
                type="button"
                loading={busy}
                onClick={async () => {
                  setBusy(true);
                  const res = await fetch("/api/demo/portal", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      action: "confirm-appointment",
                      id: data.nextAppointment!.id,
                    }),
                  });
                  const json = await res.json();
                  setBusy(false);
                  if (!res.ok) {
                    setError(json.error ?? "Não foi possível concluir.");
                    return;
                  }
                  setMessage(json.message ?? "Presença confirmada.");
                  await load();
                }}
              >
                Confirmar presença
              </Button>
            ) : null}
          </div>
        )}
      </section>

      {data.attention.length > 0 ? (
        <section className="rounded-2xl border border-[var(--warning)]/40 bg-[var(--warning-soft)]/40 p-4">
          <h2 className="font-[family-name:var(--font-display)] text-lg">
            Precisa da sua atenção
          </h2>
          <ul className="mt-2 space-y-2">
            {data.attention.map((item) => (
              <li key={item.id}>
                <Link href={item.href} className="text-sm font-medium text-[var(--brand-primary)]">
                  {item.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {data.treatmentSummary ? (
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/90 p-4">
          <h2 className="font-[family-name:var(--font-display)] text-lg">Seu tratamento</h2>
          <p className="mt-2 text-sm font-medium">{data.treatmentSummary.title}</p>
          <p className="text-sm text-[var(--text-muted)]">
            {data.treatmentSummary.completed} de {data.treatmentSummary.total}{" "}
            procedimentos concluídos ({data.treatmentSummary.percent}%)
          </p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--surface-muted)]">
            <div
              className="h-full rounded-full bg-[var(--brand-primary)]"
              style={{ width: `${data.treatmentSummary.percent}%` }}
            />
          </div>
          <Link
            href="/portal/tratamento"
            className="mt-3 inline-flex text-sm font-medium text-[var(--brand-primary)]"
          >
            Ver tratamento
          </Link>
        </section>
      ) : null}

      {data.nextPayment ? (
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/90 p-4">
          <h2 className="font-[family-name:var(--font-display)] text-lg">Próximo pagamento</h2>
          <p className="mt-2 text-sm">
            {data.nextPayment.due_date.split("-").reverse().join("/")} ·{" "}
            {formatBRL(data.nextPayment.balance_cents)}
          </p>
          <Link
            href="/portal/financeiro"
            className="mt-2 inline-flex text-sm font-medium text-[var(--brand-primary)]"
          >
            Ver financeiro
          </Link>
        </section>
      ) : null}
    </div>
  );
}
