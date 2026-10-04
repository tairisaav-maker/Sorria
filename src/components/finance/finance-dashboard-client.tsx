"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Download, Plus } from "lucide-react";
import { format, formatDistanceStrict } from "date-fns";
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
  EXPENSE_CATEGORY_LABELS,
  METHOD_LABELS,
  STATUS_LABELS,
  TYPE_LABELS,
  type FinancialDashboard,
  type PaymentMethod,
  type TransactionWithDetails,
} from "@/types/finance";

type Period = "7d" | "30d" | "month" | "6m" | "year";

export function FinanceDashboardClient({
  canCreate,
  canExpense,
  canPay,
  canReverse,
  canExport,
}: {
  canCreate: boolean;
  canExpense: boolean;
  canPay: boolean;
  canReverse: boolean;
  canExport: boolean;
}) {
  const [period, setPeriod] = useState<Period>("month");
  const [type, setType] = useState<"all" | "income" | "expense">("all");
  const [q, setQ] = useState("");
  const [dashboard, setDashboard] = useState<FinancialDashboard | null>(null);
  const [items, setItems] = useState<TransactionWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState<"income" | "expense" | null>(null);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams({ period, type, q });
    const [dashRes, listRes] = await Promise.all([
      fetch(`/api/demo/finance?resource=dashboard&${qs}`),
      fetch(`/api/demo/finance?resource=list&${qs}`),
    ]);
    const dashData = await dashRes.json();
    const listData = await listRes.json();
    if (!dashRes.ok) setError(dashData.error ?? "Erro ao carregar");
    else setDashboard(dashData.dashboard);
    if (listRes.ok) setItems(listData.items ?? []);
    setLoading(false);
  }, [period, type, q]);

  useEffect(() => {
    void load();
  }, [load]);

  async function exportFile(format: "csv" | "xlsx" | "pdf") {
    setBusy(true);
    const qs = new URLSearchParams({
      resource: "export",
      format,
      period,
      type,
      q,
    });
    const res = await fetch(`/api/demo/finance?${qs}`);
    setBusy(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Não foi possível concluir esta ação. Tente novamente.");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sorria-financeiro.${format}`;
    a.click();
    URL.revokeObjectURL(url);
    setMessage("Arquivo gerado.");
  }

  const openInstallments = useMemo(() => {
    return items.flatMap((tx) =>
      tx.installments
        .filter((i) => i.balance_cents > 0 && tx.type === "income")
        .map((i) => ({ ...i, tx })),
    );
  }, [items]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <section className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight text-[var(--brand-ink)]">
            Financeiro
          </h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Acompanhe entradas, valores a receber e despesas do consultório.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canExport ? (
            <>
              <Button type="button" size="sm" variant="secondary" loading={busy} onClick={() => exportFile("csv")}>
                <Download className="size-4" /> CSV
              </Button>
              <Button type="button" size="sm" variant="secondary" loading={busy} onClick={() => exportFile("xlsx")}>
                XLSX
              </Button>
              <Button type="button" size="sm" variant="secondary" loading={busy} onClick={() => exportFile("pdf")}>
                PDF
              </Button>
            </>
          ) : null}
          {(canCreate || canExpense) && (
            <Button type="button" onClick={() => setCreating(canCreate ? "income" : "expense")}>
              <Plus className="size-4" />
              Novo lançamento
            </Button>
          )}
        </div>
      </section>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["month", "Este mês"],
            ["7d", "7 dias"],
            ["30d", "30 dias"],
            ["6m", "6 meses"],
            ["year", "Este ano"],
          ] as const
        ).map(([value, label]) => (
          <Button
            key={value}
            type="button"
            size="sm"
            variant={period === value ? "primary" : "secondary"}
            onClick={() => setPeriod(value)}
          >
            {label}
          </Button>
        ))}
      </div>

      {message ? (
        <p className="rounded-xl bg-[var(--success-soft)] px-3 py-2 text-sm text-[var(--success)]" role="status">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-xl bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger)]">{error}</p>
      ) : null}

      {loading || !dashboard ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-[var(--surface-muted)]" />
          ))}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi title="Recebido no mês" value={formatBRL(dashboard.received_cents)} hint="pagamentos efetivos" />
          <Kpi title="A receber" value={formatBRL(dashboard.receivable_cents)} hint="saldo pendente" />
          <Kpi title="Vencido" value={formatBRL(dashboard.overdue_cents)} hint="parcelas em atraso" tone="warning" />
          <Kpi title="Despesas" value={formatBRL(dashboard.expenses_cents)} hint="pagamentos de despesa no período" />
        </div>
      )}

      {dashboard ? (
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/90 p-4 sm:p-5">
          <h2 className="font-[family-name:var(--font-display)] text-lg text-[var(--brand-ink)]">
            Entradas × Despesas
          </h2>
          <p className="text-sm text-[var(--text-muted)]">Valores efetivamente realizados (últimos 6 meses)</p>
          <div className="mt-4 h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dashboard.series}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} width={40} />
                <Tooltip formatter={(v: number) => formatBRL(Math.round(v * 100))} />
                <Legend />
                <Bar dataKey="income" name="Entradas" fill="var(--brand-primary)" radius={[6, 6, 0, 0]} />
                <Bar dataKey="expense" name="Despesas" fill="var(--warning)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      ) : null}

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/90 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-[family-name:var(--font-display)] text-lg">Próximos vencimentos</h2>
        </div>
        {!dashboard?.upcoming.length ? (
          <EmptyState title="Nenhum valor pendente" description="Não há parcelas em aberto para este período." />
        ) : (
          <ul className="space-y-2">
            {dashboard.upcoming.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[var(--surface-muted)]/60 px-3 py-2 text-sm"
              >
                <div>
                  <p className="font-medium">
                    {item.due_date.split("-").reverse().join("/")} — {formatBRL(item.balance_cents)}
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">
                    {item.description}
                    {item.patient_name ? ` · ${item.patient_name}` : ""}
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
                {canPay && item.balance_cents > 0 ? (
                  <Button type="button" size="sm" onClick={() => setPayingId(item.id)}>
                    Registrar pagamento
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[180px] flex-1">
            <Label htmlFor="q">Buscar</Label>
            <Input
              id="q"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Paciente ou descrição"
            />
          </div>
          <Select value={type} onChange={(e) => setType(e.target.value as typeof type)}>
            <option value="all">Todos</option>
            <option value="income">Receitas</option>
            <option value="expense">Despesas</option>
          </Select>
        </div>

        {!loading && items.length === 0 ? (
          <EmptyState
            title="Nenhuma movimentação financeira"
            description="Registre uma receita ou despesa para começar."
            action={
              canCreate || canExpense ? (
                <Button type="button" onClick={() => setCreating("income")}>
                  <Plus className="size-4" /> Novo lançamento
                </Button>
              ) : undefined
            }
          />
        ) : null}

        <div className="hidden md:block overflow-x-auto rounded-2xl border border-[var(--border)]">
          <table className="w-full text-left text-sm">
            <thead className="bg-[var(--surface-muted)]/70 text-xs text-[var(--text-subtle)]">
              <tr>
                <th className="px-3 py-2">Data</th>
                <th>Descrição</th>
                <th>Paciente/Origem</th>
                <th>Tipo</th>
                <th>Valor</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-t border-[var(--border)]">
                  <td className="px-3 py-2">
                    {format(new Date(item.created_at), "dd/MM/yyyy", { locale: ptBR })}
                  </td>
                  <td className="font-medium">{item.description}</td>
                  <td>{item.patient_name ?? item.treatment_title ?? "—"}</td>
                  <td>{TYPE_LABELS[item.type]}</td>
                  <td>{formatBRL(item.net_amount_cents)}</td>
                  <td>
                    <Badge tone={item.status === "overdue" ? "danger" : item.status === "paid" ? "success" : "info"}>
                      {STATUS_LABELS[item.status]}
                    </Badge>
                  </td>
                  <td className="px-2 text-right">
                    {canPay && item.type === "income" && item.balance_cents > 0 ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          const open = item.installments.find((i) => i.balance_cents > 0);
                          if (open) setPayingId(open.id);
                        }}
                      >
                        Pagar
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <ul className="space-y-3 md:hidden">
          {items.map((item) => (
            <li key={item.id} className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/90 p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{item.description}</p>
                  <p className="text-xs text-[var(--text-muted)]">
                    {item.patient_name ?? "Sem paciente"} · {TYPE_LABELS[item.type]}
                  </p>
                </div>
                <Badge tone={item.status === "overdue" ? "danger" : "info"}>
                  {STATUS_LABELS[item.status]}
                </Badge>
              </div>
              <p className="mt-2 text-sm font-semibold">{formatBRL(item.net_amount_cents)}</p>
              {canPay && item.balance_cents > 0 && item.type === "income" ? (
                <Button
                  className="mt-2"
                  type="button"
                  size="sm"
                  onClick={() => {
                    const open = item.installments.find((i) => i.balance_cents > 0);
                    if (open) setPayingId(open.id);
                  }}
                >
                  Registrar pagamento
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      {creating ? (
        <LaunchForm
          type={creating}
          canExpense={canExpense}
          busy={busy}
          onClose={() => setCreating(null)}
          onTypeChange={setCreating}
          onSubmit={async (body) => {
            setBusy(true);
            setError(null);
            const res = await fetch("/api/demo/finance", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: creating === "expense" ? "create-expense" : "create-income",
                ...body,
              }),
            });
            const data = await res.json();
            setBusy(false);
            if (!res.ok) {
              setError(data.error ?? "Não foi possível concluir esta ação. Tente novamente.");
              return;
            }
            setMessage(creating === "expense" ? "Despesa registrada." : "Plano salvo.");
            setCreating(null);
            await load();
          }}
        />
      ) : null}

      {payingId ? (
        <PaymentDialog
          installmentId={payingId}
          canReverse={canReverse}
          defaultBalance={
            openInstallments.find((i) => i.id === payingId)?.balance_cents ?? 0
          }
          onClose={() => setPayingId(null)}
          onDone={async (msg) => {
            setMessage(msg);
            setPayingId(null);
            await load();
          }}
          onError={setError}
        />
      ) : null}
    </div>
  );
}

function Kpi({
  title,
  value,
  hint,
  tone,
}: {
  title: string;
  value: string;
  hint: string;
  tone?: "warning";
}) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/90 p-4">
      <p className="text-xs uppercase tracking-wide text-[var(--text-subtle)]">{title}</p>
      <p
        className={`mt-2 font-[family-name:var(--font-display)] text-2xl ${
          tone === "warning" ? "text-[var(--warning)]" : "text-[var(--brand-ink)]"
        }`}
      >
        {value}
      </p>
      <p className="mt-1 text-xs text-[var(--text-muted)]">{hint}</p>
    </div>
  );
}

function LaunchForm({
  type,
  canExpense,
  busy,
  onClose,
  onTypeChange,
  onSubmit,
}: {
  type: "income" | "expense";
  canExpense: boolean;
  busy: boolean;
  onClose: () => void;
  onTypeChange: (t: "income" | "expense") => void;
  onSubmit: (body: Record<string, unknown>) => Promise<void>;
}) {
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState(0);
  const [due, setDue] = useState(new Date().toISOString().slice(0, 10));
  const [count, setCount] = useState(1);
  const [category, setCategory] = useState("material");
  const [notes, setNotes] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <form
        className="w-full max-w-lg space-y-3 rounded-2xl bg-white p-4 shadow-xl"
        onSubmit={(e) => {
          e.preventDefault();
          void onSubmit({
            description,
            gross_amount_reais: amount,
            due_date: due,
            installments_count: count,
            category: type === "expense" ? category : null,
            notes,
            type,
          });
        }}
      >
        <h3 className="font-[family-name:var(--font-display)] text-xl">Novo lançamento</h3>
        <div className="flex gap-2">
          <Button type="button" size="sm" variant={type === "income" ? "primary" : "secondary"} onClick={() => onTypeChange("income")}>
            Receita
          </Button>
          {canExpense ? (
            <Button type="button" size="sm" variant={type === "expense" ? "primary" : "secondary"} onClick={() => onTypeChange("expense")}>
              Despesa
            </Button>
          ) : null}
        </div>
        <div>
          <Label>Descrição</Label>
          <Input value={description} onChange={(e) => setDescription(e.target.value)} required />
        </div>
        {type === "expense" ? (
          <div>
            <Label>Categoria</Label>
            <Select value={category} onChange={(e) => setCategory(e.target.value)}>
              {Object.entries(EXPENSE_CATEGORY_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </Select>
          </div>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label>Valor (R$)</Label>
            <Input type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(Number(e.target.value) || 0)} required />
          </div>
          <div>
            <Label>Vencimento</Label>
            <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
          </div>
          <div>
            <Label>Parcelas</Label>
            <Input type="number" min={1} max={48} value={count} onChange={(e) => setCount(Number(e.target.value) || 1)} />
          </div>
        </div>
        <div>
          <Label>Observação</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={busy}>Salvar</Button>
        </div>
      </form>
    </div>
  );
}

function PaymentDialog({
  installmentId,
  defaultBalance,
  canReverse,
  onClose,
  onDone,
  onError,
}: {
  installmentId: string;
  defaultBalance: number;
  canReverse: boolean;
  onClose: () => void;
  onDone: (msg: string) => Promise<void>;
  onError: (msg: string) => void;
}) {
  const [amount, setAmount] = useState(defaultBalance / 100);
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState<PaymentMethod>("pix");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const requestId = useMemo(() => crypto.randomUUID(), []);

  useEffect(() => {
    setAmount(defaultBalance / 100);
  }, [defaultBalance]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
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
          await onDone(data.message ?? "Pagamento registrado.");
        }}
      >
        <h3 className="font-[family-name:var(--font-display)] text-xl">Registrar pagamento</h3>
        <div>
          <Label>Valor pago</Label>
          <Input type="number" min={0.01} step="0.01" value={amount} onChange={(e) => setAmount(Number(e.target.value) || 0)} />
          <p className="mt-1 text-xs text-[var(--text-subtle)]">
            Saldo restante: {formatBRL(defaultBalance)}
          </p>
        </div>
        <div>
          <Label>Data</Label>
          <Input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
        </div>
        <div>
          <Label>Forma de pagamento</Label>
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
        {canReverse ? (
          <p className="text-xs text-[var(--text-subtle)]">
            Estornos ficam disponíveis no detalhe do lançamento após o registro.
          </p>
        ) : null}
      </form>
    </div>
  );
}
