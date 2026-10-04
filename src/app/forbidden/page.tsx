import type { Metadata } from "next";
import Link from "next/link";
import { SorriaMark } from "@/components/brand/sorria-mark";

export const metadata: Metadata = {
  title: "Acesso negado",
};

export default async function ForbiddenPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const params = await searchParams;
  const suspended = params.reason === "suspended";

  return (
    <main className="login-atmosphere flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-white/60 bg-white/90 p-6 text-center shadow-lg backdrop-blur-md">
        <SorriaMark size="md" align="center" className="mb-6" />
        <h1 className="font-[family-name:var(--font-display)] text-2xl text-[var(--brand-ink)]">
          {suspended
            ? "Seu acesso a esta clínica está suspenso."
            : "Você não tem permissão para acessar esta área."}
        </h1>
        <p className="mt-3 text-sm text-[var(--text-muted)]">
          Se acredita que isso é um engano, fale com a proprietária da clínica.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            href="/app/home"
            className="inline-flex h-11 items-center rounded-xl bg-[var(--brand-primary)] px-4 text-sm font-medium text-white"
          >
            Voltar ao início
          </Link>
          <Link
            href="/login"
            className="inline-flex h-11 items-center rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-medium text-[var(--text)]"
          >
            Sair
          </Link>
        </div>
      </div>
    </main>
  );
}
