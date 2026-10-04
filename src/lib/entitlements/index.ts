import type { AuthzContext } from "@/lib/authz/can";
import { can } from "@/lib/authz/can";
import { getBillingStore } from "@/lib/demo/billing-store";
import { getAuthzStore } from "@/lib/demo/authz-store";
import type { EntitlementKey } from "@/types/saas-billing";
import {
  isSubscriptionRestricted,
  isSubscriptionUsable,
} from "@/types/saas-billing";
import type { PermissionKey } from "@/lib/permissions/keys";

export type EntitlementDecision = {
  allowed: boolean;
  reason?:
    | "no_subscription"
    | "subscription_restricted"
    | "plan_missing_entitlement"
    | "permission_denied"
    | "ok";
};

export function getClinicSubscription(clinicId: string) {
  const rows = getBillingStore().subscriptions.filter(
    (s) => s.clinic_id === clinicId,
  );
  // prefer open statuses
  return (
    rows.find((s) => s.status === "active" || s.status === "trialing") ??
    rows.find((s) => s.status === "past_due") ??
    rows[0] ??
    null
  );
}

export function getPlanForClinic(clinicId: string) {
  const sub = getClinicSubscription(clinicId);
  if (!sub) return null;
  return getBillingStore().plans.find((p) => p.id === sub.plan_id) ?? null;
}

export function listPlanEntitlements(planId: string): EntitlementKey[] {
  return getBillingStore()
    .entitlements.filter((e) => e.plan_id === planId && e.enabled)
    .map((e) => e.entitlement_key);
}

/** Plano permite o entitlement? (independente de permission do usuário) */
export function planAllowsEntitlement(
  clinicId: string,
  key: EntitlementKey,
): boolean {
  const sub = getClinicSubscription(clinicId);
  if (!sub) return false;
  if (!isSubscriptionUsable(sub.status) && isSubscriptionRestricted(sub.status)) {
    // modo restrito: entitlements de leitura/billing implícitos; features avançadas off
    return key === "exports";
  }
  return getBillingStore().entitlements.some(
    (e) => e.plan_id === sub.plan_id && e.entitlement_key === key && e.enabled,
  );
}

/**
 * PLAN ALLOWS AND USER HAS PERMISSION
 */
export function hasEntitlement(
  ctx: AuthzContext,
  key: EntitlementKey,
  permission?: PermissionKey,
): EntitlementDecision {
  const sub = getClinicSubscription(ctx.clinicId);
  if (!sub) return { allowed: false, reason: "no_subscription" };

  if (!planAllowsEntitlement(ctx.clinicId, key)) {
    if (isSubscriptionRestricted(sub.status)) {
      return { allowed: false, reason: "subscription_restricted" };
    }
    return { allowed: false, reason: "plan_missing_entitlement" };
  }

  if (permission) {
    const perm = can(ctx, permission);
    if (!perm.allowed) {
      return { allowed: false, reason: "permission_denied" };
    }
  }

  return { allowed: true, reason: "ok" };
}

export type PlanLimitKey =
  | "max_professionals"
  | "max_staff_users"
  | "storage_limit_bytes";

export function checkPlanLimit(
  clinicId: string,
  limit: PlanLimitKey,
): {
  allowed: boolean;
  limit: number | null;
  used: number;
  remaining: number | null;
} {
  const plan = getPlanForClinic(clinicId);
  const store = getAuthzStore();
  const members = store.memberships.filter(
    (m) => m.clinic_id === clinicId && m.status === "active",
  );

  if (limit === "max_professionals") {
    const used = members.filter(
      (m) => m.role_key === "dentist" || m.role_key === "owner",
    ).length;
    const max = plan?.max_professionals ?? null;
    return {
      allowed: max == null ? true : used < max,
      limit: max,
      used,
      remaining: max == null ? null : Math.max(0, max - used),
    };
  }

  if (limit === "max_staff_users") {
    const used = members.length;
    const max = plan?.max_staff_users ?? null;
    return {
      allowed: max == null ? true : used < max,
      limit: max,
      used,
      remaining: max == null ? null : Math.max(0, max - used),
    };
  }

  // storage — demo não rastreia bytes reais; placeholder 0 used
  const max = plan?.storage_limit_bytes ?? null;
  return {
    allowed: true,
    limit: max,
    used: 0,
    remaining: max,
  };
}

export function assertClinicCanMutate(ctx: AuthzContext) {
  const sub = getClinicSubscription(ctx.clinicId);
  if (!sub) {
    const err = new Error("SUBSCRIPTION_REQUIRED");
    throw err;
  }
  if (isSubscriptionRestricted(sub.status)) {
    const err = new Error("SUBSCRIPTION_RESTRICTED");
    throw err;
  }
  if (!isSubscriptionUsable(sub.status)) {
    const err = new Error("SUBSCRIPTION_RESTRICTED");
    throw err;
  }
}

export function assertEntitlement(
  ctx: AuthzContext,
  key: EntitlementKey,
  permission?: PermissionKey,
) {
  const d = hasEntitlement(ctx, key, permission);
  if (!d.allowed) {
    if (d.reason === "permission_denied") {
      throw new Error("AUTHORIZATION_DENIED");
    }
    if (d.reason === "subscription_restricted") {
      throw new Error("SUBSCRIPTION_RESTRICTED");
    }
    throw new Error("PLAN_ENTITLEMENT_REQUIRED");
  }
}
