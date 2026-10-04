"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Copy, Pencil, Phone } from "lucide-react";
import { PatientCompletion } from "@/components/patients/patient-completion";
import { PatientStatusBadge } from "@/components/patients/patient-status-badge";
import { PatientProceduresClient } from "@/components/performed-procedures/patient-procedures-client";
import { PatientTreatmentTab } from "@/components/treatments/patient-treatment-tab";
import { Button } from "@/components/ui/button";
// Financeiro: link dedicado (não mistura despesas da clínica)
import { calcAge, isMinor } from "@/lib/patients/age";
import { formatCpf, formatPhoneBR } from "@/lib/patients/normalize";
import type { Patient } from "@/types/patient";
import {
  APPOINTMENT_STATUS_LABELS,
  type AppointmentWithPatient,
} from "@/types/agenda";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

const tabs = [
  "Resumo",
  "Evolução",
  "Procedimentos",
  "Financeiro",
  "Documentos",
] as const;

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function PatientProfileClient({
  patient,
  canEdit,
  canArchive,
  canCreateAppointment,
  canViewClinical,
  canViewTreatments,
  canCreateTreatment,
  canViewFinance,
  canViewProcedures,
  canViewProcedureCosts,
  nextAppointment,
  lastAppointment,
  followUp,
}: {
  patient: Patient;
  canEdit: boolean;
  canArchive: boolean;
  canCreateAppointment: boolean;
  canViewClinical: boolean;
  canViewTreatments: boolean;
  canCreateTreatment: boolean;
  canViewFinance: boolean;
  canViewProcedures?: boolean;
  canViewProcedureCosts?: boolean;
  nextAppointment: AppointmentWithPatient | null;
  lastAppointment: AppointmentWithPatient | null;
  followUp: { intervalDays: number | null; pending: boolean } | null;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<(typeof tabs)[number]>("Resumo");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const age = calcAge(patient.birth_date);
  const minor = isMinor(patient.birth_date);

  async function copyPhone() {
    if (!patient.phone) return;
    await navigator.clipboard.writeText(patient.phone);
    setMessage("Telefone copiado.");
  }

  async function archive() {
    const ok = window.confirm(
      `Arquivar paciente?\n\n${patient.full_name} deixará de aparecer entre os pacientes ativos. O histórico será preservado.`,
    );
    if (!ok) return;
    setLoading(true);
    const response = await fetch("/api/demo/patients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "archive", id: patient.id }),
    });
    setLoading(false);
    if (!response.ok) {
      setMessage("Não foi possível concluir esta ação. Tente novamente.");
      return;
    }
    router.refresh();
    setMessage("Paciente arquivado.");
  }

  async function reactivate() {
    setLoading(true);
    const response = await fetch("/api/demo/patients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reactivate", id: patient.id }),
    });
    setLoading(false);
    if (!response.ok) {
      setMessage("Não foi possível concluir esta ação. Tente novamente.");
      return;
    }
    router.refresh();
    setMessage("Paciente reativado.");
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
      <section className="animate-fade-in rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/90 p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex size-14 items-center justify-center rounded-full bg-[var(--brand-soft)] text-lg font-semibold text-[var(--brand-ink)]">
              {initials(patient.full_name)}
            </div>
            <div>
              <h1 className="font-[family-name:var(--font-display)] text-2xl tracking-tight text-[var(--brand-ink)] sm:text-3xl">
                {patient.full_name}
              </h1>
              {patient.preferred_name ? (
                <p className="text-sm text-[var(--text-muted)]">
                  Prefere: {patient.preferred_name}
                </p>
              ) : null}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <PatientStatusBadge status={patient.status} />
                <span className="text-sm text-[var(--text-muted)]">
                  {age !== null ? `${age} anos` : "Idade não informada"}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {canCreateAppointment ? (
              <Link
                href={`/app/agenda?patientId=${patient.id}`}
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-[var(--brand-primary)] px-4 text-sm font-medium text-white"
              >
                Nova consulta
              </Link>
            ) : null}
            {patient.phone ? (
              <Button type="button" variant="secondary" onClick={copyPhone}>
                <Phone className="size-4" />
                Contato
              </Button>
            ) : null}
            {canEdit ? (
              <Link
                href={`/app/pacientes/${patient.id}/editar`}
                className="inline-flex h-11 items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-medium"
              >
                <Pencil className="size-4" />
                Editar
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      {message ? (
        <p className="rounded-xl bg-[var(--success-soft)] px-3 py-2 text-sm text-[var(--success)]" role="status">
          {message}
        </p>
      ) : null}

      <div
        className="flex gap-1 overflow-x-auto rounded-xl bg-[var(--surface-muted)] p-1"
        role="tablist"
        aria-label="Áreas do paciente"
      >
        {tabs
          .filter((item) => item !== "Procedimentos" || canViewProcedures)
          .map((item) => (
          <button
            key={item}
            type="button"
            role="tab"
            aria-selected={tab === item}
            className={cn(
              "shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              tab === item
                ? "bg-white text-[var(--brand-ink)] shadow-sm"
                : "text-[var(--text-muted)]",
            )}
            onClick={() => setTab(item)}
          >
            {item}
          </button>
        ))}
      </div>

      {tab === "Resumo" ? (
        <div className="grid gap-4 md:grid-cols-2">
          <PatientCompletion patient={patient} />

          {canViewClinical && followUp ? (
            <SummaryCard title="Retorno indicado">
              <Row
                label="Prazo"
                value={
                  followUp.intervalDays
                    ? `Em ${followUp.intervalDays} dias`
                    : "Indicado"
                }
              />
              <Row
                label="Situação"
                value={
                  followUp.pending ? "Retorno pendente" : "Consulta futura existe"
                }
              />
              {followUp.pending && canCreateAppointment ? (
                <Link
                  href={`/app/agenda?patientId=${patient.id}`}
                  className="mt-2 inline-flex text-sm font-medium text-[var(--brand-primary)]"
                >
                  Agendar retorno
                </Link>
              ) : null}
            </SummaryCard>
          ) : null}

          <SummaryCard title="Próxima consulta">
            {nextAppointment ? (
              <>
                <Row
                  label="Data"
                  value={format(new Date(nextAppointment.start_at), "dd/MM/yyyy", {
                    locale: ptBR,
                  })}
                />
                <Row
                  label="Horário"
                  value={format(new Date(nextAppointment.start_at), "HH:mm", {
                    locale: ptBR,
                  })}
                />
                <Row
                  label="Status"
                  value={APPOINTMENT_STATUS_LABELS[nextAppointment.status]}
                />
                {nextAppointment.reason ? (
                  <Row label="Motivo" value={nextAppointment.reason} />
                ) : null}
              </>
            ) : (
              <p className="text-sm text-[var(--text-muted)]">
                Nenhuma consulta futura agendada.
              </p>
            )}
          </SummaryCard>

          <SummaryCard title="Última consulta">
            {lastAppointment ? (
              <>
                <Row
                  label="Data"
                  value={format(new Date(lastAppointment.start_at), "dd/MM/yyyy", {
                    locale: ptBR,
                  })}
                />
                <Row
                  label="Horário"
                  value={format(new Date(lastAppointment.start_at), "HH:mm", {
                    locale: ptBR,
                  })}
                />
                <Row
                  label="Status"
                  value={APPOINTMENT_STATUS_LABELS[lastAppointment.status]}
                />
                {lastAppointment.reason ? (
                  <Row label="Motivo" value={lastAppointment.reason} />
                ) : null}
              </>
            ) : (
              <p className="text-sm text-[var(--text-muted)]">
                Ainda não há consultas anteriores.
              </p>
            )}
          </SummaryCard>

          <SummaryCard title="Contato">
            <Row label="Telefone" value={formatPhoneBR(patient.phone) || "—"} />
            <Row
              label="Secundário"
              value={formatPhoneBR(patient.secondary_phone) || "—"}
            />
            <Row label="E-mail" value={patient.email || "—"} />
            {patient.phone ? (
              <button
                type="button"
                className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-[var(--brand-primary)]"
                onClick={copyPhone}
              >
                <Copy className="size-3.5" />
                Copiar telefone
              </button>
            ) : null}
          </SummaryCard>

          <SummaryCard title="Dados pessoais">
            <Row
              label="Nascimento"
              value={
                patient.birth_date
                  ? patient.birth_date.split("-").reverse().join("/")
                  : "—"
              }
            />
            <Row label="Idade" value={age !== null ? `${age} anos` : "—"} />
            <Row label="CPF" value={formatCpf(patient.cpf) || "—"} />
          </SummaryCard>

          {(minor || patient.guardian_name) && (
            <SummaryCard title="Responsável">
              <Row label="Nome" value={patient.guardian_name || "—"} />
              <Row label="Relação" value={patient.guardian_relationship || "—"} />
              <Row
                label="Telefone"
                value={formatPhoneBR(patient.guardian_phone) || "—"}
              />
              {minor && !patient.guardian_name ? (
                <p className="mt-2 text-xs text-[var(--warning)]">
                  Pendência administrativa: responsável incompleto.
                </p>
              ) : null}
            </SummaryCard>
          )}

          {(patient.emergency_contact_name ||
            patient.emergency_contact_phone) && (
            <SummaryCard title="Emergência">
              <Row label="Nome" value={patient.emergency_contact_name || "—"} />
              <Row
                label="Relação"
                value={patient.emergency_contact_relationship || "—"}
              />
              <Row
                label="Telefone"
                value={formatPhoneBR(patient.emergency_contact_phone) || "—"}
              />
            </SummaryCard>
          )}

          {(patient.street || patient.city) && (
            <SummaryCard title="Endereço">
              <p className="text-sm text-[var(--text)]">
                {[
                  patient.street,
                  patient.number,
                  patient.complement,
                  patient.neighborhood,
                  patient.city,
                  patient.state,
                  patient.postal_code,
                ]
                  .filter(Boolean)
                  .join(", ")}
              </p>
            </SummaryCard>
          )}

          <SummaryCard title="Origem">
            <Row
              label="Como conheceu"
              value={patient.referral_source || "—"}
            />
          </SummaryCard>

          <SummaryCard title="Administrativo">
            <Row label="Status" value={<PatientStatusBadge status={patient.status} />} />
            <Row
              label="Observação"
              value={patient.administrative_notes || "—"}
            />
            <Row
              label="Cadastro"
              value={format(new Date(patient.created_at), "dd/MM/yyyy", {
                locale: ptBR,
              })}
            />
            <Row
              label="Atualização"
              value={format(new Date(patient.updated_at), "dd/MM/yyyy HH:mm", {
                locale: ptBR,
              })}
            />
          </SummaryCard>

          <div className="md:col-span-2 flex flex-wrap gap-2">
            {canArchive && patient.status !== "archived" ? (
              <Button
                type="button"
                variant="secondary"
                loading={loading}
                onClick={archive}
              >
                Arquivar paciente
              </Button>
            ) : null}
            {canArchive && patient.status === "archived" ? (
              <Button type="button" loading={loading} onClick={reactivate}>
                Reativar paciente
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      {tab === "Evolução" ? (
        canViewClinical ? (
          <div className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/90 px-5 py-6">
            <p className="text-sm text-[var(--text-muted)]">
              Evoluções clínicas e prontuário deste paciente.
            </p>
            <Link
              href={`/app/pacientes/${patient.id}/prontuario`}
              className="inline-flex min-h-11 items-center rounded-xl bg-[var(--brand-primary)] px-4 text-sm font-medium text-white"
            >
              Abrir evolução / prontuário
            </Link>
            {canViewTreatments ? (
              <div className="border-t border-[var(--border)] pt-4">
                <p className="mb-2 text-sm font-medium">Planos de tratamento</p>
                <PatientTreatmentTab
                  patientId={patient.id}
                  canCreate={canCreateTreatment}
                />
              </div>
            ) : null}
          </div>
        ) : (
          <Placeholder text="Você não tem permissão para acessar a evolução deste paciente." />
        )
      ) : null}
      {tab === "Procedimentos" ? (
        canViewProcedures ? (
          <PatientProceduresClient
            patientId={patient.id}
            canViewCosts={Boolean(canViewProcedureCosts)}
            canViewFinance={canViewFinance}
          />
        ) : (
          <Placeholder text="Este paciente ainda não possui procedimentos realizados — ou você não tem permissão." />
        )
      ) : null}
      {tab === "Financeiro" ? (
        canViewFinance ? (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/90 px-5 py-8 text-center">
            <p className="text-sm text-[var(--text-muted)]">
              Cobrado, recebido, a receber e vencido deste paciente.
            </p>
            <Link
              href={`/app/pacientes/${patient.id}/financeiro`}
              className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-[var(--brand-primary)] px-4 text-sm font-medium text-white"
            >
              Abrir financeiro do paciente
            </Link>
          </div>
        ) : (
          <Placeholder text="Você não tem permissão para visualizar o financeiro deste paciente." />
        )
      ) : null}
      {tab === "Documentos" ? (
        <Placeholder text="Os documentos do paciente serão disponibilizados em uma próxima etapa." />
      ) : null}
    </div>
  );
}

function SummaryCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/90 p-4">
      <h2 className="mb-3 font-[family-name:var(--font-display)] text-lg text-[var(--brand-ink)]">
        {title}
      </h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function Row({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="text-[var(--text-subtle)]">{label}</span>
      <span className="text-right text-[var(--text)]">{value}</span>
    </div>
  );
}

function Placeholder({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface-elevated)]/70 px-5 py-10 text-center text-sm text-[var(--text-muted)]">
      {text}
    </div>
  );
}
