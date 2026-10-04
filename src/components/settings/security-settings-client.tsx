"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { APP_VERSION } from "@/lib/version";

type AuditItem = {
  id: string;
  action: string;
  target_type: string | null;
  created_at: string;
  actor_user_id: string;
};

export function SecuritySettingsClient({ canAudit }: { canAudit: boolean }) {
  const [items, setItems] = useState<AuditItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!canAudit) return;
    void (async () => {
      const res = await fetch("/api/demo/settings?resource=audit");
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Sem permissão para auditoria.");
        return;
      }
      setItems(data.items ?? []);
    })();
  }, [canAudit]);

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-5">
      <header>
        <h1 className="font-[family-name:var(--font-display)] text-3xl text-[var(--brand-ink)]">
          Segurança
        </h1>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Conta, auditoria e suporte. A alteração de senha usa o provedor de autenticação (Supabase).
        </p>
      </header>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/90 p-5 space-y-3">
        <h2 className="text-sm font-semibold text-[var(--brand-ink)]">Conta</h2>
        <p className="text-sm text-[var(--text-muted)]">
          Recuperação de senha e 2FA ficam no provedor de Auth. Em produção, use o e-mail de recuperação do Supabase — não implementamos fluxo custom inseguro.
        </p>
        <ul className="space-y-2 text-sm">
          <li>
            <Link href="/login" className="text-[var(--brand-primary)] underline-offset-2 hover:underline">
              Encerrar sessão (sair)
            </Link>
          </li>
          <li className="text-[var(--text-muted)]">
            Sessões ativas: gerenciadas pelo Supabase Auth (dispositivos listados quando Auth estiver ligado fora do demo).
          </li>
        </ul>
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/90 p-5 space-y-3">
        <h2 className="text-sm font-semibold text-[var(--brand-ink)]">2FA</h2>
        <p className="text-sm text-[var(--text-muted)]">
          Preparado para MFA do Supabase. Ative no projeto Auth quando for operar em produção.
        </p>
      </section>

      {canAudit ? (
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/90 p-5">
          <h2 className="text-sm font-semibold text-[var(--brand-ink)]">
            Auditoria recente
          </h2>
          {error ? (
            <p className="mt-2 text-sm text-[var(--danger)]">{error}</p>
          ) : items.length === 0 ? (
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              Nenhum evento recente nesta clínica.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {items.slice(0, 20).map((a) => (
                <li
                  key={a.id}
                  className="rounded-xl border border-[var(--border)] px-3 py-2 text-xs"
                >
                  <span className="font-medium text-[var(--text)]">{a.action}</span>
                  <span className="mt-0.5 block text-[var(--text-muted)]">
                    {new Date(a.created_at).toLocaleString("pt-BR")}
                    {a.target_type ? ` · ${a.target_type}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      <section className="rounded-2xl border border-dashed border-[var(--border)] p-4 text-xs text-[var(--text-subtle)]">
        <p>Suporte · Sorria {APP_VERSION}</p>
        <p className="mt-1">
          Em incidentes, informe o código de erro exibido na tela (sem senhas ou tokens).
        </p>
        <p className="mt-3">
          <Link href="/termos" className="underline-offset-2 hover:underline">
            Termos de Uso
          </Link>
          {" · "}
          <Link href="/privacidade" className="underline-offset-2 hover:underline">
            Privacidade
          </Link>
        </p>
      </section>
    </div>
  );
}
