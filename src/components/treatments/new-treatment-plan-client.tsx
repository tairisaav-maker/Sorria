"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PROCEDURE_SUGGESTIONS } from "@/types/treatment";

export function NewTreatmentPlanClient({
  patientId,
  patientName,
}: {
  patientId: string;
  patientName: string;
}) {
  const router = useRouter();
  const search = useSearchParams();
  const [title, setTitle] = useState(
    `Plano de tratamento — ${new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}`,
  );
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [discountType, setDiscountType] = useState<"" | "percent" | "fixed">("");
  const [discountPercent, setDiscountPercent] = useState(0);
  const [discountValue, setDiscountValue] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Prefill from odontogram / evolução (após confirmação na origem)
  const prefillProc = search.get("procedure") ?? "";
  const prefillTooth = search.get("tooth") ?? "";
  const prefillSource = search.get("odontogramEntryId") ?? "";
  const prefillClinical = search.get("clinicalEntryId") ?? "";

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/demo/treatments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create",
        patient_id: patientId,
        title,
        description,
        notes,
        valid_until: validUntil || null,
        discount_type: discountType || null,
        discount_percent: discountType === "percent" ? discountPercent : null,
        discount_value_reais: discountType === "fixed" ? discountValue : null,
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.plan) {
      setBusy(false);
      setError(data.error ?? "Não foi possível concluir esta ação. Tente novamente.");
      return;
    }

    if (prefillProc) {
      await fetch("/api/demo/treatments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add-item",
          treatment_plan_id: data.plan.id,
          procedure_name: prefillProc,
          tooth_numbers: prefillTooth ? [Number(prefillTooth)] : [],
          quantity: 1,
          unit_price_reais: 0,
          source_odontogram_entry_id: prefillSource || null,
          source_clinical_entry_id: prefillClinical || null,
        }),
      });
    }

    setBusy(false);
    router.push(`/app/pacientes/${patientId}/tratamentos/${data.plan.id}`);
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-5">
      <section>
        <p className="text-sm text-[var(--text-muted)]">
          <Link
            href={`/app/pacientes/${patientId}/tratamentos`}
            className="text-[var(--brand-primary)]"
          >
            {patientName}
          </Link>
        </p>
        <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight text-[var(--brand-ink)]">
          Novo plano
        </h1>
      </section>

      <form
        onSubmit={submit}
        className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/90 p-4"
      >
        <div>
          <Label htmlFor="title">Nome do plano</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>
        <div>
          <Label htmlFor="description">Descrição</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="valid">Validade</Label>
          <Input
            id="valid"
            type="date"
            value={validUntil}
            onChange={(e) => setValidUntil(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="notes">Observação interna</Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Não visível ao paciente"
          />
        </div>
        <div>
          <Label>Desconto</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant={discountType === "" ? "primary" : "secondary"}
              onClick={() => setDiscountType("")}
            >
              Nenhum
            </Button>
            <Button
              type="button"
              size="sm"
              variant={discountType === "percent" ? "primary" : "secondary"}
              onClick={() => setDiscountType("percent")}
            >
              Percentual
            </Button>
            <Button
              type="button"
              size="sm"
              variant={discountType === "fixed" ? "primary" : "secondary"}
              onClick={() => setDiscountType("fixed")}
            >
              Valor
            </Button>
          </div>
          {discountType === "percent" ? (
            <Input
              className="mt-2"
              type="number"
              min={0}
              max={100}
              value={discountPercent}
              onChange={(e) => setDiscountPercent(Number(e.target.value) || 0)}
            />
          ) : null}
          {discountType === "fixed" ? (
            <Input
              className="mt-2"
              type="number"
              min={0}
              step="0.01"
              value={discountValue}
              onChange={(e) => setDiscountValue(Number(e.target.value) || 0)}
            />
          ) : null}
        </div>

        {prefillProc ? (
          <p className="rounded-xl bg-[var(--info-soft)] px-3 py-2 text-sm text-[var(--info)]">
            Ao salvar, o procedimento “{prefillProc}”
            {prefillTooth ? ` (dente ${prefillTooth})` : ""} será adicionado para
            revisão. Sugestões: {PROCEDURE_SUGGESTIONS.slice(0, 3).join(", ")}…
          </p>
        ) : null}

        {error ? (
          <p className="text-sm text-[var(--danger)]">{error}</p>
        ) : null}

        <div className="flex gap-2">
          <Button type="submit" loading={busy}>
            Criar plano
          </Button>
          <Link
            href={`/app/pacientes/${patientId}/tratamentos`}
            className="inline-flex h-11 items-center rounded-xl border border-[var(--border)] px-4 text-sm"
          >
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}
