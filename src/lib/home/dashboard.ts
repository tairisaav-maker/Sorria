import {
  addDays,
  endOfDay,
  format,
  formatDistanceToNowStrict,
  startOfDay,
  startOfWeek,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import type { AuthzContext } from "@/lib/authz/can";
import { can } from "@/lib/authz/can";
import type {
  HomeAppointment,
  HomeKpi,
  HomeRequest,
  HomeWeekPoint,
} from "@/lib/mock/home";
import { PERIOD_LABELS } from "@/types/agenda";
import {
  countTodayAppointments,
  listAppointments,
} from "@/services/appointments";
import {
  countPendingRequests,
  listAppointmentRequests,
} from "@/services/appointment-requests";
import { countPendingFollowUps } from "@/services/clinical";
import { listPatients } from "@/services/patients";
import { getHomeFinanceKpis } from "@/services/finance";
import { getPortalStore } from "@/lib/demo/portal-store";
import { getPlannedProceduresStore } from "@/lib/demo/planned-procedures-store";
import { getPerformedStore } from "@/lib/demo/performed-procedures-store";
import { countPlansByStatus } from "@/services/treatments";
import { formatBRL } from "@/lib/money";

function mapHomeStatus(
  status: string,
): HomeAppointment["status"] {
  if (status === "completed") return "completed";
  if (status === "in_progress") return "in_progress";
  if (status === "confirmed" || status === "arrived") return "confirmed";
  return "waiting";
}

export function buildHomeDashboard(ctx: AuthzContext) {
  const canAgenda = can(ctx, "appointments.view").allowed;
  const canRequests = can(ctx, "appointment_requests.view").allowed;
  const canPatients = can(ctx, "patients.demographics.view").allowed;
  const canClinical = can(ctx, "clinical_evolution.view").allowed;
  const canTreatments =
    can(ctx, "treatments.view").allowed ||
    can(ctx, "treatments.administrative_view").allowed;

  const todayStats = canAgenda
    ? countTodayAppointments(ctx)
    : { total: 0, confirmed: 0 };
  const pendingRequests = canRequests ? countPendingRequests(ctx) : 0;
  const activePatients = canPatients
    ? listPatients(ctx, { status: "active", page: 1, pageSize: 1 }).total
    : 0;

  const pendingFollowUps = canClinical ? countPendingFollowUps(ctx) : 0;
  const presentedPlans = canTreatments
    ? countPlansByStatus(ctx, "presented")
    : 0;
  const inProgressPlans = canTreatments
    ? countPlansByStatus(ctx, "in_progress")
    : 0;
  const pendingRecordCopies = canPatients
    ? getPortalStore().copyRequests.filter(
        (r) =>
          r.clinic_id === ctx.clinicId &&
          (r.status === "requested" || r.status === "preparing"),
      ).length
    : 0;

  const pendenciasHint = canClinical
    ? [
        pendingRequests > 0 ? `${pendingRequests} solicitações` : null,
        pendingFollowUps > 0 ? `${pendingFollowUps} retornos` : null,
        presentedPlans > 0 ? `${presentedPlans} planos` : null,
        pendingRecordCopies > 0 ? `${pendingRecordCopies} cópias` : null,
      ]
        .filter(Boolean)
        .join(" · ") || "nada pendente"
    : [
        pendingRequests > 0 ? "solicitações aguardando" : null,
        presentedPlans > 0 ? `${presentedPlans} planos` : null,
        pendingRecordCopies > 0 ? `${pendingRecordCopies} cópias` : null,
      ]
        .filter(Boolean)
        .join(" · ") || "agenda";

  const kpis: HomeKpi[] = [
    {
      id: "today",
      label: "Atendimentos hoje",
      value: String(todayStats.total),
      hint:
        todayStats.confirmed > 0
          ? `${todayStats.confirmed} confirmados`
          : "agenda do dia",
    },
    {
      id: "plans-decision",
      label: "Planos aguardando decisão",
      value: String(presentedPlans),
      hint:
        presentedPlans > 0
          ? `${presentedPlans} apresentados aguardando resposta`
          : "nenhum aguardando",
    },
    {
      id: "treatments-progress",
      label: "Tratamentos em andamento",
      value: String(inProgressPlans),
      hint: "execução clínica · ≠ pagamento",
    },
    {
      id: "requests",
      label: "Pendências",
      // Secretária: solicitações + planos admin (sem retorno clínico)
      value: String(
        (canClinical ? pendingRequests + pendingFollowUps : pendingRequests) +
          presentedPlans +
          pendingRecordCopies,
      ),
      hint: pendenciasHint,
    },
  ];

  // Mantém pacientes ativos quando não há visão de tratamentos
  if (!canTreatments) {
    kpis[1] = {
      id: "confirmed",
      label: "Confirmados",
      value: String(todayStats.confirmed),
      hint: "presença confirmada",
    };
    kpis[2] = {
      id: "patients",
      label: "Pacientes ativos",
      value: String(activePatients),
      hint: "cadastro administrativo",
    };
  }

  // KPIs financeiros somente com permissão administrativa (sem vazamento)
  const financeKpis = getHomeFinanceKpis(ctx);
  if (financeKpis) {
    kpis.push(
      {
        id: "finance-received",
        label: "Recebido no mês",
        value: formatBRL(financeKpis.received_cents),
        hint: "pagamentos efetivos",
      },
      {
        id: "finance-receivable",
        label: "A receber",
        value: formatBRL(financeKpis.receivable_cents),
        hint: "saldo pendente",
      },
      {
        id: "finance-overdue",
        label: "Vencido",
        value: formatBRL(financeKpis.overdue_cents),
        hint: "parcelas em atraso",
      },
    );
  }

  const today = new Date();
  const todayItems: HomeAppointment[] = canAgenda
    ? listAppointments(ctx, {
        from: startOfDay(today),
        to: endOfDay(today),
      })
        .filter((a) => a.status !== "cancelled" && a.status !== "no_show")
        .map((a) => {
          const hasPlanned = getPlannedProceduresStore().planned.some(
            (p) =>
              p.clinic_id === ctx.clinicId &&
              p.appointment_id === a.id &&
              !p.cancelled_at,
          );
          const hasPerformed = getPerformedStore().performedProcedures.some(
            (p) =>
              p.clinic_id === ctx.clinicId &&
              p.appointment_id === a.id &&
              p.status !== "cancelled",
          );
          return {
            id: a.id,
            time: format(new Date(a.start_at), "HH:mm"),
            patientName: a.patient_name,
            procedure: a.reason || "Consulta",
            status: mapHomeStatus(a.status),
            rawStatus: a.status,
            missingProcedures: !hasPlanned && !hasPerformed,
          };
        })
    : [];

  const requestItems: HomeRequest[] = canRequests
    ? [
        ...listAppointmentRequests(ctx, "pending").slice(0, 5).map((r) => {
          const dateLabel = r.requested_date
            ? format(
                new Date(`${r.requested_date}T12:00:00`),
                "dd/MM",
                { locale: ptBR },
              )
            : "sem data";
          return {
            id: r.id,
            patientName: r.patient_name,
            preferredWindow: `${dateLabel} — ${PERIOD_LABELS[r.preferred_period]}`,
            createdLabel: formatDistanceToNowStrict(new Date(r.created_at), {
              addSuffix: true,
              locale: ptBR,
            }),
            status: "pending" as const,
          };
        }),
        ...listAppointmentRequests(ctx, "proposed").slice(0, 3).map((r) => {
          const dateLabel = r.requested_date
            ? format(
                new Date(`${r.requested_date}T12:00:00`),
                "dd/MM",
                { locale: ptBR },
              )
            : "sem data";
          return {
            id: r.id,
            patientName: r.patient_name,
            preferredWindow: `${dateLabel} — ${PERIOD_LABELS[r.preferred_period]}`,
            createdLabel: formatDistanceToNowStrict(new Date(r.created_at), {
              addSuffix: true,
              locale: ptBR,
            }),
            status: "proposed" as const,
          };
        }),
      ].slice(0, 6)
    : [];

  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const weekLabels = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
  const weekSeries: HomeWeekPoint[] = canAgenda
    ? weekLabels.map((day, index) => {
        const dayDate = addDays(weekStart, index);
        const count = listAppointments(ctx, {
          from: startOfDay(dayDate),
          to: endOfDay(dayDate),
        }).filter((a) => a.status !== "cancelled").length;
        return { day, appointments: count };
      })
    : weekLabels.map((day) => ({ day, appointments: 0 }));

  return {
    kpis,
    todayItems,
    requestItems,
    weekSeries,
  };
}
