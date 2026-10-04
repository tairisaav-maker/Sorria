import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  DEMO_COOKIE_NAME,
  hydrateDemoSessionFromCookie,
} from "@/lib/demo/session";
import { getDemoSession } from "@/lib/demo/authz-store";
import { OWNER_A_ID } from "@/lib/demo/authz-store";
import { getSaasHealth, internalFindClinic } from "@/services/saas";
import { APP_VERSION } from "@/lib/version";
import { InternalClient } from "@/components/saas/internal-client";

export const metadata: Metadata = {
  title: "Internal",
};

/**
 * Admin mínimo do SaaS — sem acesso a prontuário/evolução/financeiro de pacientes.
 * Demo: restrito ao OWNER_A. Produção: substituir por allowlist de staff Sorria.
 */
export default async function InternalPage() {
  const jar = await cookies();
  hydrateDemoSessionFromCookie(jar.get(DEMO_COOKIE_NAME)?.value);
  const session = getDemoSession();
  if (session.userId !== OWNER_A_ID) {
    redirect("/forbidden");
  }

  const health = getSaasHealth();
  const clinics = internalFindClinic("");

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <section>
        <h1 className="font-[family-name:var(--font-display)] text-3xl text-[var(--brand-ink)]">
          Internal — Sorria
        </h1>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Operação SaaS mínima. Versão {APP_VERSION}. Sem impersonation. Sem
          conteúdo clínico.
        </p>
      </section>
      <dl className="grid gap-2 rounded-2xl border border-[var(--border)] p-4 text-sm sm:grid-cols-2">
        {Object.entries(health).map(([k, v]) => (
          <div key={k}>
            <dt className="text-[var(--text-muted)]">{k}</dt>
            <dd className="font-medium">{String(v)}</dd>
          </div>
        ))}
      </dl>
      <InternalClient initialClinics={clinics} />
    </div>
  );
}
