"use client";

import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  PERIOD_LABELS,
  REQUEST_STATUS_LABELS,
  type AppointmentRequestWithPatient,
} from "@/types/agenda";
import { format } from "date-fns";

type Filter = "pending" | "proposed" | "done" | "all";
type Professional = { id: string; full_name: string };

export function RequestsPageClient({
  canManage,
  professionals,
  defaultProfessionalId,
}: {
  canManage: boolean;
  professionals: Professional[];
  defaultProfessionalId: string;
}) {
  const [filter, setFilter] = useState<Filter>("pending");
  const [items, setItems] = useState<AppointmentRequestWithPatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<AppointmentRequestWithPatient | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [startLocal, setStartLocal] = useState("");
  const [duration, setDuration] = useState(40);
  const [professionalId, setProfessionalId] = useState(defaultProfessionalId);
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    const response = await fetch(`/api/demo/appointment-requests?filter=${filter}`);
    const data = (await response.json()) as { items?: AppointmentRequestWithPatient[] };
    setItems(data.items ?? []);
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  async function run(action: string, payload: Record<string, unknown> = {}) {
    setBusy(true);
    setError(null);
    const response = await fetch("/api/demo/appointment-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, id: active?.id, ...payload }),
    });
    const data = (await response.json()) as {
      error?: string;
      needsNewProposal?: boolean;
      request?: AppointmentRequestWithPatient;
    };
    setBusy(false);
    if (!response.ok) {
      setError(data.error ?? "Não foi possível concluir esta ação. Tente novamente.");
      return;
    }
    setActive(null);
    await load();
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <section>
        <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight text-[var(--brand-ink)]">
          Solicitações
        </h1>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Pedidos de horário — nunca entram na agenda como consulta automática.
        </p>
      </section>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["pending", "Pendentes"],
            ["proposed", "Propostas"],
            ["done", "Concluídas"],
            ["all", "Todas"],
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

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-[var(--surface-muted)]" />
          ))}
        </div>
      ) : null}

      {!loading && items.length === 0 ? (
        <EmptyState
          title="Nenhuma solicitação pendente"
          description="Novas solicitações de horário aparecerão aqui."
        />
      ) : null}

      <ul className="space-y-3">
        {items.map((item) => (
          <li
            key={item.id}
            className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/90 p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium text-[var(--text)]">{item.patient_name}</p>
                <p className="text-sm text-[var(--text-muted)]">{item.reason}</p>
                <p className="mt-1 text-xs text-[var(--text-subtle)]">
                  Preferência:{" "}
                  {item.requested_date
                    ? format(new Date(`${item.requested_date}T12:00:00`), "dd/MM")
                    : "sem data"}{" "}
                  — {PERIOD_LABELS[item.preferred_period]}
                </p>
                <p className="text-xs text-[var(--text-subtle)]">
                  Enviada{" "}
                  {formatDistanceToNow(new Date(item.created_at), {
                    addSuffix: true,
                    locale: ptBR,
                  })}
                </p>
              </div>
              <Badge
                tone={
                  item.status === "new" || item.status === "under_review"
                    ? "warning"
                    : item.status === "proposed"
                      ? "info"
                      : item.status === "approved"
                        ? "success"
                        : "neutral"
                }
              >
                {REQUEST_STATUS_LABELS[item.status]}
              </Badge>
            </div>
            {canManage &&
            ["new", "under_review", "proposed"].includes(item.status) ? (
              <Button
                type="button"
                size="sm"
                className="mt-3"
                variant="secondary"
                onClick={() => {
                  setActive(item);
                  setError(null);
                  const d = new Date();
                  d.setDate(d.getDate() + 2);
                  d.setHours(14, 30, 0, 0);
                  const pad = (n: number) => String(n).padStart(2, "0");
                  setStartLocal(
                    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`,
                  );
                }}
              >
                Analisar
              </Button>
            ) : null}
          </li>
        ))}
      </ul>

      {active ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-4 sm:items-center">
          <div className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
            <h2 className="font-[family-name:var(--font-display)] text-xl text-[var(--brand-ink)]">
              {active.patient_name}
            </h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              {active.reason}
              {active.custom_reason ? ` — ${active.custom_reason}` : ""}
            </p>
            <p className="mt-2 text-sm text-[var(--text)]">
              Preferência:{" "}
              {active.requested_date
                ? format(new Date(`${active.requested_date}T12:00:00`), "dd/MM/yyyy")
                : "—"}{" "}
              · {PERIOD_LABELS[active.preferred_period]}
            </p>
            {active.notes ? (
              <p className="mt-2 text-sm text-[var(--text-muted)]">{active.notes}</p>
            ) : null}

            <div className="mt-4 space-y-3 rounded-xl bg-[var(--surface-muted)]/70 p-3">
              <p className="text-sm font-medium">Propor horário</p>
              <div>
                <Label htmlFor="prop-start">Data e horário</Label>
                <Input
                  id="prop-start"
                  type="datetime-local"
                  value={startLocal}
                  onChange={(e) => setStartLocal(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="prop-dur">Duração</Label>
                  <Select
                    id="prop-dur"
                    value={String(duration)}
                    onChange={(e) => setDuration(Number(e.target.value))}
                  >
                    <option value={30}>30 min</option>
                    <option value={40}>40 min</option>
                    <option value={45}>45 min</option>
                    <option value={60}>60 min</option>
                  </Select>
                </div>
                {professionals.length > 1 ? (
                  <div>
                    <Label htmlFor="prop-pro">Profissional</Label>
                    <Select
                      id="prop-pro"
                      value={professionalId}
                      onChange={(e) => setProfessionalId(e.target.value)}
                    >
                      {professionals.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.full_name}
                        </option>
                      ))}
                    </Select>
                  </div>
                ) : null}
              </div>
            </div>

            {error ? (
              <p className="mt-3 rounded-xl bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger)]">
                {error}
              </p>
            ) : null}

            <div className="mt-4 flex flex-wrap gap-2">
              {active.status === "new" ? (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  loading={busy}
                  onClick={() => run("review")}
                >
                  Marcar em análise
                </Button>
              ) : null}
              <Button
                type="button"
                size="sm"
                loading={busy}
                onClick={() => {
                  const start = new Date(startLocal);
                  const end = new Date(start.getTime() + duration * 60_000);
                  void run("propose", {
                    proposed_start_at: start.toISOString(),
                    proposed_end_at: end.toISOString(),
                    proposed_professional_id: professionalId,
                  });
                }}
              >
                Escolher horário / Propor
              </Button>
              {active.status === "proposed" ? (
                <Button
                  type="button"
                  size="sm"
                  loading={busy}
                  onClick={() => {
                    const ok = window.confirm(
                      "Confirmar que o paciente aceitou? Isso criará a consulta na agenda.",
                    );
                    if (ok) void run("approve");
                  }}
                >
                  Confirmar (paciente aceitou)
                </Button>
              ) : null}
              <Button
                type="button"
                size="sm"
                variant="ghost"
                loading={busy}
                onClick={() => {
                  const reason =
                    window.prompt(
                      "Motivo da recusa (opcional): sem disponibilidade, procedimento não realizado...",
                    ) ?? "";
                  void run("reject", { rejection_reason: reason });
                }}
              >
                Recusar
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => setActive(null)}
              >
                Fechar
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
