"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function PortalProfileClient() {
  const [profile, setProfile] = useState<Record<string, string | null> | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void fetch("/api/demo/portal?resource=profile")
      .then((r) => r.json())
      .then((d) => setProfile(d.profile));
  }, []);

  if (!profile) {
    return <div className="h-32 animate-pulse rounded-2xl bg-[var(--surface-muted)]" />;
  }

  return (
    <div className="space-y-4">
      <h1 className="font-[family-name:var(--font-display)] text-3xl text-[var(--brand-ink)]">
        Perfil
      </h1>
      {message ? (
        <p className="rounded-xl bg-[var(--success-soft)] px-3 py-2 text-sm text-[var(--success)]">
          {message}
        </p>
      ) : null}
      <form
        className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/90 p-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const res = await fetch("/api/demo/portal", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "update-profile",
              preferred_name: profile.preferred_name,
              phone: profile.phone,
              email: profile.email,
              postal_code: profile.postal_code,
              street: profile.street,
              number: profile.number,
              complement: profile.complement,
              neighborhood: profile.neighborhood,
              city: profile.city,
              state: profile.state,
            }),
          });
          const data = await res.json();
          setBusy(false);
          if (!res.ok) {
            setMessage(data.error ?? "Não foi possível atualizar.");
            return;
          }
          setProfile(data.profile);
          setMessage(data.message ?? "Dados atualizados.");
        }}
      >
        <p className="text-sm">
          <span className="text-[var(--text-subtle)]">Nome</span>
          <br />
          <strong>{profile.full_name}</strong>
        </p>
        <p className="text-sm">
          <span className="text-[var(--text-subtle)]">CPF</span>
          <br />
          {profile.cpf_masked ?? "—"}
        </p>
        <p className="text-sm">
          <span className="text-[var(--text-subtle)]">Nascimento</span>
          <br />
          {profile.birth_date?.split("-").reverse().join("/") ?? "—"}
        </p>
        <div>
          <Label>Nome preferido</Label>
          <Input
            value={profile.preferred_name ?? ""}
            onChange={(e) =>
              setProfile((p) => ({ ...p!, preferred_name: e.target.value }))
            }
          />
        </div>
        <div>
          <Label>Telefone</Label>
          <Input
            value={profile.phone ?? ""}
            onChange={(e) => setProfile((p) => ({ ...p!, phone: e.target.value }))}
          />
        </div>
        <div>
          <Label>E-mail</Label>
          <Input
            value={profile.email ?? ""}
            onChange={(e) => setProfile((p) => ({ ...p!, email: e.target.value }))}
          />
        </div>
        <div>
          <Label>Endereço</Label>
          <Input
            className="mb-2"
            placeholder="Rua"
            value={profile.street ?? ""}
            onChange={(e) => setProfile((p) => ({ ...p!, street: e.target.value }))}
          />
          <div className="grid grid-cols-2 gap-2">
            <Input
              placeholder="Número"
              value={profile.number ?? ""}
              onChange={(e) => setProfile((p) => ({ ...p!, number: e.target.value }))}
            />
            <Input
              placeholder="CEP"
              value={profile.postal_code ?? ""}
              onChange={(e) =>
                setProfile((p) => ({ ...p!, postal_code: e.target.value }))
              }
            />
          </div>
        </div>
        <Button type="submit" loading={busy}>
          Salvar alterações
        </Button>
      </form>
    </div>
  );
}
