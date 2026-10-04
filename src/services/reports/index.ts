import { assertPermission } from "@/lib/authz/guards";
import { can, type AuthzContext } from "@/lib/authz/can";
import { getClinic, appendAudit } from "@/lib/demo/authz-store";
import { getAgendaStore } from "@/lib/demo/agenda-store";
import { getClinicalStore } from "@/lib/demo/clinical-store";
import { getFinanceStore } from "@/lib/demo/finance-store";
import { getPatientRecord, getPatientsStore } from "@/lib/demo/patients-store";
import { getTreatmentsStore } from "@/lib/demo/treatments-store";
import {
  acceptanceRate,
  attendanceRate,
  buildComparison,
  metric,
  noShowRate,
} from "@/lib/reports/formulas";
import {
  DEFAULT_CLINIC_TZ,
  autoGranularity,
  bucketKey,
  bucketLabel,
  clinicTodayYmd,
  inPeriod,
  previousEquivalentPeriod,
  resolveReportPeriod,
} from "@/lib/reports/period";
import type { PermissionKey } from "@/lib/permissions/keys";
import type {
  FinancialMetrics,
  OverviewMetrics,
  OverdueAccountRow,
  PatientMetrics,
  PendingDecisionRow,
  PendingReturnRow,
  ReportPeriod,
  ReportPeriodPreset,
  ReportSection,
  ScheduleMetrics,
  TreatmentMetrics,
} from "@/types/reports";

export type ReportFilter = {
  preset: ReportPeriodPreset;
  customStart?: string | null;
  customEnd?: string | null;
  professionalId?: string | null;
};

function clinicTz(clinicId: string) {
  return getClinic(clinicId)?.timezone ?? DEFAULT_CLINIC_TZ;
}

function periodOf(ctx: AuthzContext, filter: ReportFilter): ReportPeriod {
  return resolveReportPeriod({
    preset: filter.preset,
    customStart: filter.customStart,
    customEnd: filter.customEnd,
    timeZone: clinicTz(ctx.clinicId),
  });
}

function requireReport(ctx: AuthzContext, key: PermissionKey = "reports.view") {
  assertPermission(ctx, key);
}

function apptsInPeriod(ctx: AuthzContext, period: ReportPeriod, professionalId?: string | null) {
  return getAgendaStore().appointments.filter((a) => {
    if (a.clinic_id !== ctx.clinicId) return false;
    if (professionalId && a.professional_id !== professionalId) return false;
    return inPeriod(a.start_at, period);
  });
}

function countStatus(
  items: ReturnType<typeof apptsInPeriod>,
  status: string,
) {
  return items.filter((a) => a.status === status).length;
}

