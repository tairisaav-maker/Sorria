"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LEAD_COST_CONTROL_OPTIONS } from "@/lib/demo/commercial-store";

const COST_LABELS: Record<(typeof LEAD_COST_CONTROL_OPTIONS)[number], string> = {
  planilha: "Planilha",
  sistema_odontologico: "Sistema odontológico",
  controle_manual: "Controle manual",
  nao_controlo: "Não controlo",
  outro: "Outro",
};

export function LeadForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [clinicName, setClinicName] = useState("");
  const [dentists, setDentists] = useState("1");
  const [costControl, setCostControl] =
    useState<(typeof LEAD_COST_CONTROL_OPTIONS)[number]>("planilha");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/demo/commercial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "lead",
          data: {
            name,
            email,
            whatsapp: whatsapp || null,
            clinic_name: clinicName || null,
            dentists_count: Number(dentists),
            cost_control_today: costControl,
          },
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Não foi possível enviar.");
        setBusy(false);
        return;
      }
      setDone(true);
    } catch {
      setError("Falha de rede. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div
        className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/90 p-6"
        role="status"
      >
        <h2 className="font-[family-name:var(--font-display)] text-xl text-[var(--brand-ink)]">
          Recebemos seu interesse
        </h2>
        <p className="mt-3 text-sm text-[var(--text-muted)]">
          Em breve entraremos em contato para uma conversa curta e, se fizer
          sentido, uma demonstração com dados fictícios — nunca com dados reais
          de outra clínica.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/90 p-5 sm:p-6"
      aria-busy={busy}
    >
      <div className="space-y-1.5">
        <Label htmlFor="lead-name">Nome</Label>
        <Input
          id="lead-name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="lead-email">E-mail</Label>
        <Input
          id="lead-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="lead-whatsapp">WhatsApp (opcional)</Label>
        <Input
          id="lead-whatsapp"
          value={whatsapp}
          onChange={(e) => setWhatsapp(e.target.value)}
          autoComplete="tel"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="lead-clinic">Nome da clínica (opcional)</Label>
        <Input
          id="lead-clinic"
          value={clinicName}
          onChange={(e) => setClinicName(e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="lead-dentists">Número de dentistas</Label>
        <Input
          id="lead-dentists"
          type="number"
          min={1}
          max={50}
          required
          value={dentists}
          onChange={(e) => setDentists(e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="lead-cost">Como controla hoje os custos?</Label>
        <select
          id="lead-cost"
          className="flex h-11 w-full rounded-xl border border-[var(--border)] bg-white px-3 text-sm text-[var(--text)]"
          value={costControl}
          onChange={(e) =>
            setCostControl(
              e.target.value as (typeof LEAD_COST_CONTROL_OPTIONS)[number],
            )
          }
        >
          {LEAD_COST_CONTROL_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>
              {COST_LABELS[opt]}
            </option>
          ))}
        </select>
      </div>
      {error ? (
        <p className="text-sm text-[var(--danger)]" role="alert">
          {error}
        </p>
      ) : null}
      <Button type="submit" loading={busy} className="w-full" disabled={busy}>
        Enviar interesse
      </Button>
      <p className="text-xs text-[var(--text-subtle)]">
        Não pedimos dados clínicos. Usamos estas informações apenas para o
        contato comercial do beta.
      </p>
    </form>
  );
}
