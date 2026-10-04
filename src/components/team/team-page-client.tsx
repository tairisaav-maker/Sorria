"use client";

import { MoreHorizontal, Plus, UserRound } from "lucide-react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MemberAccess } from "@/components/team/member-access";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { DemoMembership } from "@/lib/demo/authz-store";
import { ROLE_LABELS } from "@/lib/permissions/keys";
import { cn } from "@/lib/utils";

type MemberRow = DemoMembership & {
  full_name: string;
  email: string;
  role_label: string;
  status_label: string;
};

type ActorPermissions = {
  invite: boolean;
  changeRole: boolean;
  suspend: boolean;
  reactivate: boolean;
};

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function statusTone(status: MemberRow["status"]) {
  if (status === "active") return "success" as const;
  if (status === "invited") return "info" as const;
  if (status === "suspended") return "warning" as const;
  return "neutral" as const;
}

export function TeamPageClient({
  initialMembers,
  actorUserId,
  permissions,
}: {
  initialMembers: MemberRow[];
  actorUserId: string;
  permissions: ActorPermissions;
}) {
  const router = useRouter();
  const [members, setMembers] = useState(initialMembers);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [accessMember, setAccessMember] = useState<MemberRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [roleKey, setRoleKey] = useState<"dentist" | "secretary">("secretary");

  const onlyOwner = useMemo(
    () =>
      members.filter((m) => m.status !== "revoked").length === 1 &&
      members[0]?.role_key === "owner",
    [members],
  );

  async function refresh() {
    const response = await fetch("/api/demo/team");
    const data = (await response.json()) as { members?: MemberRow[] };
    if (data.members) setMembers(data.members);
    router.refresh();
  }

  async function run(action: string, payload: Record<string, unknown>) {
    setLoading(true);
    setError(null);
    const response = await fetch("/api/demo/team", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...payload }),
    });
    const data = (await response.json()) as { error?: string };
    setLoading(false);
    if (!response.ok) {
      setError(data.error ?? "Não foi possível concluir a ação.");
      return false;
    }
    await refresh();
    return true;
  }

  async function handleInvite(event: React.FormEvent) {
    event.preventDefault();
    const ok = await run("invite", { fullName, email, roleKey });
    if (ok) {
      setInviteOpen(false);
      setFullName("");
      setEmail("");
      setRoleKey("secretary");
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
      <section className="animate-fade-in flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-[var(--brand-primary)]">
            Configurações
          </p>
          <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl tracking-tight text-[var(--brand-ink)]">
            Equipe
          </h1>
          <p className="mt-2 max-w-xl text-sm text-[var(--text-muted)]">
            Gerencie quem pode acessar o Sorria e o que cada pessoa pode fazer.
          </p>
        </div>
        {permissions.invite ? (
          <Button type="button" onClick={() => setInviteOpen(true)}>
            <Plus className="size-4" />
            Convidar pessoa
          </Button>
        ) : null}
      </section>

      {error ? (
        <p
          className="rounded-xl bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger)]"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      {onlyOwner ? (
        <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface-elevated)]/80 px-5 py-8 text-center">
          <UserRound className="mx-auto size-8 text-[var(--brand-primary)]" />
          <h2 className="mt-3 font-[family-name:var(--font-display)] text-xl text-[var(--brand-ink)]">
            Sua equipe começa aqui
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-[var(--text-muted)]">
            Quando você convidar alguém, poderá controlar o acesso de cada
            pessoa ao Sorria.
          </p>
          {permissions.invite ? (
            <Button
              type="button"
              className="mt-4"
              onClick={() => setInviteOpen(true)}
            >
              Convidar pessoa
            </Button>
          ) : null}
        </div>
      ) : null}

      {/* Mobile cards */}
      <ul className="space-y-3 lg:hidden">
        {members.map((member) => (
          <li
            key={member.id}
            className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/90 p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-full bg-[var(--brand-soft)] text-sm font-semibold text-[var(--brand-ink)]">
                  {initials(member.full_name)}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[var(--text)]">
                    {member.full_name}
                  </p>
                  <p className="truncate text-xs text-[var(--text-muted)]">
                    {member.email}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Badge tone="neutral">{member.role_label}</Badge>
                    <Badge tone={statusTone(member.status)}>
                      {member.status_label}
                    </Badge>
                  </div>
                </div>
              </div>
              <MemberMenu
                member={member}
                actorUserId={actorUserId}
                permissions={permissions}
                open={menuId === member.id}
                onToggle={() =>
                  setMenuId((id) => (id === member.id ? null : member.id))
                }
                onAccess={() => {
                  setAccessMember(member);
                  setMenuId(null);
                }}
                onChangeRole={async (newRole) => {
                  const label = ROLE_LABELS[newRole];
                  const ok = window.confirm(
                    `${member.full_name.split(" ")[0]} passará de ${member.role_label} para ${label}. As permissões de acesso serão atualizadas.`,
                  );
                  if (ok) {
                    await run("change_role", {
                      membershipId: member.id,
                      newRole,
                    });
                  }
                  setMenuId(null);
                }}
                onSuspend={async () => {
                  if (window.confirm("Suspender o acesso desta pessoa?")) {
                    await run("suspend", { membershipId: member.id });
                  }
                  setMenuId(null);
                }}
                onReactivate={async () => {
                  await run("reactivate", { membershipId: member.id });
                  setMenuId(null);
                }}
              />
            </div>
          </li>
        ))}
      </ul>

      {/* Desktop table */}
      <div className="hidden overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/90 lg:block">
        <table className="w-full text-left text-sm">
          <thead className="bg-[var(--surface-muted)]/70 text-[var(--text-muted)]">
            <tr>
              <th className="px-4 py-3 font-medium">Pessoa</th>
              <th className="px-4 py-3 font-medium">Função</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {members.map((member) => (
              <tr key={member.id}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex size-9 items-center justify-center rounded-full bg-[var(--brand-soft)] text-xs font-semibold text-[var(--brand-ink)]">
                      {initials(member.full_name)}
                    </div>
                    <div>
                      <p className="font-medium text-[var(--text)]">
                        {member.full_name}
                      </p>
                      <p className="text-xs text-[var(--text-muted)]">
                        {member.email}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">{member.role_label}</td>
                <td className="px-4 py-3">
                  <Badge tone={statusTone(member.status)}>
                    {member.status_label}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <MemberMenu
                    member={member}
                    actorUserId={actorUserId}
                    permissions={permissions}
                    open={menuId === member.id}
                    onToggle={() =>
                      setMenuId((id) => (id === member.id ? null : member.id))
                    }
                    onAccess={() => {
                      setAccessMember(member);
                      setMenuId(null);
                    }}
                    onChangeRole={async (newRole) => {
                      const label = ROLE_LABELS[newRole];
                      const ok = window.confirm(
                        `Alterar função?\n\n${member.full_name.split(" ")[0]} passará de ${member.role_label} para ${label}. As permissões de acesso serão atualizadas.`,
                      );
                      if (ok) {
                        await run("change_role", {
                          membershipId: member.id,
                          newRole,
                        });
                      }
                      setMenuId(null);
                    }}
                    onSuspend={async () => {
                      if (window.confirm("Suspender o acesso desta pessoa?")) {
                        await run("suspend", { membershipId: member.id });
                      }
                      setMenuId(null);
                    }}
                    onReactivate={async () => {
                      await run("reactivate", { membershipId: member.id });
                      setMenuId(null);
                    }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {inviteOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-4 sm:items-center">
          <div
            className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl animate-rise"
            role="dialog"
            aria-modal="true"
            aria-labelledby="invite-title"
          >
            <h2
              id="invite-title"
              className="font-[family-name:var(--font-display)] text-xl text-[var(--brand-ink)]"
            >
              Convidar para o Sorria
            </h2>
            <form onSubmit={handleInvite} className="mt-4 space-y-3">
              <div>
                <Label htmlFor="invite-name">Nome</Label>
                <Input
                  id="invite-name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="invite-email">E-mail</Label>
                <Input
                  id="invite-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="invite-role">Função</Label>
                <Select
                  id="invite-role"
                  value={roleKey}
                  onChange={(e) =>
                    setRoleKey(e.target.value as "dentist" | "secretary")
                  }
                >
                  <option value="dentist">Dentista</option>
                  <option value="secretary">Secretária</option>
                </Select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setInviteOpen(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" loading={loading}>
                  Enviar convite
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {accessMember ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-4 sm:items-center">
          <div className="max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 shadow-xl animate-rise">
            <MemberAccess
              name={accessMember.full_name}
              membership={accessMember}
            />
            <Button
              type="button"
              variant="secondary"
              className="mt-5 w-full"
              onClick={() => setAccessMember(null)}
            >
              Fechar
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MemberMenu({
  member,
  actorUserId,
  permissions,
  open,
  onToggle,
  onAccess,
  onChangeRole,
  onSuspend,
  onReactivate,
}: {
  member: MemberRow;
  actorUserId: string;
  permissions: ActorPermissions;
  open: boolean;
  onToggle: () => void;
  onAccess: () => void;
  onChangeRole: (role: "dentist" | "secretary") => void;
  onSuspend: () => void;
  onReactivate: () => void;
}) {
  const isSelf = member.user_id === actorUserId;
  const canChange =
    permissions.changeRole && member.role_key !== "owner" && !isSelf;
  const canSuspend =
    permissions.suspend &&
    member.status === "active" &&
    !isSelf &&
    !(member.role_key === "owner");
  const canReactivate =
    permissions.reactivate &&
    (member.status === "suspended" || member.status === "invited");

  return (
    <div className="relative">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-label="Ações"
        onClick={onToggle}
      >
        <MoreHorizontal className="size-4" />
      </Button>
      {open ? (
        <div
          className={cn(
            "absolute right-0 z-20 mt-1 w-48 rounded-xl border border-[var(--border)] bg-white py-1 shadow-lg",
          )}
        >
          <button
            type="button"
            className="block w-full px-3 py-2 text-left text-sm hover:bg-[var(--surface-muted)]"
            onClick={onAccess}
          >
            Ver acesso
          </button>
          {canChange ? (
            <>
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-sm hover:bg-[var(--surface-muted)]"
                onClick={() =>
                  onChangeRole(
                    member.role_key === "secretary" ? "dentist" : "secretary",
                  )
                }
              >
                Alterar função
              </button>
            </>
          ) : null}
          {canSuspend ? (
            <button
              type="button"
              className="block w-full px-3 py-2 text-left text-sm text-[var(--danger)] hover:bg-[var(--danger-soft)]"
              onClick={onSuspend}
            >
              Suspender acesso
            </button>
          ) : null}
          {canReactivate ? (
            <button
              type="button"
              className="block w-full px-3 py-2 text-left text-sm hover:bg-[var(--surface-muted)]"
              onClick={onReactivate}
            >
              Reativar acesso
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
