import { z } from "zod";
import {
  DEFAULT_BETA_COHORT,
  isInviteOnlyBeta,
} from "@/lib/commercial/config";
import {
  isCommercialEventName,
  sanitizeCommercialMeta,
  type CommercialEvent,
} from "@/lib/commercial/events";
import {
  getAuthzStore,
  getClinic,
  getDemoSession,
} from "@/lib/demo/authz-store";
import {
  CANCEL_REASONS,
  getCommercialStore,
  LEAD_COST_CONTROL_OPTIONS,
  LEAD_PIPELINE_STATUSES,
  type CancelReason,
  type ClinicCommercialMeta,
  type LeadPipelineStatus,
} from "@/lib/demo/commercial-store";
import { getAgendaStore } from "@/lib/demo/agenda-store";
import { getBillingStore } from "@/lib/demo/billing-store";
import { getInventoryStore } from "@/lib/demo/inventory-store";
import { getPerformedStore } from "@/lib/demo/performed-procedures-store";
import { getClinicSubscription, getPlanForClinic } from "@/lib/entitlements";
import { APP_VERSION } from "@/lib/version";

function now() {
  return new Date().toISOString();
}

const leadSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(200),
  whatsapp: z.string().trim().max(40).optional().nullable(),
  clinic_name: z.string().trim().max(120).optional().nullable(),
  dentists_count: z.coerce.number().int().min(1).max(50),
  cost_control_today: z.enum(LEAD_COST_CONTROL_OPTIONS),
});

export function submitLead(raw: unknown) {
  const parsed = leadSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "LEAD_INVALIDO");
  }
  const store = getCommercialStore();
  const email = parsed.data.email.toLowerCase();
  const lockKey = email;
  const last = store.lead_submit_locks[lockKey] ?? 0;
  if (Date.now() - last < 4000) {
    throw new Error("LEAD_DUPLICATE_SUBMIT");
  }
  const existing = store.leads.find((l) => l.email === email);
  if (existing) {
    store.lead_submit_locks[lockKey] = Date.now();
    trackCommercialEventPublic("lead_submitted", {
      route: "/conhecer",
      meta: { duplicate: true },
    });
    return { ok: true as const, id: existing.id, duplicate: true };
  }

  const lead = {
    id: crypto.randomUUID(),
    name: parsed.data.name,
    email,
    whatsapp: parsed.data.whatsapp?.trim() || null,
    clinic_name: parsed.data.clinic_name?.trim() || null,
    dentists_count: parsed.data.dentists_count,
    cost_control_today: parsed.data.cost_control_today,
    pipeline_status: "novo" as LeadPipelineStatus,
    non_conversion_reason: null,
    notes: null,
    created_at: now(),
    updated_at: now(),
  };
  store.leads.unshift(lead);
  store.lead_submit_locks[lockKey] = Date.now();
  trackCommercialEventPublic("lead_submitted", {
    route: "/conhecer",
    meta: {
      dentists_count: lead.dentists_count,
      cost_control_today: lead.cost_control_today,
    },
  });
  return { ok: true as const, id: lead.id, duplicate: false };
}

export function updateLeadPipeline(
  leadId: string,
  status: LeadPipelineStatus,
  nonConversionReason?: CancelReason | null,
) {
  if (!LEAD_PIPELINE_STATUSES.includes(status)) {
    throw new Error("PIPELINE_INVALIDO");
  }
  const lead = getCommercialStore().leads.find((l) => l.id === leadId);
  if (!lead) throw new Error("LEAD_NOT_FOUND");
  lead.pipeline_status = status;
  if (status === "nao_avancou" && nonConversionReason) {
    lead.non_conversion_reason = nonConversionReason;
  }
  lead.updated_at = now();
  return lead;
}

export function validateBetaInvite(code: string | null | undefined) {
  if (!isInviteOnlyBeta()) {
    return { required: false, valid: true, cohort: DEFAULT_BETA_COHORT };
  }
  const normalized = (code ?? "").trim().toUpperCase();
  if (!normalized) {
    return { required: true, valid: false, reason: "INVITE_REQUIRED" as const };
  }
  const invite = getCommercialStore().invites.find(
    (i) => i.active && i.code.toUpperCase() === normalized,
  );
  if (!invite) {
    return { required: true, valid: false, reason: "INVITE_INVALID" as const };
  }
  if (invite.uses >= invite.max_uses) {
    return { required: true, valid: false, reason: "INVITE_EXHAUSTED" as const };
  }
  return {
    required: true,
    valid: true,
    cohort: invite.cohort,
    invite_id: invite.id,
    code: invite.code,
  };
}

export function consumeBetaInvite(code: string) {
  const invite = getCommercialStore().invites.find(
    (i) => i.active && i.code.toUpperCase() === code.trim().toUpperCase(),
  );
  if (!invite) throw new Error("INVITE_INVALID");
  if (invite.uses >= invite.max_uses) throw new Error("INVITE_EXHAUSTED");
  invite.uses += 1;
  return invite;
}

