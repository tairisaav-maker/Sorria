import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Sem conexão",
  robots: { index: false, follow: false },
};

export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-[var(--surface)] px-6 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-[var(--brand-primary)] text-2xl font-semibold text-white">
        S
      </div>
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-2xl text-[var(--brand-ink)]">
          Você está sem conexão
        </h1>
        <p className="mt-2 max-w-sm text-sm text-[var(--text-muted)]">
          Verifique sua internet para continuar usando o Sorria.
        </p>
      </div>
      <Link
        href="/app/home"
        className="inline-flex h-11 items-center rounded-xl bg-[var(--brand-primary)] px-4 text-sm font-medium text-white"
      >
        Tentar novamente
      </Link>
    </main>
  );
}
