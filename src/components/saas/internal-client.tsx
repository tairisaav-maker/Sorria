"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type ClinicRow = {
  id: string;
  name: string;
  city: string | null;
  status: string;
  subscription_status: string | null;
  plan_code: string | null;
};

export function InternalClient({
  initialClinics,
}: {
  initialClinics: ClinicRow[];
}) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState(initialClinics);

  async function search() {
    const res = await fetch(
      `/api/demo/saas?view=internal_clinics&q=${encodeURIComponent(q)}`,
    );
    const json = await res.json();
    setItems(json.items ?? []);
  }

  return (
    <section className="space-y-3 rounded-2xl border border-[var(--border)] p-4">
      <h2 className="font-medium">Clínicas</h2>
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
          <li key={c.id} className="py-2">
            <p className="font-medium">{c.name}</p>
            <p className="text-xs text-[var(--text-muted)]">
              {c.id.slice(0, 8)}… · {c.city ?? "—"} · plano {c.plan_code ?? "—"}{" "}
              · {c.subscription_status ?? "—"}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
