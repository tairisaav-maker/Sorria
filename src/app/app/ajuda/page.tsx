import type { Metadata } from "next";
import Link from "next/link";
import { requireClinic } from "@/lib/authz/guards";

export const metadata: Metadata = {
  title: "Ajuda",
};

const topics = [
  {
    title: "Primeiros passos",
    body: "Configure clínica e horários, cadastre 5–10 procedimentos frequentes com materiais e estoque inicial. Depois: paciente → Agenda.",
    href: "/app/onboarding",
  },
  {
    title: "Procedimentos e materiais",
    body: "A ficha técnica diz quanto cada procedimento costuma consumir. O custo estimado aparece ao montar a ficha.",
    href: "/app/procedimentos",
  },
  {
    title: "Estoque",
    body: "Use saldo inicial + custo estimado. Divergências: Ajustar estoque com motivo — nunca editar no banco.",
    href: "/app/estoque",
  },
  {
    title: "Atendimento",
    body: "Agenda → Iniciar atendimento → confirmar materiais (utilizado = previsto) → evolução → financeiro → concluir.",
    href: "/app/agenda",
  },
  {
    title: "Financeiro do consultório",
    body: "É o dinheiro dos pacientes — separado da assinatura do Sorria (Configurações → Assinatura).",
    href: "/app/financeiro",
  },
  {
    title: "Relatórios",
    body: "Use após volume suficiente de atendimentos. Disponibilidade depende do plano + permissão.",
    href: "/app/relatorios",
  },
];

export default async function AjudaPage() {
  await requireClinic();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <section>
        <h1 className="font-[family-name:var(--font-display)] text-3xl text-[var(--brand-ink)]">
          Ajuda
        </h1>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Conteúdo enxuto com base no que o piloto costuma perguntar. Use também
          o botão Enviar feedback.
        </p>
      </section>
      <ul className="space-y-3">
        {topics.map((t) => (
          <li
            key={t.title}
            className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/90 p-4"
          >
            <h2 className="font-medium text-[var(--brand-ink)]">{t.title}</h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">{t.body}</p>
            <Link
              href={t.href}
              className="mt-2 inline-block text-sm text-[var(--brand-primary)] hover:underline"
            >
              Abrir
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
