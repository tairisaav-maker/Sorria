import { z } from "zod";
import { can, type AuthzContext } from "@/lib/authz/can";
import { assertPermission } from "@/lib/authz/guards";
import { getProfile } from "@/lib/demo/authz-store";
import { getAgendaStore } from "@/lib/demo/agenda-store";
import { buildDaySlots, getClinicHours } from "@/lib/agenda/hours";
import { dayRange, formatLabel } from "@/lib/assistant/dates";
import { DEFAULT_CLINIC_TZ, clinicTodayYmd, zonedStartOfDay } from "@/lib/reports/period";
import { formatBRL } from "@/lib/money";
import type { PermissionKey } from "@/lib/permissions/keys";
import type {
  AssistantActionPreview,
  AssistantNavLink,
  AssistantResultCard,
  AssistantRiskLevel,
} from "@/types/assistant";
import { listAppointments } from "@/services/appointments/queries";
import { checkAvailability } from "@/services/appointments/availability";
import { listAppointmentRequests } from "@/services/appointment-requests";
import { searchPatients, listPatients } from "@/services/patients/queries";
import { getPatientRecord } from "@/lib/demo/patients-store";
import {
  getFinancialMetrics,
  getOverdueAccounts,
  getPendingReturns,
  getPendingTreatmentDecisions,
  getTreatmentMetrics,
} from "@/services/reports";
import { getTreatmentsStore } from "@/lib/demo/treatments-store";
import { getFinanceStore } from "@/lib/demo/finance-store";
import { OWNER_A_ID } from "@/lib/demo/authz-store";

export type ToolResult = {
  facts: string[];
  cards?: AssistantResultCard[];
  links?: AssistantNavLink[];
  data?: unknown;
  /** When set, orchestrator creates action plan */
  action_plan?: {
    action_type: string;
    payload: Record<string, unknown>;
    preview: AssistantActionPreview;
  };
  ambiguity?: Array<{ id: string; label: string }>;
};

export type AssistantTool = {
  name: string;
  description: string;
  riskLevel: AssistantRiskLevel;
  requiresConfirmation: boolean;
  domainPermissions: PermissionKey[];
  inputSchema: z.ZodType<Record<string, unknown>>;
  handler: (ctx: AuthzContext, input: Record<string, unknown>) => ToolResult;
};

function requireDomains(ctx: AuthzContext, perms: PermissionKey[]) {
  for (const p of perms) {
    if (!can(ctx, p).allowed) {
      throw new Error("AUTHORIZATION_DENIED");
    }
  }
}

function apptLine(a: {
  start_at: string;
  patient_name?: string;
  status: string;
}) {
  const time = new Date(a.start_at).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: DEFAULT_CLINIC_TZ,
  });
  return `• ${time} — ${a.patient_name ?? "Paciente"} (${statusLabel(a.status)})`;
}

function statusLabel(s: string) {
  const map: Record<string, string> = {
    scheduled: "agendada",
    confirmed: "confirmada",
    arrived: "chegou",
    in_progress: "em atendimento",
    completed: "concluída",
    cancelled: "cancelada",
    no_show: "falta",
  };
  return map[s] ?? s;
}

