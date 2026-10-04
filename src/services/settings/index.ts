import { z } from "zod";
import { assertPermission } from "@/lib/authz/guards";
import { can, type AuthzContext } from "@/lib/authz/can";
import {
  appendAudit,
  getAuthzStore,
  getClinic,
  getProfile,
  type DemoClinic,
  type DemoProfile,
} from "@/lib/demo/authz-store";
import { DEFAULT_FEATURE_FLAGS, type FeatureFlags } from "@/lib/feature-flags";
import {
  WEEKDAY_ORDER,
  defaultClinicHours,
  isOnboardingComplete,
  type ClinicHoursConfig,
  type ClinicStatus,
  type OnboardingProgress,
  type WeekdayKey,
} from "@/types/clinic-settings";
import { getAgendaStore } from "@/lib/demo/agenda-store";
import { getInventoryStore } from "@/lib/demo/inventory-store";
import { listPatients } from "@/services/patients/queries";

const clinicUpdateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  trade_name: z.string().trim().max(120).nullable().optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  email: z.string().trim().email().nullable().or(z.literal("")).optional(),
  address_line: z.string().trim().max(200).nullable().optional(),
  city: z.string().trim().max(80).nullable().optional(),
  state: z.string().trim().max(2).nullable().optional(),
  timezone: z.string().trim().min(3).max(64).optional(),
  slot_minutes: z.number().int().min(5).max(240).optional(),
  status: z.enum(["active", "suspended", "closed"]).optional(),
  feature_flags: z
    .object({
      assistant_enabled: z.boolean().optional(),
      portal_enabled: z.boolean().optional(),
    })
    .optional(),
});

const profileUpdateSchema = z.object({
  full_name: z.string().trim().min(2).max(120).optional(),
  professional_name: z.string().trim().max(120).nullable().optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  cro: z.string().trim().max(20).nullable().optional(),
  cro_uf: z.string().trim().max(2).nullable().optional(),
  specialty: z.string().trim().max(80).nullable().optional(),
});

const periodSchema = z.object({
  start: z.string().regex(/^\d{2}:\d{2}$/),
  end: z.string().regex(/^\d{2}:\d{2}$/),
});

const hoursSchema = z.record(
  z.enum(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]),
  z.object({
    enabled: z.boolean(),
    periods: z.array(periodSchema),
  }),
);

function requireActiveClinic(clinic: DemoClinic | null): DemoClinic {
  if (!clinic) throw new Error("CLINIC_NOT_FOUND");
  if (clinic.status === "suspended" || clinic.status === "closed") {
    throw new Error("CLINIC_INACTIVE");
  }
  return clinic;
}

export function getClinicSettings(ctx: AuthzContext) {
  assertPermission(ctx, "clinic.settings");
  const clinic = getClinic(ctx.clinicId);
  if (!clinic) throw new Error("CLINIC_NOT_FOUND");
  return clinic;
}

export function updateClinicSettings(
  ctx: AuthzContext,
  raw: Record<string, unknown>,
) {
  assertPermission(ctx, "clinic.settings");
  const clinic = requireActiveClinic(getClinic(ctx.clinicId));
  const parsed = clinicUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Dados inválidos");
  }
  const data = parsed.data;
  if (data.name !== undefined) clinic.name = data.name;
  if (data.trade_name !== undefined) clinic.trade_name = data.trade_name;
  if (data.phone !== undefined) clinic.phone = data.phone;
  if (data.email !== undefined) {
    clinic.email = data.email === "" ? null : data.email;
  }
  if (data.address_line !== undefined) clinic.address_line = data.address_line;
  if (data.city !== undefined) clinic.city = data.city;
  if (data.state !== undefined) clinic.state = data.state?.toUpperCase() ?? null;
  if (data.timezone !== undefined) clinic.timezone = data.timezone;
  if (data.slot_minutes !== undefined) clinic.slot_minutes = data.slot_minutes;
  if (data.status !== undefined) clinic.status = data.status as ClinicStatus;
  if (data.feature_flags) {
    clinic.feature_flags = {
      ...DEFAULT_FEATURE_FLAGS,
      ...clinic.feature_flags,
      ...data.feature_flags,
    } as FeatureFlags;
  }
  if (!clinic.onboarding.clinic_done) {
    clinic.onboarding.clinic_done = true;
    maybeCompleteOnboarding(clinic);
  }
  appendAudit({
    clinic_id: ctx.clinicId,
    actor_user_id: ctx.userId,
    action: "clinic.settings_updated",
    target_type: "clinic",
    target_id: clinic.id,
    metadata: { fields: Object.keys(data) },
  });
  return clinic;
}

