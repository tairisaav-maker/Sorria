"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ProfileSettingsClient() {
  const [form, setForm] = useState({
    full_name: "",
    professional_name: "",
    phone: "",
    cro: "",
    cro_uf: "",
    specialty: "",
    email: "",
  });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/demo/settings?resource=profile");
      if (!res.ok) return;
      const p = await res.json();
      if (!p) return;
      setForm({
        full_name: p.full_name ?? "",
        professional_name: p.professional_name ?? "",
        phone: p.phone ?? "",
        cro: p.cro ?? "",
        cro_uf: p.cro_uf ?? "",
        specialty: p.specialty ?? "",
        email: p.email ?? "",
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
          action: "update_profile",
          payload: {
            full_name: form.full_name,
            professional_name: form.professional_name || null,
            phone: form.phone || null,
            cro: form.cro || null,
            cro_uf: form.cro_uf || null,
            specialty: form.specialty || null,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro");
      setMsg("Perfil atualizado.");
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
          Perfil
        </h1>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Seus dados profissionais no Sorria.
        </p>
      </header>
      {error ? (
        <p className="rounded-xl bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger)]">{error}</p>
      ) : null}
      {msg ? (
        <p className="rounded-xl bg-[var(--success-soft)] px-3 py-2 text-sm text-[var(--success)]">{msg}</p>
      ) : null}
      <section className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/90 p-5">
        <div>
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" value={form.email} disabled />
        </div>
        <div>
          <Label htmlFor="full_name">Nome</Label>
          <Input id="full_name" autoComplete="name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="professional_name">Nome profissional</Label>
          <Input id="professional_name" value={form.professional_name} onChange={(e) => setForm({ ...form, professional_name: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="cro">CRO</Label>
            <Input id="cro" value={form.cro} onChange={(e) => setForm({ ...form, cro: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="cro_uf">UF</Label>
            <Input id="cro_uf" maxLength={2} value={form.cro_uf} onChange={(e) => setForm({ ...form, cro_uf: e.target.value.toUpperCase() })} />
          </div>
        </div>
        <div>
          <Label htmlFor="phone">Telefone</Label>
          <Input id="phone" autoComplete="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="specialty">Especialidade</Label>
          <Input id="specialty" value={form.specialty} onChange={(e) => setForm({ ...form, specialty: e.target.value })} />
        </div>
        <Button type="button" loading={busy} onClick={() => void save()}>
          Salvar
        </Button>
      </section>
    </div>
  );
}
