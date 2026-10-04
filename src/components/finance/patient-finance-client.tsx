"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { formatDistanceStrict } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatBRL } from "@/lib/money";
import {
  METHOD_LABELS,
  STATUS_LABELS,
  type PatientFinancialSummary,
  type PaymentMethod,
  type TransactionWithDetails,
} from "@/types/finance";

export function PatientFinanceClient({
  patientId,
  patientName,
  canPay,
  canReverse,
}: {
  patientId: string;
  patientName: string;
  canPay: boolean;
  canReverse: boolean;
}) {
  const [summary, setSummary] = useState<PatientFinancialSummary | null>(null);
  const [history, setHistory] = useState<TransactionWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [paying, setPaying] = useState<{
    id: string;
    balance: number;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(
      `/api/demo/finance?resource=patient-summary&patientId=${patientId}`,
    );
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Não encontramos este registro.");
      return;
    }
    setSummary(data.summary);
    setHistory(data.history ?? []);
  }, [patientId]);

  useEffect(() => {
    void load();
  }, [load]);

  const upcoming = useMemo(() => {
    return history
      .flatMap((tx) =>
        tx.installments.map((i) => ({
          ...i,
          description: tx.description,
          treatment: tx.treatment_title,
        })),
      )
      .filter((i) => i.balance_cents > 0)
      .sort((a, b) => a.due_date.localeCompare(b.due_date));
  }, [history]);

  if (loading) {
    return <div className="h-40 animate-pulse rounded-2xl bg-[var(--surface-muted)]" />;
  }

  if (error && !summary) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--border)] px-5 py-10 text-center text-sm text-[var(--text-muted)]">
        {error}
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
      <section>
        <p className="text-sm text-[var(--text-muted)]">
          <Link href={`/app/pacientes/${patientId}`} className="text-[var(--brand-primary)]">
            {patientName}
          </Link>
        </p>
        <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight text-[var(--brand-ink)]">
          Financeiro
        </h1>
      </section>

      {message ? (
        <p className="rounded-xl bg-[var(--success-soft)] px-3 py-2 text-sm text-[var(--success)]">{message}</p>
      ) : null}

      {summary ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Mini title="Total contratado" value={formatBRL(summary.contracted_cents)} />
          <Mini title="Total recebido" value={formatBRL(summary.received_cents)} />
          <Mini title="A receber" value={formatBRL(summary.receivable_cents)} />
          <Mini title="Vencido" value={formatBRL(summary.overdue_cents)} warning />
        </div>
      ) : null}

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/90 p-4">
        <h2 className="mb-3 font-[family-name:var(--font-display)] text-lg">Próximos vencimentos</h2>
        {upcoming.length === 0 ? (
          <EmptyState title="Nenhum valor pendente" description="Não há parcelas em aberto para este paciente." />
        ) : (
          <ul className="space-y-2">
            {upcoming.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[var(--surface-muted)]/60 px-3 py-2 text-sm">
                <div>
                  <p className="font-medium">
                    {item.due_date.split("-").reverse().join("/")} — {formatBRL(item.balance_cents)}
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">
                    {item.description}
                    {item.treatment ? ` · ${item.treatment}` : ""}
                  </p>
                  {item.status === "overdue" ? (
                    <p className="text-xs text-[var(--danger)]">
                      Vencida há{" "}
                      {formatDistanceStrict(new Date(`${item.due_date}T12:00:00`), new Date(), {
                        locale: ptBR,
                        unit: "day",
                      })}
                    </p>
                  ) : null}
                </div>
                {canPay ? (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setPaying({ id: item.id, balance: item.balance_cents })}
                  >
                    Registrar pagamento
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-[family-name:var(--font-display)] text-lg">Histórico</h2>
        {history.length === 0 ? (
          <EmptyState title="Nenhuma movimentação financeira" description="Ainda não há obrigações financeiras para este paciente." />
        ) : (
          history.map((tx) => (
            <article key={tx.id} className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/90 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{tx.description}</p>
                  <p className="text-xs text-[var(--text-muted)]">
                    {tx.treatment_title ?? "Receita"} · {formatBRL(tx.net_amount_cents)}
                  </p>
                </div>
                <Badge tone={tx.status === "overdue" ? "danger" : "info"}>
                  {STATUS_LABELS[tx.status]}
                </Badge>
              </div>
              <ul className="mt-3 space-y-2 text-sm">
                {tx.installments.map((inst) => (
                  <li key={inst.id} className="rounded-xl bg-[var(--surface-muted)]/50 px-3 py-2">
                    <div className="flex flex-wrap justify-between gap-2">
                      <span>
                        Parcela {inst.installment_number} · venc.{" "}
                        {inst.due_date.split("-").reverse().join("/")}
                      </span>
                      <span>
                        {formatBRL(inst.paid_cents)} / {formatBRL(inst.amount_cents)}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--text-muted)]">
                      {STATUS_LABELS[inst.status]}
                      {inst.payments.filter((p) => !p.reversed_at).length
                        ? ` · ${inst.payments
                            .filter((p) => !p.reversed_at)
                            .map((p) => METHOD_LABELS[p.payment_method])
                            .join(", ")}`
                        : ""}
                    </p>
                    {canReverse
                      ? inst.payments
                          .filter((p) => !p.reversed_at)
                          .map((p) => (
                            <Button
                              key={p.id}
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="mt-1"
                              onClick={async () => {
                                const reason = window.prompt("Motivo do estorno:");
                                if (!reason) return;
                                const res = await fetch("/api/demo/finance", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({
                                    action: "reverse-payment",
                                    payment_id: p.id,
                                    reversal_reason: reason,
                                  }),
                                });
                                const data = await res.json();
                                if (!res.ok) {
                                  setError(data.error ?? "Erro");
                                  return;
                                }
                                setMessage("Pagamento estornado.");
                                await load();
                              }}
                            >
                              Estornar {formatBRL(p.amount_cents)}
                            </Button>
                          ))
                      : null}
                  </li>
                ))}
              </ul>
            </article>
          ))
        )}
      </section>

      {paying ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <PaymentMini
            installmentId={paying.id}
            balance={paying.balance}
            onClose={() => setPaying(null)}
            onDone={async () => {
              setMessage("Pagamento registrado.");
              setPaying(null);
              await load();
            }}
            onError={setError}
          />
        </div>
      ) : null}
    </div>
  );
}

