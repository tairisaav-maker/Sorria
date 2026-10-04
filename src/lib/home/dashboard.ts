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
import { listPatients } from "@/services/patients";

function mapHomeStatus(
  status: string,
): HomeAppointment["status"] {
  if (status === "in_progress") return "in_progress";
  if (status === "confirmed" || status === "arrived") return "confirmed";
  return "waiting";
}

export function buildHomeDashboard(ctx: AuthzContext) {
  const canAgenda = can(ctx, "appointments.view").allowed;
  const canRequests = can(ctx, "appointment_requests.view").allowed;
  const canPatients = can(ctx, "patients.demographics.view").allowed;

  const todayStats = canAgenda
    ? countTodayAppointments(ctx)
    : { total: 0, confirmed: 0 };
  const pendingRequests = canRequests ? countPendingRequests(ctx) : 0;
  const activePatients = canPatients
    ? listPatients(ctx, { status: "active", page: 1, pageSize: 1 }).total
    : 0;

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
      id: "confirmed",
      label: "Confirmados",
      value: String(todayStats.confirmed),
      hint: "presença confirmada",
    },
    {
      id: "requests",
      label: "Pendências",
      value: String(pendingRequests),
      hint: "solicitações aguardando",
    },
    {
      id: "patients",
      label: "Pacientes ativos",
      value: String(activePatients),
      hint: "cadastro administrativo",
    },
  ];

  const today = new Date();
  const todayItems: HomeAppointment[] = canAgenda
    ? listAppointments(ctx, {
        from: startOfDay(today),
        to: endOfDay(today),
      })
        .filter((a) => a.status !== "cancelled")
        .map((a) => ({
          id: a.id,
          time: format(new Date(a.start_at), "HH:mm"),
          patientName: a.patient_name,
          procedure: a.reason || "Consulta",
          status: mapHomeStatus(a.status),
        }))
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
