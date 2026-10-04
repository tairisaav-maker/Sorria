"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ChevronDown, Plus } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ANAMNESIS_SECTIONS } from "@/lib/clinical/anamnesis-template";
import {
  LOWER_LEFT,
  LOWER_RIGHT,
  UPPER_LEFT,
  UPPER_RIGHT,
} from "@/lib/clinical/teeth";
import { cn } from "@/lib/utils";
import {
  ANAMNESIS_STATUS_LABELS,
  ATTACHMENT_TYPE_LABELS,
  FOLLOW_UP_PRESETS,
  TOOTH_CONDITION_LABELS,
  type Anamnesis,
  type AnamnesisAnswer,
  type ClinicalAttachment,
  type ClinicalEntry,
  type ClinicalSummary,
  type OdontogramEntry,
  type ToothCondition,
} from "@/types/clinical";

type Tab = "resumo" | "anamnese" | "evolucoes" | "odontograma" | "arquivos";

const tabs: { id: Tab; label: string }[] = [
  { id: "resumo", label: "Resumo clínico" },
  { id: "anamnese", label: "Anamnese" },
  { id: "evolucoes", label: "Evoluções" },
  { id: "odontograma", label: "Odontograma" },
  { id: "arquivos", label: "Arquivos" },
];

export function ClinicalChartClient({
  patientId,
  patientName,
  appointmentId,
  canCreate,
  canUpdate,
  canUpload,
}: {
  patientId: string;
  patientName: string;
  appointmentId?: string;
  canCreate: boolean;
  canUpdate: boolean;
  canUpload: boolean;
}) {
  const [tab, setTab] = useState<Tab>("resumo");
  const [summary, setSummary] = useState<ClinicalSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await fetch(
      `/api/demo/clinical?resource=summary&patientId=${patientId}`,
    );
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Você não tem permissão para acessar o prontuário deste paciente.");
      return;
    }
    setSummary(data.summary);
  }, [patientId]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
      <section className="animate-fade-in">
        <p className="text-sm text-[var(--text-muted)]">
          <Link href={`/app/pacientes/${patientId}`} className="text-[var(--brand-primary)]">
            {patientName}
          </Link>
        </p>
        <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight text-[var(--brand-ink)]">
          Prontuário
        </h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Dados clínicos · separados do cadastro administrativo
        </p>
      </section>

      <div
        className="flex gap-1 overflow-x-auto rounded-xl bg-[var(--surface-muted)] p-1"
        role="tablist"
        aria-label="Seções do prontuário"
      >
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={cn(
              "shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              tab === item.id
                ? "bg-white text-[var(--brand-ink)] shadow-sm"
                : "text-[var(--text-muted)]",
            )}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {error ? (
        <p className="rounded-xl bg-[var(--danger-soft)] px-4 py-3 text-sm text-[var(--danger)]">
          {error}
        </p>
      ) : null}

      {loading && !summary ? (
        <div className="space-y-2" aria-busy="true">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl bg-[var(--surface-muted)]" />
          ))}
        </div>
      ) : null}

      {tab === "resumo" && summary ? (
        <SummaryTab summary={summary} onGo={setTab} />
      ) : null}
      {tab === "anamnese" ? (
        <AnamnesisTab
          patientId={patientId}
          canUpdate={canUpdate || canCreate}
          onChanged={loadSummary}
        />
      ) : null}
      {tab === "evolucoes" ? (
        <EntriesTab
          patientId={patientId}
          appointmentId={appointmentId}
          canCreate={canCreate}
          canUpdate={canUpdate}
          onChanged={loadSummary}
        />
      ) : null}
      {tab === "odontograma" ? (
        <OdontogramTab
          patientId={patientId}
          canUpdate={canUpdate}
          onChanged={loadSummary}
        />
      ) : null}
      {tab === "arquivos" ? (
        <FilesTab patientId={patientId} canUpload={canUpload} />
      ) : null}
    </div>
  );
}