export function getScheduleMetrics(
  ctx: AuthzContext,
  filter: ReportFilter,
): ScheduleMetrics {
  requireReport(ctx, "reports.view_schedule");
  const period = periodOf(ctx, filter);
  const prev = previousEquivalentPeriod(period);
  const cur = apptsInPeriod(ctx, period, filter.professionalId);
  const prv = apptsInPeriod(ctx, prev, filter.professionalId);

  const completed = countStatus(cur, "completed");
  const cancelled = countStatus(cur, "cancelled");
  const noShows = countStatus(cur, "no_show");
  const scheduled = cur.length;

  const prevCompleted = countStatus(prv, "completed");
  const prevCancelled = countStatus(prv, "cancelled");
  const prevNoShows = countStatus(prv, "no_show");

  const att = attendanceRate(completed, noShows);
  const nsr = noShowRate(completed, noShows);
  const prevAtt = attendanceRate(prevCompleted, prevNoShows);

  const gran = autoGranularity(period);
  const buckets = new Map<string, number>();
  for (const a of cur.filter((x) => x.status === "completed")) {
    const k = bucketKey(a.start_at, gran, period.timezone);
    buckets.set(k, (buckets.get(k) ?? 0) + 1);
  }
  const completed_over_time = [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => ({
      key,
      label: bucketLabel(key, gran),
      value,
    }));

  return {
    scheduled_in_period: metric({
      key: "scheduled",
      title: "Consultas no período",
      value: scheduled,
      format: "number",
      tooltip:
        "Consultas com horário (start_at) dentro do período, qualquer status final ou transitório.",
      comparison: buildComparison(scheduled, prv.length),
    }),
    completed: metric({
      key: "completed",
      title: "Consultas concluídas",
      value: completed,
      format: "number",
      tooltip: "status = completed e start_at no período.",
      comparison: buildComparison(completed, prevCompleted),
    }),
    cancelled: metric({
      key: "cancelled",
      title: "Cancelamentos",
      value: cancelled,
      format: "number",
      tooltip: "Consultas do período com status final cancelled.",
      comparison: buildComparison(cancelled, prevCancelled),
    }),
    no_shows: metric({
      key: "no_shows",
      title: "Faltas",
      value: noShows,
      format: "number",
      tooltip: "Consultas do período com status = no_show.",
      comparison: buildComparison(noShows, prevNoShows),
    }),
    attendance_rate: metric({
      key: "attendance_rate",
      title: "Taxa de comparecimento",
      value: att ?? 0,
      format: "percent",
      tooltip:
        "Percentual de consultas concluídas entre concluídas e faltas no período. Cancelamentos não entram.",
      comparison:
        att != null && prevAtt != null
          ? buildComparison(att, prevAtt)
          : buildComparison(att ?? 0, 0),
    }),
    no_show_rate: metric({
      key: "no_show_rate",
      title: "Taxa de falta",
      value: nsr ?? 0,
      format: "percent",
      tooltip: "faltas ÷ (concluídas + faltas) × 100. Consultas futuras não entram.",
    }),
    occupancy: {
      available: false,
      message:
        "Ocupação disponível após configurar horários de atendimento.",
      rate: null,
    },
    by_status: [
      { key: "completed", label: "Concluídas", value: completed },
      { key: "cancelled", label: "Canceladas", value: cancelled },
      { key: "no_show", label: "Faltas", value: noShows },
    ],
    completed_over_time,
  };
}

export function getPatientMetrics(
  ctx: AuthzContext,
  filter: ReportFilter,
): PatientMetrics {
  requireReport(ctx, "reports.view_patients");
  const period = periodOf(ctx, filter);
  const prev = previousEquivalentPeriod(period);
  const patients = getPatientsStore().patients.filter(
    (p) => p.clinic_id === ctx.clinicId,
  );

  const newCur = patients.filter((p) => inPeriod(p.created_at, period)).length;
  const newPrev = patients.filter((p) => inPeriod(p.created_at, prev)).length;
  const active = patients.filter((p) => p.status === "active").length;

  const referralMap = new Map<string, number>();
  for (const p of patients.filter((x) => inPeriod(x.created_at, period))) {
    const key = p.referral_source?.trim() || "Não informado";
    referralMap.set(key, (referralMap.get(key) ?? 0) + 1);
  }
  const by_referral = [...referralMap.entries()]
    .map(([label, value]) => ({
      key: label.toLowerCase().replace(/\s+/g, "_"),
      label,
      value,
    }))
    .sort((a, b) => b.value - a.value);

  const returns = getPendingReturns(ctx, { administrativeOnly: !can(ctx, "clinical_evolution.view").allowed });

  return {
    new_patients: metric({
      key: "new_patients",
      title: "Pacientes novos",
      value: newCur,
      format: "number",
      tooltip: "Pacientes com created_at no período (cadastro). Não é primeira consulta.",
      comparison: buildComparison(newCur, newPrev),
    }),
    active_registered: metric({
      key: "active_registered",
      title: "Pacientes cadastrados como ativos",
      value: active,
      format: "number",
      tooltip: "patients.status = active. Não significa pacientes atendidos.",
    }),
    by_referral,
    pending_returns: metric({
      key: "pending_returns",
      title: "Retornos pendentes",
      value: returns.length,
      format: "number",
      tooltip: can(ctx, "clinical_evolution.view").allowed
        ? "Indicação clínica de retorno sem consulta futura válida."
        : "Contatos para agendamento (sem detalhe clínico).",
      drilldown: "pending_returns",
    }),
  };
}