export function updateClinicHours(ctx: AuthzContext, raw: unknown) {
  assertPermission(ctx, "clinic.settings");
  const clinic = requireActiveClinic(getClinic(ctx.clinicId));
  const parsed = hoursSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error("Horários inválidos");
  }
  // Validate period order
  for (const day of WEEKDAY_ORDER) {
    const d = parsed.data[day];
    if (!d) continue;
    for (const p of d.periods) {
      if (p.start >= p.end) {
        throw new Error(`Período inválido em ${day}: início deve ser antes do fim`);
      }
    }
  }
  clinic.hours = parsed.data as ClinicHoursConfig;
  clinic.onboarding.hours_done = true;
  maybeCompleteOnboarding(clinic);
  appendAudit({
    clinic_id: ctx.clinicId,
    actor_user_id: ctx.userId,
    action: "clinic.hours_updated",
    target_type: "clinic",
    target_id: clinic.id,
    metadata: {},
  });
  return clinic.hours;
}

export function getMyProfile(ctx: AuthzContext) {
  return getProfile(ctx.userId);
}

export function updateMyProfile(ctx: AuthzContext, raw: Record<string, unknown>) {
  const parsed = profileUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Dados inválidos");
  }
  const store = getAuthzStore();
  const profile = store.profiles.find((p) => p.id === ctx.userId);
  if (!profile) throw new Error("PROFILE_NOT_FOUND");
  const data = parsed.data;
  if (data.full_name !== undefined) profile.full_name = data.full_name;
  if (data.professional_name !== undefined) {
    profile.professional_name = data.professional_name;
  }
  if (data.phone !== undefined) profile.phone = data.phone;
  if (data.cro !== undefined) profile.cro = data.cro;
  if (data.cro_uf !== undefined) {
    profile.cro_uf = data.cro_uf?.toUpperCase() ?? null;
  }
  if (data.specialty !== undefined) profile.specialty = data.specialty;

  const clinic = getClinic(ctx.clinicId);
  if (clinic && !clinic.onboarding.profile_done) {
    clinic.onboarding.profile_done = true;
    maybeCompleteOnboarding(clinic);
  }
  appendAudit({
    clinic_id: ctx.clinicId,
    actor_user_id: ctx.userId,
    action: "profile.updated",
    target_type: "profile",
    target_id: profile.id,
    metadata: { fields: Object.keys(data) },
  });
  return profile;
}

export function getOnboarding(ctx: AuthzContext) {
  const clinic = getClinic(ctx.clinicId);
  if (!clinic) throw new Error("CLINIC_NOT_FOUND");
  // Sync checklist with real data when modules already have records
  if (can(ctx, "patients.demographics.view").allowed) {
    try {
      if (listPatients(ctx, { page: 1, pageSize: 1, status: "all" }).items.length > 0) {
        clinic.onboarding.first_patient_done = true;
      }
    } catch {
      /* ignore */
    }
  }
  if (can(ctx, "appointments.view").allowed) {
    const hasAppt = getAgendaStore().appointments.some(
      (a) => a.clinic_id === ctx.clinicId,
    );
    if (hasAppt) clinic.onboarding.first_appointment_done = true;
  }
  maybeCompleteOnboarding(clinic);
  return {
    progress: clinic.onboarding,
    complete: isOnboardingComplete(clinic.onboarding),
    checklist: buildChecklist(ctx, clinic),
  };
}

