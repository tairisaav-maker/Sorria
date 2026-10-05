"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { ProcedureLibraryPicker } from "@/components/procedures/procedure-library-picker";
import { ProcedureSimulationDialog } from "@/components/procedures/procedure-simulation-dialog";
import { formatBRL } from "@/lib/money";
import { startFlowTimer, trackClientEvent } from "@/lib/pilot/client";
import {
  PERFORMED_PROCEDURE_STATUS_LABELS,
  type PerformedProcedureStatus,
} from "@/types/performed-procedure";

type CatalogProc = { id: string; name: string; default_price_cents: number | null };
type InvItem = { id: string; name: string };

type Detail = {
  procedure: {
    id: string;
    procedure_name_snapshot: string;
    tooth_number: number | null;
    status: PerformedProcedureStatus;
    quantity: number;
    charged_amount_cents: number | null;
    standard_price_snapshot_cents?: number | null;
    planned_total_cost_cents: number | null;
    actual_total_cost_cents: number | null;
    gross_result_cents: number | null;
    gross_margin_percent: number | null;
    operational_total_cost_cents?: number | null;
    operational_result_cents?: number | null;
    operational_margin_percent?: number | null;
    consumption_confirmed: boolean;
    patient_id: string;
  };
  consumptions: Array<{
    id: string;
    item_name_snapshot: string;
    actual_item_name_snapshot: string | null;
    planned_quantity: number;
    actual_quantity: number | null;
    consumption_unit: string;
    planned_cost_cents: number;
    actual_cost_cents: number | null;
    is_extra: boolean;
    inventory_item_id: string;
    actual_inventory_item_id: string | null;
  }>;
  appointment_consumptions: Array<{
    id: string;
    item_name_snapshot: string;
    planned_quantity: number;
    actual_quantity: number | null;
    consumption_unit: string;
    planned_cost_cents: number;
    actual_cost_cents: number | null;
    status: string;
  }>;
  canViewCosts: boolean;
  financeOffer?: { offer: boolean; reason: string };
};