export function attachClinicCommercialMeta(
  clinicId: string,
  opts?: {
    invite_code?: string | null;
    founder_pricing?: boolean;
    commercial_offer?: ClinicCommercialMeta["commercial_offer"];
  },
) {
  const store = getCommercialStore();
  let meta = store.clinic_meta.find((m) => m.clinic_id === clinicId);
  const inviteCode = opts?.invite_code?.trim() || null;
  let cohort = DEFAULT_BETA_COHORT;
  if (inviteCode) {
    const invite = consumeBetaInvite(inviteCode);
    cohort = invite.cohort;
  }
  if (!meta) {
    meta = {
      clinic_id: clinicId,
      beta_cohort: cohort,
      invite_code_used: inviteCode,
      entered_at: now(),
      founder_pricing: opts?.founder_pricing ?? false,
      commercial_offer: opts?.commercial_offer ?? "trial",
      health: "onboarding_incomplete",
      last_operational_activity_at: null,
      activated_at: null,
    };
    store.clinic_meta.push(meta);
  }
  return meta;
}

export type ActivationMilestone = {
  key: string;
  label: string;
  done: boolean;
  href: string;
};

/** Ativação comercial: procedimento + ficha + material + estoque + atendimento. */
export function getCommercialActivation(clinicId: string) {
  const inv = getInventoryStore();
  const performed = getPerformedStore();
  const clinicDone = Boolean(getClinic(clinicId));

  const procedureDone = inv.procedures.some(
    (p) => p.clinic_id === clinicId && p.active,
  );
  const materialsDone = inv.procedureMaterials.some((m) => {
    const proc = inv.procedures.find(
      (p) => p.id === m.procedure_id && p.clinic_id === clinicId,
    );
    return Boolean(proc);
  });
  const stockDone = inv.inventoryItems.some(
    (i) =>
      i.clinic_id === clinicId &&
      i.active &&
      !i.archived_at &&
      i.current_quantity > 0,
  );
  const attendanceDone =
    performed.performedProcedures.some(
      (p) => p.clinic_id === clinicId && p.status === "completed",
    ) ||
    getAgendaStore().appointments.some(
      (a) => a.clinic_id === clinicId && a.status === "completed",
    );

  const milestones: ActivationMilestone[] = [
    {
      key: "clinic",
      label: "Criar clínica",
      done: clinicDone,
      href: "/app/onboarding?step=clinic",
    },
    {
      key: "procedure",
      label: "Cadastrar procedimento",
      done: procedureDone,
      href: "/app/procedimentos/novo?from=onboarding",
    },
    {
      key: "materials",
      label: "Adicionar materiais",
      done: materialsDone,
      href: "/app/procedimentos?from=onboarding",
    },
    {
      key: "stock",
      label: "Registrar estoque",
      done: stockDone,
      href: "/app/estoque?from=onboarding",
    },
    {
      key: "attendance",
      label: "Concluir primeiro atendimento",
      done: attendanceDone,
      href: "/app/agenda?from=onboarding",
    },
  ];

  const activated = milestones.every((m) => m.done);
  const meta = getCommercialStore().clinic_meta.find(
    (m) => m.clinic_id === clinicId,
  );
  if (meta) {
    if (activated && !meta.activated_at) {
      meta.activated_at = now();
      meta.health = "activated";
      trackCommercialEventPublic("activation_completed", {
        clinicId,
        meta: { cohort: meta.beta_cohort },
      });
    } else if (!activated) {
      meta.health = "onboarding_incomplete";
    }
  }

  return {
    milestones,
    activated,
    activated_at: meta?.activated_at ?? null,
    health: computeClinicHealth(clinicId),
  };
}

export function computeClinicHealth(
  clinicId: string,
): NonNullable<ClinicCommercialMeta["health"]> {
  const activation = (() => {
    const inv = getInventoryStore();
    const performed = getPerformedStore();
    const procedureDone = inv.procedures.some(
      (p) => p.clinic_id === clinicId && p.active,
    );
    const materialsDone = inv.procedureMaterials.some((m) => {
      const proc = inv.procedures.find(
        (p) => p.id === m.procedure_id && p.clinic_id === clinicId,
      );
      return Boolean(proc);
    });
    const stockDone = inv.inventoryItems.some(
      (i) =>
        i.clinic_id === clinicId &&
        i.active &&
        !i.archived_at &&
        i.current_quantity > 0,
    );
    const attendanceDone =
      performed.performedProcedures.some(
        (p) => p.clinic_id === clinicId && p.status === "completed",
      ) ||
      getAgendaStore().appointments.some(
        (a) => a.clinic_id === clinicId && a.status === "completed",
      );
    return (
      procedureDone && materialsDone && stockDone && attendanceDone
    );
  })();

  const meta = getCommercialStore().clinic_meta.find(
    (m) => m.clinic_id === clinicId,
  );
  const last = meta?.last_operational_activity_at;
  const weekAgo = Date.now() - 7 * 86400_000;

  if (!activation) return "onboarding_incomplete";
  if (last && new Date(last).getTime() >= weekAgo) return "active";
  if (activation && !last) return "activated";
  if (last && new Date(last).getTime() < weekAgo) return "inactive";
  return "activated";
}