export function getPendingReturns(
  ctx: AuthzContext,
  options?: { administrativeOnly?: boolean },
): PendingReturnRow[] {
  requireReport(ctx, "reports.view_patients");
  const clinical = can(ctx, "clinical_evolution.view").allowed && !options?.administrativeOnly;
  const now = Date.now();
  const store = getClinicalStore();
  const agenda = getAgendaStore();

  const byPatient = new Map<
    string,
    { entry: (typeof store.entries)[number] }
  >();
  for (const entry of store.entries) {
    if (entry.clinic_id !== ctx.clinicId) continue;
    if (entry.status !== "finalized" || !entry.follow_up_required) continue;
    const prev = byPatient.get(entry.patient_id);
    const ts = +new Date(entry.signed_at ?? entry.created_at);
    if (!prev || ts > +new Date(prev.entry.signed_at ?? prev.entry.created_at)) {
      byPatient.set(entry.patient_id, { entry });
    }
  }

  const rows: PendingReturnRow[] = [];
  for (const [patientId, { entry }] of byPatient) {
    const hasFuture = agenda.appointments.some(
      (a) =>
        a.clinic_id === ctx.clinicId &&
        a.patient_id === patientId &&
        !["cancelled", "no_show", "completed"].includes(a.status) &&
        +new Date(a.start_at) >= now,
    );
    if (hasFuture) continue;
    const patient = getPatientRecord(patientId);
    const lastAppt = agenda.appointments
      .filter(
        (a) =>
          a.clinic_id === ctx.clinicId &&
          a.patient_id === patientId &&
          a.status === "completed",
      )
      .sort((a, b) => +new Date(b.start_at) - +new Date(a.start_at))[0];

    rows.push({
      patient_id: patientId,
      patient_name: patient?.full_name ?? "Paciente",
      indication: clinical ? "Retorno indicado" : null,
      indicated_at: entry.signed_at ?? entry.created_at,
      interval_days: clinical ? entry.follow_up_interval_days : null,
      last_appointment_at: lastAppt?.start_at ?? null,
      mode: clinical ? "clinical" : "administrative_contact",
    });
  }
  return rows.sort(
    (a, b) => +new Date(a.indicated_at) - +new Date(b.indicated_at),
  );
}

