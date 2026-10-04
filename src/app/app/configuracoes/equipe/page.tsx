import type { Metadata } from "next";
import { TeamPageClient } from "@/components/team/team-page-client";
import { can } from "@/lib/authz/can";
import { requirePermission } from "@/lib/authz/guards";
import {
  getProfile,
  listClinicMembers,
} from "@/lib/demo/authz-store";
import { ROLE_LABELS, STATUS_LABELS } from "@/lib/permissions/keys";

export const metadata: Metadata = {
  title: "Equipe",
};

export default async function EquipePage() {
  const actor = await requirePermission("team.view");

  const members = listClinicMembers(actor.ctx.clinicId).map((membership) => {
    const profile = getProfile(membership.user_id);
    return {
      ...membership,
      full_name: profile?.full_name ?? "Sem nome",
      email: profile?.email ?? "",
      role_label: ROLE_LABELS[membership.role_key],
      status_label: STATUS_LABELS[membership.status],
    };
  });

  return (
    <TeamPageClient
      initialMembers={members}
      actorUserId={actor.ctx.userId}
      permissions={{
        invite: can(actor.ctx, "team.invite").allowed,
        changeRole: can(actor.ctx, "team.change_role").allowed,
        suspend: can(actor.ctx, "team.suspend").allowed,
        reactivate: can(actor.ctx, "team.reactivate").allowed,
      }}
    />
  );
}