export function markOnboardingStep(
  ctx: AuthzContext,
  step: keyof OnboardingProgress | "dismiss" | "welcome",
) {
  const clinic = getClinic(ctx.clinicId);
  if (!clinic) throw new Error("CLINIC_NOT_FOUND");
  if (step === "dismiss") {
    clinic.onboarding.dismissed = true;
  } else if (step === "welcome") {
    clinic.onboarding.welcome_seen = true;
  } else if (step in clinic.onboarding) {
    (clinic.onboarding as Record<string, unknown>)[step] = true;
  }
  maybeCompleteOnboarding(clinic);
  appendAudit({
    clinic_id: ctx.clinicId,
    actor_user_id: ctx.userId,
    action: "onboarding.step",
    target_type: "clinic",
    target_id: clinic.id,
    metadata: { step },
  });
  return getOnboarding(ctx);
}

export function resetOnboardingForTests(clinicId: string) {
  const clinic = getClinic(clinicId);
  if (!clinic) return;
  clinic.onboarding = {
    welcome_seen: false,
    clinic_done: false,
    profile_done: false,
    hours_done: false,
    first_patient_done: false,
    first_appointment_done: false,
    dismissed: false,
    completed_at: null,
  };
  clinic.hours = defaultClinicHours();
}

function maybeCompleteOnboarding(clinic: DemoClinic) {
  if (isOnboardingComplete(clinic.onboarding) && !clinic.onboarding.completed_at) {
    clinic.onboarding.completed_at = new Date().toISOString();
  }
}

function buildChecklist(ctx: AuthzContext, clinic: DemoClinic) {
  const o = clinic.onboarding;
  const inv = getInventoryStore();
  const proceduresDone = inv.procedures.some(
    (p) => p.clinic_id === ctx.clinicId && p.active,
  );
  const materialsDone = inv.procedureMaterials.some((m) => {
    const proc = inv.procedures.find(
      (p) => p.id === m.procedure_id && p.clinic_id === ctx.clinicId,
    );
    return Boolean(proc);
  });
  const stockDone = inv.inventoryItems.some(
    (i) =>
      i.clinic_id === ctx.clinicId &&
      i.active &&
      !i.archived_at &&
      i.current_quantity > 0,
  );
  return [
    {
      key: "clinic",
      label: "1. Clínica",
      done: o.clinic_done,
      href: "/app/onboarding?step=clinic",
    },
    {
      key: "procedures",
      label: "2. Procedimentos",
      done: proceduresDone,
      href: "/app/procedimentos/novo?from=onboarding",
    },
    {
      key: "materials",
      label: "3. Materiais",
      done: materialsDone,
      href: "/app/procedimentos?from=onboarding",
    },
    {
      key: "stock",
      label: "4. Estoque inicial",
      done: stockDone,
      href: "/app/estoque?from=onboarding",
    },
    {
      key: "patient",
      label: "5. Primeiro paciente",
      done: o.first_patient_done,
      href: "/app/pacientes/novo?from=onboarding",
    },
    {
      key: "appointment",
      label: "6. Primeira consulta",
      done: o.first_appointment_done,
      href: "/app/agenda?from=onboarding",
    },
  ] as const;
}

export function listRecentAudit(ctx: AuthzContext, limit = 30) {
  assertPermission(ctx, "audit.view");
  return getAuthzStore()
    .auditLogs
    .filter((a) => a.clinic_id === ctx.clinicId)
    .slice(0, limit)
    .map((a) => ({
      id: a.id,
      action: a.action,
      target_type: a.target_type,
      target_id: a.target_id,
      actor_user_id: a.actor_user_id,
      created_at: a.created_at,
      metadata: a.metadata,
    }));
}

export type { DemoClinic, DemoProfile, WeekdayKey };
