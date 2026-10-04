"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function SubscriptionClient({
  currentPlanCode,
  cancelAtPeriodEnd,
}: {
  currentPlanCode: string;
  cancelAtPeriodEnd: boolean;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function post(action: string, data: Record<string, unknown> = {}) {
    setBusy(true);
    setMessage(null);
    const res = await fetch("/api/demo/saas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, data }),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMessage(json.error ?? "Não foi possível concluir.");
      return;
    }
    setMessage("Atualizado.");
    router.refresh();
  }

  return (
    <section className="space-y-3 rounded-2xl border border-[var(--border)] p-4">
      <h2 className="font-medium text-[var(--brand-ink)]">Gerenciar assinatura</h2>
      <p className="text-xs text-[var(--text-muted)]">
        Checkout real depende do provedor. Redirect do browser não ativa plano —
        ativação via webhook idempotente.
      </p>
      <div className="flex flex-wrap gap-2">
        {currentPlanCode !== "pro" ? (
          <Button
            size="sm"
            loading={busy}
            onClick={() => void post("change_plan", { plan_code: "pro" })}
          >
            Ir para Pro
          </Button>
        ) : (
          <Button
            size="sm"
            variant="secondary"
            loading={busy}
            onClick={() => void post("change_plan", { plan_code: "starter" })}
          >
            Voltar para Starter
          </Button>
        )}
        <Link href="/app/configuracoes/equipe">
          <Button size="sm" variant="secondary">
            Gerenciar equipe
          </Button>
        </Link>
        <Button
          size="sm"
          variant="ghost"
          loading={busy}
          disabled={cancelAtPeriodEnd}
          onClick={() => void post("cancel_subscription")}
        >
          {cancelAtPeriodEnd ? "Cancelamento agendado" : "Cancelar no fim do período"}
        </Button>
      </div>
      {message ? (
        <p className="text-sm text-[var(--success)]" role="status">
          {message}
        </p>
      ) : null}
    </section>
  );
}
