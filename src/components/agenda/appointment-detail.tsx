"use client";

import Link from "next/link";
import { useState } from "react";
import { PlannedProceduresSection } from "@/components/agenda/planned-procedures-section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  APPOINTMENT_STATUS_LABELS,
  type AppointmentStatus,
  type AppointmentWithPatient,
} from "@/types/agenda";
import { appointmentStatusTone } from "@/lib/agenda/status-ui";
import { formatPhoneBR } from "@/lib/patients/normalize";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

function durationMin(start: string, end: string) {
  return Math.round((+new Date(end) - +new Date(start)) / 60_000);
}

const actionsFor = (
  status: AppointmentStatus,
): Array<{ label: string; status?: AppointmentStatus; kind?: "reschedule" | "cancel" | "clinical" }> => {
  switch (status) {
    case "scheduled":
      return [
        { label: "Confirmar", status: "confirmed" },
        { label: "Marcar chegada", status: "arrived" },
        { label: "Reagendar", kind: "reschedule" },
        { label: "Cancelar", kind: "cancel" },
        { label: "Marcar falta", status: "no_show" },
      ];
    case "confirmed":
      return [
        { label: "Marcar chegada", status: "arrived" },
        { label: "Reagendar", kind: "reschedule" },
        { label: "Cancelar", kind: "cancel" },
        { label: "Marcar falta", status: "no_show" },
      ];
    case "arrived":
      return [
        { label: "Iniciar atendimento", status: "in_progress" },
        { label: "Cancelar", kind: "cancel" },
      ];
    case "in_progress":
      return [
        { label: "Concluir", status: "completed" },
        { label: "Cancelar", kind: "cancel" },
      ];
    default:
      return [];
  }
};

