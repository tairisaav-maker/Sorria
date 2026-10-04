"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { centsToReais } from "@/lib/money";
import type { Procedure } from "@/types/inventory";

export function ProcedureFormClient({
  mode,
  initial,
}: {
  mode: "create" | "edit";
  initial?: Procedure;
}) {
  const router = useRouter();
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [duration, setDuration] = useState(
    initial?.default_duration_minutes?.toString() ?? "",
  );
  const [price, setPrice] = useState(
    initial?.default_price_cents != null
      ? centsToReais(initial.default_price_cents).toFixed(2)
      : "",
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const data = {
      ...(mode === "edit" ? { id: initial!.id } : {}),
      name,
      description: description || null,
      category: category || null,
      default_duration_minutes: duration ? Number(duration) : null,
      default_price_reais: price ? Number(price.replace(",", ".")) : null,
    };
    const res = await fetch("/api/demo/procedures", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: mode === "create" ? "create" : "update",
        data,
      }),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(json.error ?? "Erro ao salvar");
      return;
    }
    router.push(`/app/procedimentos/${json.procedure.id}`);
    router.refresh();
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-5">
      <section>
        <p className="text-sm text-[var(--text-muted)]">
          <Link
            href="/app/procedimentos"
            className="text-[var(--brand-primary)]"
          >
            Procedimentos
          </Link>
        </p>
        <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl tracking-tight text-[var(--brand-ink)]">
          {mode === "create" ? "Novo procedimento" : "Editar procedimento"}
        </h1>
      </section>

      <form onSubmit={onSubmit} className="space-y-4 animate-rise">
        <div className="space-y-1.5">
          <Label htmlFor="name">Nome</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            minLength={2}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="category">Categoria</Label>
          <Input
            id="category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Ex.: Restaurador"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="duration">Duração (min)</Label>
            <Input
              id="duration"
              type="number"
              min={1}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="price">Preço padrão (R$)</Label>
            <Input
              id="price"
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="350,00"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="description">Descrição</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
        </div>

        {error ? (
          <p className="rounded-xl bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger)]">
            {error}
          </p>
        ) : null}

        <div className="flex gap-2">
          <Button type="submit" loading={saving}>
            Salvar
          </Button>
          <Link href={initial ? `/app/procedimentos/${initial.id}` : "/app/procedimentos"}>
            <Button type="button" variant="secondary">
              Cancelar
            </Button>
          </Link>
        </div>
      </form>
    </div>
  );
}
