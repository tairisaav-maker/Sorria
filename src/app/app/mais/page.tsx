import type { Metadata } from "next";
import Link from "next/link";
import {
  CalendarClock,
  ClipboardList,
  FileBarChart2,
  Settings,
  Shield,
  Sparkles,
  Users,
  Wallet,
} from "lucide-react";
import { can } from "@/lib/authz/can";
import { requireClinic } from "@/lib/authz/guards";
import { getClinic } from "@/lib/demo/authz-store";
import { isAssistantEnabled } from "@/lib/feature-flags";

export const metadata: Metadata = {
  title: "Mais",
};

export default async function MaisPage() {
  const actor = await requireClinic();
  const clinic = getClinic(actor.ctx.clinicId);
  const canTeam = can(actor.ctx, "team.view").allowed;
  const canPermissions = can(actor.ctx, "permissions.manage").allowed;
  const canRequests = can(actor.ctx, "appointment_requests.view").allowed;
  const canFinance = can(actor.ctx, "finance.view_administrative").allowed;
  const canReports = can(actor.ctx, "reports.view").allowed;
  const canProcedures = can(actor.ctx, "procedures.view").allowed;
  const canAssistant =
    can(actor.ctx, "assistant.use").allowed && isAssistantEnabled(clinic);

  const links = [
    canProcedures
      ? {
          href: "/app/procedimentos",
          title: "Procedimentos",
          description: "Catálogo, ficha técnica e custo padrão",
          icon: ClipboardList,
        }
      : null,
    {
      href: "/app/configuracoes",
      title: "Configurações",
      description: "Clínica, agenda, perfil, equipe e segurança",
      icon: Settings,
    },
    canReports
      ? {
          href: "/app/relatorios",
          title: "Relatórios",
          description: "Indicadores essenciais de operação",
          icon: FileBarChart2,
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
    canRequests
      ? {
          href: "/app/solicitacoes",
          title: "Solicitações de horário",
          description: "Pedidos do paciente (área futura / secundária)",
          icon: CalendarClock,
        }
      : null,
    canAssistant
      ? {
          href: "/app/assistente",
          title: "Secretária Virtual",
          description: "Área futura — não faz parte do núcleo V1",
          icon: Sparkles,
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
          Áreas secundárias. O núcleo do Sorria é Agenda, Pacientes, Estoque e
          Financeiro.
        </p>
      </section>

      {links.length === 0 ? (
        <p className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/90 px-4 py-5 text-sm text-[var(--text-muted)]">
          Você não tem permissão para acessar atalhos extras nesta clínica.
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
