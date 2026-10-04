import {
  getMembership,
  permissionsForRole,
} from "@/lib/demo/authz-store";
import type { PermissionKey } from "@/lib/permissions/keys";

export type AuthzContext = {
  userId: string;
  clinicId: string;
};

export type AuthzDecision = {
  allowed: boolean;
  reason?:
    | "unauthenticated"
    | "no_membership"
    | "invited"
    | "suspended"
    | "revoked"
    | "missing_permission"
    | "tenant_mismatch";
};

/**
 * Camada centralizada de autorização.
 * UI usa para UX; servidor revalida; RLS é a última linha.
 */
export function can(
  ctx: AuthzContext | null | undefined,
  permission: PermissionKey,
  resourceClinicId?: string,
): AuthzDecision {
  if (!ctx?.userId || !ctx.clinicId) {
    return { allowed: false, reason: "unauthenticated" };
  }

  if (resourceClinicId && resourceClinicId !== ctx.clinicId) {
    return { allowed: false, reason: "tenant_mismatch" };
  }

  const membership = getMembership(ctx.userId, ctx.clinicId);
  if (!membership) {
    return { allowed: false, reason: "no_membership" };
  }

  if (membership.status === "invited") {
    return { allowed: false, reason: "invited" };
  }
  if (membership.status === "suspended") {
    return { allowed: false, reason: "suspended" };
  }
  if (membership.status === "revoked") {
    return { allowed: false, reason: "revoked" };
  }

  const granted = permissionsForRole(membership.role_key);
  if (!granted.includes(permission)) {
    return { allowed: false, reason: "missing_permission" };
  }

  return { allowed: true };
}

export function canAll(
  ctx: AuthzContext | null | undefined,
  permissions: PermissionKey[],
  resourceClinicId?: string,
) {
  return permissions.every(
    (permission) => can(ctx, permission, resourceClinicId).allowed,
  );
}

export function denyAuditIfNeeded(
  ctx: AuthzContext,
  permission: PermissionKey,
  decision: AuthzDecision,
) {
  if (decision.allowed) return;
  // Lazy import avoided — caller may append audit for sensitive denies.
  void ctx;
  void permission;
  void decision;
}
