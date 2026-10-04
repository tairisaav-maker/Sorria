"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const REASONS = [
  "Avaliação",
  "Limpeza",
  "Retorno",
  "Dor/Urgência",
  "Continuação de tratamento",
  "Outro",
] as const;

export function PortalRequestClient() {
  const router = useRouter();
  const [reason, setReason] = useState<(typeof REASONS)[number]>("Avaliação");
  const [date, setDate] = useState("");
  const [period, setPeriod] = useState("afternoon");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (done) {
    return (
      <div className="space-y-4">
        <h1 className="font-[family-name:var(--font-display)] text-3xl text-[var(--brand-ink)]">
          Solicitação enviada
        </h1>
        <p className="text-sm text-[var(--text-muted)]">
          A clínica irá analisar sua preferência e poderá propor um horário.
        </p>
        <Link
          href="/portal/consultas?tab=solicitacoes"
          className="inline-flex h-11 items-center rounded-xl bg-[var(--brand-primary)] px-4 text-sm font-medium text-white"
        >
          Ver solicitações
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section>
        <h1 className="font-[family-name:var(--font-display)] text-3xl text-[var(--brand-ink)]">
          Solicitar horário
        </h1>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Conte para a clínica sua preferência. A equipe irá analisar e propor um
          horário para você.
        </p>
      </section>

      <form
        className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/90 p-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          const res = await fetch("/api/demo/portal", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "create-request",
              reason,
              requested_date: date || null,
              preferred_period: period,
              notes,
            }),
          });
          const data = await res.json();
          setBusy(false);
          if (!res.ok) {
            setError(data.error ?? "Não foi possível enviar sua solicitação. Tente novamente.");
            return;
          }
          setDone(true);
          router.refresh();
        }}
      >
        <div>
          <Label htmlFor="reason">Motivo</Label>
          <Select
            id="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value as (typeof REASONS)[number])}
          >
            {REASONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="date">Data preferida</Label>
          <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="period">Período</Label>
          <Select id="period" value={period} onChange={(e) => setPeriod(e.target.value)}>
            <option value="morning">Manhã</option>
            <option value="afternoon">Tarde</option>
            <option value="evening">Noite</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="notes">Observação</Label>
          <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
        <Button type="submit" loading={busy} className="w-full">
          Enviar solicitação
        </Button>
      </form>
    </div>
  );
}
