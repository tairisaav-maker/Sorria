"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { SorriaMark } from "@/components/brand/sorria-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trackCommercialEvent } from "@/lib/commercial/client";

export default function SignupPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [inviteOnly, setInviteOnly] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void trackCommercialEvent("signup_started");
    void fetch("/api/demo/commercial?view=status")
      .then((r) => r.json())
      .then((j) => setInviteOnly(Boolean(j.invite_only)))
      .catch(() => undefined);
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/demo/saas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "signup",
        data: {
          full_name: fullName,
          email,
          password,
          invite_code: inviteCode || null,
        },
      }),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(json.error ?? "Não foi possível criar a conta.");
      return;
    }
    router.push(json.next ?? "/cadastro/clinica");
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
            Criar conta no Sorria
          </h1>
          <p className="text-sm text-[var(--text-muted)]">
            {inviteOnly
              ? "Beta fechado — é necessário um código de convite."
              : "Poucos dados agora. A clínica vem no próximo passo."}
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="name">Nome</Label>
            <Input
              id="name"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="invite">
              Código de convite{inviteOnly ? "" : " (opcional)"}
            </Label>
            <Input
              id="invite"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              required={inviteOnly}
              placeholder="SORRIA-BETA"
              autoComplete="off"
            />
          </div>
          {error ? (
            <p className="text-sm text-[var(--danger)]" role="alert">
              {error}
            </p>
          ) : null}
          <Button type="submit" loading={busy} className="w-full">
            Continuar
          </Button>
          <p className="text-center text-sm text-[var(--text-muted)]">
            Prefere falar antes?{" "}
            <Link href="/conhecer" className="text-[var(--brand-primary)]">
              Quero conhecer o Sorria
            </Link>
          </p>
          <p className="text-center text-sm text-[var(--text-muted)]">
            Já tem conta?{" "}
            <Link href="/login" className="text-[var(--brand-primary)]">
              Entrar
            </Link>
          </p>
        </form>
      </div>
    </main>
  );
}