export function getTreatmentMetrics(
  ctx: AuthzContext,
  filter: ReportFilter,
): TreatmentMetrics {
  requireReport(ctx, "reports.view_treatments");
  const period = periodOf(ctx, filter);
  const prev = previousEquivalentPeriod(period);
  const store = getTreatmentsStore();
  const plans = store.plans.filter((p) => p.clinic_id === ctx.clinicId);

  const presented = plans.filter((p) => inPeriod(p.presented_at, period));
  const accepted = plans.filter((p) => inPeriod(p.accepted_at, period));
  const rejected = plans.filter((p) => inPeriod(p.rejected_at, period));
  const awaiting = plans.filter((p) => p.status === "presented");
  const inProgress = plans.filter((p) => p.status === "in_progress");
  const completed = plans.filter((p) => p.status === "completed");

  const prevAccepted = plans.filter((p) => inPeriod(p.accepted_at, prev)).length;
  const prevPresented = plans.filter((p) => inPeriod(p.presented_at, prev)).length;

  // Valor apresentado: snapshot da versão apresentada no período
  let presentedValue = 0;
  for (const p of presented) {
    const version = store.versions.find(
      (v) =>
        v.treatment_plan_id === p.id &&
        v.clinic_id === ctx.clinicId &&
        inPeriod(v.presented_at ?? v.created_at, period),
    );
    const snapTotal =
      typeof version?.snapshot_json?.total_cents === "number"
        ? version.snapshot_json.total_cents
        : p.total_cents;
    presentedValue += snapTotal;
  }

  let acceptedValue = 0;
  for (const p of accepted) {
    const version = store.versions.find(
      (v) =>
        v.treatment_plan_id === p.id &&
        v.version_number === (p.accepted_version ?? p.version_number),
    );
    const snapTotal =
      typeof version?.snapshot_json?.total_cents === "number"
        ? version.snapshot_json.total_cents
        : p.total_cents;
    acceptedValue += snapTotal;
  }

  const rate = acceptanceRate(accepted.length, rejected.length);
  const prevRate = acceptanceRate(
    plans.filter((p) => inPeriod(p.accepted_at, prev)).length,
    plans.filter((p) => inPeriod(p.rejected_at, prev)).length,
  );

  let receivedNote: TreatmentMetrics["received_cents_note"] = null;
  if (can(ctx, "reports.view_financial").allowed) {
    const fin = getFinancialMetrics(ctx, filter);
    receivedNote = metric({
      key: "received_vs_accepted",
      title: "Valor recebido (referência)",
      value: fin.received_cents.value,
      format: "currency_cents",
      tooltip: "Pagamentos válidos no período — diferente do valor aceito dos planos.",
    });
  }

  return {
    presented: metric({
      key: "presented",
      title: "Planos apresentados",
      value: presented.length,
      format: "number",
      tooltip: "presented_at no período.",
      comparison: buildComparison(presented.length, prevPresented),
    }),
    accepted: metric({
      key: "accepted",
      title: "Planos aceitos",
      value: accepted.length,
      format: "number",
      tooltip: "accepted_at no período.",
      comparison: buildComparison(accepted.length, prevAccepted),
    }),
    rejected: metric({
      key: "rejected",
      title: "Planos recusados",
      value: rejected.length,
      format: "number",
      tooltip: "rejected_at no período.",
    }),
    awaiting_decision: metric({
      key: "awaiting",
      title: "Aguardando decisão",
      value: awaiting.length,
      format: "number",
      tooltip: "Planos ainda no status apresentado (estoque atual).",
      drilldown: "pending_decisions",
    }),
    in_progress: metric({
      key: "in_progress",
      title: "Tratamentos em andamento",
      value: inProgress.length,
      format: "number",
      tooltip: "status = in_progress (estoque atual). Não é pagamento.",
    }),
    completed: metric({
      key: "completed_plans",
      title: "Tratamentos concluídos",
      value: completed.length,
      format: "number",
      tooltip: "status = completed (estoque atual).",
    }),
    acceptance_rate: metric({
      key: "acceptance_rate",
      title: "Taxa de aceitação",
      value: rate ?? 0,
      format: "percent",
      tooltip: "aceitos ÷ (aceitos + recusados) no período. Aguardando decisão não entra.",
      comparison:
        rate != null && prevRate != null
          ? buildComparison(rate, prevRate)
          : buildComparison(rate ?? 0, 0),
    }),
    presented_value_cents: metric({
      key: "presented_value",
      title: "Valor apresentado",
      value: presentedValue,
      format: "currency_cents",
      tooltip: "Soma da versão apresentada no período (não a versão atual alterada depois).",
    }),
    accepted_value_cents: metric({
      key: "accepted_value",
      title: "Valor aceito",
      value: acceptedValue,
      format: "currency_cents",
      tooltip: "Soma da versão efetivamente aceita. ≠ valor recebido.",
    }),
    received_cents_note: receivedNote,
    progress_distribution: [
      { key: "accepted", label: "Aceitos", value: plans.filter((p) => p.status === "accepted").length },
      { key: "in_progress", label: "Em andamento", value: inProgress.length },
      { key: "completed", label: "Concluídos", value: completed.length },
    ],
  };
}

export function getPendingTreatmentDecisions(ctx: AuthzContext): PendingDecisionRow[] {
  requireReport(ctx, "reports.view_treatments");
  return getTreatmentsStore()
    .plans
    .filter((p) => p.clinic_id === ctx.clinicId && p.status === "presented")
    .map((p) => ({
      plan_id: p.id,
      patient_id: p.patient_id,
      patient_name: getPatientRecord(p.patient_id)?.full_name ?? "Paciente",
      title: p.title,
      presented_at: p.presented_at,
      total_cents: p.total_cents,
      status: p.status,
    }))
    .sort(
      (a, b) =>
        +(new Date(a.presented_at ?? 0)) - +(new Date(b.presented_at ?? 0)),
    );
}

function installmentBalance(installmentId: string): number {
  const store = getFinanceStore();
  const inst = store.installments.find((i) => i.id === installmentId);
  if (!inst) return 0;
  const paid = store.payments
    .filter((p) => p.payment_installment_id === inst.id && !p.reversed_at)
    .reduce((s, p) => s + p.amount_cents, 0);
  return Math.max(0, inst.amount_cents - paid);
}

