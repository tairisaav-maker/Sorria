"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PORTAL_REQUEST_STATUS_LABELS } from "@/types/portal";

type Tab = "proximas" | "historico" | "solicitacoes";

export function PortalAppointmentsClient({
  initialTab = "proximas",
}: {
  initialTab?: Tab;
}) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [upcoming, setUpcoming] = useState<Array<Record<string, unknown>>>([]);
  const [history, setHistory] = useState<Array<Record<string, unknown>>>([]);
  const [requests, setRequests] = useState<Array<Record<string, unknown>>>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const [u, h, r] = await Promise.all([
      fetch("/api/demo/portal?resource=appointments&scope=upcoming").then((x) => x.json()),
      fetch("/api/demo/portal?resource=appointments&scope=history").then((x) => x.json()),
      fetch("/api/demo/portal?resource=requests").then((x) => x.json()),
    ]);
    setUpcoming(u.items ?? []);
    setHistory(h.items ?? []);
    setRequests(r.items ?? []);
  }

  useEffect(() => {
    void load();
  }, []);

  async function post(action: string, body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/demo/portal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...body }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Não foi possível enviar sua solicitação. Tente novamente.");
      return;
    }
    setMessage(data.message ?? "Solicitação enviada.");
    await load();
  }

  const list = tab === "proximas" ? upcoming : tab === "historico" ? history : requests;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl text-[var(--brand-ink)]">
          Consultas
        </h1>
        <Link
          href="/portal/solicitar-horario"
          className="mt-3 inline-flex h-11 items-center rounded-xl bg-[var(--brand-primary)] px-4 text-sm font-medium text-white"
        >
          Solicitar horário
        </Link>
      </div>

      <div className="flex flex-wrap gap-2" role="tablist">
        {(
          [
            ["proximas", "Próximas"],
            ["historico", "Histórico"],
            ["solicitacoes", "Solicitações"],
          ] as const
        ).map(([id, label]) => (
          <Button
            key={id}
            type="button"
            size="sm"
            variant={tab === id ? "primary" : "secondary"}
            onClick={() => setTab(id)}
          >
            {label}
          </Button>
        ))}
      </div>

      {message ? (
        <p className="rounded-xl bg-[var(--success-soft)] px-3 py-2 text-sm text-[var(--success)]">{message}</p>
      ) : null}
      {error ? (
        <p className="rounded-xl bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger)]">{error}</p>
      ) : null}

      {list.length === 0 ? (
        <EmptyState
          title={tab === "solicitacoes" ? "Nenhuma solicitação" : "Nenhuma consulta"}
          description={
            tab === "proximas"
              ? "Você não tem consulta agendada."
              : "Quando houver registros, eles aparecerão aqui."
          }
        />
      ) : null}

      <ul className="space-y-3">
        {tab !== "solicitacoes"
          ? (list as Array<{
              id: string;
              start_at: string;
              professional_name: string;
              reason: string | null;
              status: string;
            }>).map((item) => (
              <li key={item.id} className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/90 p-4">
                <p className="text-lg font-medium">
                  {format(new Date(item.start_at), "dd 'de' MMMM", { locale: ptBR })}
                </p>
                <p className="text-sm text-[var(--text-muted)]">
                  {format(new Date(item.start_at), "HH:mm")} · {item.professional_name}
                </p>
                <p className="mt-1 text-sm">{item.reason || "Consulta"}</p>
                <p className="mt-1 text-xs text-[var(--text-subtle)]">
                  {item.status === "confirmed"
                    ? "Confirmada"
                    : item.status === "scheduled"
                      ? "Agendada"
                      : item.status === "completed"
                        ? "Concluída"
                        : item.status === "cancelled"
                          ? "Cancelada"
                          : item.status}
                </p>
                {tab === "proximas" ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {item.status === "scheduled" ? (
                      <Button
                        type="button"
                        size="sm"
                        loading={busy}
                        onClick={() => post("confirm-appointment", { id: item.id })}
                      >
                        Confirmar presença
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      loading={busy}
                      onClick={() => {
                        const period =
                          window.prompt("Período preferido (morning/afternoon/evening):", "afternoon") ??
                          "afternoon";
                        const date = window.prompt("Data preferida (AAAA-MM-DD), opcional:") ?? "";
                        void post("request-change", {
                          appointment_id: item.id,
                          change_kind: "other_day",
                          preferred_period: period,
                          requested_date: date || null,
                        });
                      }}
                    >
                      Solicitar alteração
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      loading={busy}
                      onClick={() => {
                        if (!window.confirm("Deseja solicitar o cancelamento desta consulta?")) return;
                        const notes = window.prompt("Motivo (opcional):") ?? "";
                        void post("request-cancel", {
                          appointment_id: item.id,
                          notes,
                        });
                      }}
                    >
                      Solicitar cancelamento
                    </Button>
                  </div>
                ) : null}
              </li>
            ))
          : (list as Array<{
              id: string;
              reason: string;
              status: string;
              requested_date: string | null;
              preferred_period: string;
              proposed_start_at: string | null;
              created_at: string;
            }>).map((item) => (
              <li key={item.id} className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/90 p-4">
                {item.status === "proposed" && item.proposed_start_at ? (
                  <div className="mb-3 rounded-xl bg-[var(--info-soft)] px-3 py-2">
                    <p className="font-medium">A clínica propôs um horário</p>
                    <p className="text-sm">
                      {format(new Date(item.proposed_start_at), "EEEE, dd 'de' MMMM · HH:mm", {
                        locale: ptBR,
                      })}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        loading={busy}
                        onClick={() => post("confirm-proposal", { id: item.id })}
                      >
                        Confirmar horário
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        loading={busy}
                        onClick={() => {
                          const period =
                            window.prompt("Novo período (morning/afternoon/evening):", "morning") ??
                            "morning";
                          const date = window.prompt("Nova data (AAAA-MM-DD):") ?? "";
                          void post("request-alternative", {
                            request_id: item.id,
                            preferred_period: period,
                            requested_date: date || null,
                          });
                        }}
                      >
                        Solicitar outro
                      </Button>
                    </div>
                  </div>
                ) : null}
                <p className="font-medium">{item.reason}</p>
                <p className="text-sm text-[var(--text-muted)]">
                  Preferência: {item.requested_date?.split("-").reverse().join("/") ?? "sem data"} ·{" "}
                  {item.preferred_period === "morning"
                    ? "Manhã"
                    : item.preferred_period === "afternoon"
                      ? "Tarde"
                      : "Noite"}
                </p>
                <p className="mt-1 text-xs">
                  {PORTAL_REQUEST_STATUS_LABELS[item.status] ?? item.status} · enviada em{" "}
                  {format(new Date(item.created_at), "dd/MM/yyyy", { locale: ptBR })}
                </p>
              </li>
            ))}
      </ul>
    </div>
  );
}