function Mini({
  title,
  value,
  warning,
}: {
  title: string;
  value: string;
  warning?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/90 p-4">
      <p className="text-xs text-[var(--text-subtle)]">{title}</p>
      <p className={`mt-1 text-xl font-semibold ${warning ? "text-[var(--danger)]" : ""}`}>
        {value}
      </p>
    </div>
  );
}

function PaymentMini({
  installmentId,
  balance,
  onClose,
  onDone,
  onError,
}: {
  installmentId: string;
  balance: number;
  onClose: () => void;
  onDone: () => Promise<void>;
  onError: (m: string) => void;
}) {
  const [amount, setAmount] = useState(balance / 100);
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState<PaymentMethod>("pix");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const requestId = useMemo(() => crypto.randomUUID(), []);

  return (
    <form
      className="w-full max-w-md space-y-3 rounded-2xl bg-white p-4 shadow-xl"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const res = await fetch("/api/demo/finance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "register-payment",
            installment_id: installmentId,
            amount_reais: amount,
            paid_at: paidAt,
            payment_method: method,
            notes,
            client_request_id: requestId,
          }),
        });
        const data = await res.json();
        setBusy(false);
        if (!res.ok) {
          onError(data.error ?? "Não foi possível concluir esta ação. Tente novamente.");
          return;
        }
        await onDone();
      }}
    >
      <h3 className="font-[family-name:var(--font-display)] text-xl">Registrar pagamento</h3>
      <div>
        <Label>Valor pago</Label>
        <Input type="number" min={0.01} step="0.01" value={amount} onChange={(e) => setAmount(Number(e.target.value) || 0)} />
      </div>
      <div>
        <Label>Data</Label>
        <Input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
      </div>
      <div>
        <Label>Forma</Label>
        <Select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
          {Object.entries(METHOD_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </Select>
      </div>
      <div>
        <Label>Observação</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button type="submit" loading={busy}>Confirmar</Button>
      </div>
    </form>
  );
}
