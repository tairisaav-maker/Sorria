"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CANCEL_REASONS } from "@/lib/demo/commercial-store";

const REASON_LABELS: Record<(typeof CANCEL_REASONS)[number], string> = {
  preco: "Preço",
  nao_entendeu_valor: "Não entendi o valor",
  muito_dificil: "Muito difícil",
  ja_usa_outro_sistema: "Já uso outro sistema",
  faltou_funcionalidade: "Faltou funcionalidade",
  nao_e_prioridade: "Não é prioridade",
  outro: "Outro",
};

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
  const [showCancelFeedback, setShowCancelFeedback] = useState(false);
  const [reason, setReason] =
    useState<(typeof CANCEL_REASONS)[number]>("outro");

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
      return false;
    }
    setMessage("Atualizado.");
    router.refresh();
    return true;
  }

  async function cancelWithOptionalFeedback() {
    const ok = await post("cancel_subscription");
    if (!ok) return;
    // feedback opcional — nunca bloqueia o cancelamento
    try {
      await fetch("/api/demo/commercial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "cancel_feedback",
          data: { reason },
        }),
      });
    } catch {
      /* ignore */
    }
    setShowCancelFeedback(false);
  }

  return (
    <section className="space-y-3 rounded-2xl border border-[var(--border)] p-4">
      <h2 className="font-medium text-[var(--brand-ink)]">Gerenciar assinatura</h2>
      <p className="text-xs text-[var(--text-muted)]">
        Checkout real depende do provedor. Redirect do browser não ativa plano —
        ativação via webhook idempotente. Cancelamento simples, sem dark patterns.
      </p>
      <div className="flex flex-wrap gap-2">
        {currentPlanCode !== "pro" ? (
          <Button
            size="sm"
            loading={busy}
            onClick={() => void post("change_plan", { plan_code: "pro" })}
          >
            Ir para Clínica
          </Button>
        ) : (
          <Button
            size="sm"
            variant="secondary"
            loading={busy}
            onClick={() => void post("change_plan", { plan_code: "starter" })}
          >
            Voltar para Individual
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
          onClick={() => setShowCancelFeedback(true)}
        >
          {cancelAtPeriodEnd
            ? "Cancelamento agendado"
            : "Cancelar no fim do período"}
        </Button>
      </div>

      {showCancelFeedback && !cancelAtPeriodEnd ? (
        <div className="space-y-3 border-t border-[var(--border)] pt-3">
          <p className="text-sm text-[var(--brand-ink)]">
            Qual foi o principal motivo?{" "}
            <span className="text-[var(--text-subtle)]">(opcional)</span>
          </p>
          <select
            className="flex h-10 w-full max-w-sm rounded-xl border border-[var(--border)] bg-white px-3 text-sm"
            value={reason}
            onChange={(e) =>
              setReason(e.target.value as (typeof CANCEL_REASONS)[number])
            }
          >
            {CANCEL_REASONS.map((r) => (
              <option key={r} value={r}>
                {REASON_LABELS[r]}
              </option>
            ))}
          </select>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              loading={busy}
              onClick={() => void cancelWithOptionalFeedback()}
            >
              Confirmar cancelamento
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowCancelFeedback(false)}
            >
              Voltar
            </Button>
          </div>
        </div>
      ) : null}

      {message ? (
        <p className="text-sm text-[var(--success)]" role="status">
          {message}
        </p>
      ) : null}
    </section>
  );
}
