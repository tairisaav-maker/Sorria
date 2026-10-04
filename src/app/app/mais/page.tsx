import type { Metadata } from "next";
import Link from "next/link";
import { can } from "@/lib/authz/can";
import { requireClinic } from "@/lib/authz/guards";
import { CalendarClock, FileBarChart2, Shield, Sparkles, Users, Wallet } from "lucide-react";

export const metadata: Metadata = {
  title: "Mais",
};

export default async function MaisPage() {
  const actor = await requireClinic();
  const canTeam = can(actor.ctx, "team.view").allowed;
  const canPermissions = can(actor.ctx, "permissions.manage").allowed;
  const canRequests = can(actor.ctx, "appointment_requests.view").allowed;
  const canFinance = can(actor.ctx, "finance.view_administrative").allowed;
  const canReports = can(actor.ctx, "reports.view").allowed;
  const canAssistant = can(actor.ctx, "assistant.use").allowed;

  const links = [
    canAssistant
      ? {
          href: "/app/assistente",
          title: "Secretária Virtual",
          description: "Consulte informações e organize tarefas administrativas",
          icon: Sparkles,
        }
      : null,
    canFinance
      ? {
          href: "/app/financeiro",
          title: "Financeiro",
          description: "Recebido, a receber, vencidos e despesas",
          icon: Wallet,
        }
      : null,
    canReports
      ? {
          href: "/app/relatorios",
          title: "Relatórios",
          description: "Indicadores de agenda, pacientes, tratamentos e financeiro",
          icon: FileBarChart2,
        }
      : null,
    canRequests
      ? {
          href: "/app/solicitacoes",
          title: "Solicitações de horário",
          description: "Analisar, propor e recusar pedidos do paciente",
          icon: CalendarClock,
        }
      : null,
    canTeam
      ? {
          href: "/app/configuracoes/equipe",
          title: "Equipe",
          description: "Convites, funções e status de acesso",
          icon: Users,
        }
      : null,
    canPermissions
      ? {
          href: "/app/configuracoes/permissoes",
          title: "Permissões",
          description: "Papéis e separação administrativo × clínico",
          icon: Shield,
        }
      : null,
  ].filter(Boolean) as Array<{
    href: string;
    title: string;
    description: string;
    icon: typeof Users;
  }>;

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-5">
      <section className="animate-fade-in">
        <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight text-[var(--brand-ink)]">
          Mais
        </h1>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Configurações e atalhos da clínica no Sorria.
        </p>
      </section>

      {links.length === 0 ? (
        <p className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/90 px-4 py-5 text-sm text-[var(--text-muted)]">
          Você não tem permissão para acessar configurações nesta clínica.
        </p>
      ) : (
        <ul className="space-y-3 animate-rise">
          {links.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/90 px-4 py-4 transition-colors hover:bg-[var(--surface-muted)]/70"
              >
                <item.icon className="size-5 text-[var(--brand-primary)]" />
                <span>
                  <span className="block text-sm font-medium text-[var(--text)]">
                    {item.title}
                  </span>
                  <span className="block text-xs text-[var(--text-muted)]">
                    {item.description}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
