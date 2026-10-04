import { createHash, timingSafeEqual } from "crypto";
import { z } from "zod";
import {
  appendAudit,
  getAuthzStore,
  getClinic,
  getMembership,
  getProfile,
  inviteMember,
  setDemoSession,
  type DemoClinic,
  type DemoMembership,
  type DemoProfile,
} from "@/lib/demo/authz-store";
import {
  getBillingStore,
  PRO_ID,
  STARTER_ID,
} from "@/lib/demo/billing-store";
import { getBillingProvider } from "@/lib/billing/demo-provider";
import {
  assertClinicCanMutate,
  checkPlanLimit,
  getClinicSubscription,
  getPlanForClinic,
  listPlanEntitlements,
} from "@/lib/entitlements";
import { defaultClinicHours, defaultOnboarding } from "@/types/clinic-settings";
import { DEFAULT_FEATURE_FLAGS } from "@/lib/feature-flags";
import type { AuthzContext } from "@/lib/authz/can";
import { assertPermission } from "@/lib/authz/guards";
import type {
  ClinicSubscription,
  SubscriptionStatus,
} from "@/types/saas-billing";
import { APP_VERSION } from "@/lib/version";
import {
  attachClinicCommercialMeta,
  trackCommercialEventPublic,
  validateBetaInvite,
} from "@/services/commercial";

function now() {
  return new Date().toISOString();
}

