import type { Metadata } from "next";
import Link from "next/link";
import { requirePermission } from "@/lib/authz/guards";

export const metadata: Metadata = {
  title: "Permissões",
};

export default async function PermissoesPage() {
  await requirePermission("permissions.manage");

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <section className="animate-fade-in">
        <p className="text-sm font-medium text-[var(--brand-primary)]">
          Configurações
        </p>
        <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl tracking-tight text-[var(--brand-ink)]">
          Permissões
        </h1>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Visão simples dos papéis do Sorria. As permissões granulares vivem no
          banco e na camada <code>can()</code>.
        </p>
      </section>

      <section className="animate-rise space-y-4">
        <article className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/90 p-5">
          <h2 className="font-[family-name:var(--font-display)] text-lg text-[var(--brand-ink)]">
            Proprietária
          </h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Acesso administrativo completo dentro da própria clínica. Não é
            administradora global da plataforma e permanece isolada por tenant.
          </p>
        </article>

        <article className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/90 p-5">
          <h2 className="font-[family-name:var(--font-display)] text-lg text-[var(--brand-ink)]">
            Dentista
          </h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Acesso profissional e clínico. Autorização financeira permanece
            separada da autorização clínica.
          </p>
        </article>

        <article className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/90 p-5">
          <h2 className="font-[family-name:var(--font-display)] text-lg text-[var(--brand-ink)]">
            Secretária
          </h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Acesso administrativo (agenda, cadastro, contato, financeiro
            administrativo).
          </p>
          <p className="mt-3 rounded-xl bg-[var(--warning-soft)] px-3 py-2 text-sm text-[var(--warning)]">
            A secretária não possui acesso ao prontuário clínico por padrão.
          </p>
        </article>
      </section>

      <p className="text-sm text-[var(--text-subtle)]">
        Cadastro administrativo do paciente e prontuário clínico são domínios
        diferentes.{" "}
        <Link
          href="/app/configuracoes/equipe"
          className="font-medium text-[var(--brand-primary)] underline-offset-2 hover:underline"
        >
          Gerenciar equipe
        </Link>
      </p>
    </div>
  );
}