export function getFinancialMetrics(
  ctx: AuthzContext,
  filter: ReportFilter,
): FinancialMetrics {
  requireReport(ctx, "reports.view_financial");
  const period = periodOf(ctx, filter);
  const prev = previousEquivalentPeriod(period);
  const store = getFinanceStore();
  const today = clinicTodayYmd(clinicTz(ctx.clinicId));

  const payments = store.payments.filter(
    (p) =>
      p.clinic_id === ctx.clinicId &&
      !p.reversed_at &&
      inPeriod(p.paid_at, period),
  );
  const prevPayments = store.payments.filter(
    (p) =>
      p.clinic_id === ctx.clinicId &&
      !p.reversed_at &&
      inPeriod(p.paid_at, prev),
  );

  let received = 0;
  let expense = 0;
  const methodMap = new Map<string, number>();
  for (const p of payments) {
    const tx = store.transactions.find((t) => t.id === p.financial_transaction_id);
    if (!tx || tx.cancelled_at) continue;
    if (tx.type === "income") {
      received += p.amount_cents;
      methodMap.set(
        p.payment_method,
        (methodMap.get(p.payment_method) ?? 0) + p.amount_cents,
      );
    } else if (tx.type === "expense") {
      expense += p.amount_cents;
    }
  }

  let prevReceived = 0;
  let prevExpense = 0;
  for (const p of prevPayments) {
    const tx = store.transactions.find((t) => t.id === p.financial_transaction_id);
    if (!tx || tx.cancelled_at) continue;
    if (tx.type === "income") prevReceived += p.amount_cents;
    else if (tx.type === "expense") prevExpense += p.amount_cents;
  }

  let receivable = 0;
  let overdue = 0;
  for (const tx of store.transactions) {
    if (tx.clinic_id !== ctx.clinicId || tx.type !== "income" || tx.cancelled_at) {
      continue;
    }
    for (const inst of store.installments.filter(
      (i) => i.financial_transaction_id === tx.id,
    )) {
      const bal = installmentBalance(inst.id);
      if (bal <= 0) continue;
      receivable += bal;
      if (inst.due_date < today) overdue += bal;
    }
  }

  const overdueRows = getOverdueAccounts(ctx);

  const METHOD_LABELS: Record<string, string> = {
    pix: "PIX",
    cash: "Dinheiro",
    debit_card: "Débito",
    credit_card: "Crédito",
    bank_transfer: "Transferência",
    other: "Outros",
  };

  const gran = autoGranularity(period);
  const inflow = new Map<string, number>();
  const outflow = new Map<string, number>();
  for (const p of payments) {
    const tx = store.transactions.find((t) => t.id === p.financial_transaction_id);
    if (!tx || tx.cancelled_at) continue;
    const k = bucketKey(p.paid_at, gran, period.timezone);
    if (tx.type === "income") inflow.set(k, (inflow.get(k) ?? 0) + p.amount_cents);
    else outflow.set(k, (outflow.get(k) ?? 0) + p.amount_cents);
  }
  const keys = [...new Set([...inflow.keys(), ...outflow.keys()])].sort();
  const cashflow_over_time = keys.map((key) => ({
    key,
    label: bucketLabel(key, gran),
    value: inflow.get(key) ?? 0,
    secondary: outflow.get(key) ?? 0,
  }));

  const result = received - expense;
  const prevResult = prevReceived - prevExpense;

  return {
    received_cents: metric({
      key: "received",
      title: "Valor recebido",
      value: received,
      format: "currency_cents",
      tooltip: "Soma de payments válidos (não estornados) com paid_at no período. ≠ plano aceito.",
      comparison: buildComparison(received, prevReceived),
    }),
    receivable_cents: metric({
      key: "receivable",
      title: "A receber",
      value: receivable,
      format: "currency_cents",
      tooltip: "Saldo atual de parcelas de receita em aberto (estoque).",
    }),
    overdue_cents: metric({
      key: "overdue",
      title: "Valor vencido",
      value: overdue,
      format: "currency_cents",
      tooltip: "Saldo de parcelas com due_date < hoje (timezone da clínica).",
      drilldown: "overdue",
    }),
    expense_cents: metric({
      key: "expenses",
      title: "Despesas registradas",
      value: expense,
      format: "currency_cents",
      tooltip: "Pagamentos válidos de despesas com paid_at no período.",
      comparison: buildComparison(expense, prevExpense),
    }),
    period_result_cents: metric({
      key: "period_result",
      title: "Resultado do período",
      value: result,
      format: "currency_cents",
      tooltip:
        "Entradas (pagamentos de receita) − despesas pagas no período. Não é lucro líquido contábil.",
      comparison: buildComparison(result, prevResult),
    }),
    overdue_patients: metric({
      key: "overdue_patients",
      title: "Pacientes com parcelas vencidas",
      value: overdueRows.length,
      format: "number",
      tooltip: "Pacientes únicos com saldo vencido > 0.",
      drilldown: "overdue",
    }),
    by_method: [...methodMap.entries()].map(([key, value]) => ({
      key,
      label: METHOD_LABELS[key] ?? key,
      value,
    })),
    cashflow_over_time,
  };
}

