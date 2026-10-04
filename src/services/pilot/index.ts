import { z } from "zod";
import type { AuthzContext } from "@/lib/authz/can";
import { can } from "@/lib/authz/can";
import { getAgendaStore } from "@/lib/demo/agenda-store";
import { getClinicalStore } from "@/lib/demo/clinical-store";
import { getInventoryStore } from "@/lib/demo/inventory-store";
import {
  getPilotStore,
  type PilotFeedbackImpact,
  type PilotFeedbackKind,
} from "@/lib/demo/pilot-store";
import { getPerformedStore } from "@/lib/demo/performed-procedures-store";
import {
  isPilotEventName,
  sanitizePilotMeta,
  type PilotEventName,
} from "@/lib/pilot/events";
import { APP_VERSION } from "@/lib/version";
import { listPatients } from "@/services/patients/queries";
import { getOnboarding } from "@/services/settings";

const trackSchema = z.object({
  name: z.string().min(1),
  route: z.string().max(200).nullable().optional(),
  duration_ms: z.number().int().nonnegative().nullable().optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
});

const feedbackSchema = z.object({
  kind: z.enum(["bug", "friction", "suggestion"]),
  what_happened: z.string().trim().min(3).max(2000),
  what_expected: z.string().trim().min(1).max(2000),
  impact: z.enum(["none", "some", "much"]),
  route: z.string().max(200).optional(),
});

export function trackPilotEvent(
  ctx: AuthzContext,
  raw: unknown,
) {
  const parsed = trackSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error("EVENTO_INVALIDO");
  }
  if (!isPilotEventName(parsed.data.name)) {
    throw new Error("EVENTO_DESCONHECIDO");
  }
  const event = {
    id: `pe-${crypto.randomUUID()}`,
    name: parsed.data.name as PilotEventName,
    clinic_id: ctx.clinicId,
    user_id: ctx.userId,
    route: parsed.data.route ?? null,
    duration_ms: parsed.data.duration_ms ?? null,
    meta: sanitizePilotMeta(parsed.data.meta),
    created_at: new Date().toISOString(),
    app_version: APP_VERSION,
  };
  getPilotStore().events.unshift(event);
  // cap memória demo/piloto
  if (getPilotStore().events.length > 2000) {
    getPilotStore().events.length = 2000;
  }
  return { ok: true as const, id: event.id };
}

export function submitPilotFeedback(ctx: AuthzContext, raw: unknown) {
  const parsed = feedbackSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "FEEDBACK_INVALIDO");
  }
  const row = {
    id: `pf-${crypto.randomUUID()}`,
    clinic_id: ctx.clinicId,
    user_id: ctx.userId,
    kind: parsed.data.kind as PilotFeedbackKind,
    what_happened: parsed.data.what_happened,
    what_expected: parsed.data.what_expected,
    impact: parsed.data.impact as PilotFeedbackImpact,
    route: parsed.data.route ?? "",
    app_version: APP_VERSION,
    priority: null as null,
    created_at: new Date().toISOString(),
  };
  getPilotStore().feedback.unshift(row);
  trackPilotEvent(ctx, {
    name: "feedback.submitted",
    route: row.route || null,
    meta: { kind: row.kind, impact: row.impact },
  });
  return { ok: true as const, id: row.id };
}

export function listPilotFeedback(ctx: AuthzContext, limit = 50) {
  if (!can(ctx, "clinic.settings").allowed && !can(ctx, "audit.view").allowed) {
    throw new Error("AUTHORIZATION_DENIED");
  }
  return getPilotStore()
    .feedback.filter((f) => f.clinic_id === ctx.clinicId)
    .slice(0, limit);
}

export function getPilotCoverageMetrics(ctx: AuthzContext) {
  const procs = getPerformedStore().performedProcedures.filter(
    (p) => p.clinic_id === ctx.clinicId && p.status !== "cancelled",
  );
  const clinical = getClinicalStore().entries;
  const total = procs.length;
  const withConsumption = procs.filter((p) => p.consumption_confirmed).length;
  const withEvolution = procs.filter(
    (p) =>
      Boolean(p.clinical_entry_id) ||
      clinical.some((e) => e.performed_procedure_id === p.id),
  ).length;
  const withFinance = procs.filter(
    (p) =>
      p.financial_status === "charged" ||
      p.financial_status === "no_charge" ||
      p.financial_status === "included_in_plan",
  ).length;
  const withCost = procs.filter(
    (p) => p.actual_total_cost_cents != null,
  ).length;
  const appointmentsCompleted = getAgendaStore().appointments.filter(
    (a) => a.clinic_id === ctx.clinicId && a.status === "completed",
  ).length;

  const pct = (n: number) => (total === 0 ? null : Math.round((n / total) * 1000) / 10);

  return {
    appointments_completed: appointmentsCompleted,
    procedures_registered: total,
    consumption_confirmed: withConsumption,
    consumption_confirmed_pct: pct(withConsumption),
    evolution_registered: withEvolution,
    evolution_registered_pct: pct(withEvolution),
    finance_defined: withFinance,
    finance_defined_pct: pct(withFinance),
    cost_complete: withCost,
    cost_complete_pct: pct(withCost),
    feedback_count: getPilotStore().feedback.filter(
      (f) => f.clinic_id === ctx.clinicId,
    ).length,
    events_count: getPilotStore().events.filter(
      (e) => e.clinic_id === ctx.clinicId,
    ).length,
  };
}

export type PilotPrepItem = {
  key: string;
  label: string;
  done: boolean;
  href: string;
};