function SummaryTab({
  summary,
  onGo,
}: {
  summary: ClinicalSummary;
  onGo: (t: Tab) => void;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/90 p-4 md:col-span-2">
        <h2 className="mb-3 font-[family-name:var(--font-display)] text-lg text-[var(--brand-ink)]">
          Alertas
        </h2>
        {summary.alerts.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">Nenhum alerta clínico derivado.</p>
        ) : (
          <ul className="space-y-2">
            {summary.alerts.map((alert) => (
              <li
                key={alert.id}
                className={cn(
                  "flex items-start gap-2 rounded-xl px-3 py-2 text-sm",
                  alert.severity === "high"
                    ? "bg-[var(--danger-soft)] text-[var(--danger)]"
                    : "bg-[var(--warning-soft)] text-[var(--warning)]",
                )}
              >
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span>
                  <span className="font-medium">{alert.label}</span>
                  {alert.detail ? (
                    <span className="block text-xs opacity-90">{alert.detail}</span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Card title="Anamnese">
        <p className="text-sm">{summary.anamnesisLabel}</p>
        <Button type="button" size="sm" variant="secondary" className="mt-3" onClick={() => onGo("anamnese")}>
          Abrir anamnese
        </Button>
      </Card>

      <Card title="Última evolução">
        {summary.lastEntry ? (
          <>
            <p className="text-sm font-medium">
              {format(new Date(summary.lastEntry.signed_at ?? summary.lastEntry.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
            </p>
            <p className="mt-1 text-sm text-[var(--text-muted)] line-clamp-2">
              {summary.lastEntry.chief_complaint || summary.lastEntry.procedure_done || "Sem resumo"}
            </p>
          </>
        ) : (
          <p className="text-sm text-[var(--text-muted)]">Nenhuma evolução finalizada.</p>
        )}
      </Card>

      <Card title="Último atendimento">
        {summary.lastAppointment ? (
          <p className="text-sm">
            {format(new Date(summary.lastAppointment.start_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
          </p>
        ) : (
          <p className="text-sm text-[var(--text-muted)]">—</p>
        )}
      </Card>

      <Card title="Próxima consulta">
        {summary.nextAppointment ? (
          <p className="text-sm">
            {format(new Date(summary.nextAppointment.start_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
          </p>
        ) : (
          <p className="text-sm text-[var(--text-muted)]">Nenhuma agendada</p>
        )}
      </Card>

      {summary.followUp?.required ? (
        <Card title="Retorno indicado">
          <p className="text-sm">
            Em {summary.followUp.intervalDays ?? "—"} dias
          </p>
          {summary.followUp.pending ? (
            <Badge tone="warning" className="mt-2">
              Retorno pendente
            </Badge>
          ) : (
            <Badge tone="success" className="mt-2">
              Consulta futura existe
            </Badge>
          )}
        </Card>
      ) : null}

      <Card title="Odontograma">
        <p className="text-sm text-[var(--text-muted)]">
          {summary.odontogramUpdatedAt
            ? `Atualizado em ${format(new Date(summary.odontogramUpdatedAt), "dd/MM/yyyy", { locale: ptBR })}`
            : "Ainda não atualizado"}
        </p>
        <Button type="button" size="sm" variant="secondary" className="mt-3" onClick={() => onGo("odontograma")}>
          Abrir odontograma
        </Button>
      </Card>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/90 p-4">
      <h2 className="mb-2 font-[family-name:var(--font-display)] text-lg text-[var(--brand-ink)]">
        {title}
      </h2>
      {children}
    </section>
  );
}

function AnamnesisTab({
  patientId,
  canUpdate,
  onChanged,
}: {
  patientId: string;
  canUpdate: boolean;
  onChanged: () => void;
}) {
  const [anamnesis, setAnamnesis] = useState<Anamnesis | null>(null);
  const [answers, setAnswers] = useState<Record<string, { value_bool: boolean | null; value_text: string | null }>>({});
  const [openSection, setOpenSection] = useState<string>(ANAMNESIS_SECTIONS[0]!.id);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    const res = await fetch(`/api/demo/clinical?resource=anamnesis&patientId=${patientId}`);
    const data = await res.json();
    setAnamnesis(data.anamnesis);
    const map: typeof answers = {};
    for (const a of (data.answers ?? []) as AnamnesisAnswer[]) {
      map[a.question_key] = {
        value_bool: a.value_bool,
        value_text: a.value_text,
      };
    }
    setAnswers(map);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId]);

  function setBool(key: string, value: boolean) {
    setAnswers((prev) => ({
      ...prev,
      [key]: { value_bool: value, value_text: prev[key]?.value_text ?? null },
    }));
  }

  function setText(key: string, value: string) {
    setAnswers((prev) => ({
      ...prev,
      [key]: { value_bool: prev[key]?.value_bool ?? null, value_text: value },
    }));
  }

  async function post(action: string) {
    setBusy(true);
    setMessage(null);
    const res = await fetch("/api/demo/clinical", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        patient_id: patientId,
        answers,
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMessage(data.error ?? "Não foi possível concluir esta ação. Tente novamente.");
      return;
    }
    setAnamnesis(data.anamnesis);
    setMessage("Salvo.");
    onChanged();
    await load();
  }

  if (!anamnesis && Object.keys(answers).length === 0 && !canUpdate) {
    return (
      <EmptyState
        title="Nenhuma anamnese registrada"
        description="Aguarde um profissional clínico preencher."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={anamnesis?.status === "reviewed" ? "success" : "info"}>
          {anamnesis ? ANAMNESIS_STATUS_LABELS[anamnesis.status] : "Não preenchida"}
        </Badge>
        <span className="text-xs text-[var(--text-subtle)]">
          Template v{anamnesis?.template_version ?? 1}
        </span>
      </div>

      {ANAMNESIS_SECTIONS.map((section) => {
        const open = openSection === section.id;
        return (
          <section
            key={section.id}
            className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/90"
          >
            <button
              type="button"
              className="flex w-full items-center justify-between px-4 py-3 text-left"
              onClick={() => setOpenSection(open ? "" : section.id)}
            >
              <span className="font-medium text-[var(--brand-ink)]">{section.title}</span>
              <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
            </button>
            {open ? (
              <div className="space-y-4 border-t border-[var(--border)] px-4 py-4">
                {section.questions.map((q) => {
                  if (q.showIf) {
                    const parent = answers[q.showIf.key]?.value_bool;
                    if (parent !== q.showIf.equals) return null;
                  }
                  return (
                    <div key={q.key}>
                      <Label>{q.label}</Label>
                      {q.type === "bool" ? (
                        <div className="mt-2 flex gap-2">
                          {[false, true].map((val) => (
                            <Button
                              key={String(val)}
                              type="button"
                              size="sm"
                              variant={answers[q.key]?.value_bool === val ? "primary" : "secondary"}
                              disabled={!canUpdate}
                              onClick={() => setBool(q.key, val)}
                            >
                              {val ? "Sim" : "Não"}
                            </Button>
                          ))}
                        </div>
                      ) : (
                        <Textarea
                          className="mt-2"
                          value={answers[q.key]?.value_text ?? ""}
                          disabled={!canUpdate}
                          onChange={(e) => setText(q.key, e.target.value)}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            ) : null}
          </section>
        );
      })}

      {message ? (
        <p className="text-sm text-[var(--success)]" role="status">
          {message}
        </p>
      ) : null}

      {canUpdate ? (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" loading={busy} onClick={() => post("anamnesis.save")}>
            Salvar rascunho
          </Button>
          <Button type="button" loading={busy} onClick={() => post("anamnesis.submit")}>
            Finalizar respostas
          </Button>
          {anamnesis?.status === "submitted" || anamnesis?.status === "reviewed" ? (
            <Button type="button" variant="secondary" loading={busy} onClick={() => post("anamnesis.review")}>
              Marcar como revisada
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function EntriesTab({
  patientId,
  appointmentId,
  canCreate,
  canUpdate,
  onChanged,
}: {
  patientId: string;
  appointmentId?: string;
  canCreate: boolean;
  canUpdate: boolean;
  onChanged: () => void;
}) {
  const router = useRouter();
  const [items, setItems] = useState<Array<ClinicalEntry & { professional_name?: string }>>([]);
  const [editing, setEditing] = useState<ClinicalEntry | null>(null);
  const [creating, setCreating] = useState(Boolean(appointmentId));
  const [versionsFor, setVersionsFor] = useState<string | null>(null);
  const [versions, setVersions] = useState<Array<{ version_number: number; created_at: string; change_reason: string | null; changed_by_name: string | null }>>([]);
  const [form, setForm] = useState({
    chief_complaint: "",
    clinical_exam: "",
    procedure_done: "",
    conduct: "",
    guidance: "",
    next_step: "",
    follow_up_required: false,
    follow_up_interval_days: 15 as number | null,
    change_reason: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch(`/api/demo/clinical?resource=entries&patientId=${patientId}`);
    const data = await res.json();
    setItems(data.items ?? []);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId]);

  async function saveDraft(id?: string) {
    setBusy(true);
    setError(null);
    const payload = {
      ...form,
      patient_id: patientId,
      appointment_id: appointmentId ?? editing?.appointment_id ?? null,
      expected_updated_at: editing?.updated_at,
      id,
    };
    const res = await fetch("/api/demo/clinical", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: id ? "entry.update" : "entry.create",
        ...payload,
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Não foi possível concluir esta ação. Tente novamente.");
      return;
    }
    setCreating(false);
    setEditing(null);
    await load();
    onChanged();
  }

  async function finalize(id: string, updatedAt: string) {
    setBusy(true);
    const res = await fetch("/api/demo/clinical", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "entry.finalize",
        id,
        expected_updated_at: updatedAt,
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Não foi possível concluir esta ação. Tente novamente.");
      return;
    }
    await load();
    onChanged();
  }

  async function correct(id: string, updatedAt: string) {
    if (!form.change_reason.trim()) {
      setError("Informe o motivo da correção");
      return;
    }
    setBusy(true);
    const res = await fetch("/api/demo/clinical", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "entry.correct",
        id,
        expected_updated_at: updatedAt,
        change_reason: form.change_reason,
        chief_complaint: form.chief_complaint,
        clinical_exam: form.clinical_exam,
        procedure_done: form.procedure_done,
        conduct: form.conduct,
        guidance: form.guidance,
        next_step: form.next_step,
        follow_up_required: form.follow_up_required,
        follow_up_interval_days: form.follow_up_interval_days,
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Não foi possível concluir esta ação. Tente novamente.");
      return;
    }
    setEditing(null);
    await load();
    onChanged();
  }

  async function showVersions(id: string) {
    const res = await fetch(`/api/demo/clinical?resource=versions&id=${id}`);
    const data = await res.json();
    setVersions(data.items ?? []);
    setVersionsFor(id);
  }

  const formUi = (
    <div className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/90 p-4">
      <h3 className="font-[family-name:var(--font-display)] text-lg text-[var(--brand-ink)]">
        {editing?.status === "finalized" ? "Adicionar correção" : "Nova evolução"}
      </h3>
      {(
        [
          ["chief_complaint", "Queixa principal"],
          ["clinical_exam", "Exame clínico"],
          ["procedure_done", "Procedimento realizado"],
          ["conduct", "Conduta"],
          ["guidance", "Orientações"],
          ["next_step", "Próximo passo"],
        ] as const
      ).map(([key, label]) => (
        <div key={key}>
          <Label>{label}</Label>
          <Textarea
            className="mt-1"
            value={form[key]}
            onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
          />
        </div>
      ))}
      <div>
        <Label>Precisa retornar?</Label>
        <div className="mt-2 flex gap-2">
          <Button
            type="button"
            size="sm"
            variant={form.follow_up_required ? "primary" : "secondary"}
            onClick={() => setForm((f) => ({ ...f, follow_up_required: true }))}
          >
            Sim
          </Button>
          <Button
            type="button"
            size="sm"
            variant={!form.follow_up_required ? "primary" : "secondary"}
            onClick={() => setForm((f) => ({ ...f, follow_up_required: false }))}
          >
            Não
          </Button>
        </div>
      </div>
      {form.follow_up_required ? (
        <div>
          <Label>Em aproximadamente</Label>
          <Select
            className="mt-1"
            value={String(form.follow_up_interval_days ?? 15)}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                follow_up_interval_days: Number(e.target.value),
              }))
            }
          >
            {FOLLOW_UP_PRESETS.map((d) => (
              <option key={d} value={d}>
                {d} dias
              </option>
            ))}
          </Select>
        </div>
      ) : null}
      {editing?.status === "finalized" ? (
        <div>
          <Label>Motivo da correção</Label>
          <Textarea
            className="mt-1"
            value={form.change_reason}
            onChange={(e) => setForm((f) => ({ ...f, change_reason: e.target.value }))}
          />
        </div>
      ) : null}
      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            setCreating(false);
            setEditing(null);
          }}
        >
          Cancelar
        </Button>
        {editing?.status === "finalized" ? (
          <Button type="button" loading={busy} onClick={() => correct(editing.id, editing.updated_at)}>
            Salvar correção
          </Button>
        ) : (
          <>
            <Button
              type="button"
              variant="secondary"
              loading={busy}
              onClick={() => saveDraft(editing?.id)}
            >
              Salvar rascunho
            </Button>
            {editing ? (
              <Button
                type="button"
                loading={busy}
                onClick={() => finalize(editing.id, editing.updated_at)}
              >
                Finalizar evolução
              </Button>
            ) : null}
          </>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {canCreate && !creating && !editing ? (
        <Button
          type="button"
          onClick={() => {
            setCreating(true);
            setForm({
              chief_complaint: "",
              clinical_exam: "",
              procedure_done: "",
              conduct: "",
              guidance: "",
              next_step: "",
              follow_up_required: false,
              follow_up_interval_days: 15,
              change_reason: "",
            });
          }}
        >
          <Plus className="size-4" />
          Nova evolução
        </Button>
      ) : null}

      {(creating || editing) && canUpdate ? formUi : null}

      {items.length === 0 && !creating ? (
        <EmptyState
          title="Nenhuma evolução clínica registrada"
          description="Registre o atendimento em ordem cronológica."
        />
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li
              key={item.id}
              className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/90 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-[var(--brand-primary)]">
                    {format(new Date(item.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </p>
                  <p className="text-sm text-[var(--text-muted)]">
                    {item.professional_name}
                    {item.appointment_id ? " · consulta vinculada" : ""}
                  </p>
                </div>
                <Badge tone={item.status === "finalized" ? "success" : "warning"}>
                  {item.status === "finalized" ? "Finalizada" : "Rascunho"}
                  {item.status === "finalized" ? ` · v${item.version_number}` : ""}
                </Badge>
              </div>
              <p className="mt-2 text-sm font-medium">{item.chief_complaint || "Sem queixa"}</p>
              {item.procedure_done ? (
                <p className="mt-1 text-sm text-[var(--text-muted)]">{item.procedure_done}</p>
              ) : null}
              {item.related_teeth.length > 0 ? (
                <p className="mt-1 text-xs text-[var(--text-subtle)]">
                  Dentes: {item.related_teeth.join(", ")}
                </p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                {item.status === "draft" && canUpdate ? (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setEditing(item);
                        setCreating(false);
                        setForm({
                          chief_complaint: item.chief_complaint ?? "",
                          clinical_exam: item.clinical_exam ?? "",
                          procedure_done: item.procedure_done ?? "",
                          conduct: item.conduct ?? "",
                          guidance: item.guidance ?? "",
                          next_step: item.next_step ?? "",
                          follow_up_required: item.follow_up_required,
                          follow_up_interval_days: item.follow_up_interval_days,
                          change_reason: "",
                        });
                      }}
                    >
                      Editar rascunho
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => finalize(item.id, item.updated_at)}
                    >
                      Finalizar
                    </Button>
                  </>
                ) : null}
                {item.status === "finalized" && canUpdate ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setEditing(item);
                      setForm({
                        chief_complaint: item.chief_complaint ?? "",
                        clinical_exam: item.clinical_exam ?? "",
                        procedure_done: item.procedure_done ?? "",
                        conduct: item.conduct ?? "",
                        guidance: item.guidance ?? "",
                        next_step: item.next_step ?? "",
                        follow_up_required: item.follow_up_required,
                        follow_up_interval_days: item.follow_up_interval_days,
                        change_reason: "",
                      });
                    }}
                  >
                    Adicionar correção
                  </Button>
                ) : null}
                {item.status === "finalized" ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => showVersions(item.id)}
                  >
                    Histórico de alterações
                  </Button>
                ) : null}
                {item.status === "finalized" && item.next_step ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      const ok = window.confirm(
                        `Adicionar o próximo passo “${item.next_step}” a um novo plano de tratamento?\n\nVocê revisará antes de apresentar. Nada é criado sem confirmação.`,
                      );
                      if (!ok) return;
                      const qs = new URLSearchParams({
                        procedure: item.next_step ?? "Procedimento",
                        clinicalEntryId: item.id,
                      });
                      if (item.related_teeth[0]) {
                        qs.set("tooth", String(item.related_teeth[0]));
                      }
                      router.push(
                        `/app/pacientes/${patientId}/tratamentos/novo?${qs.toString()}`,
                      );
                    }}
                  >
                    Adicionar ao plano
                  </Button>
                ) : null}
              </div>
              {versionsFor === item.id ? (
                <ul className="mt-3 space-y-2 rounded-xl bg-[var(--surface-muted)]/70 p-3 text-xs">
                  {versions.map((v) => (
                    <li key={v.version_number}>
                      <strong>Versão {v.version_number}</strong>{" "}
                      {format(new Date(v.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      {" · "}
                      {v.changed_by_name}
                      {v.change_reason ? ` — Motivo: ${v.change_reason}` : ""}
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function OdontogramTab({
  patientId,
  canUpdate,
  onChanged,
}: {
  patientId: string;
  canUpdate: boolean;
  onChanged: () => void;
}) {
  const router = useRouter();
  const [teeth, setTeeth] = useState<OdontogramEntry[]>([]);
  const [selected, setSelected] = useState<OdontogramEntry | null>(null);
  const [condition, setCondition] = useState<ToothCondition>("healthy");
  const [planned, setPlanned] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const res = await fetch(`/api/demo/clinical?resource=odontogram&patientId=${patientId}`);
    const data = await res.json();
    setTeeth(data.teeth ?? []);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId]);

  const byNumber = useMemo(() => {
    return new Map(teeth.map((t) => [t.tooth_number, t]));
  }, [teeth]);

  function openTooth(n: number) {
    const tooth = byNumber.get(n);
    if (!tooth) return;
    setSelected(tooth);
    setCondition(tooth.condition);
    setPlanned(tooth.planned_procedure ?? "");
    setNotes(tooth.notes ?? "");
  }

  async function save() {
    if (!selected || !canUpdate) return;
    setBusy(true);
    await fetch("/api/demo/clinical", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "odontogram.update",
        patient_id: patientId,
        tooth_number: selected.tooth_number,
        condition,
        planned_procedure: planned,
        notes,
      }),
    });
    setBusy(false);
    setSelected(null);
    await load();
    onChanged();
  }

  function ToothButton({ n }: { n: number }) {
    const tooth = byNumber.get(n);
    const cond = tooth?.condition ?? "healthy";
    return (
      <button
        type="button"
        onClick={() => openTooth(n)}
        className={cn(
          "flex size-10 items-center justify-center rounded-lg border text-xs font-semibold transition-colors sm:size-11",
          cond === "healthy" && "border-[var(--border)] bg-white",
          cond === "caries" && "border-red-300 bg-red-100 text-red-800",
          cond === "restoration" && "border-sky-300 bg-sky-100 text-sky-800",
          cond === "missing" && "border-zinc-300 bg-zinc-200 text-zinc-500 line-through",
          cond === "implant" && "border-violet-300 bg-violet-100",
          cond === "crown" && "border-amber-300 bg-amber-100",
          cond === "endodontics" && "border-orange-300 bg-orange-100",
          cond === "extraction_indicated" && "border-rose-400 bg-rose-100",
          cond === "other" && "border-teal-300 bg-teal-50",
        )}
        aria-label={`Dente ${n}, ${TOOTH_CONDITION_LABELS[cond]}`}
      >
        {n}
      </button>
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/90 p-4">
        <p className="mb-3 text-center text-xs text-[var(--text-subtle)]">Superior</p>
        <div className="flex justify-center gap-1">
          {UPPER_RIGHT.map((n) => (
            <ToothButton key={n} n={n} />
          ))}
          <div className="mx-1 w-px bg-[var(--border)]" />
          {UPPER_LEFT.map((n) => (
            <ToothButton key={n} n={n} />
          ))}
        </div>
        <div className="my-4 h-px bg-[var(--border)]" />
        <div className="flex justify-center gap-1">
          {LOWER_RIGHT.map((n) => (
            <ToothButton key={n} n={n} />
          ))}
          <div className="mx-1 w-px bg-[var(--border)]" />
          {LOWER_LEFT.map((n) => (
            <ToothButton key={n} n={n} />
          ))}
        </div>
        <p className="mt-3 text-center text-xs text-[var(--text-subtle)]">Inferior</p>
      </div>

      {selected ? (
        <div className="rounded-2xl border border-[var(--border)] bg-white p-4 shadow-lg">
          <h3 className="font-[family-name:var(--font-display)] text-lg">
            Dente {selected.tooth_number}
          </h3>
          <div className="mt-3 space-y-3">
            <div>
              <Label>Condição</Label>
              <Select
                className="mt-1"
                value={condition}
                disabled={!canUpdate}
                onChange={(e) => setCondition(e.target.value as ToothCondition)}
              >
                {Object.entries(TOOTH_CONDITION_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Procedimento planejado</Label>
              <Input
                className="mt-1"
                value={planned}
                disabled={!canUpdate}
                onChange={(e) => setPlanned(e.target.value)}
                placeholder="Ex.: Restauração"
              />
            </div>
            <div>
              <Label>Observação</Label>
              <Textarea
                className="mt-1"
                value={notes}
                disabled={!canUpdate}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" onClick={() => setSelected(null)}>
                Fechar
              </Button>
              {canUpdate ? (
                <Button type="button" loading={busy} onClick={save}>
                  Salvar
                </Button>
              ) : null}
              {planned.trim() ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    const ok = window.confirm(
                      `Adicionar “${planned.trim()}” (dente ${selected.tooth_number}) a um novo plano de tratamento?\n\nVocê revisará valores antes de apresentar. Nenhum item é criado sem esta confirmação.`,
                    );
                    if (!ok) return;
                    const qs = new URLSearchParams({
                      procedure: planned.trim(),
                      tooth: String(selected.tooth_number),
                      odontogramEntryId: selected.id,
                    });
                    router.push(
                      `/app/pacientes/${patientId}/tratamentos/novo?${qs.toString()}`,
                    );
                  }}
                >
                  Adicionar ao plano de tratamento
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function FilesTab({
  patientId,
  canUpload,
}: {
  patientId: string;
  canUpload: boolean;
}) {
  const [items, setItems] = useState<ClinicalAttachment[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [type, setType] = useState<ClinicalAttachment["type"]>("clinical_photo");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch(`/api/demo/clinical?resource=attachments&patientId=${patientId}`);
    const data = await res.json();
    setItems(data.items ?? []);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId]);

  async function upload() {
    if (!file) return;
    setBusy(true);
    setError(null);
    const base64 = await fileToBase64(file);
    const res = await fetch("/api/demo/clinical", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "attachment.upload",
        patient_id: patientId,
        type,
        file_name: file.name,
        mime_type: file.type || "application/octet-stream",
        file_size: file.size,
        description,
        patient_visible: false,
        content_base64: base64,
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Não foi possível enviar o arquivo. Confira o formato e tente novamente.");
      return;
    }
    setFile(null);
    setDescription("");
    await load();
  }

  async function openAccess(id: string) {
    const res = await fetch("/api/demo/clinical", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "attachment.access", id, purpose: "view" }),
    });
    const data = await res.json();
    if (res.ok && data.signedUrl) {
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    }
  }

  return (
    <div className="space-y-4">
      {canUpload ? (
        <div className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/90 p-4">
          <h3 className="font-medium">Adicionar arquivo</h3>
          <Input
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <Select value={type} onChange={(e) => setType(e.target.value as ClinicalAttachment["type"])}>
            {Object.entries(ATTACHMENT_TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
          <Input
            placeholder="Descrição"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
          <Button type="button" loading={busy} disabled={!file} onClick={upload}>
            Enviar
          </Button>
        </div>
      ) : null}

      {items.length === 0 ? (
        <EmptyState title="Nenhum arquivo clínico" description="Anexe fotos, radiografias ou PDFs." />
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] px-3 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{item.file_name}</p>
                <p className="text-xs text-[var(--text-muted)]">
                  {ATTACHMENT_TYPE_LABELS[item.type]}
                  {item.description ? ` · ${item.description}` : ""}
                </p>
              </div>
              <Button type="button" size="sm" variant="secondary" onClick={() => openAccess(item.id)}>
                Abrir
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const base64 = result.includes(",") ? result.split(",")[1]! : result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
