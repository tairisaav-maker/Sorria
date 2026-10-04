import { NextResponse } from "next/server";
import { can } from "@/lib/authz/can";
import {
  changeMemberRole,
  invitePerson,
  reactivateTeamMember,
  suspendTeamMember,
} from "@/lib/authz/team-service";
import {
  getAuthzStore,
  getClinic,
  getDemoSession,
  getProfile,
  listClinicMembers,
  setDemoSession,
} from "@/lib/demo/authz-store";
import { ROLE_LABELS, STATUS_LABELS } from "@/lib/permissions/keys";

function ensureDemo() {
  if (process.env.NEXT_PUBLIC_DEMO_MODE !== "true") {
    return NextResponse.json({ error: "Demo mode only" }, { status: 403 });
  }
  return null;
}

function sessionCtx() {
  const session = getDemoSession();
  return { userId: session.userId, clinicId: session.clinicId };
}

export async function GET() {
  const blocked = ensureDemo();
  if (blocked) return blocked;

  const ctx = sessionCtx();
  const decision = can(ctx, "team.view", ctx.clinicId);
  if (!decision.allowed) {
    return NextResponse.json(
      { error: "Você não tem permissão para acessar esta área." },
      { status: 403 },
    );
  }

  const members = listClinicMembers(ctx.clinicId).map((membership) => {
    const profile = getProfile(membership.user_id);
    return {
      ...membership,
      full_name: profile?.full_name ?? "Sem nome",
      email: profile?.email ?? "",
      role_label: ROLE_LABELS[membership.role_key],
      status_label: STATUS_LABELS[membership.status],
    };
  });

  return NextResponse.json({
    clinic: getClinic(ctx.clinicId),
    members,
    actor: {
      ...ctx,
      profile: getProfile(ctx.userId),
      permissions: {
        invite: can(ctx, "team.invite").allowed,
        changeRole: can(ctx, "team.change_role").allowed,
        suspend: can(ctx, "team.suspend").allowed,
        reactivate: can(ctx, "team.reactivate").allowed,
      },
    },
    auditLogs: getAuthzStore().auditLogs.filter(
      (log) => log.clinic_id === ctx.clinicId,
    ),
  });
}

export async function POST(request: Request) {
  const blocked = ensureDemo();
  if (blocked) return blocked;

  const ctx = sessionCtx();
  const body = (await request.json()) as {
    action?: string;
    fullName?: string;
    email?: string;
    roleKey?: "dentist" | "secretary";
    membershipId?: string;
    newRole?: "dentist" | "secretary";
    // deliberate attack vectors for negative tests / hardening
    clinicId?: string;
    switchUserId?: string;
    switchClinicId?: string;
  };

  try {
    if (body.action === "switch_session") {
      if (!body.switchUserId || !body.switchClinicId) {
        return NextResponse.json({ error: "Sessão inválida" }, { status: 400 });
      }
      setDemoSession(body.switchUserId, body.switchClinicId);
      return NextResponse.json({ ok: true });
    }

    if (body.clinicId && body.clinicId !== ctx.clinicId) {
      return NextResponse.json(
        { error: "clinic_id inválido para esta sessão." },
        { status: 403 },
      );
    }

    if (body.action === "invite") {
      if (!body.fullName || !body.email || !body.roleKey) {
        return NextResponse.json({ error: "Dados incompletos" }, { status: 400 });
      }
      if (body.roleKey !== "dentist" && body.roleKey !== "secretary") {
        return NextResponse.json(
          { error: "Função inválida para convite." },
          { status: 400 },
        );
      }
      const result = invitePerson(ctx, {
        fullName: body.fullName,
        email: body.email,
        roleKey: body.roleKey,
      });
      return NextResponse.json({ ok: true, result }, { status: 201 });
    }

    if (body.action === "change_role") {
      if (!body.membershipId || !body.newRole) {
        return NextResponse.json({ error: "Dados incompletos" }, { status: 400 });
      }
      if (body.newRole === ("owner" as never)) {
        return NextResponse.json(
          { error: "Escalonamento para Proprietária negado." },
          { status: 403 },
        );
      }
      const membership = changeMemberRole(ctx, {
        membershipId: body.membershipId,
        newRole: body.newRole,
      });
      return NextResponse.json({ ok: true, membership });
    }

    if (body.action === "suspend") {
      if (!body.membershipId) {
        return NextResponse.json({ error: "membershipId obrigatório" }, { status: 400 });
      }
      const membership = suspendTeamMember(ctx, body.membershipId);
      return NextResponse.json({ ok: true, membership });
    }

    if (body.action === "reactivate") {
      if (!body.membershipId) {
        return NextResponse.json({ error: "membershipId obrigatório" }, { status: 400 });
      }
      const membership = reactivateTeamMember(ctx, body.membershipId);
      return NextResponse.json({ ok: true, membership });
    }

    return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Falha na operação de equipe";
    const status = message === "AUTHORIZATION_DENIED" ? 403 : 400;
    return NextResponse.json(
      {
        error:
          message === "AUTHORIZATION_DENIED"
            ? "Você não tem permissão para acessar esta área."
            : message,
      },
      { status },
    );
  }
}