/** Checklist interno de preparação do piloto (§10). */
export function getPilotPreparationChecklist(ctx: AuthzContext): {
  items: PilotPrepItem[];
  ready_count: number;
  total: number;
} {
  const clinicOnboarding = getOnboarding(ctx);
  const inv = getInventoryStore();
  const procedures = inv.procedures.filter(
    (p) => p.clinic_id === ctx.clinicId && p.active,
  );
  const materials = inv.inventoryItems.filter(
    (i) => i.clinic_id === ctx.clinicId && i.active && !i.archived_at,
  );
  const fichas = inv.procedureMaterials.filter((m) => {
    const proc = procedures.find((p) => p.id === m.procedure_id);
    return Boolean(proc);
  });
  const stocked = materials.filter((i) => i.current_quantity > 0);
  let patients = 0;
  try {
    patients = listPatients(ctx, { page: 1, pageSize: 1, status: "active" })
      .total;
  } catch {
    patients = 0;
  }
  const hasAppt = getAgendaStore().appointments.some(
    (a) => a.clinic_id === ctx.clinicId,
  );

  const items: PilotPrepItem[] = [
    {
      key: "clinic",
      label: "Clínica configurada",
      done: clinicOnboarding.progress.clinic_done,
      href: "/app/configuracoes/clinica",
    },
    {
      key: "professional",
      label: "Profissional configurado",
      done: clinicOnboarding.progress.profile_done,
      href: "/app/configuracoes/perfil",
    },
    {
      key: "hours",
      label: "Horários configurados",
      done: clinicOnboarding.progress.hours_done,
      href: "/app/configuracoes/agenda",
    },
    {
      key: "procedures",
      label: "Procedimentos cadastrados (5–10 recomendados)",
      done: procedures.length >= 1,
      href: "/app/procedimentos",
    },
    {
      key: "materials",
      label: "Materiais cadastrados",
      done: materials.length >= 1,
      href: "/app/estoque",
    },
    {
      key: "bom",
      label: "Fichas técnicas configuradas",
      done: fichas.length >= 1,
      href: "/app/procedimentos",
    },
    {
      key: "stock",
      label: "Estoque inicial registrado",
      done: stocked.length >= 1,
      href: "/app/estoque",
    },
    {
      key: "patients",
      label: "Pacientes cadastrados",
      done: patients >= 1,
      href: "/app/pacientes",
    },
    {
      key: "agenda",
      label: "Agenda pronta",
      done: hasAppt || clinicOnboarding.progress.hours_done,
      href: "/app/agenda",
    },
  ];

  return {
    items,
    ready_count: items.filter((i) => i.done).length,
    total: items.length,
  };
}

/**
 * Compara previsto × real por material de um procedimento do catálogo.
 * Determinístico — sem IA. Só sinaliza revisão; não altera ficha.
 */
export function getProcedureMaterialVariance(
  ctx: AuthzContext,
  procedureId: string,
) {
  assertClinicProcedure(ctx, procedureId);
  const performed = getPerformedStore().performedProcedures.filter(
    (p) =>
      p.clinic_id === ctx.clinicId &&
      p.procedure_id === procedureId &&
      p.consumption_confirmed &&
      p.status !== "cancelled",
  );
  const consumptions = getPerformedStore().procedureConsumptions.filter(
    (c) =>
      c.clinic_id === ctx.clinicId &&
      performed.some((p) => p.id === c.performed_procedure_id) &&
      !c.is_extra,
  );

  type Agg = {
    inventory_item_id: string;
    item_name: string;
    unit: string;
    samples: number;
    planned_avg: number;
    actual_avg: number;
    delta_pct: number | null;
  };
  const map = new Map<string, Agg & { plannedSum: number; actualSum: number }>();

  for (const c of consumptions) {
    if (c.actual_quantity == null) continue;
    const key = c.actual_inventory_item_id ?? c.inventory_item_id;
    const cur = map.get(key) ?? {
      inventory_item_id: key,
      item_name: c.actual_item_name_snapshot ?? c.item_name_snapshot,
      unit: c.consumption_unit,
      samples: 0,
      planned_avg: 0,
      actual_avg: 0,
      delta_pct: null,
      plannedSum: 0,
      actualSum: 0,
    };
    cur.samples += 1;
    cur.plannedSum += c.planned_quantity;
    cur.actualSum += c.actual_quantity;
    map.set(key, cur);
  }

  const rows = [...map.values()].map((r) => {
    const planned_avg = r.plannedSum / r.samples;
    const actual_avg = r.actualSum / r.samples;
    const delta_pct =
      planned_avg === 0
        ? null
        : Math.round(((actual_avg - planned_avg) / planned_avg) * 1000) / 10;
    return {
      inventory_item_id: r.inventory_item_id,
      item_name: r.item_name,
      unit: r.unit,
      samples: r.samples,
      planned_avg: Math.round(planned_avg * 1000) / 1000,
      actual_avg: Math.round(actual_avg * 1000) / 1000,
      delta_pct,
      suggest_review: delta_pct != null && Math.abs(delta_pct) >= 25 && r.samples >= 3,
    };
  });

  return {
    procedure_id: procedureId,
    performed_count: performed.length,
    rows,
    has_review_suggestion: rows.some((r) => r.suggest_review),
  };
}

function assertClinicProcedure(ctx: AuthzContext, procedureId: string) {
  const proc = getInventoryStore().procedures.find(
    (p) => p.id === procedureId && p.clinic_id === ctx.clinicId,
  );
  if (!proc) throw new Error("PROCEDURE_NOT_FOUND");
  return proc;
}