export function getOverdueAccounts(ctx: AuthzContext): OverdueAccountRow[] {
  requireReport(ctx, "reports.view_financial");
  const store = getFinanceStore();
  const today = clinicTodayYmd(clinicTz(ctx.clinicId));
  const byPatient = new Map<string, OverdueAccountRow>();

  for (const tx of store.transactions) {
    if (tx.clinic_id !== ctx.clinicId || tx.type !== "income" || tx.cancelled_at) {
      continue;
    }
    if (!tx.patient_id) continue;
    for (const inst of store.installments.filter(
      (i) => i.financial_transaction_id === tx.id,
    )) {
      if (inst.due_date >= today) continue;
      const bal = installmentBalance(inst.id);
      if (bal <= 0) continue;
      const cur = byPatient.get(tx.patient_id) ?? {
        patient_id: tx.patient_id,
        patient_name: getPatientRecord(tx.patient_id)?.full_name ?? "Paciente",
        overdue_cents: 0,
        oldest_due_date: inst.due_date,
        overdue_installments: 0,
      };
      cur.overdue_cents += bal;
      cur.overdue_installments += 1;
      if (inst.due_date < cur.oldest_due_date) cur.oldest_due_date = inst.due_date;
      byPatient.set(tx.patient_id, cur);
    }
  }
  return [...byPatient.values()].sort((a, b) => b.overdue_cents - a.overdue_cents);
}

export function getOverviewMetrics(
  ctx: AuthzContext,
  filter: ReportFilter,
): OverviewMetrics {
  requireReport(ctx, "reports.view");
  const schedule = can(ctx, "reports.view_schedule").allowed
    ? getScheduleMetrics(ctx, filter)
    : null;
  const patients = can(ctx, "reports.view_patients").allowed
    ? getPatientMetrics(ctx, filter)
    : null;
  const treatments = can(ctx, "reports.view_treatments").allowed
    ? getTreatmentMetrics(ctx, filter)
    : null;
  const financial = can(ctx, "reports.view_financial").allowed
    ? getFinancialMetrics(ctx, filter)
    : null;

  const insights: string[] = [];
  if (patients && patients.pending_returns.value > 0) {
    insights.push(
      `${patients.pending_returns.value} paciente(s) com retorno pendente de agendamento.`,
    );
  }
  if (financial && financial.overdue_cents.value > 0) {
    insights.push(
      `Há valor vencido de parcelas em aberto neste momento.`,
    );
  }
  if (treatments && treatments.awaiting_decision.value > 0) {
    insights.push(
      `${treatments.awaiting_decision.value} plano(s) aguardando decisão do paciente.`,
    );
  }
  if (schedule && schedule.no_show_rate.value > 0) {
    insights.push(
      `A taxa de falta foi de ${schedule.no_show_rate.value}% neste período` +
        (schedule.no_show_rate.comparison?.has_baseline
          ? ` e ${schedule.no_show_rate.comparison.previous_value}% no período anterior.`
          : "."),
    );
  }

  return {
    completed_appointments: schedule?.completed ?? metric({
      key: "completed",
      title: "Consultas concluídas",
      value: 0,
      format: "number",
    }),
    new_patients: patients?.new_patients ?? metric({
      key: "new_patients",
      title: "Pacientes novos",
      value: 0,
      format: "number",
    }),
    accepted_plans: treatments?.accepted ?? metric({
      key: "accepted",
      title: "Planos aceitos",
      value: 0,
      format: "number",
    }),
    received_cents: financial?.received_cents ?? null,
    no_shows: schedule?.no_shows ?? null,
    cancellations: schedule?.cancelled ?? null,
    receivable_cents: financial?.receivable_cents ?? null,
    overdue_cents: financial?.overdue_cents ?? null,
    insights,
  };
}