export const ASSISTANT_TOOLS: AssistantTool[] = [
  {
    name: "getScheduleForDay",
    description: "Agenda de um dia (start_at no dia).",
    riskLevel: "read",
    requiresConfirmation: false,
    domainPermissions: ["appointments.view"],
    inputSchema: z.object({
      date_ymd: z.string().optional(),
      date_label: z.string().optional(),
    }),
    handler(ctx, input) {
      requireDomains(ctx, ["appointments.view"]);
      const ymd = String(input.date_ymd ?? clinicTodayYmd(DEFAULT_CLINIC_TZ));
      const range = dayRange(ymd);
      const items = listAppointments(ctx, {
        from: new Date(range.start),
        to: new Date(range.end),
      }).filter((a) => a.status !== "cancelled");
      const label = String(input.date_label ?? formatLabel(ymd));
      const facts = [
        `${items.length} consulta(s) em ${label}.`,
        ...items.slice(0, 12).map(apptLine),
      ];
      return {
        facts,
        cards: [
          { title: "Consultas", value: String(items.length), hint: label },
          {
            title: "Confirmadas",
            value: String(items.filter((a) => a.status === "confirmed").length),
          },
        ],
        links: [{ label: "Abrir Agenda", href: "/app/agenda" }],
        data: { count: items.length },
      };
    },
  },
  {
    name: "getUnconfirmedAppointments",
    description: "Consultas scheduled (não confirmadas) em um dia.",
    riskLevel: "read",
    requiresConfirmation: false,
    domainPermissions: ["appointments.view"],
    inputSchema: z.object({
      date_ymd: z.string().optional(),
      date_label: z.string().optional(),
    }),
    handler(ctx, input) {
      requireDomains(ctx, ["appointments.view"]);
      const ymd =
        String(input.date_ymd ?? "") ||
        (() => {
          const t = clinicTodayYmd(DEFAULT_CLINIC_TZ);
          // default amanhã if not specified — caller usually sets
          return t;
        })();
      const range = dayRange(ymd);
      const items = listAppointments(ctx, {
        from: new Date(range.start),
        to: new Date(range.end),
      }).filter((a) => a.status === "scheduled");
      const label = String(input.date_label ?? formatLabel(ymd));
      return {
        facts: [
          items.length === 0
            ? `Nenhum paciente aguardando confirmação em ${label}.`
            : `${items.length} paciente(s) ainda não confirmaram em ${label}.`,
          ...items.map(apptLine),
        ],
        cards: [
          {
            title: "Aguardando confirmação",
            value: String(items.length),
            hint: label,
          },
        ],
        links: [{ label: "Ver agenda", href: "/app/agenda" }],
      };
    },
  },
  {
    name: "getNoShows",
    description: "Faltas no período.",
    riskLevel: "read",
    requiresConfirmation: false,
    domainPermissions: ["appointments.view"],
    inputSchema: z.object({
      date_ymd: z.string().optional(),
      week: z.boolean().optional(),
    }),
    handler(ctx, input) {
      requireDomains(ctx, ["appointments.view"]);
      const today = clinicTodayYmd(DEFAULT_CLINIC_TZ);
      let startYmd = String(input.date_ymd ?? today);
      let endYmd = startYmd;
      if (input.week) {
        const [y, m, d] = today.split("-").map(Number);
        const dt = new Date(Date.UTC(y!, m! - 1, d! - 6));
        startYmd = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
        endYmd = today;
      }
      const from = zonedStartOfDay(startYmd, DEFAULT_CLINIC_TZ);
      const to = zonedStartOfDay(
        (() => {
          const [y, m, d] = endYmd.split("-").map(Number);
          const dt = new Date(Date.UTC(y!, m! - 1, d! + 1));
          return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
        })(),
        DEFAULT_CLINIC_TZ,
      );
      const items = listAppointments(ctx, { from, to }).filter(
        (a) => a.status === "no_show",
      );
      return {
        facts: [
          `${items.length} falta(s) no período.`,
          ...items.slice(0, 10).map(apptLine),
        ],
        links: [{ label: "Abrir Agenda", href: "/app/agenda" }],
      };
    },
  },
  {
    name: "findAvailableWindows",
    description: "Janelas livres com base na agenda real.",
    riskLevel: "read",
    requiresConfirmation: false,
    domainPermissions: ["appointments.view"],
    inputSchema: z.object({
      date_ymd: z.string().optional(),
      date_label: z.string().optional(),
      afternoon: z.boolean().optional(),
      morning: z.boolean().optional(),
      professional_id: z.string().optional(),
    }),
    handler(ctx, input) {
      requireDomains(ctx, ["appointments.view"]);
      const ymd = String(input.date_ymd ?? clinicTodayYmd(DEFAULT_CLINIC_TZ));
      const professionalId = String(input.professional_id ?? ctx.userId);
      const hours = getClinicHours();
      const dayStart = zonedStartOfDay(ymd, DEFAULT_CLINIC_TZ);
      const slots = buildDaySlots(dayStart);
      const windows: string[] = [];
      for (const slot of slots) {
        const hour = Number(
          new Intl.DateTimeFormat("en-US", {
            timeZone: DEFAULT_CLINIC_TZ,
            hour: "numeric",
            hourCycle: "h23",
          }).format(slot),
        );
        if (input.afternoon && hour < 12) continue;
        if (input.morning && hour >= 12) continue;
        const end = new Date(slot.getTime() + hours.slotMinutes * 60_000);
        const avail = checkAvailability({
          clinicId: ctx.clinicId,
          professionalId,
          startAt: slot.toISOString(),
          endAt: end.toISOString(),
        });
        if (avail.available) {
          const t = slot.toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
            timeZone: DEFAULT_CLINIC_TZ,
          });
          const t2 = end.toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
            timeZone: DEFAULT_CLINIC_TZ,
          });
          windows.push(`• ${t}–${t2}`);
        }
      }
      const label = String(input.date_label ?? formatLabel(ymd));
      return {
        facts: [
          windows.length
            ? `Em ${label}, encontrei ${windows.length} janela(s) disponível(is):`
            : `Não encontrei janelas livres em ${label} no período solicitado.`,
          ...windows.slice(0, 8),
        ],
        links: [{ label: "Abrir Agenda", href: "/app/agenda" }],
      };
    },
  },
  {
    name: "getPendingRequests",
    description: "Solicitações pendentes.",
    riskLevel: "read",
    requiresConfirmation: false,
    domainPermissions: ["appointment_requests.view"],
    inputSchema: z.object({}),
    handler(ctx) {
      requireDomains(ctx, ["appointment_requests.view"]);
      const items = listAppointmentRequests(ctx, "pending");
      return {
        facts: [
          items.length
            ? `${items.length} solicitação(ões) aguardam análise.`
            : "Não há solicitações pendentes.",
          ...items.slice(0, 8).map(
            (r) =>
              `• ${r.patient_name} — ${r.reason} (${r.preferred_period})`,
          ),
        ],
        links: [{ label: "Ver solicitações", href: "/app/solicitacoes" }],
      };
    },
  },
  {
    name: "getProposedRequests",
    description: "Solicitações com horário proposto.",
    riskLevel: "read",
    requiresConfirmation: false,
    domainPermissions: ["appointment_requests.view"],
    inputSchema: z.object({}),
    handler(ctx) {
      requireDomains(ctx, ["appointment_requests.view"]);
      const items = listAppointmentRequests(ctx, "proposed");
      return {
        facts: [
          items.length
            ? `${items.length} solicitação(ões) com horário proposto aguardando resposta.`
            : "Nenhuma proposta aguardando resposta.",
          ...items.slice(0, 8).map((r) => `• ${r.patient_name} — ${r.reason}`),
        ],
        links: [{ label: "Ver solicitações", href: "/app/solicitacoes" }],
      };
    },
  },
  {
    name: "findPatients",
    description: "Busca administrativa de pacientes.",
    riskLevel: "read",
    requiresConfirmation: false,
    domainPermissions: ["patients.demographics.view"],
    inputSchema: z.object({ query: z.string() }),
    handler(ctx, input) {
      requireDomains(ctx, ["patients.demographics.view"]);
      const q = String(input.query ?? "").trim();
      const { patients: results, ambiguous } = resolvePatients(ctx, q);
      if (results.length === 0) {
        return { facts: [`Não encontrei paciente com “${q}”.`] };
      }
      if (ambiguous) {
        return {
          facts: [
            `Encontrei ${results.length} pacientes. Selecione qual deseja:`,
            ...results.map((p) => {
              const phone = p.phone?.replace(/\D/g, "") ?? "";
              const tail = phone.slice(-4) || "????";
              return `• ${p.full_name} — final ${tail}`;
            }),
          ],
          ambiguity: results.map((p) => ({
            id: p.id,
            label: p.full_name,
          })),
          links: [{ label: "Ver pacientes", href: "/app/pacientes" }],
        };
      }
      const p = results[0]!;
      const phoneOk = can(ctx, "patients.contact.view").allowed;
      return {
        facts: [
          `Paciente: ${p.full_name}`,
          phoneOk && p.phone ? `Telefone: ${p.phone}` : "Telefone: (sem permissão ou não informado)",
        ],
        links: [
          { label: "Ver paciente", href: `/app/pacientes/${p.id}` },
        ],
        data: { patient_id: p.id, patient_name: p.full_name },
      };
    },
  },
  {
    name: "getPatientsPendingReturnScheduling",
    description: "Retornos pendentes (serviço derivado).",
    riskLevel: "read",
    requiresConfirmation: false,
    domainPermissions: ["reports.view_patients"],
    inputSchema: z.object({}),
    handler(ctx) {
      // Prefer reports permission; fall back denial
      if (!can(ctx, "reports.view_patients").allowed && !can(ctx, "patients.demographics.view").allowed) {
        throw new Error("AUTHORIZATION_DENIED");
      }
      if (can(ctx, "reports.view_patients").allowed) {
        assertPermission(ctx, "reports.view_patients");
      }
      const rows = getPendingReturns(ctx);
      return {
        facts: [
          rows.length
            ? `${rows.length} paciente(s) precisam de contato para retorno.`
            : "Nenhum retorno pendente de agendamento.",
          ...rows.slice(0, 10).map((r) => {
            if (r.mode === "clinical") {
              return `• ${r.patient_name} — retorno indicado`;
            }
            return `• ${r.patient_name} — contato para agendamento`;
          }),
        ],
        links: [{ label: "Ver Relatórios", href: "/app/relatorios" }],
      };
    },
  },
  {
    name: "getNewPatients",
    description: "Pacientes novos do mês.",
    riskLevel: "read",
    requiresConfirmation: false,
    domainPermissions: ["patients.demographics.view"],
    inputSchema: z.object({}),
    handler(ctx) {
      requireDomains(ctx, ["patients.demographics.view"]);
      const list = listPatients(ctx, { status: "active", page: 1, pageSize: 100 });
      const start = zonedStartOfDay(
        clinicTodayYmd(DEFAULT_CLINIC_TZ).slice(0, 8) + "01",
        DEFAULT_CLINIC_TZ,
      );
      const items = list.items.filter((p) => +new Date(p.created_at) >= +start);
      return {
        facts: [
          `${items.length} paciente(s) novo(s) neste mês.`,
          ...items.slice(0, 10).map((p) => `• ${p.full_name}`),
        ],
        links: [{ label: "Ver pacientes", href: "/app/pacientes" }],
      };
    },
  },
  {
    name: "getPendingTreatmentDecisions",
    description: "Planos aguardando decisão.",
    riskLevel: "read",
    requiresConfirmation: false,
    domainPermissions: ["treatments.administrative_view"],
    inputSchema: z.object({}),
    handler(ctx) {
      const ok =
        can(ctx, "treatments.administrative_view").allowed ||
        can(ctx, "treatments.view").allowed ||
        can(ctx, "reports.view_treatments").allowed;
      if (!ok) throw new Error("AUTHORIZATION_DENIED");
      const rows = can(ctx, "reports.view_treatments").allowed
        ? getPendingTreatmentDecisions(ctx)
        : getTreatmentsStore()
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
            }));
      return {
        facts: [
          rows.length
            ? `${rows.length} plano(s) aguardando decisão.`
            : "Nenhum plano aguardando decisão.",
          ...rows.slice(0, 8).map(
            (r) => `• ${r.patient_name} — ${r.title} (${formatBRL(r.total_cents)})`,
          ),
        ],
      };
    },
  },
  {
    name: "getTreatmentsInProgress",
    description: "Tratamentos em andamento.",
    riskLevel: "read",
    requiresConfirmation: false,
    domainPermissions: ["treatments.administrative_view"],
    inputSchema: z.object({}),
    handler(ctx) {
      const ok =
        can(ctx, "treatments.administrative_view").allowed ||
        can(ctx, "treatments.view").allowed;
      if (!ok) throw new Error("AUTHORIZATION_DENIED");
      if (can(ctx, "reports.view_treatments").allowed) {
        const m = getTreatmentMetrics(ctx, { preset: "30d" });
        return {
          facts: [
            `${m.in_progress.value} tratamento(s) em andamento.`,
            "Progresso clínico ≠ pagamento.",
          ],
        };
      }
      const n = getTreatmentsStore().plans.filter(
        (p) => p.clinic_id === ctx.clinicId && p.status === "in_progress",
      ).length;
      return { facts: [`${n} tratamento(s) em andamento.`] };
    },
  },
  {
    name: "getFinancialSummary",
    description: "Resumo financeiro (mesmas métricas da Fase 8).",
    riskLevel: "read",
    requiresConfirmation: false,
    domainPermissions: ["reports.view_financial"],
    inputSchema: z.object({
      period_hint: z.string().optional(),
    }),
    handler(ctx, input) {
      if (
        !can(ctx, "reports.view_financial").allowed &&
        !can(ctx, "finance.view_administrative").allowed
      ) {
        throw new Error("AUTHORIZATION_DENIED");
      }
      if (can(ctx, "reports.view_financial").allowed) {
        assertPermission(ctx, "reports.view_financial");
      } else {
        assertPermission(ctx, "finance.view_administrative");
      }
      const hint = String(input.period_hint ?? "month");
      const preset =
        hint === "today" || hint === "week" ? "7d" : hint === "month" ? "month" : "30d";
      const m = getFinancialMetrics(ctx, { preset: preset as "7d" | "month" | "30d" });
      return {
        facts: [
          `Valor recebido (${m.received_cents.title}): ${formatBRL(m.received_cents.value)}`,
          `A receber: ${formatBRL(m.receivable_cents.value)}`,
          `Valor vencido: ${formatBRL(m.overdue_cents.value)}`,
          `Resultado do período: ${formatBRL(m.period_result_cents.value)} (não é lucro líquido).`,
        ],
        cards: [
          {
            title: "Valor recebido",
            value: formatBRL(m.received_cents.value),
          },
          {
            title: "Valor vencido",
            value: formatBRL(m.overdue_cents.value),
          },
        ],
        links: [{ label: "Abrir Financeiro", href: "/app/financeiro" }],
        data: { received_cents: m.received_cents.value },
      };
    },
  },
  {
    name: "getOverdueAccounts",
    description: "Pacientes com parcelas vencidas.",
    riskLevel: "read",
    requiresConfirmation: false,
    domainPermissions: ["reports.view_financial"],
    inputSchema: z.object({}),
    handler(ctx) {
      if (
        !can(ctx, "reports.view_financial").allowed &&
        !can(ctx, "finance.view_administrative").allowed
      ) {
        throw new Error("AUTHORIZATION_DENIED");
      }
      const rows = getOverdueAccounts(ctx);
      return {
        facts: [
          rows.length
            ? `${rows.length} paciente(s) com parcelas vencidas.`
            : "Nenhum paciente com valor vencido.",
          ...rows.slice(0, 8).map(
            (r) =>
              `• ${r.patient_name} — ${formatBRL(r.overdue_cents)} (venc. ${r.oldest_due_date.split("-").reverse().join("/")})`,
          ),
        ],
        links: [{ label: "Abrir Financeiro", href: "/app/financeiro" }],
      };
    },
  },
  {
    name: "getAttentionSummary",
    description: "Pendências do dia respeitando permissões.",
    riskLevel: "read",
    requiresConfirmation: false,
    domainPermissions: ["dashboard.view"],
    inputSchema: z.object({}),
    handler(ctx) {
      const facts: string[] = [];
      const today = clinicTodayYmd(DEFAULT_CLINIC_TZ);
      const range = dayRange(today);

      if (can(ctx, "appointments.view").allowed) {
        const items = listAppointments(ctx, {
          from: new Date(range.start),
          to: new Date(range.end),
        }).filter((a) => a.status !== "cancelled");
        const unconfirmed = items.filter((a) => a.status === "scheduled");
        facts.push(`Hoje você tem ${items.length} consulta(s).`);
        if (unconfirmed.length) {
          facts.push(`${unconfirmed.length} ainda não foram confirmadas.`);
        }
      }
      if (can(ctx, "appointment_requests.view").allowed) {
        const pending = listAppointmentRequests(ctx, "pending");
        if (pending.length) {
          facts.push(`Há ${pending.length} nova(s) solicitação(ões) de horário.`);
        }
      }
      if (can(ctx, "reports.view_patients").allowed) {
        const returns = getPendingReturns(ctx);
        if (returns.length) {
          facts.push(
            `${returns.length} paciente(s) estão aguardando contato para retorno.`,
          );
        }
      }
      if (
        can(ctx, "treatments.administrative_view").allowed ||
        can(ctx, "treatments.view").allowed ||
        can(ctx, "reports.view_treatments").allowed
      ) {
        try {
          const decisions = can(ctx, "reports.view_treatments").allowed
            ? getPendingTreatmentDecisions(ctx)
            : [];
          if (decisions.length) {
            facts.push(
              `${decisions.length} plano(s) apresentados aguardam decisão.`,
            );
          }
        } catch {
          /* ignore */
        }
      }
      if (
        can(ctx, "reports.view_financial").allowed ||
        can(ctx, "finance.view_administrative").allowed
      ) {
        try {
          const fin = getFinancialMetrics(ctx, { preset: "30d" });
          if (fin.overdue_cents.value > 0) {
            facts.push(
              `Há ${formatBRL(fin.overdue_cents.value)} em parcelas vencidas.`,
            );
          }
        } catch {
          /* ignore */
        }
      }
      if (facts.length === 0) {
        facts.push("Não há pendências visíveis com suas permissões atuais.");
      }
      return {
        facts,
        links: [{ label: "Ir para Início", href: "/app/home" }],
      };
    },
  },
  {
    name: "prepareMessageDraft",
    description: "Rascunho de mensagem — não envia.",
    riskLevel: "low_write",
    requiresConfirmation: false,
    domainPermissions: ["patients.contact.view"],
    inputSchema: z.object({ raw: z.string().optional() }),
    handler(ctx, input) {
      void ctx;
      const raw = String(input.raw ?? "");
      const nameMatch = raw.match(/Mariana|paciente (\w+)/i);
      const name = nameMatch?.[0] ?? "paciente";
      return {
        facts: [
          "Rascunho — não enviado",
          "",
          `Olá, ${name}! Passando para lembrar da sua consulta na clínica. Se precisar remarcar, fale conosco.`,
          "",
          "Nenhuma mensagem foi enviada automaticamente.",
        ],
      };
    },
  },
  {
    name: "prepareCreateAppointment",
    description: "Prepara agendamento com confirmação.",
    riskLevel: "sensitive_write",
    requiresConfirmation: true,
    domainPermissions: ["appointments.create"],
    inputSchema: z.object({
      raw: z.string().optional(),
      date: z.any().optional(),
      patient_id: z.string().optional(),
    }),
    handler(ctx, input) {
      requireDomains(ctx, ["appointments.create"]);
      const raw = String(input.raw ?? "");
      const q = extractPatientQuery(raw) || "Mariana";
      const { patients, ambiguous } = resolvePatients(
        ctx,
        q,
        typeof input.patient_id === "string" ? input.patient_id : undefined,
      );
      if (patients.length === 0) {
        return { facts: ["Não encontrei o paciente para agendar."] };
      }
      if (ambiguous) {
        return {
          facts: [
            "Encontrei mais de um paciente. Selecione:",
            ...patients.map((p) => {
              const phone = p.phone?.replace(/\D/g, "") ?? "";
              return `• ${p.full_name} — final ${phone.slice(-4) || "????"}`;
            }),
          ],
          ambiguity: patients.map((p) => ({ id: p.id, label: p.full_name })),
        };
      }
      const patient = patients[0]!;
      const dateInfo = (input.date as { ymd?: string; label?: string } | null) ?? null;
      const ymd = dateInfo?.ymd ?? clinicTodayYmd(DEFAULT_CLINIC_TZ);
      const timeMatch = raw.match(/\b(\d{1,2})(?::(\d{2}))?\b/);
      const hour = timeMatch ? Number(timeMatch[1]) : 14;
      const minute = timeMatch?.[2] ? Number(timeMatch[2]) : 0;
      const start = zonedStartOfDay(ymd, DEFAULT_CLINIC_TZ);
      // apply hour in clinic TZ approximately via UTC offset of midnight + hours
      const startAt = new Date(start.getTime() + (hour * 60 + minute) * 60_000);
      const endAt = new Date(startAt.getTime() + 40 * 60_000);
      const professionalId = OWNER_A_ID;
      const professional = getProfile(professionalId);
      const avail = checkAvailability({
        clinicId: ctx.clinicId,
        professionalId,
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
      });
      if (!avail.available) {
        return {
          facts: [
            "Esse horário não está disponível no momento. Consulte janelas livres na Agenda.",
          ],
          links: [{ label: "Abrir Agenda", href: "/app/agenda" }],
        };
      }
      const when = `${formatLabel(ymd)} · ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
      return {
        facts: [
          "Preparei o agendamento. Confirme para executar.",
        ],
        action_plan: {
          action_type: "create_appointment",
          payload: {
            patient_id: patient.id,
            professional_id: professionalId,
            start_at: startAt.toISOString(),
            end_at: endAt.toISOString(),
            reason: "Retorno",
          },
          preview: {
            title: "Confirmar agendamento?",
            fields: [
              { label: "Paciente", value: patient.full_name },
              { label: "Quando", value: when },
              {
                label: "Profissional",
                value: professional?.full_name ?? "Profissional",
              },
              { label: "Motivo", value: "Retorno" },
            ],
            confirm_label: "Confirmar agendamento",
            cancel_label: "Cancelar",
          },
        },
      };
    },
  },
  {
    name: "prepareRescheduleAppointment",
    description: "Prepara reagendamento com confirmação.",
    riskLevel: "sensitive_write",
    requiresConfirmation: true,
    domainPermissions: ["appointments.update"],
    inputSchema: z.object({
      raw: z.string().optional(),
      date: z.any().optional(),
    }),
    handler(ctx, input) {
      requireDomains(ctx, ["appointments.update"]);
      const raw = String(input.raw ?? "");
      const q = extractPatientQuery(raw);
      const patients = q ? searchPatients(ctx, q).items : [];
      if (patients.length > 1) {
        return {
          facts: ["Encontrei mais de um paciente. Selecione:"],
          ambiguity: patients.map((p) => ({ id: p.id, label: p.full_name })),
        };
      }
      const patientId = patients[0]?.id;
      const upcoming = getAgendaStore()
        .appointments
        .filter(
          (a) =>
            a.clinic_id === ctx.clinicId &&
            a.status !== "cancelled" &&
            a.status !== "completed" &&
            +new Date(a.start_at) >= Date.now() &&
            (!patientId || a.patient_id === patientId),
        )
        .sort((a, b) => +new Date(a.start_at) - +new Date(b.start_at));
      if (!upcoming[0]) {
        return { facts: ["Não encontrei consulta futura para reagendar."] };
      }
      const current = upcoming[0];
      const patient = getPatientRecord(current.patient_id);
      const dateInfo = (input.date as { ymd?: string; label?: string } | null) ?? null;
      const ymd = dateInfo?.ymd ?? clinicTodayYmd(DEFAULT_CLINIC_TZ);
      const timeMatch = raw.match(/\b(\d{1,2})(?::(\d{2}))?\b/);
      const hour = timeMatch ? Number(timeMatch[1]) : 14;
      const minute = timeMatch?.[2] ? Number(timeMatch[2]) : 0;
      const start = zonedStartOfDay(ymd, DEFAULT_CLINIC_TZ);
      const startAt = new Date(start.getTime() + (hour * 60 + minute) * 60_000);
      const endAt = new Date(startAt.getTime() + 40 * 60_000);
      const avail = checkAvailability({
        clinicId: ctx.clinicId,
        professionalId: current.professional_id,
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        excludeAppointmentId: current.id,
      });
      if (!avail.available) {
        return {
          facts: [
            "O novo horário não está disponível. Consulte janelas livres na Agenda.",
          ],
          links: [{ label: "Abrir Agenda", href: "/app/agenda" }],
        };
      }
      const when = `${formatLabel(ymd)} · ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
      return {
        facts: ["Preparei o reagendamento. Confirme para executar."],
        action_plan: {
          action_type: "reschedule_appointment",
          payload: {
            appointment_id: current.id,
            patient_id: current.patient_id,
            professional_id: current.professional_id,
            start_at: startAt.toISOString(),
            end_at: endAt.toISOString(),
            reason: current.reason ?? "Consulta",
          },
          preview: {
            title: "Confirmar reagendamento?",
            fields: [
              { label: "Paciente", value: patient?.full_name ?? "Paciente" },
              { label: "Novo horário", value: when },
            ],
            confirm_label: "Confirmar reagendamento",
            cancel_label: "Cancelar",
          },
        },
      };
    },
  },
  {
    name: "prepareCancelAppointment",
    description: "Prepara cancelamento com confirmação.",
    riskLevel: "sensitive_write",
    requiresConfirmation: true,
    domainPermissions: ["appointments.cancel"],
    inputSchema: z.object({ raw: z.string().optional() }),
    handler(ctx, input) {
      requireDomains(ctx, ["appointments.cancel"]);
      const raw = String(input.raw ?? "");
      const q = extractPatientQuery(raw);
      const patients = q ? searchPatients(ctx, q).items : [];
      const patientId = patients[0]?.id;
      const upcoming = getAgendaStore()
        .appointments
        .filter(
          (a) =>
            a.clinic_id === ctx.clinicId &&
            a.status !== "cancelled" &&
            a.status !== "completed" &&
            +new Date(a.start_at) >= Date.now() &&
            (!patientId || a.patient_id === patientId),
        )
        .sort((a, b) => +new Date(a.start_at) - +new Date(b.start_at));
      if (!upcoming[0]) {
        return { facts: ["Não encontrei consulta futura para cancelar."] };
      }
      const a = upcoming[0];
      const patient = getPatientRecord(a.patient_id);
      return {
        facts: ["Preparei o cancelamento. Confirme para executar."],
        action_plan: {
          action_type: "cancel_appointment",
          payload: {
            appointment_id: a.id,
            reason: "Cancelado via Secretária Virtual",
          },
          preview: {
            title: "Confirmar cancelamento?",
            fields: [
              { label: "Paciente", value: patient?.full_name ?? "Paciente" },
              {
                label: "Quando",
                value: new Date(a.start_at).toLocaleString("pt-BR", {
                  timeZone: DEFAULT_CLINIC_TZ,
                }),
              },
            ],
            confirm_label: "Confirmar cancelamento",
            cancel_label: "Voltar",
          },
        },
      };
    },
  },
  {
    name: "prepareRegisterPayment",
    description: "Prepara registro de pagamento com confirmação.",
    riskLevel: "sensitive_write",
    requiresConfirmation: true,
    domainPermissions: ["finance.payment_create"],
    inputSchema: z.object({ raw: z.string().optional() }),
    handler(ctx, input) {
      requireDomains(ctx, ["finance.payment_create"]);
      if (!can(ctx, "finance.view_administrative").allowed) {
        throw new Error("AUTHORIZATION_DENIED");
      }
      const raw = String(input.raw ?? "");
      const amountMatch = raw.match(/r\$\s*([\d.]+(?:,\d{2})?)/i);
      const amountReais = amountMatch
        ? Number(amountMatch[1]!.replace(/\./g, "").replace(",", "."))
        : NaN;
      const amountCents = Number.isFinite(amountReais)
        ? Math.round(amountReais * 100)
        : 0;
      const q = extractPatientQuery(raw) || "Mariana";
      const { patients, ambiguous } = resolvePatients(ctx, q);
      if (patients.length === 0) {
        return { facts: ["Não encontrei o paciente para o pagamento."] };
      }
      if (ambiguous) {
        return {
          facts: ["Há mais de um paciente. Selecione:"],
          ambiguity: patients.map((p) => ({ id: p.id, label: p.full_name })),
        };
      }
      const patient = patients[0]!;
      const store = getFinanceStore();
      const open = store.installments
        .filter((i) => {
          const tx = store.transactions.find((t) => t.id === i.financial_transaction_id);
          return (
            tx &&
            tx.clinic_id === ctx.clinicId &&
            tx.patient_id === patient.id &&
            tx.type === "income" &&
            !tx.cancelled_at
          );
        })
        .map((i) => {
          const paid = store.payments
            .filter((p) => p.payment_installment_id === i.id && !p.reversed_at)
            .reduce((s, p) => s + p.amount_cents, 0);
          return { ...i, balance: Math.max(0, i.amount_cents - paid) };
        })
        .filter((i) => i.balance > 0)
        .sort((a, b) => a.due_date.localeCompare(b.due_date));

      if (open.length === 0) {
        return { facts: [`${patient.full_name} não possui parcelas em aberto.`] };
      }
      if (open.length > 1 && amountCents === 0) {
        return {
          facts: [
            `${patient.full_name} possui ${open.length} parcelas em aberto. Informe o valor ou escolha a parcela na tela Financeiro.`,
            ...open.slice(0, 5).map(
              (i) =>
                `• Venc. ${i.due_date.split("-").reverse().join("/")} — saldo ${formatBRL(i.balance)}`,
            ),
          ],
          links: [
            {
              label: "Abrir financeiro do paciente",
              href: `/app/pacientes/${patient.id}/financeiro`,
            },
          ],
        };
      }
      const inst =
        open.find((i) => amountCents > 0 && i.balance === amountCents) ??
        open[0]!;
      const pay = amountCents > 0 ? Math.min(amountCents, inst.balance) : inst.balance;
      const method = /\bpix\b/i.test(raw)
        ? "pix"
        : /\bdinheiro\b/i.test(raw)
          ? "cash"
          : "pix";
      return {
        facts: ["Preparei o registro de pagamento. Confirme para executar."],
        action_plan: {
          action_type: "register_payment",
          payload: {
            installment_id: inst.id,
            amount_reais: pay / 100,
            payment_method: method,
            paid_at: new Date().toISOString().slice(0, 10),
            client_request_id: `asst-pay-${crypto.randomUUID()}`,
          },
          preview: {
            title: "Registrar pagamento?",
            fields: [
              { label: "Paciente", value: patient.full_name },
              {
                label: "Parcela",
                value: `venc. ${inst.due_date.split("-").reverse().join("/")}`,
              },
              { label: "Saldo atual", value: formatBRL(inst.balance) },
              { label: "Pagamento", value: formatBRL(pay) },
              { label: "Forma", value: method.toUpperCase() },
            ],
            confirm_label: "Confirmar pagamento",
            cancel_label: "Cancelar",
          },
        },
      };
    },
  },
];

