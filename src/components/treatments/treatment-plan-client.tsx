"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { calculatePlanTotals, formatBRL, reaisToCents } from "@/lib/treatments/money";
import {
  ITEM_STATUS_LABELS,
  PLAN_STATUS_LABELS,
  PROCEDURE_SUGGESTIONS,
  type TreatmentPlanWithItems,
} from "@/types/treatment";

export function TreatmentPlanClient({
  patientId,
  planId,
  canUpdate,
  canPresent,
  canAcceptance,
  canProgress,
  canCreateFinance = false,
}: {
  patientId: string;
  planId: string;
  canUpdate: boolean;
  canPresent: boolean;
  canAcceptance: boolean;
  canProgress: boolean;
  canCreateFinance?: boolean;
}) {
  const router = useRouter();
  const [plan, setPlan] = useState<TreatmentPlanWithItems | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [itemForm, setItemForm] = useState({
    procedure_name: "",
    tooth_numbers: "",
    quantity: 1,
    unit_price_reais: 0,
    description: "",
  });

  const load = useCallback(async () => {
    const res = await fetch(`/api/demo/treatments?id=${planId}`);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Não encontramos este registro.");
      return;
    }
    setPlan(data.plan);
  }, [planId]);

  useEffect(() => {
    void load();
  }, [load]);

  const previewTotals = useMemo(() => {
    if (!plan) return null;
    return calculatePlanTotals({
      items: plan.items,
      discount_type: plan.discount_type,
      discount_percent: plan.discount_percent,
      discount_value_cents: plan.discount_value_cents,
    });
  }, [plan]);

  async function post(action: string, body: Record<string, unknown> = {}) {
    setBusy(true);
    setError(null);
    setMessage(null);
    const res = await fetch("/api/demo/treatments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, id: planId, ...body }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Não foi possível concluir esta ação. Tente novamente.");
      return null;
    }
    if (data.plan) setPlan(data.plan);
    return data.plan as TreatmentPlanWithItems;
  }

  async function addItem() {
    const teeth = itemForm.tooth_numbers
      .split(/[,\s]+/)
      .map((t) => Number(t))
      .filter((n) => Number.isFinite(n) && n > 0);
    const updated = await post("add-item", {
      treatment_plan_id: planId,
      procedure_name: itemForm.procedure_name,
      tooth_numbers: teeth,
      quantity: itemForm.quantity,
      unit_price_reais: itemForm.unit_price_reais,
      description: itemForm.description,
      expected_updated_at: plan?.updated_at,
    });
    if (updated) {
      setMessage("Procedimento adicionado.");
      setAdding(false);
      setItemForm({
        procedure_name: "",
        tooth_numbers: "",
        quantity: 1,
        unit_price_reais: 0,
        description: "",
      });
    }
  }

  if (!plan) {
    return (
      <div className="mx-auto max-w-4xl p-4">
        {error ? (
          <p className="text-sm text-[var(--danger)]">{error}</p>
        ) : (
          <div className="h-32 animate-pulse rounded-2xl bg-[var(--surface-muted)]" />
        )}
      </div>
    );
  }

  const discountCents =
    (previewTotals?.discount_cents ?? 0);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
      <section>
        <p className="text-sm text-[var(--text-muted)]">
          <Link
            href={`/app/pacientes/${patientId}/tratamentos`}
            className="text-[var(--brand-primary)]"
          >
            Tratamentos
          </Link>
        </p>
        <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight text-[var(--brand-ink)]">
              {plan.title}
            </h1>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Criado em{" "}
              {format(new Date(plan.created_at), "dd/MM/yyyy", { locale: ptBR })}
              {plan.valid_until
                ? ` · validade ${plan.valid_until.split("-").reverse().join("/")}`
                : ""}
              {` · v${plan.version_number}`}
            </p>
          </div>
          <Badge tone={plan.status === "rejected" ? "danger" : "info"}>
            {PLAN_STATUS_LABELS[plan.status]}
          </Badge>
        </div>
        {plan.is_expired ? (
          <p className="mt-2 text-sm text-[var(--warning)]">Validade encerrada</p>
        ) : null}
      </section>

      <div className="flex flex-wrap gap-2">
        {canPresent && plan.status === "draft" ? (
          <Button
            type="button"
            loading={busy}
            onClick={async () => {
              const p = await post("present");
              if (p) setMessage("Plano marcado como apresentado.");
            }}
          >
            Apresentar ao paciente
          </Button>
        ) : null}
        {canAcceptance && plan.status === "presented" ? (
          <>
            <Button
              type="button"
              loading={busy}
              onClick={async () => {
                if (!window.confirm("Confirmar aceite deste plano?")) return;
                const p = await post("accept");
                if (p) setMessage("Aceite registrado.");
              }}
            >
              Registrar aceite
            </Button>
            <Button
              type="button"
              variant="secondary"
              loading={busy}
              onClick={async () => {
                const reason =
                  window.prompt("Motivo da recusa (opcional):") ?? "";
                const p = await post("reject", { rejection_reason: reason });
                if (p) setMessage("Recusa registrada.");
              }}
            >
              Registrar recusa
            </Button>
          </>
        ) : null}
        {canUpdate && plan.status !== "draft" && plan.status !== "completed" ? (
          <Button
            type="button"
            variant="secondary"
            loading={busy}
            onClick={async () => {
              const p = await post("revise", {
                reason: "Alteração material",
              });
              if (p) setMessage("Nova revisão criada. Reapresente o plano.");
            }}
          >
            Criar nova revisão
          </Button>
        ) : null}
        {canProgress && plan.status === "in_progress" ? (
          <Button
            type="button"
            variant="secondary"
            loading={busy}
            onClick={async () => {
              if (!window.confirm("Concluir este plano?")) return;
              const p = await post("complete-plan");
              if (p) setMessage("Plano concluído.");
            }}
          >
            Concluir plano
          </Button>
        ) : null}
        {canUpdate ? (
          <Button
            type="button"
            variant="ghost"
            loading={busy}
            onClick={async () => {
              const p = await post("duplicate");
              if (p) {
                setMessage("Cópia criada.");
                router.push(`/app/pacientes/${patientId}/tratamentos/${p.id}`);
              }
            }}
          >
            Duplicar como novo plano
          </Button>
        ) : null}
        {canCreateFinance &&
        (plan.status === "accepted" ||
          plan.status === "in_progress" ||
          plan.status === "completed") ? (
          <Button
            type="button"
            variant="secondary"
            loading={busy}
            onClick={async () => {
              const choice = window.prompt(
                "Criar condição de pagamento?\n\nDigite o número de parcelas (1–4) ou deixe 1 para à vista:",
                "3",
              );
              if (choice === null) return;
              const count = Math.min(48, Math.max(1, Number(choice) || 1));
              const discountStr = window.prompt(
                "Desconto financeiro adicional (R$), opcional:",
                "0",
              );
              setBusy(true);
              setError(null);
              const res = await fetch("/api/demo/finance", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  action: "create-from-treatment",
                  treatment_plan_id: planId,
                  installments_count: count,
                  discount_amount_reais: Number(discountStr) || 0,
                  first_due_date: new Date().toISOString().slice(0, 10),
                }),
              });
              const data = await res.json();
              setBusy(false);
              if (!res.ok) {
                setError(
                  data.error ??
                    "Não foi possível concluir esta ação. Tente novamente.",
                );
                return;
              }
              setMessage(
                "Condição de pagamento criada. Plano aceito ≠ receita recebida.",
              );
              router.push(`/app/pacientes/${patientId}/financeiro`);
            }}
          >
            Criar condição de pagamento
          </Button>
        ) : null}
      </div>

      {message ? (
        <p className="rounded-xl bg-[var(--success-soft)] px-3 py-2 text-sm text-[var(--success)]" role="status">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-xl bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger)]">
          {error}
        </p>
      ) : null}

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/90 p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="font-[family-name:var(--font-display)] text-lg text-[var(--brand-ink)]">
            Procedimentos
          </h2>
          {canUpdate && plan.status === "draft" ? (
            <Button type="button" size="sm" onClick={() => setAdding(true)}>
              + Adicionar procedimento
            </Button>
          ) : null}
        </div>

        {plan.items.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">
            Adicione o primeiro procedimento
          </p>
        ) : (
          <>
            <div className="hidden md:block">
              <table className="w-full text-left text-sm">
                <thead className="text-xs text-[var(--text-subtle)]">
                  <tr>
                    <th className="py-2">Procedimento</th>
                    <th>Dente(s)</th>
                    <th>Qtd.</th>
                    <th>Unitário</th>
                    <th>Total</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {plan.items.map((item) => (
                    <tr key={item.id} className="border-t border-[var(--border)]">
                      <td className="py-2 font-medium">{item.procedure_name}</td>
                      <td>{item.tooth_numbers.join(", ") || "—"}</td>
                      <td>{item.quantity}</td>
                      <td>{formatBRL(item.unit_price_cents)}</td>
                      <td>{formatBRL(item.total_price_cents)}</td>
                      <td>{ITEM_STATUS_LABELS[item.status]}</td>
                      <td className="text-right">
                        <ItemActions
                          itemId={item.id}
                          status={item.status}
                          planStatus={plan.status}
                          canProgress={canProgress}
                          canUpdate={canUpdate}
                          busy={busy}
                          onAction={post}
                          onMessage={setMessage}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="space-y-3 md:hidden">
              {plan.items.map((item) => (
                <li
                  key={item.id}
                  className="rounded-xl bg-[var(--surface-muted)]/70 px-3 py-3"
                >
                  <p className="font-medium">{item.procedure_name}</p>
                  <p className="text-xs text-[var(--text-muted)]">
                    {item.tooth_numbers.join(", ") || "Sem dente"} · qtd{" "}
                    {item.quantity} · {formatBRL(item.total_price_cents)}
                  </p>
                  <p className="mt-1 text-xs">{ITEM_STATUS_LABELS[item.status]}</p>
                  <div className="mt-2">
                    <ItemActions
                      itemId={item.id}
                      status={item.status}
                      planStatus={plan.status}
                      canProgress={canProgress}
                      canUpdate={canUpdate}
                      busy={busy}
                      onAction={post}
                      onMessage={setMessage}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}

        {adding ? (
          <div className="mt-4 space-y-3 rounded-xl border border-dashed border-[var(--border)] p-3">
            <div>
              <Label>Procedimento</Label>
              <Input
                list="proc-suggestions"
                value={itemForm.procedure_name}
                onChange={(e) =>
                  setItemForm((f) => ({ ...f, procedure_name: e.target.value }))
                }
              />
              <datalist id="proc-suggestions">
                {PROCEDURE_SUGGESTIONS.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <Label>Dente(s)</Label>
                <Input
                  placeholder="16, 26"
                  value={itemForm.tooth_numbers}
                  onChange={(e) =>
                    setItemForm((f) => ({ ...f, tooth_numbers: e.target.value }))
                  }
                />
              </div>
              <div>
                <Label>Quantidade</Label>
                <Input
                  type="number"
                  min={1}
                  value={itemForm.quantity}
                  onChange={(e) =>
                    setItemForm((f) => ({
                      ...f,
                      quantity: Number(e.target.value) || 1,
                    }))
                  }
                />
              </div>
              <div>
                <Label>Valor unitário (R$)</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={itemForm.unit_price_reais}
                  onChange={(e) =>
                    setItemForm((f) => ({
                      ...f,
                      unit_price_reais: Number(e.target.value) || 0,
                    }))
                  }
                />
              </div>
            </div>
            <p className="text-xs text-[var(--text-subtle)]">
              Total linha:{" "}
              {formatBRL(
                itemForm.quantity * reaisToCents(itemForm.unit_price_reais),
              )}
            </p>
            <div className="flex gap-2">
              <Button type="button" loading={busy} onClick={addItem}>
                Adicionar
              </Button>
              <Button type="button" variant="ghost" onClick={() => setAdding(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/90 p-4">
        <h2 className="mb-3 font-[family-name:var(--font-display)] text-lg text-[var(--brand-ink)]">
          Valores
        </h2>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-[var(--text-muted)]">Subtotal</dt>
            <dd>{formatBRL(plan.subtotal_cents)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-[var(--text-muted)]">Desconto</dt>
            <dd>{formatBRL(discountCents)}</dd>
          </div>
          <div className="flex justify-between text-base font-semibold">
            <dt>Total</dt>
            <dd>{formatBRL(plan.total_cents)}</dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-[var(--text-subtle)]">
          Progresso clínico: {plan.progress.completed} de {plan.progress.total}{" "}
          ({plan.progress.percent}%) — não representa pagamento.
        </p>
      </section>
    </div>
  );
}

function ItemActions({
  itemId,
  status,
  planStatus,
  canProgress,
  canUpdate,
  busy,
  onAction,
  onMessage,
}: {
  itemId: string;
  status: string;
  planStatus: string;
  canProgress: boolean;
  canUpdate: boolean;
  busy: boolean;
  onAction: (action: string, body?: Record<string, unknown>) => Promise<unknown>;
  onMessage: (m: string) => void;
}) {
  if (canUpdate && planStatus === "draft") {
    return (
      <Button
        type="button"
        size="sm"
        variant="ghost"
        loading={busy}
        onClick={async () => {
          await onAction("remove-item", { id: itemId });
          onMessage("Procedimento removido.");
        }}
      >
        Remover
      </Button>
    );
  }
  if (!canProgress) return null;
  if (planStatus !== "accepted" && planStatus !== "in_progress") return null;

  return (
    <div className="flex flex-wrap justify-end gap-1">
      {(status === "planned" || status === "accepted") && (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          loading={busy}
          onClick={async () => {
            await onAction("start-item", { id: itemId });
            onMessage("Procedimento iniciado.");
          }}
        >
          Iniciar
        </Button>
      )}
      {(status === "in_progress" || status === "accepted") && (
        <Button
          type="button"
          size="sm"
          loading={busy}
          onClick={async () => {
            await onAction("complete-item", { id: itemId });
            onMessage("Procedimento concluído.");
          }}
        >
          Concluir
        </Button>
      )}
    </div>
  );
}