export function getReportBundle(ctx: AuthzContext, filter: ReportFilter) {
  requireReport(ctx, "reports.view");
  const period = periodOf(ctx, filter);
  const clinic = getClinic(ctx.clinicId);
  return {
    period,
    clinicName: clinic?.name ?? "Clínica",
    sections: {
      overview: getOverviewMetrics(ctx, filter),
      schedule: can(ctx, "reports.view_schedule").allowed
        ? getScheduleMetrics(ctx, filter)
        : null,
      patients: can(ctx, "reports.view_patients").allowed
        ? getPatientMetrics(ctx, filter)
        : null,
      treatments: can(ctx, "reports.view_treatments").allowed
        ? getTreatmentMetrics(ctx, filter)
        : null,
      financial: can(ctx, "reports.view_financial").allowed
        ? getFinancialMetrics(ctx, filter)
        : null,
    },
    capabilities: {
      schedule: can(ctx, "reports.view_schedule").allowed,
      patients: can(ctx, "reports.view_patients").allowed,
      treatments: can(ctx, "reports.view_treatments").allowed,
      financial: can(ctx, "reports.view_financial").allowed,
      export: can(ctx, "reports.export").allowed,
      clinicalReturns: can(ctx, "clinical_evolution.view").allowed,
    },
  };
}

export async function exportReport(
  ctx: AuthzContext,
  filter: ReportFilter,
  format: "pdf" | "xlsx" | "csv",
  section: ReportSection | "all" = "all",
) {
  assertPermission(ctx, "reports.export");

  if (
    section === "operational" ||
    section === "procedures" ||
    section === "materials" ||
    section === "patient_ops"
  ) {
    const { getOperationalBundle } = await import(
      "@/services/reports/operational"
    );
    const {
      buildOperationalCsv,
      buildOperationalPdf,
      buildOperationalXlsx,
    } = await import("@/lib/reports/operational-export");
    const op = getOperationalBundle(ctx, filter);

    appendAudit({
      clinic_id: ctx.clinicId,
      actor_user_id: ctx.userId,
      action: "report.exported",
      target_type: "report",
      target_id: section,
      metadata: {
        format,
        section,
        period_start: op.period.start,
        period_end: op.period.end,
        period_label: op.period.label,
      },
    });

    if (format === "csv") {
      return {
        filename: `sorria-relatorio-operacional.csv`,
        contentType: "text/csv; charset=utf-8",
        body: buildOperationalCsv(op),
      };
    }
    if (format === "xlsx") {
      return {
        filename: `sorria-relatorio-operacional.xlsx`,
        contentType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        body: await buildOperationalXlsx(op),
      };
    }
    return {
      filename: `sorria-relatorio-operacional.pdf`,
      contentType: "application/pdf",
      body: await buildOperationalPdf(op),
    };
  }

  const bundle = getReportBundle(ctx, filter);
  const { buildReportCsv, buildReportPdf, buildReportXlsx } = await import(
    "@/lib/reports/export"
  );

  appendAudit({
    clinic_id: ctx.clinicId,
    actor_user_id: ctx.userId,
    action: "report.exported",
    target_type: "report",
    target_id: section,
    metadata: {
      format,
      section,
      period_start: bundle.period.start,
      period_end: bundle.period.end,
      period_label: bundle.period.label,
    },
  });

  if (format === "csv") {
    return {
      filename: `sorria-relatorio-${section}.csv`,
      contentType: "text/csv; charset=utf-8",
      body: buildReportCsv(bundle, section),
    };
  }
  if (format === "xlsx") {
    const buf = await buildReportXlsx(bundle, section);
    return {
      filename: `sorria-relatorio.xlsx`,
      contentType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      body: buf,
    };
  }
  const pdf = await buildReportPdf(bundle, section);
  return {
    filename: `sorria-relatorio.pdf`,
    contentType: "application/pdf",
    body: pdf,
  };
}

export { resolveReportPeriod, periodOf };
