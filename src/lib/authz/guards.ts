import { redirect } from "next/navigation";
import { can, type AuthzContext } from "@/lib/authz/can";
import {
  getClinic,
  getDemoSession,
  getMembership,
  getProfile,
} from "@/lib/demo/authz-store";
import type { PermissionKey } from "@/lib/permissions/keys";
import { isDemoMode } from "@/lib/utils";

export type SessionActor = {
  ctx: AuthzContext;
  profile: NonNullable<ReturnType<typeof getProfile>>;
  clinic: NonNullable<ReturnType<typeof getClinic>>;
  membership: NonNullable<ReturnType<typeof getMembership>>;
};

export async function requireAuth(): Promise<{ userId: string } | null> {
  if (!isDemoMode()) {
    // Fase 1: UI operacional em demo; Supabase real usa a mesma camada can()/RLS.
    return null;
  }
  const session = getDemoSession();
  return { userId: session.userId };
}

export async function requireClinic(): Promise<SessionActor> {
  if (!isDemoMode()) {
    redirect("/login");
  }

  const session = getDemoSession();
  const membership = getMembership(session.userId, session.clinicId);
  const profile = getProfile(session.userId);
  const clinic = getClinic(session.clinicId);

  if (!membership || !profile) {
    redirect("/app/sem-clinica");
  }

  if (membership.status === "suspended") {
    redirect("/forbidden?reason=suspended");
  }

  if (membership.status === "invited") {
    redirect("/app/sem-clinica?reason=invited");
  }

  if (membership.status !== "active" || !clinic) {
    redirect("/app/sem-clinica");
  }

  return {
    ctx: { userId: session.userId, clinicId: session.clinicId },
    profile,
    clinic,
    membership,
  };
}

export async function requirePermission(
  permission: PermissionKey,
): Promise<SessionActor> {
  const actor = await requireClinic();
  const decision = can(actor.ctx, permission, actor.ctx.clinicId);
  if (!decision.allowed) {
    redirect("/forbidden");
  }
  return actor;
}

export function assertPermission(
  ctx: AuthzContext,
  permission: PermissionKey,
  resourceClinicId?: string,
) {
  const decision = can(ctx, permission, resourceClinicId ?? ctx.clinicId);
  if (!decision.allowed) {
    const error = new Error("AUTHORIZATION_DENIED");
    (error as Error & { decision: typeof decision }).decision = decision;
    throw error;
  }
  return decision;
}