function extractPatientQuery(raw: string): string {
  const m = raw.match(
    /(?:a |o |paciente )?([A-ZÁÉÍÓÚÂÊÔÃÕ][a-záéíóúâêôãõ]+(?:\s+[A-ZÁÉÍÓÚÂÊÔÃÕ][a-záéíóúâêôãõ]+)+)/,
  );
  if (m) return m[1]!;
  if (/mariana/i.test(raw)) return "Mariana";
  return "";
}

/** Prefer exact / unique full-name matches; otherwise keep ambiguity list. */
function resolvePatients(
  ctx: AuthzContext,
  query: string,
  preferredId?: string,
) {
  const results = searchPatients(ctx, query).items.slice(0, 12);
  if (preferredId) {
    const hit = results.find((p) => p.id === preferredId);
    if (hit) return { patients: [hit], ambiguous: false as const };
  }
  const q = query.trim().toLowerCase();
  const exact = results.filter((p) => p.full_name.toLowerCase() === q);
  if (exact.length === 1) {
    return { patients: exact, ambiguous: false as const };
  }
  if (results.length <= 1) {
    return { patients: results, ambiguous: false as const };
  }
  return { patients: results, ambiguous: true as const };
}

export function getTool(name: string) {
  return ASSISTANT_TOOLS.find((t) => t.name === name) ?? null;
}

export function listToolNames() {
  return ASSISTANT_TOOLS.map((t) => t.name);
}
