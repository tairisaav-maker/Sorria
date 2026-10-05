import type { Metadata } from "next";
import Link from "next/link";
import {
  Building2,
  CalendarRange,
  CreditCard,
  HelpCircle,
  KeyRound,
  Shield,
  UserRound,
  Users,
} from "lucide-react";
import { InstallSorriaCard } from "@/components/pwa/pwa-provider";
import { can } from "@/lib/authz/can";
import { requireClinic } from "@/lib/authz/guards";
import { APP_VERSION } from "@/lib/version";

export const metadata: Metadata = {
  title: "Configurações",
};

export default async function ConfiguracoesPage() {
  const actor = await requireClinic();
  const canClinic = can(actor.ctx, "clinic.settings").allowed;
  const canTeam = can(actor.ctx, "team.view").allowed;
  const canPerms = can(actor.ctx, "permissions.manage").allowed;
  const canAudit = can(actor.ctx, "audit.view").allowed;

  const links = [
    canClinic
      ? {
          href: "/app/configuracoes/clinica",
          title: "Clínica",
          description: "Nome, contato, timezone e recursos",
          icon: Building2,
        }
      : null,
    canClinic
      ? {
          href: "/app/configuracoes/agenda",
          title: "Agenda",
          description: "Horários e duração padrão",
          icon: CalendarRange,
        }
      : null,
    {
      href: "/app/configuracoes/perfil",
      title: "Perfil",
      description: "Seus dados profissionais",
      icon: UserRound,
    },
    canTeam
      ? {
          href: "/app/configuracoes/equipe",
          title: "Equipe",
          description: "Convites e funções",
          icon: Users,
        }
      : null,
    canPerms
      ? {
          href: "/app/configuracoes/permissoes",
          title: "Permissões",
          description: "Papéis e acesso",
          icon: Shield,
        }
      : null,
    canAudit || canClinic
      ? {
          href: "/app/configuracoes/seguranca",
          title: "Segurança",
          description: "Auditoria, sessões e conta",
          icon: KeyRound,
        }
      : null,
    canClinic
      ? {
          href: "/app/configuracoes/assinatura",
          title: "Assinatura",
          description: "Plano, trial, limites e cobrança SaaS",
          icon: CreditCard,
        }
      : null,
    {
      href: "/app/ajuda",
      title: "Ajuda",
      description: "Primeiros passos e dúvidas do piloto",
      icon: HelpCircle,
    },
  ].filter(Boolean) as Array<{
    href: string;
    title: string;
    description: string;
    icon: typeof Users;
  }>;

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-5">
      <section>
        <h1 className="font-[family-name:var(--font-display)] text-3xl text-[var(--brand-ink)]">
          Configurações
        </h1>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Organização da clínica no Sorria.
        </p>
      </section>
      <ul className="space-y-3">
        {links.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/90 px-4 py-4 hover:bg-[var(--surface-muted)]/70"
            >
              <item.icon className="size-5 text-[var(--brand-primary)]" />
              <span>
                <span className="block text-sm font-medium">{item.title}</span>
                <span className="block text-xs text-[var(--text-muted)]">
                  {item.description}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <InstallSorriaCard />
      <p className="text-xs text-[var(--text-subtle)]">Sorria {APP_VERSION}</p>
    </div>
  );
}
