"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type ClinicRow = {
  id: string;
  name: string;
  city?: string | null;
  status?: string;
  subscription_status: string | null;
  plan_code: string | null;
  plan_name?: string | null;
  entered_at?: string | null;
  beta_cohort?: string | null;
  activation?: boolean;
  health?: string | null;
  last_operational_activity_at?: string | null;
};

type Metrics = {
  leads: number;
  demos: number;
  trials_started: number;
  clinics_activated: number;
  paying_customers: number;
  cancellations: number;
};

export function InternalClient({
  initialClinics,
  initialMetrics,
}: {
  initialClinics: ClinicRow[];
  initialMetrics?: Metrics | null;
}) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState(initialClinics);
  const [metrics, setMetrics] = useState(initialMetrics ?? null);
  const [tab, setTab] = useState<"beta" | "search">("beta");

  async function search() {
    const res = await fetch(
      `/api/demo/saas?view=internal_clinics&q=${encodeURIComponent(q)}`,
    );
    const json = await res.json();
    setItems(json.items ?? []);
    setTab("search");
  }

  async function loadBeta() {
    const [clinicsRes, metricsRes] = await Promise.all([
      fetch("/api/demo/commercial?view=beta_clinics"),
      fetch("/api/demo/commercial?view=metrics"),
    ]);
    const clinicsJson = await clinicsRes.json();
    const metricsJson = await metricsRes.json();
    setItems(clinicsJson.items ?? []);
    setMetrics(metricsJson);
    setTab("beta");
  }

  return (
    <div className="space-y-6">
      {metrics ? (
        <section className="grid gap-3 rounded-2xl border border-[var(--border)] p-4 text-sm sm:grid-cols-3">
          <div>
            <p className="text-[var(--text-muted)]">Leads</p>
            <p className="text-xl font-semibold">{metrics.leads}</p>
          </div>
          <div>
            <p className="text-[var(--text-muted)]">Demos</p>
            <p className="text-xl font-semibold">{metrics.demos}</p>
          </div>
          <div>
            <p className="text-[var(--text-muted)]">Trials</p>
            <p className="text-xl font-semibold">{metrics.trials_started}</p>
          </div>
          <div>
            <p className="text-[var(--text-muted)]">Ativadas</p>
            <p className="text-xl font-semibold">{metrics.clinics_activated}</p>
          </div>
          <div>
            <p className="text-[var(--text-muted)]">Pagantes</p>
            <p className="text-xl font-semibold">{metrics.paying_customers}</p>
          </div>
          <div>
            <p className="text-[var(--text-muted)]">Cancelamentos</p>
            <p className="text-xl font-semibold">{metrics.cancellations}</p>
          </div>
        </section>
      ) : null}

      <section className="space-y-3 rounded-2xl border border-[var(--border)] p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-medium">
            {tab === "beta" ? "Beta comercial" : "Busca"}
          </h2>
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="secondary" onClick={() => void loadBeta()}>
              Painel beta
            </Button>
          </div>
        </div>
        <div className="flex gap-2">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Nome, e-mail ou id"
          />
          <Button type="button" size="sm" onClick={() => void search()}>
            Buscar
          </Button>
        </div>
        <ul className="divide-y divide-[var(--border)] text-sm">
          {items.map((c) => (
            <li key={c.id} className="py-3">
              <p className="font-medium">{c.name}</p>
              <p className="text-xs text-[var(--text-muted)]">
                {c.id.slice(0, 8)}… · plano {c.plan_name ?? c.plan_code ?? "—"} ·{" "}
                {c.subscription_status ?? "—"}
                {c.beta_cohort ? ` · cohort ${c.beta_cohort}` : ""}
                {c.health ? ` · ${c.health}` : ""}
                {c.activation != null
                  ? c.activation
                    ? " · ativada"
                    : " · onboarding"
                  : ""}
              </p>
              {c.entered_at || c.last_operational_activity_at ? (
                <p className="mt-1 text-xs text-[var(--text-subtle)]">
                  {c.entered_at
                    ? `Entrada ${new Date(c.entered_at).toLocaleDateString("pt-BR")}`
                    : null}
                  {c.last_operational_activity_at
                    ? ` · Última atividade ${new Date(c.last_operational_activity_at).toLocaleDateString("pt-BR")}`
                    : null}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
        <p className="text-xs text-[var(--text-subtle)]">
          Sem conteúdo clínico. Pipeline de leads pode ser externo (CRM simples).
        </p>
      </section>
    </div>
  );
}