export function AttendanceClient({
  appointmentId,
  patientId,
  patientName,
  canCreate,
  canConfirm,
}: {
  appointmentId: string;
  patientId: string;
  patientName: string;
  canCreate: boolean;
  canConfirm: boolean;
}) {
  const [catalog, setCatalog] = useState<CatalogProc[]>([]);
  const [inventory, setInventory] = useState<InvItem[]>([]);
  const [list, setList] = useState<
    Array<{
      id: string;
      procedure_name_snapshot: string;
      tooth_number: number | null;
      status: PerformedProcedureStatus;
      consumption_confirmed: boolean;
    }>
  >([]);
  const [forecast, setForecast] = useState<
    Array<{
      item_name: string;
      planned_quantity: number;
      consumption_unit: string;
      current_stock: number;
      availability: string;
    }>
  >([]);
  const [selected, setSelected] = useState<Detail | null>(null);
  const [procId, setProcId] = useState("");
  const [tooth, setTooth] = useState("");
  const [qty, setQty] = useState("1");
  const [charge, setCharge] = useState("");
  const [showLibrary, setShowLibrary] = useState(false);
  const [simOpen, setSimOpen] = useState(false);
  const [simPerformedId, setSimPerformedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [extraItem, setExtraItem] = useState("");
  const [extraQty, setExtraQty] = useState("1");
  const [confirmNeg, setConfirmNeg] = useState(false);
  const [plannedCount, setPlannedCount] = useState(0);
  const [converting, setConverting] = useState(false);
  const [completion, setCompletion] = useState<{
    materials_confirmed: boolean;
    evolutions_finalized: number;
    charged_cents: number | null;
    received_cents: number | null;
    outstanding_cents: number | null;
    warnings: string[];
    procedures: Array<{ name: string; tooth_number: number | null }>;
  } | null>(null);
  const [financeBreakdown, setFinanceBreakdown] = useState<{
    standard_price_cents: number | null;
    charged_amount_cents: number | null;
    received_cents: number;
    outstanding_cents: number;
    actual_total_cost_cents: number | null;
    gross_result_charged_cents: number | null;
    gross_margin_percent: number | null;
    financial_status: string;
  } | null>(null);

  async function loadList() {
    const [apptRes, procRes, invRes, plannedRes] = await Promise.all([
      fetch(
        `/api/demo/performed-procedures?view=appointment&appointmentId=${appointmentId}`,
      ).then((r) => r.json()),
      fetch("/api/demo/procedures").then((r) => r.json()),
      fetch("/api/demo/inventory").then((r) => r.json()),
      fetch(
        `/api/demo/planned-procedures?appointmentId=${appointmentId}`,
      ).then((r) => r.json()),
    ]);
    setList(apptRes.items ?? []);
    setForecast(apptRes.forecast?.materials ?? []);
    setCompletion(apptRes.completion ?? null);
    setPlannedCount((plannedRes.items ?? []).length);
    const cats = (procRes.items ?? []) as CatalogProc[];
    setCatalog(cats);
    if (!procId && cats[0]) setProcId(cats[0].id);
    setInventory(
      (invRes.items ?? []).map((i: { id: string; name: string }) => ({
        id: i.id,
        name: i.name,
      })),
    );
    if (!extraItem && invRes.items?.[0]) setExtraItem(invRes.items[0].id);
  }

  async function convertPlanned() {
    setConverting(true);
    setError(null);
    const res = await fetch("/api/demo/planned-procedures", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "convert",
        data: { appointment_id: appointmentId },
      }),
    });
    const json = await res.json();
    setConverting(false);
    if (!res.ok) {
      setError(json.error ?? "Não foi possível converter procedimentos.");
      return;
    }
    await loadList();
  }

  async function openDetail(id: string) {
    const res = await fetch(
      `/api/demo/performed-procedures?view=detail&id=${id}`,
    ).then((r) => r.json());
    if (res.error) {
      setError(res.error);
      return;
    }
    setSelected(res);
    setFinanceBreakdown(res.financeBreakdown ?? null);
    setConfirmNeg(false);
    void trackClientEvent("procedure_consumption.opened", {
      meta: { performed_procedure_id: id },
    });
  }

  useEffect(() => {
    void (async () => {
      void trackClientEvent("appointment.opened", {
        meta: { appointment_id: appointmentId },
      });
      await loadList();
      // Auto-converte previstos se ainda não houver realizados (idempotente)
      try {
        const plannedRes = await fetch(
          `/api/demo/planned-procedures?appointmentId=${appointmentId}`,
        ).then((r) => r.json());
        const count = (plannedRes.items ?? []).length;
        setPlannedCount(count);
        const listRes = await fetch(
          `/api/demo/performed-procedures?view=appointment&appointmentId=${appointmentId}`,
        ).then((r) => r.json());
        if (count > 0 && (listRes.items ?? []).length === 0) {
          await fetch("/api/demo/planned-procedures", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "convert",
              data: { appointment_id: appointmentId },
            }),
          });
          await loadList();
        }
      } catch {
        // silencioso
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appointmentId]);

  const [message, setMessage] = useState<string | null>(null);
  const [completingAppt, setCompletingAppt] = useState(false);

  async function completeAppointment() {
    setCompletingAppt(true);
    setError(null);
    const res = await fetch("/api/demo/appointments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "status",
        id: appointmentId,
        status: "completed",
      }),
    });
    setCompletingAppt(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Não foi possível concluir o atendimento.");
      return;
    }
    setMessage("Atendimento concluído.");
    void trackClientEvent("appointment.completed", {
      meta: { appointment_id: appointmentId },
    });
    await loadList();
  }

  async function addProcedureById(procedureId: string) {
    setError(null);
    const cat = catalog.find((c) => c.id === procedureId);
    const res = await fetch("/api/demo/performed-procedures", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create",
        data: {
          patient_id: patientId,
          appointment_id: appointmentId,
          procedure_id: procedureId,
          tooth_number: tooth ? Number(tooth) : null,
          quantity: Number(qty) || 1,
          charged_amount_reais: charge
            ? Number(charge.replace(",", "."))
            : cat?.default_price_cents != null
              ? cat.default_price_cents / 100
              : null,
        },
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Erro");
      return;
    }
    setShowLibrary(false);
    setTooth("");
    setCharge("");
    await loadList();
    await openDetail(json.item.procedure.id);
  }

  async function addProcedure(e: React.FormEvent) {
    e.preventDefault();
    if (!procId) {
      setShowLibrary(true);
      return;
    }
    await addProcedureById(procId);
  }

  async function saveConsumption() {
    if (!selected) return;
    setError(null);
    const res = await fetch("/api/demo/performed-procedures", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update_consumption",
        data: {
          performed_procedure_id: selected.procedure.id,
          lines: selected.consumptions.map((c) => ({
            id: c.id,
            actual_quantity: c.actual_quantity ?? c.planned_quantity,
            actual_inventory_item_id: c.actual_inventory_item_id,
          })),
          appointment_lines: selected.appointment_consumptions.map((c) => ({
            id: c.id,
            actual_quantity: c.actual_quantity ?? c.planned_quantity,
          })),
        },
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Erro");
      return;
    }
    setSelected(json);
  }

  async function confirm() {
    if (!selected) return;
    await saveConsumption();
    const res = await fetch("/api/demo/performed-procedures", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "confirm_consumption",
        data: {
          performed_procedure_id: selected.procedure.id,
          confirm_insufficient_stock: confirmNeg,
        },
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      if (json.code === "INSUFFICIENT_STOCK") {
        setConfirmNeg(true);
        setError(json.error);
        return;
      }
      setError(json.error ?? "Erro");
      return;
    }
    setSelected(json);
    await loadList();
  }

  async function complete() {
    if (!selected) return;
    const res = await fetch("/api/demo/performed-procedures", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "complete",
        data: { id: selected.procedure.id },
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Erro");
      return;
    }
    setSelected(json.item);
    await loadList();
  }

  async function addExtra(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    const res = await fetch("/api/demo/performed-procedures", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "add_extra",
        data: {
          performed_procedure_id: selected.procedure.id,
          inventory_item_id: extraItem,
          quantity: Number(extraQty.replace(",", ".")),
        },
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Erro");
      return;
    }
    setSelected(json);
  }

  async function registerEvolution() {
    if (!selected) return;
    const res = await fetch("/api/demo/performed-procedures", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "register_evolution",
        data: { id: selected.procedure.id },
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Erro");
      return;
    }
    window.location.href = `/app/pacientes/${patientId}/prontuario?appointmentId=${appointmentId}`;
  }

  async function addFinance() {
    if (!selected) return;
    const res = await fetch("/api/demo/performed-procedures", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "add_to_finance",
        data: { id: selected.procedure.id },
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Erro");
      return;
    }
    setSelected(json.item);
  }

  const availLabel: Record<string, string> = {
    disponivel: "Disponível",
    estoque_baixo: "Estoque baixo",
    insuficiente: "Insuficiente",
  };

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
      <section>
        <p className="text-sm text-[var(--text-muted)]">
          <Link href="/app/agenda" className="text-[var(--brand-primary)]">
            Agenda
          </Link>
          {" · "}
          <Link
            href={`/app/pacientes/${patientId}`}
            className="text-[var(--brand-primary)]"
          >
            {patientName}
          </Link>
        </p>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight text-[var(--brand-ink)]">
              Atendimento
            </h1>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              {patientName} · procedimentos · materiais · evolução · financeiro
            </p>
          </div>
          <Link
            href={`/app/pacientes/${patientId}`}
            className="text-sm text-[var(--brand-primary)] hover:underline"
          >
            Ver paciente
          </Link>
        </div>
      </section>

      <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-subtle)]">
        1. Procedimentos
      </p>

      {canCreate && plannedCount > 0 && list.length === 0 ? (
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/90 p-4">
          <h2 className="font-medium text-[var(--brand-ink)]">
            Procedimentos previstos
          </h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            {plannedCount} previsto(s). Conversão automática ao abrir; use o
            botão se precisar repetir.
          </p>
          <Button
            type="button"
            size="sm"
            className="mt-3"
            loading={converting}
            onClick={() => void convertPlanned()}
          >
            Usar procedimentos previstos
          </Button>
        </section>
      ) : null}

      {forecast.length > 0 ? (
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/90 p-4">
          <h2 className="font-medium text-[var(--brand-ink)]">
            Previsão do atendimento
          </h2>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            Ainda não baixa estoque
          </p>
          <ul className="mt-3 space-y-1 text-sm">
            {forecast.map((m) => (
              <li key={m.item_name} className="flex justify-between gap-2">
                <span>
                  {m.item_name}: {m.planned_quantity} {m.consumption_unit}
                  <span className="text-[var(--text-subtle)]">
                    {" "}
                    (estoque {m.current_stock})
                  </span>
                </span>
                <span>{availLabel[m.availability] ?? m.availability}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {canCreate ? (
        <div className="space-y-3 rounded-2xl border border-[var(--border)] p-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-[var(--brand-ink)]">
                Procedimentos do atendimento
              </p>
              <p className="text-xs text-[var(--text-muted)]">
                Favoritos e mais usados primeiro — 2 a 3 toques
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={() => setShowLibrary(true)}
            >
              + Procedimento
            </Button>
          </div>
          <form
            onSubmit={addProcedure}
            className="grid gap-3 sm:grid-cols-4"
          >
            <div className="sm:col-span-2 space-y-1.5">
              <Label>Atalho do catálogo</Label>
              <Select
                value={procId}
                onChange={(e) => setProcId(e.target.value)}
              >
                <option value="">Escolher…</option>
                {catalog.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Dente</Label>
              <Input
                value={tooth}
                onChange={(e) => setTooth(e.target.value)}
                placeholder="16"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Qtd</Label>
              <Input value={qty} onChange={(e) => setQty(e.target.value)} />
            </div>
            <div className="sm:col-span-4 flex flex-wrap gap-2">
              <Button type="submit" size="sm" variant="secondary">
                Adicionar do atalho
              </Button>
            </div>
          </form>
        </div>
      ) : null}

      {showLibrary ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-[var(--surface)] p-4 sm:p-6">
          <ProcedureLibraryPicker
            mode="attendance"
            onClose={() => setShowLibrary(false)}
            onSelectClinicProcedure={(id) => {
              void addProcedureById(id);
            }}
          />
        </div>
      ) : null}

      <ul className="divide-y divide-[var(--border)] rounded-2xl border border-[var(--border)]">
        {list.length === 0 ? (
          <li className="px-4 py-5 text-sm text-[var(--text-muted)]">
            Nenhum procedimento neste atendimento.
          </li>
        ) : (
          list.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left hover:bg-[var(--surface-muted)]/60"
                onClick={() => openDetail(p.id)}
              >
                <span className="text-sm font-medium">
                  {p.procedure_name_snapshot}
                  {p.tooth_number ? ` — Dente ${p.tooth_number}` : ""}
                </span>
                <span className="text-xs text-[var(--text-muted)]">
                  {PERFORMED_PROCEDURE_STATUS_LABELS[p.status]}
                  {p.consumption_confirmed ? " · consumo ok" : ""}
                </span>
              </button>
            </li>
          ))
        )}
      </ul>

      {selected ? (
        <section className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/90 p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="text-lg font-medium">
                {selected.procedure.procedure_name_snapshot}
                {selected.procedure.tooth_number
                  ? ` — Dente ${selected.procedure.tooth_number}`
                  : ""}
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                {PERFORMED_PROCEDURE_STATUS_LABELS[selected.procedure.status]}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelected(null)}
            >
              Fechar
            </Button>
          </div>

          {selected.canViewCosts ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => {
                setSimPerformedId(selected.procedure.id);
                setSimOpen(true);
              }}
            >
              Simular outro valor
            </Button>
          ) : null}

          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-subtle)]">
              2. Materiais
            </p>
            <h3 className="mt-1 text-sm font-medium">
              Revisar materiais utilizados
            </h3>
            <p className="text-xs text-[var(--text-muted)]">
              Utilizado = previsto por padrão. Altere só o que mudou. Baixa só
              após confirmar.
            </p>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-xs text-[var(--text-subtle)]">
                    <th className="py-1 pr-2">Material</th>
                    <th className="py-1 pr-2">Previsto</th>
                    <th className="py-1 pr-2">Utilizado</th>
                    {selected.canViewCosts ? (
                      <th className="py-1">Custo</th>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {selected.consumptions.map((c, idx) => (
                    <tr key={c.id} className="border-t border-[var(--border)]">
                      <td className="py-2 pr-2">
                        {c.actual_item_name_snapshot ?? c.item_name_snapshot}
                        {c.is_extra ? " (extra)" : ""}
                        {!selected.procedure.consumption_confirmed ? (
                          <Select
                            className="mt-1"
                            value={
                              c.actual_inventory_item_id ?? c.inventory_item_id
                            }
                            onChange={(e) => {
                              const next = { ...selected };
                              next.consumptions = [...next.consumptions];
                              next.consumptions[idx] = {
                                ...c,
                                actual_inventory_item_id: e.target.value,
                                actual_item_name_snapshot:
                                  inventory.find((i) => i.id === e.target.value)
                                    ?.name ?? c.item_name_snapshot,
                              };
                              setSelected(next);
                            }}
                          >
                            {inventory.map((i) => (
                              <option key={i.id} value={i.id}>
                                {i.name}
                              </option>
                            ))}
                          </Select>
                        ) : null}
                      </td>
                      <td className="py-2 pr-2">
                        {c.planned_quantity} {c.consumption_unit}
                      </td>
                      <td className="py-2 pr-2">
                        {selected.procedure.consumption_confirmed ? (
                          `${c.actual_quantity ?? 0} ${c.consumption_unit}`
                        ) : (
                          <Input
                            className="h-9 w-24"
                            value={String(
                              c.actual_quantity ?? c.planned_quantity,
                            )}
                            onChange={(e) => {
                              const next = { ...selected };
                              next.consumptions = [...next.consumptions];
                              next.consumptions[idx] = {
                                ...c,
                                actual_quantity: Number(
                                  e.target.value.replace(",", "."),
                                ),
                              };
                              setSelected(next);
                            }}
                          />
                        )}
                      </td>
                      {selected.canViewCosts ? (
                        <td className="py-2">
                          {formatBRL(c.actual_cost_cents ?? c.planned_cost_cents)}
                        </td>
                      ) : null}
                    </tr>
                  ))}
                  {selected.appointment_consumptions.map((c) => (
                    <tr key={c.id} className="border-t border-[var(--border)]">
                      <td className="py-2 pr-2">
                        {c.item_name_snapshot}{" "}
                        <span className="text-xs text-[var(--text-subtle)]">
                          (por atendimento)
                        </span>
                      </td>
                      <td className="py-2 pr-2">
                        {c.planned_quantity} {c.consumption_unit}
                      </td>
                      <td className="py-2 pr-2">
                        {c.actual_quantity ?? c.planned_quantity}{" "}
                        {c.consumption_unit}
                      </td>
                      {selected.canViewCosts ? (
                        <td className="py-2">
                          {formatBRL(c.actual_cost_cents ?? c.planned_cost_cents)}
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {!selected.procedure.consumption_confirmed && canConfirm ? (
            <form onSubmit={addExtra} className="flex flex-wrap items-end gap-2">
              <div className="space-y-1">
                <Label>Material extra</Label>
                <Select
                  value={extraItem}
                  onChange={(e) => setExtraItem(e.target.value)}
                >
                  {inventory.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Qtd</Label>
                <Input
                  className="w-24"
                  value={extraQty}
                  onChange={(e) => setExtraQty(e.target.value)}
                />
              </div>
              <Button type="submit" size="sm" variant="secondary">
                + Adicionar material
              </Button>
            </form>
          ) : null}

          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-subtle)]">
              3. Evolução
            </p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              Contexto pré-preenchido com paciente, procedimento e dente —
              sem redigitar.
            </p>
            {selected.procedure.status === "completed" ? (
              <Button
                size="sm"
                className="mt-2"
                variant="secondary"
                onClick={registerEvolution}
              >
                Registrar evolução
              </Button>
            ) : (
              <p className="mt-2 text-xs text-[var(--text-subtle)]">
                Disponível após concluir o procedimento.
              </p>
            )}
          </div>

          <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-subtle)]">
            4. Custos e financeiro
          </p>
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            {financeBreakdown?.standard_price_cents != null ? (
              <div>
                <dt className="text-[var(--text-muted)]">Preço padrão</dt>
                <dd className="font-medium">
                  {formatBRL(financeBreakdown.standard_price_cents)}
                </dd>
              </div>
            ) : null}
            <div>
              <dt className="text-[var(--text-muted)]">Valor cobrado</dt>
              <dd className="font-medium">
                {(financeBreakdown?.charged_amount_cents ??
                  selected.procedure.charged_amount_cents) != null
                  ? formatBRL(
                      financeBreakdown?.charged_amount_cents ??
                        selected.procedure.charged_amount_cents!,
                    )
                  : "—"}
                <span className="ml-1 text-xs text-[var(--text-subtle)]">
                  (estimado cobrado)
                </span>
              </dd>
            </div>
            {financeBreakdown &&
            (financeBreakdown.received_cents > 0 ||
              financeBreakdown.outstanding_cents > 0) ? (
              <>
                <div>
                  <dt className="text-[var(--text-muted)]">Recebido</dt>
                  <dd className="font-medium">
                    {formatBRL(financeBreakdown.received_cents)}
                  </dd>
                </div>
                <div>
                  <dt className="text-[var(--text-muted)]">Saldo</dt>
                  <dd className="font-medium">
                    {formatBRL(financeBreakdown.outstanding_cents)}
                  </dd>
                </div>
              </>
            ) : null}
            {selected.canViewCosts ? (
              <>
                <div>
                  <dt className="text-[var(--text-muted)]">Custo direto</dt>
                  <dd className="font-medium">
                    {financeBreakdown?.actual_total_cost_cents != null
                      ? formatBRL(financeBreakdown.actual_total_cost_cents)
                      : selected.procedure.actual_total_cost_cents != null
                        ? formatBRL(selected.procedure.actual_total_cost_cents)
                        : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-[var(--text-muted)]">
                    Resultado sobre custos diretos
                  </dt>
                  <dd className="font-medium">
                    {financeBreakdown?.gross_result_charged_cents != null
                      ? formatBRL(financeBreakdown.gross_result_charged_cents)
                      : selected.procedure.gross_result_cents != null
                        ? formatBRL(selected.procedure.gross_result_cents)
                        : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-[var(--text-muted)]">Margem direta</dt>
                  <dd className="font-medium">
                    {financeBreakdown?.gross_margin_percent != null
                      ? `${financeBreakdown.gross_margin_percent}%`
                      : selected.procedure.gross_margin_percent != null
                        ? `${selected.procedure.gross_margin_percent}%`
                        : "—"}
                  </dd>
                </div>
              </>
            ) : null}
            {selected.procedure.operational_total_cost_cents != null ||
            selected.procedure.charged_amount_cents === null ? (
              <>
                {selected.procedure.charged_amount_cents == null ? (
                  <div className="sm:col-span-2">
                    <p className="text-sm text-[var(--text-muted)]">
                      Valor ainda não definido
                    </p>
                  </div>
                ) : null}
                {selected.procedure.operational_total_cost_cents != null ? (
                  <>
                    <div>
                      <dt className="text-[var(--text-muted)]">
                        Custo operacional
                      </dt>
                      <dd className="font-medium">
                        {formatBRL(
                          selected.procedure.operational_total_cost_cents,
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[var(--text-muted)]">
                        Resultado operacional
                      </dt>
                      <dd className="font-medium">
                        {selected.procedure.operational_result_cents != null
                          ? formatBRL(
                              selected.procedure.operational_result_cents,
                            )
                          : "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[var(--text-muted)]">
                        Margem operacional
                      </dt>
                      <dd className="font-medium">
                        {selected.procedure.operational_margin_percent != null
                          ? `${selected.procedure.operational_margin_percent}%`
                          : "—"}
                      </dd>
                    </div>
                    {selected.procedure.charged_amount_cents != null &&
                    selected.procedure.charged_amount_cents <
                      selected.procedure.operational_total_cost_cents ? (
                      <div className="sm:col-span-2">
                        <p className="text-sm">
                          Abaixo do custo operacional
                        </p>
                      </div>
                    ) : null}
                  </>
                ) : null}
              </>
            ) : null}
          </dl>

          <div className="flex flex-wrap gap-2">
            {!selected.procedure.consumption_confirmed && canConfirm ? (
              <div className="space-y-2">
                <p className="text-xs text-[var(--text-muted)]">
                  Por padrão, utilizado = previsto. Altere só o que mudou.
                </p>
                <Button
                  size="sm"
                  onClick={async () => {
                    const t = startFlowTimer();
                    await confirm();
                    setMessage("Consumo confirmado.");
                    void trackClientEvent("procedure_consumption.confirmed", {
                      duration_ms: t.elapsed(),
                      meta: {
                        performed_procedure_id: selected.procedure.id,
                      },
                    });
                    if (confirmNeg) {
                      void trackClientEvent("inventory.insufficient_warning", {
                        meta: {
                          performed_procedure_id: selected.procedure.id,
                        },
                      });
                    }
                  }}
                >
                  Confirmar consumo
                </Button>
                {confirmNeg ? (
                  <label className="flex items-center gap-2 text-xs text-[var(--danger)]">
                    <input
                      type="checkbox"
                      checked={confirmNeg}
                      onChange={(e) => setConfirmNeg(e.target.checked)}
                    />
                    O estoque registrado deste material é inferior à quantidade
                    utilizada — continuar mesmo assim
                  </label>
                ) : null}
              </div>
            ) : null}
            {selected.procedure.consumption_confirmed &&
            selected.procedure.status !== "completed" ? (
              <Button size="sm" onClick={complete}>
                Concluir procedimento
              </Button>
            ) : null}
            {selected.procedure.status === "completed" &&
            selected.financeOffer?.offer ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={async () => {
                  await addFinance();
                  setMessage("Cobrança adicionada ao financeiro.");
                }}
              >
                Adicionar ao financeiro
              </Button>
            ) : null}
          </div>
        </section>
      ) : null}

      {completion && completion.procedures.length > 0 ? (
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/90 p-4">
          <h2 className="font-medium text-[var(--brand-ink)]">
            Resumo do atendimento
          </h2>
          <p className="mt-1 text-sm">
            {completion.procedures.length} procedimento(s) realizado(s)
          </p>
          <ul className="mt-2 space-y-1 text-sm">
            {completion.procedures.map((p) => (
              <li key={p.name + String(p.tooth_number)}>
                {p.name}
                {p.tooth_number != null ? ` — ${p.tooth_number}` : ""}
              </li>
            ))}
          </ul>
          <dl className="mt-3 grid gap-1 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-[var(--text-muted)]">Consumo</dt>
              <dd>
                {completion.materials_confirmed
                  ? "✓ Confirmado"
                  : "Consumo pendente"}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--text-muted)]">Evolução</dt>
              <dd>
                {completion.evolutions_finalized > 0
                  ? `✓ ${completion.evolutions_finalized} finalizada(s)`
                  : "Evolução em rascunho / pendente"}
              </dd>
            </div>
            {completion.charged_cents != null ? (
              <>
                <div>
                  <dt className="text-[var(--text-muted)]">Valor cobrado</dt>
                  <dd>{formatBRL(completion.charged_cents)}</dd>
                </div>
                <div>
                  <dt className="text-[var(--text-muted)]">Recebido</dt>
                  <dd>
                    {completion.received_cents != null
                      ? formatBRL(completion.received_cents)
                      : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-[var(--text-muted)]">Saldo</dt>
                  <dd>
                    {completion.outstanding_cents != null
                      ? formatBRL(completion.outstanding_cents)
                      : "—"}
                  </dd>
                </div>
              </>
            ) : (
              <div className="sm:col-span-2 text-[var(--text-muted)]">
                Financeiro não definido
              </div>
            )}
          </dl>
          {completion.warnings.length > 0 ? (
            <ul className="mt-3 space-y-1 text-xs text-[var(--warning)]">
              {completion.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              size="sm"
              loading={completingAppt}
              onClick={() => void completeAppointment()}
            >
              Concluir atendimento
            </Button>
            <Link href={`/app/pacientes/${patientId}`}>
              <Button size="sm" variant="secondary">
                Ver paciente
              </Button>
            </Link>
          </div>
          <p className="mt-2 text-xs text-[var(--text-muted)]">
            Financeiro não definido ou evolução em rascunho são avisos — não
            bloqueiam a conclusão.
          </p>
        </section>
      ) : null}

      {message ? (
        <p
          role="status"
          className="rounded-xl bg-[var(--success-soft)] px-3 py-2 text-sm text-[var(--success)]"
        >
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-xl bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger)]">
          {error}
        </p>
      ) : null}

      <ProcedureSimulationDialog
        open={simOpen}
        onClose={() => {
          setSimOpen(false);
          setSimPerformedId(null);
        }}
        performedProcedureId={simPerformedId}
      />
    </div>
  );
}
