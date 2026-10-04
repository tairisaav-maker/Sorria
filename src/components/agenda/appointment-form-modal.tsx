"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DURATION_PRESETS_MIN } from "@/types/agenda";
import { formatPhoneBR } from "@/lib/patients/normalize";
import Link from "next/link";

type Professional = { id: string; full_name: string };
type PatientOption = {
  id: string;
  full_name: string;
  phone: string | null;
  birth_date: string | null;
};

export function AppointmentFormModal({
  open,
  onClose,
  onCreated,
  initialStart,
  presetPatientId,
  professionals,
  defaultProfessionalId,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
  initialStart?: Date;
  presetPatientId?: string;
  professionals: Professional[];
  defaultProfessionalId: string;
}) {
  const [patientQuery, setPatientQuery] = useState("");
  const [patients, setPatients] = useState<PatientOption[]>([]);
  const [patientId, setPatientId] = useState(presetPatientId ?? "");
  const [professionalId, setProfessionalId] = useState(defaultProfessionalId);
  const [startLocal, setStartLocal] = useState("");
  const [duration, setDuration] = useState(40);
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [estimatedValue, setEstimatedValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPatientId(presetPatientId ?? "");
    setProfessionalId(defaultProfessionalId);
    setError(null);
    if (initialStart) {
      const pad = (n: number) => String(n).padStart(2, "0");
      const d = initialStart;
      setStartLocal(
        `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`,
      );
    }
  }, [open, initialStart, presetPatientId, defaultProfessionalId]);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      const q = patientQuery.trim();
      fetch(`/api/demo/patients?q=${encodeURIComponent(q)}&status=all&page=1`)
        .then((r) => r.json())
        .then((data: { items?: PatientOption[] }) => {
          setPatients(data.items ?? []);
        })
        .catch(() => setPatients([]));
    }, 250);
    return () => clearTimeout(timer);
  }, [patientQuery, open]);

  const endAt = useMemo(() => {
    if (!startLocal) return "";
    return new Date(
      new Date(startLocal).getTime() + duration * 60_000,
    ).toISOString();
  }, [startLocal, duration]);

  if (!open) return null;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const response = await fetch("/api/demo/appointments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patient_id: patientId,
        professional_id: professionalId,
        start_at: new Date(startLocal).toISOString(),
        end_at: endAt,
        reason,
        notes,
        estimated_value: estimatedValue
          ? Number(estimatedValue.replace(",", "."))
          : undefined,
      }),
    });
    const data = (await response.json()) as {
      error?: string;
      appointment?: { id: string };
    };
    setLoading(false);
    if (!response.ok || !data.appointment) {
      setError(data.error ?? "Não foi possível concluir esta ação. Tente novamente.");
      return;
    }
    onCreated(data.appointment.id);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-4 sm:items-center">
      <form
        onSubmit={submit}
        className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl animate-rise"
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-appt-title"
      >
        <h2
          id="new-appt-title"
          className="font-[family-name:var(--font-display)] text-xl text-[var(--brand-ink)]"
        >
          Nova consulta
        </h2>

        <div className="mt-4 space-y-3">
          {!presetPatientId ? (
            <div>
              <Label htmlFor="patient-search">Paciente</Label>
              <Input
                id="patient-search"
                placeholder="Nome, telefone ou CPF"
                value={patientQuery}
                onChange={(e) => setPatientQuery(e.target.value)}
              />
              <Select
                className="mt-2"
                value={patientId}
                onChange={(e) => setPatientId(e.target.value)}
                required
                aria-label="Selecionar paciente"
              >
                <option value="">Selecione</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name}
                    {p.phone ? ` · ${formatPhoneBR(p.phone)}` : ""}
                  </option>
                ))}
              </Select>
              <Link
                href="/app/pacientes/novo"
                className="mt-2 inline-block text-xs font-medium text-[var(--brand-primary)]"
              >
                + Cadastrar paciente
              </Link>
            </div>
          ) : (
            <p className="text-sm text-[var(--text-muted)]">
              Paciente já selecionado no perfil.
            </p>
          )}

          <div>
            <Label htmlFor="reason">Motivo</Label>
            <Input
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Avaliação, limpeza, retorno..."
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="start">Data e horário</Label>
              <Input
                id="start"
                type="datetime-local"
                value={startLocal}
                onChange={(e) => setStartLocal(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="duration">Duração</Label>
              <Select
                id="duration"
                value={String(duration)}
                onChange={(e) => setDuration(Number(e.target.value))}
              >
                {DURATION_PRESETS_MIN.map((m) => (
                  <option key={m} value={m}>
                    {m} min
                  </option>
                ))}
                <option value={40}>40 min</option>
              </Select>
            </div>
          </div>

          {professionals.length > 1 ? (
            <div>
              <Label htmlFor="professional">Profissional</Label>
              <Select
                id="professional"
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

          <div>
            <Label htmlFor="notes">Observação administrativa</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="estimated">Valor estimado (opcional)</Label>
            <Input
              id="estimated"
              inputMode="decimal"
              placeholder="0,00"
              value={estimatedValue}
              onChange={(e) => setEstimatedValue(e.target.value)}
            />
          </div>
        </div>

        {error ? (
          <p className="mt-3 rounded-xl bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger)]">
            {error}
          </p>
        ) : null}

        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={loading}>
            Criar consulta
          </Button>
        </div>
      </form>
    </div>
  );
}
