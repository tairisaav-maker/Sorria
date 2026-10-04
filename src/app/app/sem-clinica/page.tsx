import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Nenhuma clínica disponível",
};

export default async function SemClinicaPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const params = await searchParams;
  const reason = params.reason;

  const detail =
    reason === "invited"
      ? "Você possui um convite pendente. Aceite o convite para começar a usar o Sorria nesta clínica."
      : reason === "suspended"
        ? "Seu acesso a esta clínica está suspenso."
        : "Não encontramos um vínculo ativo de clínica para a sua conta.";

  return (
    <div className="mx-auto flex min-h-[60dvh] w-full max-w-lg flex-col justify-center gap-4 px-2">
      <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight text-[var(--brand-ink)]">
        Nenhuma clínica disponível
      </h1>
      <p className="text-sm text-[var(--text-muted)]">{detail}</p>
      <div>
        <Link
          href="/login"
          className="inline-flex h-11 items-center rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-medium text-[var(--text)]"
        >
          Voltar ao login
        </Link>
      </div>
    </div>
  );
}
