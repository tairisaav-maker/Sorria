import { assertPermission } from "@/lib/authz/guards";
import type { AuthzContext } from "@/lib/authz/can";
import {
  appendAudit,
  changeRole,
  getAuthzStore,
  inviteMember,
  reactivateMember,
  suspendMember,
} from "@/lib/demo/authz-store";

function deny(
  ctx: AuthzContext,
  action: string,
  detail: Record<string, unknown>,
) {
  appendAudit({
    clinic_id: ctx.clinicId,
    actor_user_id: ctx.userId,
    action: "authorization.denied",
    target_type: "team",
    target_id: null,
    metadata: { attempted: action, ...detail },
  });
}

function findMembershipInClinic(clinicId: string, membershipId: string) {
  return (
    getAuthzStore().memberships.find(
      (m) => m.id === membershipId && m.clinic_id === clinicId,
    ) ?? null
  );
}

export function invitePerson(
  ctx: AuthzContext,
  input: { fullName: string; email: string; roleKey: "dentist" | "secretary" },
) {
  assertPermission(ctx, "team.invite");

  return inviteMember({
    clinicId: ctx.clinicId,
    actorUserId: ctx.userId,
    fullName: input.fullName,
    email: input.email,
    roleKey: input.roleKey,
  });
}

export function changeMemberRole(
  ctx: AuthzContext,
  input: {
    membershipId: string;
    newRole: "dentist" | "secretary";
  },
) {
  assertPermission(ctx, "team.change_role");

  const target = findMembershipInClinic(ctx.clinicId, input.membershipId);
  if (!target) {
    deny(ctx, "team.change_role", { reason: "target_not_found" });
    throw new Error("Membro não encontrado nesta clínica.");
  }

  if (target.user_id === ctx.userId && target.role_key !== input.newRole) {
    // Dentista/secretária não alteram o próprio papel por este fluxo.
    const actor = findMembershipInClinic(ctx.clinicId, target.id);
    if (actor && actor.role_key !== "owner") {
      deny(ctx, "team.change_role", { reason: "self_role_change" });
      throw new Error("Você não pode alterar o próprio papel.");
    }
  }

  return changeRole({
    clinicId: ctx.clinicId,
    actorUserId: ctx.userId,
    membershipId: input.membershipId,
    newRole: input.newRole,
  });
}

export function suspendTeamMember(ctx: AuthzContext, membershipId: string) {
  assertPermission(ctx, "team.suspend");
  const target = findMembershipInClinic(ctx.clinicId, membershipId);
  if (!target) {
    deny(ctx, "team.suspend", { reason: "tenant_or_missing" });
    throw new Error("Membro não encontrado nesta clínica.");
  }
  return suspendMember({
    clinicId: ctx.clinicId,
    actorUserId: ctx.userId,
    membershipId,
  });
}

export function reactivateTeamMember(ctx: AuthzContext, membershipId: string) {
  assertPermission(ctx, "team.reactivate");
  const target = findMembershipInClinic(ctx.clinicId, membershipId);
  if (!target) {
    deny(ctx, "team.reactivate", { reason: "tenant_or_missing" });
    throw new Error("Membro não encontrado nesta clínica.");
  }
  return reactivateMember({
    clinicId: ctx.clinicId,
    actorUserId: ctx.userId,
    membershipId,
  });
}

/** Tentativa de escalonamento / cross-tenant — sempre negar. */
export function attemptForbiddenEscalation(
  ctx: AuthzContext,
  membershipId: string,
  forgedClinicId: string,
) {
  if (forgedClinicId !== ctx.clinicId) {
    deny(ctx, "team.change_role", {
      reason: "tenant_mismatch",
      forgedClinicId,
    });
    throw new Error("Operação negada entre clínicas.");
  }

  const target = findMembershipInClinic(ctx.clinicId, membershipId);
  if (!target) {
    deny(ctx, "team.change_role", { reason: "target_not_found" });
    throw new Error("Membro não encontrado nesta clínica.");
  }

  // Secretary/dentist cannot promote to owner
  deny(ctx, "team.change_role", { reason: "cannot_promote_owner" });
  throw new Error("Escalonamento para Proprietária negado.");
}
