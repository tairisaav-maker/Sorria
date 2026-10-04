"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { SorriaMark } from "@/components/brand/sorria-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function CreateClinicPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [professionalName, setProfessionalName] = useState("");
  const [plan, setPlan] = useState<"starter" | "pro">("starter");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/demo/saas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create_clinic",
        data: {
          name,
          phone: phone || null,
          city: city || null,
          timezone: "America/Sao_Paulo",
          professional_name: professionalName || null,
          plan_code: plan,
        },
      }),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(json.error ?? "Não foi possível criar a clínica.");
      return;
    }
    router.push(json.next ?? "/app/onboarding");
  }

  return (
    <main className="login-atmosphere flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="mx-auto w-full max-w-md space-y-6">
        <SorriaMark size="md" showSubtitle align="center" />
        <form
          onSubmit={onSubmit}
          className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/90 p-5"
        >
          <h1 className="font-[family-name:var(--font-display)] text-2xl text-[var(--brand-ink)]">
            Criar sua clínica
          </h1>
          <p className="text-sm text-[var(--text-muted)]">
            Você será a proprietária. Acesso clínico não é automático — configure
            depois se também atender.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="clinic">Nome da clínica</Label>
            <Input
              id="clinic"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone">Telefone (opcional)</Label>
            <Input
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="city">Cidade (opcional)</Label>
            <Input
              id="city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pro">Nome profissional (opcional)</Label>
            <Input
              id="pro"
              value={professionalName}
              onChange={(e) => setProfessionalName(e.target.value)}
            />
          </div>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Plano inicial (trial)</legend>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                checked={plan === "starter"}
                onChange={() => setPlan("starter")}
              />
              Starter — núcleo operacional
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                checked={plan === "pro"}
                onChange={() => setPlan("pro")}
              />
              Pro — relatórios avançados e precificação
            </label>
            <p className="text-xs text-[var(--text-subtle)]">
              Preços comerciais ainda não definidos — trial configurável por plano.
            </p>
          </fieldset>
          {error ? (
            <p className="text-sm text-[var(--danger)]" role="alert">
              {error}
            </p>
          ) : null}
          <Button type="submit" loading={busy} className="w-full">
            Entrar no Sorria
          </Button>
        </form>
      </div>
    </main>
  );
}
