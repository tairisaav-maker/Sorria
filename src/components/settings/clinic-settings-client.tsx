"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ClinicSettingsClient() {
  const [form, setForm] = useState({
    name: "",
    trade_name: "",
    phone: "",
    email: "",
    address_line: "",
    city: "",
    state: "",
    timezone: "America/Sao_Paulo",
    slot_minutes: 30,
    assistant_enabled: true,
    portal_enabled: true,
  });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/demo/settings?resource=clinic");
      if (!res.ok) return;
      const c = await res.json();
      setForm({
        name: c.name ?? "",
        trade_name: c.trade_name ?? "",
        phone: c.phone ?? "",
        email: c.email ?? "",
        address_line: c.address_line ?? "",
        city: c.city ?? "",
        state: c.state ?? "",
        timezone: c.timezone ?? "America/Sao_Paulo",
        slot_minutes: c.slot_minutes ?? 30,
        assistant_enabled: c.feature_flags?.assistant_enabled ?? true,
        portal_enabled: c.feature_flags?.portal_enabled ?? true,
      });
    })();
  }, []);

  async function save() {
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      const res = await fetch("/api/demo/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_clinic",
          payload: {
            name: form.name,
            trade_name: form.trade_name || null,
            phone: form.phone || null,
            email: form.email || null,
            address_line: form.address_line || null,
            city: form.city || null,
            state: form.state || null,
            timezone: form.timezone,
            slot_minutes: form.slot_minutes,
            feature_flags: {
              assistant_enabled: form.assistant_enabled,
              portal_enabled: form.portal_enabled,
              commercial_beta: true,
            },
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro");
      setMsg("Dados da clínica salvos.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-5">
      <header>
        <h1 className="font-[family-name:var(--font-display)] text-3xl text-[var(--brand-ink)]">
          Clínica
        </h1>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Identidade da clínica no Sorria — independente da marca do produto.
        </p>
      </header>

      {error ? (
        <p className="rounded-xl bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger)]" role="alert">
          {error}
        </p>
      ) : null}
      {msg ? (
        <p className="rounded-xl bg-[var(--success-soft)] px-3 py-2 text-sm text-[var(--success)]" role="status">
          {msg}
        </p>
      ) : null}

      <section className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/90 p-5">
        <div>
          <Label htmlFor="name">Nome</Label>
          <Input id="name" autoComplete="organization" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="trade">Nome fantasia</Label>
          <Input id="trade" value={form.trade_name} onChange={(e) => setForm({ ...form, trade_name: e.target.value })} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="phone">Telefone</Label>
            <Input id="phone" autoComplete="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" autoComplete="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
        </div>
        <div>
          <Label htmlFor="addr">Endereço</Label>
          <Input id="addr" autoComplete="street-address" value={form.address_line} onChange={(e) => setForm({ ...form, address_line: e.target.value })} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="city">Cidade</Label>
            <Input id="city" autoComplete="address-level2" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="state">UF</Label>
            <Input id="state" maxLength={2} value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value.toUpperCase() })} />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="tz">Timezone</Label>
            <select
              id="tz"
              className="mt-1 h-11 w-full rounded-xl border border-[var(--border)] bg-white px-3 text-sm"
              value={form.timezone}
              onChange={(e) => setForm({ ...form, timezone: e.target.value })}
            >
              <option value="America/Sao_Paulo">America/Sao_Paulo</option>
              <option value="America/Manaus">America/Manaus</option>
              <option value="America/Fortaleza">America/Fortaleza</option>
            </select>
          </div>
          <div>
            <Label htmlFor="slot">Duração padrão (min)</Label>
            <Input
              id="slot"
              type="number"
              min={5}
              max={240}
              value={form.slot_minutes}
              onChange={(e) =>
                setForm({ ...form, slot_minutes: Number(e.target.value) || 30 })
              }
            />
          </div>
        </div>
        <fieldset className="space-y-2 border-t border-[var(--border)] pt-3">
          <legend className="text-sm font-medium text-[var(--text)]">Recursos</legend>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.assistant_enabled}
              onChange={(e) =>
                setForm({ ...form, assistant_enabled: e.target.checked })
              }
            />
            Secretária Virtual habilitada
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.portal_enabled}
              onChange={(e) =>
                setForm({ ...form, portal_enabled: e.target.checked })
              }
            />
            Portal do paciente habilitado
          </label>
        </fieldset>
        <Button type="button" loading={busy} onClick={() => void save()}>
          Salvar
        </Button>
      </section>
    </div>
  );
}
