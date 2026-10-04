"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { createCorrelationId } from "@/lib/observability";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const code = error.digest?.slice(0, 8)?.toUpperCase() ?? createCorrelationId();

  useEffect(() => {
    console.error("[sorria:error]", { code, message: error.message });
  }, [code, error.message]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-5 px-4 text-center">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-2xl text-[var(--brand-ink)]">
          Algo deu errado
        </h1>
        <p className="mt-2 max-w-md text-sm text-[var(--text-muted)]">
          Não foi possível concluir esta ação. Tente novamente.
        </p>
        <p className="mt-3 text-xs text-[var(--text-subtle)]">Código: {code}</p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Button type="button" onClick={reset}>
          Tentar novamente
        </Button>
        <Link
          href="/app/home"
          className="inline-flex h-11 items-center rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-medium text-[var(--text)]"
        >
          Voltar ao início
        </Link>
      </div>
    </main>
  );
}