export function touchOperationalActivity(clinicId: string) {
  const store = getCommercialStore();
  let meta = store.clinic_meta.find((m) => m.clinic_id === clinicId);
  if (!meta) {
    meta = attachClinicCommercialMeta(clinicId);
  }
  meta.last_operational_activity_at = now();
  meta.health = computeClinicHealth(clinicId);
  return meta;
}

export function trackCommercialEventPublic(
  name: string,
  opts?: {
    route?: string | null;
    clinicId?: string | null;
    userId?: string | null;
    meta?: Record<string, unknown>;
  },
) {
  if (!isCommercialEventName(name)) {
    throw new Error("EVENTO_DESCONHECIDO");
  }
  const session = (() => {
    try {
      return getDemoSession();
    } catch {
      return { userId: "", clinicId: "" };
    }
  })();
  const clinicId = opts?.clinicId ?? (session.clinicId || null);
  const userId = opts?.userId ?? (session.userId || null);
  const store = getCommercialStore();

  // eventos one-shot por clínica
  if (
    name === "first_procedure_cost_calculated" ||
    name === "first_real_procedure_cost_calculated" ||
    name === "activation_completed"
  ) {
    if (clinicId) {
      const prior = store.events.find(
        (e) => e.name === name && e.clinic_id === clinicId,
      );
      if (prior) {
        return { ok: true as const, id: prior.id, duplicate: true };
      }
    }
  }

  const event: CommercialEvent = {
    id: crypto.randomUUID(),
    name,
    clinic_id: clinicId,
    user_id: userId,
    route: opts?.route ?? null,
    meta: sanitizeCommercialMeta(opts?.meta),
    created_at: now(),
    app_version: APP_VERSION,
  };
  store.events.unshift(event);
  if (store.events.length > 3000) store.events.length = 3000;

  return { ok: true as const, id: event.id, duplicate: false };
}

export function recordCancelFeedback(input: {
  clinicId: string;
  userId: string;
  reason: string;
  detail?: string | null;
}) {
  if (!(CANCEL_REASONS as readonly string[]).includes(input.reason)) {
    throw new Error("CANCEL_REASON_INVALID");
  }
  const row = {
    id: crypto.randomUUID(),
    clinic_id: input.clinicId,
    user_id: input.userId,
    reason: input.reason as CancelReason,
    detail: input.detail?.trim()?.slice(0, 280) || null,
    created_at: now(),
  };
  getCommercialStore().cancel_feedback.unshift(row);
  trackCommercialEventPublic("cancel_feedback_submitted", {
    clinicId: input.clinicId,
    userId: input.userId,
    meta: { reason: row.reason },
  });
  return row;
}

export function listBetaClinicsInternal() {
  const clinics = getClinicStoreSnapshot();
  return clinics.map((c) => {
    const sub = getClinicSubscription(c.id);
    const plan = getPlanForClinic(c.id);
    const meta = getCommercialStore().clinic_meta.find(
      (m) => m.clinic_id === c.id,
    );
    const activation = getCommercialActivation(c.id);
    return {
      id: c.id,
      name: c.name,
      entered_at: meta?.entered_at ?? null,
      beta_cohort: meta?.beta_cohort ?? null,
      plan_code: plan?.code ?? null,
      plan_name: plan?.name ?? null,
      subscription_status: sub?.status ?? null,
      activation: activation.activated,
      health: activation.health,
      last_operational_activity_at:
        meta?.last_operational_activity_at ?? null,
      // sem conteúdo clínico
    };
  });
}

function getClinicStoreSnapshot() {
  return getAuthzStore().clinics;
}

export function getCommercialFunnelMetrics() {
  const store = getCommercialStore();
  const leads = store.leads.length;
  const demos = store.leads.filter((l) =>
    ["demonstracao", "teste", "cliente"].includes(l.pipeline_status),
  ).length;
  const trials = getBillingStore().subscriptions.filter(
    (s) => s.status === "trialing",
  ).length;
  const activated = store.clinic_meta.filter((m) => m.activated_at).length;
  const paying = getBillingStore().subscriptions.filter(
    (s) => s.status === "active" && !s.cancel_at_period_end,
  ).length;
  const cancelled = getBillingStore().subscriptions.filter(
    (s) => s.status === "cancelled",
  ).length;
  return {
    leads,
    demos,
    trials_started: trials,
    clinics_activated: activated,
    paying_customers: paying,
    cancellations: cancelled,
    cancel_reasons: store.cancel_feedback.reduce(
      (acc, f) => {
        acc[f.reason] = (acc[f.reason] ?? 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    ),
    events_by_name: COMMERCIAL_EVENT_COUNT(store.events),
  };
}

function COMMERCIAL_EVENT_COUNT(events: CommercialEvent[]) {
  const out: Record<string, number> = {};
  for (const e of events) {
    out[e.name] = (out[e.name] ?? 0) + 1;
  }
  return out;
}

export function getInviteOnlyStatus() {
  return {
    invite_only: isInviteOnlyBeta(),
    commercial_beta: true,
  };
}
