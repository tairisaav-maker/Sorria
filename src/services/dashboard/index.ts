import {
  addDays,
  endOfDay,
  format,
  startOfDay,
  startOfWeek,
  subDays,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import type { AuthzContext } from "@/lib/authz/can";
import { can } from "@/lib/authz/can";
import { getFinanceStore } from "@/lib/demo/finance-store";
import { getInventoryStore } from "@/lib/demo/inventory-store";
import { getPlannedProceduresStore } from "@/lib/demo/planned-procedures-store";
import { getPerformedStore } from "@/lib/demo/performed-procedures-store";
import { formatBRL } from "@/lib/money";
import {
  countTodayAppointments,
  listAppointments,
} from "@/services/appointments";
import { countPendingRequests } from "@/services/appointment-requests";
import { getHomeFinanceKpis } from "@/services/finance";
import { getInventoryDashboard } from "@/services/inventory";
import { forecastMaterialNeeds } from "@/services/inventory/forecast";
import { getUpcomingReplenishmentBrief } from "@/services/inventory/replenishment";
import { getStandardOperationalEstimate } from "@/services/procedure-operational-costs";
import { listProcedures } from "@/services/procedures";

export type DashboardMetric = {
  id: string;
  label: string;
  value: string;
  hint: string;
  href?: string;
  icon: "calendar" | "wallet" | "receivable" | "package";
};

export type DashboardAgendaItem = {
  id: string;
  time: string;
  patientName: string;
  procedure: string;
  status: "next" | "in_progress" | "completed" | "cancelled" | "scheduled";
  rawStatus: string;
  ctaLabel: string;
  ctaHref: string;
};

export type DashboardAttentionItem = {
  id: string;
  title: string;
  href: string;
};

export type DashboardFrequentProcedure = {
  id: string;
  name: string;
  default_price_cents: number | null;
  cost_cents: number | null;
  use_count: number;
};

export type DashboardReceiptPoint = {
  day: string;
  label: string;
  received_cents: number;
};

export type DashboardSummary = {
  greeting_name: string;
  clinic_name: string;
  greeting_period: "Bom dia" | "Boa tarde" | "Boa noite";
  metrics: DashboardMetric[];
  agenda: DashboardAgendaItem[];
  attention: DashboardAttentionItem[];
  frequent_procedures: DashboardFrequentProcedure[];
  receipts_7d: DashboardReceiptPoint[] | null;
  permissions: {
    can_create_appointment: boolean;
    can_create_patient: boolean;
    can_create_procedure: boolean;
    can_purchase: boolean;
    can_payment: boolean;
    can_simulate: boolean;
    can_view_finance: boolean;
    can_view_costs: boolean;
  };
  empty_procedures: boolean;
};

function greetingPeriod(d = new Date()): DashboardSummary["greeting_period"] {
  const h = d.getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

function mapAgendaStatus(
  status: string,
  startAt: string,
): DashboardAgendaItem["status"] {
  if (status === "completed") return "completed";
  if (status === "cancelled" || status === "no_show") return "cancelled";
  if (status === "in_progress") return "in_progress";
  const start = new Date(startAt).getTime();
  const now = Date.now();
  if (start >= now - 15 * 60_000 && start <= now + 90 * 60_000) return "next";
  return "scheduled";
}

function agendaCta(status: string, id: string) {
  if (status === "completed") {
    return { label: "Abrir", href: `/app/agenda/atendimento/${id}` };
  }
  if (status === "in_progress") {
    return {
      label: "Continuar",
      href: `/app/agenda/atendimento/${id}`,
    };
  }
  if (
    status === "arrived" ||
    status === "confirmed" ||
    status === "scheduled"
  ) {
    return {
      label: "Iniciar atendimento",
      href: `/app/agenda/atendimento/${id}?iniciar=1`,
    };
  }
  return { label: "Abrir", href: `/app/agenda/atendimento/${id}` };
}

function firstName(full: string) {
  const parts = full.trim().split(/\s+/);
  if (parts[0]?.toLowerCase().startsWith("dr") && parts[1]) {
    return `${parts[0]} ${parts[1]}`;
  }
  return parts[0] ?? full;
}

export function getDashboardSummary(
  ctx: AuthzContext,
  opts: { userName: string; clinicName: string },
): DashboardSummary {
  const canAgenda = can(ctx, "appointments.view").allowed;
  const canFinance = can(ctx, "finance.view_administrative").allowed;
  const canInventory = can(ctx, "inventory.view").allowed;
  const canSimulate =
    can(ctx, "procedure_pricing.simulate").allowed ||
    can(ctx, "procedure_pricing.view").allowed;
  const canCosts =
    can(ctx, "procedure_costs.view").allowed ||
    can(ctx, "procedure_pricing.view").allowed;
  const canOps =
    can(ctx, "procedure_operational_costs.view").allowed ||
    can(ctx, "operational_costs.view").allowed;

  const today = new Date();
  const todayStats = canAgenda
    ? countTodayAppointments(ctx)
    : { total: 0, confirmed: 0 };

  const todayAppts = canAgenda
    ? listAppointments(ctx, {
        from: startOfDay(today),
        to: endOfDay(today),
      }).filter((a) => a.status !== "cancelled" && a.status !== "no_show")
    : [];

  const nextAppt = todayAppts
    .filter((a) => a.status !== "completed")
    .sort(
      (a, b) => +new Date(a.start_at) - +new Date(b.start_at),
    )
    .find((a) => new Date(a.start_at).getTime() >= Date.now() - 30 * 60_000);

  const metrics: DashboardMetric[] = [];

  if (canAgenda) {
    metrics.push({
      id: "today",
      label: "Atendimentos hoje",
      value: String(todayStats.total),
      hint: nextAppt
        ? `Próximo às ${format(new Date(nextAppt.start_at), "HH:mm")}`
        : todayStats.total === 0
          ? "Nenhum agendado"
          : `${todayStats.confirmed} confirmados`,
      href: "/app/agenda",
      icon: "calendar",
    });
  }

  // Finance — today received + a receber
  if (canFinance) {
    const store = getFinanceStore();
    const dayStart = startOfDay(today);
    const dayEnd = endOfDay(today);
    let receivedToday = 0;
    for (const pay of store.payments) {
      if (pay.clinic_id !== ctx.clinicId || pay.reversed_at) continue;
      const paidAt = new Date(pay.paid_at);
      if (paidAt < dayStart || paidAt > dayEnd) continue;
      const tx = store.transactions.find(
        (t) => t.id === pay.financial_transaction_id,
      );
      if (!tx || tx.cancelled_at || tx.type !== "income") continue;
      receivedToday += pay.amount_cents;
    }

    // média diária dos últimos 7 dias (exclui hoje) — só mostra delta se houver base
    let avgPrev = 0;
    let daysWithData = 0;
    for (let i = 1; i <= 7; i++) {
      const d = subDays(today, i);
      const from = startOfDay(d);
      const to = endOfDay(d);
      let daySum = 0;
      for (const pay of store.payments) {
        if (pay.clinic_id !== ctx.clinicId || pay.reversed_at) continue;
        const paidAt = new Date(pay.paid_at);
        if (paidAt < from || paidAt > to) continue;
        const tx = store.transactions.find(
          (t) => t.id === pay.financial_transaction_id,
        );
        if (!tx || tx.cancelled_at || tx.type !== "income") continue;
        daySum += pay.amount_cents;
      }
      if (daySum > 0) {
        avgPrev += daySum;
        daysWithData += 1;
      }
    }
    avgPrev = daysWithData > 0 ? Math.round(avgPrev / daysWithData) : 0;
    let receivedHint = "pagamentos de hoje";
    if (avgPrev > 0 && receivedToday > 0) {
      const delta = Math.round(((receivedToday - avgPrev) / avgPrev) * 100);
      if (delta !== 0) {
        receivedHint = `${delta > 0 ? "+" : ""}${delta}% comparado à média`;
      }
    }

    metrics.push({
      id: "received_today",
      label: "Recebido hoje",
      value: formatBRL(receivedToday),
      hint: receivedHint,
      href: "/app/financeiro",
      icon: "wallet",
    });

    const homeFin = getHomeFinanceKpis(ctx);
    let openCharges = 0;
    for (const inst of store.installments) {
      if (inst.clinic_id !== ctx.clinicId) continue;
      const tx = store.transactions.find(
        (t) => t.id === inst.financial_transaction_id,
      );
      if (!tx || tx.type !== "income" || tx.cancelled_at) continue;
      const paid = store.payments
        .filter(
          (p) =>
            p.payment_installment_id === inst.id &&
            !p.reversed_at,
        )
        .reduce((s, p) => s + p.amount_cents, 0);
      if (inst.amount_cents - paid > 0) openCharges += 1;
    }

    metrics.push({
      id: "receivable",
      label: "A receber",
      value: formatBRL(homeFin?.receivable_cents ?? 0),
      hint:
        openCharges > 0
          ? `${openCharges} cobrança${openCharges === 1 ? "" : "s"} aberta${openCharges === 1 ? "" : "s"}`
          : "nada em aberto",
      href: "/app/financeiro",
      icon: "receivable",
    });
  }

  if (canInventory) {
    const inv = getInventoryDashboard(ctx);
    const attentionCount =
      (inv?.low_count ?? 0) + (inv?.empty_count ?? 0);
    let hint = "estoque sob controle";
    if (can(ctx, "inventory.forecast_view").allowed) {
      try {
        const start = startOfDay(today);
        const weekEnd = endOfDay(addDays(start, 7));
        const forecast = forecastMaterialNeeds(ctx, {
          start_date: start.toISOString(),
          end_date: weekEnd.toISOString(),
        });
        if (forecast.materials_at_risk > 0) {
          hint = `${forecast.materials_at_risk} podem faltar nesta semana`;
        }
      } catch {
        /* ignore */
      }
    } else if (attentionCount > 0) {
      hint = `${inv?.empty_count ?? 0} sem estoque`;
    }
    metrics.push({
      id: "stock",
      label: "Estoque em atenção",
      value: String(attentionCount),
      hint:
        attentionCount === 0
          ? "Tudo certo no estoque"
          : `${attentionCount} ite${attentionCount === 1 ? "m" : "ns"} · ${hint}`,
      href: "/app/estoque",
      icon: "package",
    });
  }

  const agenda: DashboardAgendaItem[] = todayAppts
    .sort((a, b) => +new Date(a.start_at) - +new Date(b.start_at))
    .map((a) => {
      const status = mapAgendaStatus(a.status, a.start_at);
      const cta = agendaCta(a.status, a.id);
      const planned = getPlannedProceduresStore().planned.find(
        (p) =>
          p.clinic_id === ctx.clinicId &&
          p.appointment_id === a.id &&
          !p.cancelled_at,
      );
      const performed = getPerformedStore().performedProcedures.find(
        (p) =>
          p.clinic_id === ctx.clinicId &&
          p.appointment_id === a.id &&
          p.status !== "cancelled",
      );
      return {
        id: a.id,
        time: format(new Date(a.start_at), "HH:mm"),
        patientName: a.patient_name,
        procedure:
          performed?.procedure_name_snapshot ||
          a.reason ||
          planned?.procedure_name ||
          "Consulta",
        status,
        rawStatus: a.status,
        ctaLabel: cta.label,
        ctaHref: cta.href,
      };
    });

  // Mark only the soonest upcoming as "next"
  const nextId = agenda.find(
    (a) => a.status === "next" || a.status === "scheduled",
  )?.id;
  for (const item of agenda) {
    if (item.status === "scheduled" && item.id === nextId) {
      item.status = "next";
    } else if (item.status === "next" && item.id !== nextId) {
      item.status = "scheduled";
    }
  }

  const attention: DashboardAttentionItem[] = [];
  if (canInventory) {
    const inv = getInventoryDashboard(ctx);
    const n = (inv?.low_count ?? 0) + (inv?.empty_count ?? 0);
    if (n > 0) {
      attention.push({
        id: "stock",
        title: `${n} materia${n === 1 ? "l" : "is"} em atenção`,
        href: "/app/estoque",
      });
    }
    if (can(ctx, "inventory.replenishment_view").allowed) {
      const brief = getUpcomingReplenishmentBrief(ctx, 7);
      if (brief && brief.materials_needing_attention > 0) {
        attention.push({
          id: "replenish",
          title: `${brief.materials_needing_attention} podem faltar em breve`,
          href: "/app/estoque/reposicao",
        });
      }
    }
  }
  if (canFinance) {
    const store = getFinanceStore();
    let overduePatients = 0;
    const seen = new Set<string>();
    for (const inst of store.installments) {
      if (inst.clinic_id !== ctx.clinicId) continue;
      const tx = store.transactions.find(
        (t) => t.id === inst.financial_transaction_id,
      );
      if (!tx || tx.type !== "income" || tx.cancelled_at || !tx.patient_id) {
        continue;
      }
      const paid = store.payments
        .filter(
          (p) => p.payment_installment_id === inst.id && !p.reversed_at,
        )
        .reduce((s, p) => s + p.amount_cents, 0);
      const balance = inst.amount_cents - paid;
      if (balance <= 0) continue;
      if (new Date(inst.due_date) >= startOfDay(today)) continue;
      if (seen.has(tx.patient_id)) continue;
      seen.add(tx.patient_id);
      overduePatients += 1;
    }
    if (overduePatients > 0) {
      attention.push({
        id: "overdue",
        title: `${overduePatients} paciente${overduePatients === 1 ? "" : "s"} com saldo vencido`,
        href: "/app/financeiro",
      });
    }
  }
  if (can(ctx, "procedures.view").allowed) {
    const store = getInventoryStore();
    const incomplete = store.procedures.filter((p) => {
      if (p.clinic_id !== ctx.clinicId || !p.active || p.archived_at) {
        return false;
      }
      const mats = store.procedureMaterials.filter(
        (m) => m.procedure_id === p.id,
      );
      return mats.length === 0;
    }).length;
    if (incomplete > 0) {
      attention.push({
        id: "incomplete_fiche",
        title: `${incomplete} ficha${incomplete === 1 ? "" : "s"} técnica${incomplete === 1 ? "" : "s"} incompleta${incomplete === 1 ? "" : "s"}`,
        href: "/app/procedimentos",
      });
    }
  }
  if (can(ctx, "appointment_requests.view").allowed) {
    const pending = countPendingRequests(ctx);
    if (pending > 0) {
      attention.push({
        id: "requests",
        title: `${pending} solicitaç${pending === 1 ? "ão" : "ões"} aguardando`,
        href: "/app/solicitacoes",
      });
    }
  }

  // Frequent procedures
  let frequent: DashboardFrequentProcedure[] = [];
  if (can(ctx, "procedures.view").allowed) {
    const procs = listProcedures(ctx);
    frequent = procs
      .slice()
      .sort((a, b) => {
        if (b.use_count !== a.use_count) return b.use_count - a.use_count;
        if (a.favorited !== b.favorited) return a.favorited ? -1 : 1;
        return a.name.localeCompare(b.name, "pt-BR");
      })
      .slice(0, 4)
      .map((p) => {
        let cost: number | null = null;
        if (canCosts || canOps) {
          try {
            const est = getStandardOperationalEstimate(ctx, p.id);
            cost =
              est.operational_total_cents ??
              est.materials_cost_cents ??
              null;
          } catch {
            cost = null;
          }
        }
        return {
          id: p.id,
          name: p.name,
          default_price_cents: p.default_price_cents,
          cost_cents: cost,
          use_count: p.use_count,
        };
      });
  }

  // Receipts last 7 days chart
  let receipts: DashboardReceiptPoint[] | null = null;
  if (canFinance) {
    const store = getFinanceStore();
    receipts = Array.from({ length: 7 }, (_, i) => {
      const d = subDays(today, 6 - i);
      const from = startOfDay(d);
      const to = endOfDay(d);
      let sum = 0;
      for (const pay of store.payments) {
        if (pay.clinic_id !== ctx.clinicId || pay.reversed_at) continue;
        const paidAt = new Date(pay.paid_at);
        if (paidAt < from || paidAt > to) continue;
        const tx = store.transactions.find(
          (t) => t.id === pay.financial_transaction_id,
        );
        if (!tx || tx.cancelled_at || tx.type !== "income") continue;
        sum += pay.amount_cents;
      }
      return {
        day: format(d, "yyyy-MM-dd"),
        label: format(d, "EEE", { locale: ptBR }).replace(".", ""),
        received_cents: sum,
      };
    });
  }

  const procs = can(ctx, "procedures.view").allowed
    ? listProcedures(ctx)
    : [];

  return {
    greeting_name: firstName(opts.userName),
    clinic_name: opts.clinicName,
    greeting_period: greetingPeriod(today),
    metrics,
    agenda,
    attention,
    frequent_procedures: frequent,
    receipts_7d: receipts,
    permissions: {
      can_create_appointment: can(ctx, "appointments.create").allowed,
      can_create_patient: can(ctx, "patients.demographics.create").allowed,
      can_create_procedure: can(ctx, "procedures.create").allowed,
      can_purchase: can(ctx, "inventory.purchase_create").allowed,
      can_payment: can(ctx, "finance.payment_create").allowed,
      can_simulate: canSimulate,
      can_view_finance: canFinance,
      can_view_costs: canCosts || canOps,
    },
    empty_procedures: procs.length === 0,
  };
}

/** Mantém compatibilidade com buildHomeDashboard antigo (week series). */
export function getWeekAppointmentSeries(ctx: AuthzContext) {
  if (!can(ctx, "appointments.view").allowed) return [];
  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const labels = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
  return labels.map((day, index) => {
    const dayDate = addDays(weekStart, index);
    const count = listAppointments(ctx, {
      from: startOfDay(dayDate),
      to: endOfDay(dayDate),
    }).filter((a) => a.status !== "cancelled").length;
    return { day, appointments: count };
  });
}