export function AppointmentDetail({
  appointment,
  canUpdate,
  canCancel,
  canOpenClinical,
  canManagePlanned,
  canViewForecast,
  onClose,
  onChanged,
}: {
  appointment: AppointmentWithPatient;
  canUpdate: boolean;
  canCancel: boolean;
  canOpenClinical?: boolean;
  canManagePlanned?: boolean;
  canViewForecast?: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [startLocal, setStartLocal] = useState("");

  async function runStatus(status: AppointmentStatus) {
    if (status === "no_show") {
      const ok = window.confirm("Marcar paciente como faltou?");
      if (!ok) return;
    }
    if (status === "completed") {
      const drafts = await fetch(
        `/api/demo/clinical?resource=drafts-for-appointment&appointmentId=${appointment.id}`,
      );
      if (drafts.ok) {
        const data = (await drafts.json()) as { items?: unknown[] };
        if ((data.items?.length ?? 0) > 0) {
          const proceed = window.confirm(
            "Existe uma evolução clínica em rascunho para este atendimento.\n\nOK = Concluir consulta mesmo assim\nCancelar = Voltar ao prontuário",
          );
          if (!proceed) {
            window.location.href = `/app/pacientes/${appointment.patient_id}/prontuario?appointmentId=${appointment.id}`;
            return;
          }
        }
      }
    }
    setLoading(true);
    setError(null);
    const response = await fetch("/api/demo/appointments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "status", id: appointment.id, status }),
    });
    const data = (await response.json()) as { error?: string };
    setLoading(false);
    if (!response.ok) {
      setError(data.error ?? "Não foi possível concluir esta ação. Tente novamente.");
      return;
    }
    if (status === "in_progress") {
      // Oferece converter procedimentos previstos → realizados (idempotente)
      try {
        const plannedRes = await fetch(
          `/api/demo/planned-procedures?appointmentId=${appointment.id}`,
        );
        if (plannedRes.ok) {
          const plannedData = (await plannedRes.json()) as {
            items?: unknown[];
          };
          if ((plannedData.items?.length ?? 0) > 0) {
            const usePlanned = window.confirm(
              "Usar procedimentos previstos para iniciar o atendimento?",
            );
            if (usePlanned) {
              await fetch("/api/demo/planned-procedures", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  action: "convert",
                  data: { appointment_id: appointment.id },
                }),
              });
            }
          }
        }
      } catch {
        // segue para a tela de atendimento mesmo se a conversão falhar
      }
      window.location.href = `/app/agenda/atendimento/${appointment.id}`;
      return;
    }
    onChanged();
  }

  async function cancel() {
    const reason =
      window.prompt("Motivo do cancelamento (opcional):") ?? "";
    if (reason === null) return;
    const ok = window.confirm("Cancelar esta consulta?");
    if (!ok) return;
    setLoading(true);
    const response = await fetch("/api/demo/appointments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "cancel",
        id: appointment.id,
        cancellation_reason: reason,
      }),
    });
    setLoading(false);
    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      setError(data.error ?? "Não foi possível concluir esta ação.");
      return;
    }
    onChanged();
  }

  async function reschedule(event: React.FormEvent) {
    event.preventDefault();
    const start = new Date(startLocal);
    const end = new Date(
      start.getTime() +
        durationMin(appointment.start_at, appointment.end_at) * 60_000,
    );
    setLoading(true);
    const response = await fetch("/api/demo/appointments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "reschedule",
        id: appointment.id,
        start_at: start.toISOString(),
        end_at: end.toISOString(),
        professional_id: appointment.professional_id,
      }),
    });
    setLoading(false);
    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      setError(data.error ?? "Não foi possível concluir esta ação.");
      return;
    }
    setRescheduleOpen(false);
    onChanged();
  }

  const actions = actionsFor(appointment.status).filter((a) => {
    if (a.kind === "cancel") return canCancel;
    if (a.status || a.kind === "reschedule") return canUpdate;
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-4 sm:items-center">
      <div className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl animate-rise">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-xl text-[var(--brand-ink)]">
              {appointment.patient_name}
            </h2>
            <p className="text-sm text-[var(--text-muted)]">
              {formatPhoneBR(appointment.patient_phone) || "Sem telefone"}
            </p>
          </div>
          <Badge tone={appointmentStatusTone[appointment.status]}>
            {APPOINTMENT_STATUS_LABELS[appointment.status]}
          </Badge>
        </div>

        <dl className="mt-4 space-y-2 text-sm">
          <Row
            label="Data"
            value={format(new Date(appointment.start_at), "dd/MM/yyyy", {
              locale: ptBR,
            })}
          />
          <Row
            label="Horário"
            value={`${format(new Date(appointment.start_at), "HH:mm")} – ${format(new Date(appointment.end_at), "HH:mm")}`}
          />
          <Row
            label="Duração"
            value={`${durationMin(appointment.start_at, appointment.end_at)} min`}
          />
          <Row label="Profissional" value={appointment.professional_name} />
          <Row label="Motivo" value={appointment.reason || "—"} />
          <Row label="Observação" value={appointment.notes || "—"} />
          <Row
            label="Valor estimado"
            value={
              appointment.estimated_value != null
                ? appointment.estimated_value.toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  })
                : "—"
            }
          />
        </dl>

        <PlannedProceduresSection
          appointmentId={appointment.id}
          canCreate={Boolean(canManagePlanned)}
          canUpdate={Boolean(canManagePlanned)}
          canViewForecast={Boolean(canViewForecast)}
        />

        {error ? (
          <p className="mt-3 rounded-xl bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger)]">
            {error}
          </p>
        ) : null}

        {rescheduleOpen ? (
          <form onSubmit={reschedule} className="mt-4 space-y-3">
            <div>
              <Label htmlFor="reschedule-start">Novo horário</Label>
              <Input
                id="reschedule-start"
                type="datetime-local"
                value={startLocal}
                onChange={(e) => setStartLocal(e.target.value)}
                required
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" size="sm" loading={loading}>
                Salvar reagendamento
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setRescheduleOpen(false)}
              >
                Voltar
              </Button>
            </div>
          </form>
        ) : (
          <div className="mt-4 flex flex-wrap gap-2">
            {appointment.status === "in_progress" ||
            appointment.status === "arrived" ||
            appointment.status === "confirmed" ? (
              <Link
                href={`/app/agenda/atendimento/${appointment.id}`}
                className="inline-flex h-9 items-center rounded-xl bg-[var(--brand-primary)] px-3 text-sm font-medium text-white"
              >
                Procedimentos / consumo
              </Link>
            ) : null}
            {canOpenClinical &&
            (appointment.status === "arrived" ||
              appointment.status === "in_progress" ||
              appointment.status === "confirmed") ? (
              <Link
                href={`/app/pacientes/${appointment.patient_id}/prontuario?appointmentId=${appointment.id}`}
                className="inline-flex h-9 items-center rounded-xl border border-[var(--border)] px-3 text-sm font-medium"
              >
                Abrir prontuário
              </Link>
            ) : null}
            {actions.map((action) => (
              <Button
                key={action.label}
                type="button"
                size="sm"
                variant={action.kind === "cancel" ? "danger" : "secondary"}
                loading={loading}
                onClick={() => {
                  if (action.kind === "cancel") void cancel();
                  else if (action.kind === "reschedule") {
                    const d = new Date(appointment.start_at);
                    const pad = (n: number) => String(n).padStart(2, "0");
                    setStartLocal(
                      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`,
                    );
                    setRescheduleOpen(true);
                  } else if (action.status) void runStatus(action.status);
                }}
              >
                {action.label}
              </Button>
            ))}
            <Link
              href={`/app/pacientes/${appointment.patient_id}`}
              className="inline-flex h-9 items-center rounded-xl border border-[var(--border)] px-3 text-sm font-medium"
            >
              Ver paciente
            </Link>
          </div>
        )}

        <Button
          type="button"
          variant="ghost"
          className="mt-4 w-full"
          onClick={onClose}
        >
          Fechar
        </Button>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-[var(--text-subtle)]">{label}</dt>
      <dd className="text-right text-[var(--text)]">{value}</dd>
    </div>
  );
}
