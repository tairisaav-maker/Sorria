import Link from "next/link";
import { SorriaMark } from "@/components/brand/sorria-mark";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 text-center">
      <SorriaMark size="md" showSubtitle align="center" />
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-2xl text-[var(--brand-ink)]">
          Não encontramos esta página
        </h1>
        <p className="mt-2 max-w-md text-sm text-[var(--text-muted)]">
          O endereço pode estar incorreto ou você não tem acesso a este recurso.
        </p>
      </div>
      <Link
        href="/app/home"
        className="inline-flex h-11 items-center rounded-xl bg-[var(--brand-primary)] px-4 text-sm font-medium text-white"
      >
        Voltar ao início
      </Link>
    </main>
  );
}