function hashPassword(password: string) {
  return createHash("sha256").update(`sorria:${password}`).digest("hex");
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function safeEqualHex(a: string, b: string) {
  try {
    const ba = Buffer.from(a, "hex");
    const bb = Buffer.from(b, "hex");
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

const signupSchema = z.object({
  full_name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(200),
  password: z.string().min(8).max(72),
  invite_code: z.string().trim().max(64).optional().nullable(),
});

const clinicSchema = z.object({
  name: z.string().trim().min(2).max(120),
  phone: z.string().trim().max(40).optional().nullable(),
  city: z.string().trim().max(80).optional().nullable(),
  timezone: z.string().trim().min(3).max(64).default("America/Sao_Paulo"),
  professional_name: z.string().trim().max(120).optional().nullable(),
  plan_code: z.enum(["starter", "pro"]).default("starter"),
  invite_code: z.string().trim().max(64).optional().nullable(),
  founder_pricing: z.boolean().optional(),
});

export function listPublicPlans() {
  return getBillingStore()
    .plans.filter((p) => p.active)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((p) => ({
      ...p,
      entitlements: listPlanEntitlements(p.id),
      /** Preços placeholder — revisão de produto necessária */
      price_placeholder: true,
    }));
}

export function signupAccount(raw: unknown) {
  const parsed = signupSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Dados inválidos");
  }

  // validação invite-only (sem consumir ainda — consumo na criação da clínica)
  const inviteCheck = validateBetaInvite(parsed.data.invite_code);
  if (inviteCheck.required && !inviteCheck.valid) {
    throw new Error(inviteCheck.reason ?? "INVITE_REQUIRED");
  }

  const email = parsed.data.email.toLowerCase();
  const store = getBillingStore();
  if (store.accounts.some((a) => a.email === email)) {
    throw new Error("EMAIL_ALREADY_REGISTERED");
  }
  const authz = getAuthzStore();
  if (authz.profiles.some((p) => p.email.toLowerCase() === email)) {
    throw new Error("EMAIL_ALREADY_REGISTERED");
  }

  const userId = crypto.randomUUID();
  const profile: DemoProfile = {
    id: userId,
    full_name: parsed.data.full_name,
    email,
    phone: null,
    professional_name: parsed.data.full_name,
    cro: null,
    cro_uf: null,
    specialty: null,
    avatar_url: null,
  };
  authz.profiles.push(profile);
  store.accounts.push({
    user_id: userId,
    email,
    password_hash: hashPassword(parsed.data.password),
    full_name: parsed.data.full_name,
    email_verified: false,
    created_at: now(),
    pending_invite_code: parsed.data.invite_code?.trim() || null,
  });

  // sessão sem clínica ainda
  setDemoSession(userId, "");

  trackCommercialEventPublic("signup_completed", {
    userId,
    meta: { invite_only: inviteCheck.required },
  });

  return {
    user_id: userId,
    email,
    email_verified: false,
    next: "/cadastro/clinica",
  };
}

export function createClinicForOwner(userId: string, raw: unknown) {
  const profile = getProfile(userId);
  if (!profile) throw new Error("PROFILE_NOT_FOUND");

  const parsed = clinicSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Dados inválidos");
  }

  const clinicId = crypto.randomUUID();
  const stamp = now();
  const clinic: DemoClinic = {
    id: clinicId,
    name: parsed.data.name,
    trade_name: null,
    timezone: parsed.data.timezone,
    phone: parsed.data.phone ?? null,
    email: profile.email,
    address_line: null,
    city: parsed.data.city ?? null,
    state: null,
    status: "active",
    hours: defaultClinicHours(),
    slot_minutes: 30,
    logo_url: null,
    onboarding: defaultOnboarding(false),
    feature_flags: {
      ...DEFAULT_FEATURE_FLAGS,
      assistant_enabled: false,
      portal_enabled: false,
    },
  };
  clinic.onboarding.clinic_done = true;
  clinic.onboarding.welcome_seen = true;

  if (parsed.data.professional_name) {
    profile.professional_name = parsed.data.professional_name;
    clinic.onboarding.profile_done = true;
  }

  const membership: DemoMembership = {
    id: crypto.randomUUID(),
    clinic_id: clinicId,
    user_id: userId,
    role_key: "owner",
    status: "active",
    clinical_access: false, // owner ≠ acesso clínico universal
    invited_at: null,
    joined_at: stamp,
    suspended_at: null,
    created_at: stamp,
    updated_at: stamp,
  };

  const authz = getAuthzStore();
  authz.clinics.push(clinic);
  authz.memberships.push(membership);

  const plan =
    getBillingStore().plans.find((p) => p.code === parsed.data.plan_code) ??
    getBillingStore().plans.find((p) => p.id === STARTER_ID)!;

  const trialDays = plan.trial_days ?? 0;
  const trialEnd = new Date();
  if (trialDays > 0) trialEnd.setDate(trialEnd.getDate() + trialDays);

  const subscription: ClinicSubscription = {
    id: crypto.randomUUID(),
    clinic_id: clinicId,
    plan_id: plan.id,
    status: trialDays > 0 ? "trialing" : "active",
    trial_started_at: trialDays > 0 ? stamp : null,
    trial_ends_at: trialDays > 0 ? trialEnd.toISOString() : null,
    current_period_start: stamp,
    current_period_end: trialDays > 0 ? trialEnd.toISOString() : null,
    cancel_at_period_end: false,
    billing_provider: "demo",
    provider_customer_id: null,
    provider_subscription_id: null,
    created_at: stamp,
    updated_at: stamp,
  };
  getBillingStore().subscriptions.push(subscription);

  const account = getBillingStore().accounts.find((a) => a.user_id === userId);
  const inviteCode =
    parsed.data.invite_code?.trim() || account?.pending_invite_code || null;
  attachClinicCommercialMeta(clinicId, {
    invite_code: inviteCode,
    founder_pricing: parsed.data.founder_pricing ?? false,
    commercial_offer: parsed.data.founder_pricing ? "founder" : "trial",
  });
  if (account) account.pending_invite_code = null;

  appendAudit({
    clinic_id: clinicId,
    actor_user_id: userId,
    action: "subscription.created",
    target_type: "clinic_subscription",
    target_id: subscription.id,
    metadata: { plan_code: plan.code, status: subscription.status },
  });

  setDemoSession(userId, clinicId);

  return {
    clinic,
    membership,
    subscription,
    plan,
    next: "/app/onboarding",
  };
}

export function getSubscriptionOverview(ctx: AuthzContext) {
  assertPermission(ctx, "clinic.settings");
  const sub = getClinicSubscription(ctx.clinicId);
  const plan = getPlanForClinic(ctx.clinicId);
  const professionals = checkPlanLimit(ctx.clinicId, "max_professionals");
  const staff = checkPlanLimit(ctx.clinicId, "max_staff_users");
  const storage = checkPlanLimit(ctx.clinicId, "storage_limit_bytes");
  return {
    subscription: sub,
    plan,
    entitlements: plan ? listPlanEntitlements(plan.id) : [],
    usage: {
      professionals,
      staff,
      storage,
    },
    app_version: APP_VERSION,
  };
}

export function requestCancelSubscription(ctx: AuthzContext) {
  assertPermission(ctx, "clinic.settings");
  const sub = getClinicSubscription(ctx.clinicId);
  if (!sub) throw new Error("SUBSCRIPTION_NOT_FOUND");
  sub.cancel_at_period_end = true;
  sub.updated_at = now();
  appendAudit({
    clinic_id: ctx.clinicId,
    actor_user_id: ctx.userId,
    action: "subscription.cancel_requested",
    target_type: "clinic_subscription",
    target_id: sub.id,
    metadata: {},
  });
  return sub;
}

export function changeClinicPlan(ctx: AuthzContext, planCode: string) {
  assertPermission(ctx, "clinic.settings");
  assertClinicCanMutate(ctx);
  const plan = getBillingStore().plans.find(
    (p) => p.code === planCode && p.active,
  );
  if (!plan) throw new Error("PLAN_NOT_FOUND");
  const sub = getClinicSubscription(ctx.clinicId);
  if (!sub) throw new Error("SUBSCRIPTION_NOT_FOUND");
  const previous = sub.plan_id;
  sub.plan_id = plan.id;
  sub.updated_at = now();
  // upgrade/downgrade: nunca apaga dados
  appendAudit({
    clinic_id: ctx.clinicId,
    actor_user_id: ctx.userId,
    action: "subscription.plan_changed",
    target_type: "clinic_subscription",
    target_id: sub.id,
    metadata: { from_plan_id: previous, to_plan_id: plan.id, plan_code: plan.code },
  });
  return { subscription: sub, plan };
}

export function expireTrialForTests(clinicId: string) {
  const sub = getClinicSubscription(clinicId);
  if (!sub) return null;
  sub.status = "expired";
  sub.trial_ends_at = now();
  sub.updated_at = now();
  return sub;
}

export function setSubscriptionStatusForTests(
  clinicId: string,
  status: SubscriptionStatus,
) {
  const sub = getClinicSubscription(clinicId);
  if (!sub) return null;
  sub.status = status;
  sub.updated_at = now();
  return sub;
}

/** Webhook idempotente — server authority. */
export async function handleBillingWebhook(input: {
  rawBody: string;
  signature: string | null;
}) {
  const provider = getBillingProvider();
  const parsed = await provider.verifyAndParseWebhook(input);
  if (!parsed) {
    throw new Error("WEBHOOK_INVALID");
  }

  const store = getBillingStore();
  const existing = store.events.find(
    (e) =>
      e.provider === provider.name &&
      e.provider_event_id === parsed.providerEventId,
  );
  if (existing?.status === "processed") {
    return { ok: true as const, duplicate: true, event_id: existing.id };
  }

  const event: (typeof store.events)[number] = {
    id: crypto.randomUUID(),
    provider: provider.name,
    provider_event_id: parsed.providerEventId,
    event_type: parsed.eventType,
    clinic_id: parsed.clinicId,
    payload_digest: createHash("sha256").update(input.rawBody).digest("hex"),
    processed_at: null,
    status: "received",
    error_message: null,
    created_at: now(),
  };
  store.events.push(event);

  try {
    if (parsed.clinicId) {
      const sub = getClinicSubscription(parsed.clinicId);
      if (sub) {
        if (parsed.planCode) {
          const plan = store.plans.find((p) => p.code === parsed.planCode);
          if (plan) sub.plan_id = plan.id;
        }
        if (parsed.status === "active") sub.status = "active";
        if (parsed.status === "past_due") sub.status = "past_due";
        if (parsed.status === "cancelled") sub.status = "cancelled";
        if (parsed.subscriptionId) {
          sub.provider_subscription_id = parsed.subscriptionId;
        }
        sub.updated_at = now();
        appendAudit({
          clinic_id: parsed.clinicId,
          actor_user_id: "system",
          action: `subscription.${parsed.eventType}`,
          target_type: "clinic_subscription",
          target_id: sub.id,
          metadata: { provider_event_id: parsed.providerEventId },
        });
      }
    }
    event.status = "processed";
    event.processed_at = now();
  } catch (err) {
    event.status = "failed";
    event.error_message =
      err instanceof Error ? err.message : "webhook_failed";
  }

  return { ok: true as const, duplicate: false, event_id: event.id };
}

export function createSecureInvitation(
  ctx: AuthzContext,
  input: { email: string; role_key: "dentist" | "secretary"; full_name: string },
) {
  assertPermission(ctx, "team.invite");
  assertClinicCanMutate(ctx);

  const staffLimit = checkPlanLimit(ctx.clinicId, "max_staff_users");
  if (!staffLimit.allowed) {
    throw new Error("PLAN_STAFF_LIMIT_REACHED");
  }
  if (input.role_key === "dentist") {
    const prof = checkPlanLimit(ctx.clinicId, "max_professionals");
    if (!prof.allowed) throw new Error("PLAN_PROFESSIONAL_LIMIT_REACHED");
  }

  const email = input.email.trim().toLowerCase();
  const token = crypto.randomUUID() + crypto.randomUUID();
  const invitation = {
    id: crypto.randomUUID(),
    clinic_id: ctx.clinicId,
    email,
    role_key: input.role_key,
    token_hash: hashToken(token),
    invited_by: ctx.userId,
    expires_at: new Date(Date.now() + 7 * 86400_000).toISOString(),
    accepted_at: null,
    revoked_at: null,
    created_at: now(),
  };
  getBillingStore().invitations.push(invitation);

  const invited = inviteMember({
    clinicId: ctx.clinicId,
    actorUserId: ctx.userId,
    fullName: input.full_name,
    email,
    roleKey: input.role_key,
  });

  appendAudit({
    clinic_id: ctx.clinicId,
    actor_user_id: ctx.userId,
    action: "team.invitation_token_created",
    target_type: "clinic_invitation",
    target_id: invitation.id,
    metadata: { email, role: input.role_key },
  });

  return {
    invitation_id: invitation.id,
    membership: invited.membership,
    /** token só retornado na criação — não armazenar plaintext */
    accept_token: token,
    expires_at: invitation.expires_at,
  };
}

export function acceptInvitation(token: string, userId: string) {
  const hash = hashToken(token);
  const inv = getBillingStore().invitations.find(
    (i) => !i.accepted_at && !i.revoked_at && safeEqualHex(i.token_hash, hash),
  );
  if (!inv) throw new Error("INVITATION_INVALID");
  if (new Date(inv.expires_at).getTime() < Date.now()) {
    throw new Error("INVITATION_EXPIRED");
  }
  const profile = getProfile(userId);
  if (!profile) throw new Error("PROFILE_NOT_FOUND");
  if (profile.email.toLowerCase() !== inv.email) {
    throw new Error("INVITATION_EMAIL_MISMATCH");
  }

  const membership = getMembership(userId, inv.clinic_id);
  if (!membership) throw new Error("MEMBERSHIP_NOT_FOUND");
  membership.status = "active";
  membership.joined_at = now();
  membership.updated_at = now();
  inv.accepted_at = now();

  setDemoSession(userId, inv.clinic_id);
  appendAudit({
    clinic_id: inv.clinic_id,
    actor_user_id: userId,
    action: "team.invite_accepted",
    target_type: "clinic_invitation",
    target_id: inv.id,
    metadata: {},
  });
  return { clinic_id: inv.clinic_id, membership };
}

export function listMembershipClinics(userId: string) {
  const store = getAuthzStore();
  return store.memberships
    .filter((m) => m.user_id === userId && m.status === "active")
    .map((m) => {
      const clinic = getClinic(m.clinic_id);
      return {
        clinic_id: m.clinic_id,
        clinic_name: clinic?.name ?? "Clínica",
        role_key: m.role_key,
      };
    });
}

export function switchClinic(userId: string, clinicId: string) {
  const membership = getMembership(userId, clinicId);
  if (!membership || membership.status !== "active") {
    throw new Error("MEMBERSHIP_NOT_FOUND");
  }
  setDemoSession(userId, clinicId);
  return { clinic_id: clinicId };
}

export function requestAccountClosure(ctx: AuthzContext, confirm: string) {
  assertPermission(ctx, "clinic.settings");
  if (confirm !== "ENCERRAR") {
    throw new Error("CONFIRMATION_REQUIRED");
  }
  const sub = getClinicSubscription(ctx.clinicId);
  if (sub) {
    sub.cancel_at_period_end = true;
    sub.status = "cancelled";
    sub.updated_at = now();
  }
  appendAudit({
    clinic_id: ctx.clinicId,
    actor_user_id: ctx.userId,
    action: "clinic.closure_requested",
    target_type: "clinic",
    target_id: ctx.clinicId,
    metadata: {
      note: "Soft cancel — sem hard delete. Retenção jurídica pendente.",
    },
  });
  return {
    ok: true as const,
    message:
      "Solicitação registrada. Dados não são apagados automaticamente. Exportação e retenção: política em revisão jurídica.",
  };
}

export function internalFindClinic(query: string) {
  const q = query.trim().toLowerCase();
  return getAuthzStore()
    .clinics.filter(
      (c) =>
        c.id.includes(q) ||
        c.name.toLowerCase().includes(q) ||
        (c.email ?? "").toLowerCase().includes(q),
    )
    .slice(0, 20)
    .map((c) => {
      const sub = getClinicSubscription(c.id);
      const plan = getPlanForClinic(c.id);
      return {
        id: c.id,
        name: c.name,
        city: c.city,
        status: c.status,
        subscription_status: sub?.status ?? null,
        plan_code: plan?.code ?? null,
        // sem dados clínicos
      };
    });
}

export function getSaasHealth() {
  return {
    auth: "ok",
    database: "ok",
    storage: "unknown",
    billing: getBillingProvider().name,
    email: "demo",
    version: APP_VERSION,
    time: now(),
  };
}

export { STARTER_ID, PRO_ID };
