"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Clock,
  Package,
  Search,
  Star,
  X,
  Sparkles,
  Plus,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatBRL } from "@/lib/money";
import type { ProcedureLibraryCard } from "@/types/procedure-library";
import { CONSUMPTION_MODE_LABELS, type ConsumptionMode } from "@/types/inventory";

type PreviewMaterial = {
  material: {
    id: string;
    name: string;
    reference_purchase_price_cents: number | null;
    reference_price_date: string | null;
    clinically_variable: boolean;
  };
  link: {
    suggested_quantity: number | null;
    consumption_unit: string;
    consumption_mode: ConsumptionMode;
    optional: boolean;
    clinically_variable: boolean;
    notes: string | null;
  };
  match: {
    status: "matched" | "ambiguous" | "missing";
    inventory_item_id: string | null;
    inventory_item_name: string | null;
    candidates: Array<{ id: string; name: string }>;
    clinic_unit_cost_cents: number | null;
    reference_unit_cost_cents: number | null;
  };
};

type Preview = {
  template: {
    id: string;
    name: string;
    description: string | null;
    default_duration_minutes: number | null;
    category: string;
  };
  materials: PreviewMaterial[];
  reference_cost_cents: number | null;
  materials_with_cost: number;
  materials_without_cost: number;
  already_imported_procedure_id: string | null;
};

type Mode = "catalog" | "attendance" | "onboarding";

function qtyLabel(m: PreviewMaterial): string {
  if (m.link.clinically_variable || m.link.consumption_mode === "manual") {
    return "confirmar";
  }
  if (m.link.suggested_quantity == null) return "estimativa";
  return `${String(m.link.suggested_quantity).replace(".", ",")} ${m.link.consumption_unit}`;
}

export function ProcedureLibraryPicker({
  mode = "catalog",
  onSelectClinicProcedure,
  onClose,
  embedded = false,
}: {
  mode?: Mode;
  /** No atendimento: selecionar procedure da clínica */
  onSelectClinicProcedure?: (procedureId: string, name: string) => void;
  onClose?: () => void;
  embedded?: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState(
    mode === "attendance" ? "mais_usados" : "todos",
  );
  const [cards, setCards] = useState<ProcedureLibraryCard[]>([]);
  const [quick, setQuick] = useState<ProcedureLibraryCard[]>([]);
  const [categories, setCategories] = useState<
    Array<{ key: string; label: string }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [customizing, setCustomizing] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customDuration, setCustomDuration] = useState("");
  const [customPrice, setCustomPrice] = useState("");
  const [removedMats, setRemovedMats] = useState<Set<string>>(new Set());
  const [qtyOverrides, setQtyOverrides] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [showAll, setShowAll] = useState(mode !== "attendance");
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [batchSelected, setBatchSelected] = useState<Set<string>>(new Set());
  const [customForm, setCustomForm] = useState({
    name: "",
    category: "",
    duration: "",
    price: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (category) params.set("category", category);
    params.set("mode", mode);
    const res = await fetch(`/api/demo/procedure-library?${params}`);
    const json = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(json.error ?? "Erro ao carregar biblioteca");
      return;
    }
    setCards(json.cards ?? []);
    setQuick(json.quick ?? []);
    setCategories(json.categories ?? []);
  }, [query, category, mode]);

  useEffect(() => {
    const t = setTimeout(() => void load(), query ? 180 : 0);
    return () => clearTimeout(t);
  }, [load, query]);

  async function openPreview(templateId: string) {
    setPreviewLoading(true);
    setCustomizing(false);
    setRemovedMats(new Set());
    setQtyOverrides({});
    const res = await fetch(
      `/api/demo/procedure-library?view=preview&template_id=${templateId}`,
    );
    const json = await res.json();
    setPreviewLoading(false);
    if (!res.ok) {
      setError(json.error ?? "Erro ao abrir modelo");
      return;
    }
    setPreview(json);
    setCustomName(json.template.name);
    setCustomDuration(
      json.template.default_duration_minutes?.toString() ?? "",
    );
    setCustomPrice("");
  }

  async function toggleFavorite(card: ProcedureLibraryCard) {
    await fetch("/api/demo/procedure-library", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "favorite",
        data: {
          procedure_id: card.procedure_id,
          procedure_template_id: card.procedure_template_id,
          favorited: !card.favorited,
        },
      }),
    });
    void load();
  }

  async function importTemplate(customize: boolean) {
    if (!preview) return;
    setSaving(true);
    setError(null);
    const materials = preview.materials
      .filter((m) => !removedMats.has(m.material.id))
      .map((m) => {
        const override = qtyOverrides[m.material.id];
        return {
          material_template_id: m.material.id,
          inventory_item_id: m.match.inventory_item_id,
          create_new: m.match.status !== "matched",
          suggested_quantity:
            override != null && override !== ""
              ? Number(override.replace(",", "."))
              : m.link.suggested_quantity,
          consumption_mode: m.link.consumption_mode,
          optional: m.link.optional,
          clinically_variable: m.link.clinically_variable,
        };
      });

    const res = await fetch("/api/demo/procedure-library", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "import",
        data: {
          procedure_template_id: preview.template.id,
          name: customize ? customName : preview.template.name,
          default_duration_minutes: customize
            ? customDuration
              ? Number(customDuration)
              : null
            : preview.template.default_duration_minutes,
          default_price_reais: customize
            ? customPrice
              ? Number(customPrice.replace(",", "."))
              : null
            : null,
          create_missing_materials: true,
          materials,
        },
      }),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(json.error ?? "Erro ao importar");
      return;
    }
    if (mode === "attendance" && onSelectClinicProcedure) {
      onSelectClinicProcedure(json.procedure.id, json.procedure.name);
      onClose?.();
      return;
    }
    router.push(`/app/procedimentos/${json.procedure.id}`);
    router.refresh();
  }

  async function importBatch() {
    if (batchSelected.size === 0) return;
    setSaving(true);
    const res = await fetch("/api/demo/procedure-library", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "import_batch",
        data: {
          procedure_template_ids: [...batchSelected],
          create_missing_materials: true,
        },
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const json = await res.json();
      setError(json.error ?? "Erro na importação em lote");
      return;
    }
    setBatchSelected(new Set());
    void load();
  }

  async function createCustom(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch("/api/demo/procedures", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create",
        data: {
          name: customForm.name,
          category: customForm.category || null,
          default_duration_minutes: customForm.duration
            ? Number(customForm.duration)
            : null,
          default_price_reais: customForm.price
            ? Number(customForm.price.replace(",", "."))
            : null,
        },
      }),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(json.error ?? "Erro ao criar");
      return;
    }
    await fetch("/api/demo/procedure-library", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "mark_custom",
        data: { procedure_id: json.procedure.id },
      }),
    });
    if (mode === "attendance" && onSelectClinicProcedure) {
      onSelectClinicProcedure(json.procedure.id, json.procedure.name);
      onClose?.();
      return;
    }
    router.push(`/app/procedimentos/${json.procedure.id}`);
    router.refresh();
  }

  function onCardActivate(card: ProcedureLibraryCard) {
    if (card.source === "clinic" && card.procedure_id) {
      if (mode === "attendance" && onSelectClinicProcedure) {
        onSelectClinicProcedure(card.procedure_id, card.name);
        onClose?.();
        return;
      }
      router.push(`/app/procedimentos/${card.procedure_id}`);
      return;
    }
    if (card.procedure_template_id) {
      void openPreview(card.procedure_template_id);
    }
  }

  const matchedCount = useMemo(
    () =>
      preview?.materials.filter(
        (m) => m.match.status === "matched" && !removedMats.has(m.material.id),
      ).length ?? 0,
    [preview, removedMats],
  );
  const missingCount = useMemo(
    () =>
      preview?.materials.filter(
        (m) => m.match.status !== "matched" && !removedMats.has(m.material.id),
      ).length ?? 0,
    [preview, removedMats],
  );

  const shellClass = embedded
    ? "flex flex-col gap-4"
    : "mx-auto flex w-full max-w-6xl flex-col gap-4";

  const showQuickFirst =
    mode === "attendance" && !showAll && !query && category === "mais_usados";

  return (
    <div className={shellClass}>
      <header className="flex flex-wrap items-start justify-between gap-3 animate-fade-in">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight text-[var(--brand-ink)]">
            {mode === "attendance"
              ? "Adicionar procedimento"
              : "Biblioteca de procedimentos"}
          </h1>
          <p className="mt-1 max-w-xl text-sm text-[var(--text-muted)]">
            Selecione um modelo, revise a ficha de materiais e salve na clínica.
            Sugestões são operacionais — não são protocolo clínico.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {batchSelected.size > 0 ? (
            <Button
              type="button"
              size="sm"
              loading={saving}
              onClick={() => void importBatch()}
            >
              Adicionar {batchSelected.size} selecionados
            </Button>
          ) : null}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setShowCustomForm((v) => !v)}
          >
            <Plus className="size-4" />
            Criar personalizado
          </Button>
          {onClose ? (
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>
              <X className="size-4" />
              Fechar
            </Button>
          ) : null}
        </div>
      </header>

      {error ? (
        <p className="rounded-xl bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger)]">
          {error}
        </p>
      ) : null}

      {showCustomForm ? (
        <form
          onSubmit={createCustom}
          className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] p-4 animate-rise"
        >
          <h2 className="font-medium text-[var(--brand-ink)]">
            Procedimento personalizado
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Nome</Label>
              <Input
                value={customForm.name}
                onChange={(e) =>
                  setCustomForm({ ...customForm, name: e.target.value })
                }
                required
                minLength={2}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <Input
                value={customForm.category}
                onChange={(e) =>
                  setCustomForm({ ...customForm, category: e.target.value })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>Duração (min)</Label>
              <Input
                type="number"
                value={customForm.duration}
                onChange={(e) =>
                  setCustomForm({ ...customForm, duration: e.target.value })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>Preço padrão (R$)</Label>
              <Input
                value={customForm.price}
                onChange={(e) =>
                  setCustomForm({ ...customForm, price: e.target.value })
                }
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="submit" loading={saving}>
              Salvar
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowCustomForm(false)}
            >
              Cancelar
            </Button>
          </div>
        </form>
      ) : null}

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--text-subtle)]" />
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShowAll(true);
          }}
          placeholder="Buscar procedimento… ex.: restauração, profilaxia"
          className="h-12 pl-10 text-base"
          autoFocus={mode !== "attendance"}
        />
      </div>

      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 scrollbar-thin">
        {categories.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => {
              setCategory(c.key);
              setShowAll(true);
            }}
            className={[
              "shrink-0 rounded-full px-3.5 py-1.5 text-sm transition-colors",
              category === c.key
                ? "bg-[var(--brand-primary)] text-white"
                : "bg-[var(--surface-elevated)] text-[var(--text-muted)] ring-1 ring-[var(--border)] hover:bg-[var(--surface-muted)]",
            ].join(" ")}
          >
            {c.label}
          </button>
        ))}
      </div>

      {showQuickFirst ? (
        <section className="space-y-3 animate-rise">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-medium text-[var(--brand-ink)]">
              Mais usados nesta clínica
            </h2>
            <button
              type="button"
              className="text-sm text-[var(--brand-primary)]"
              onClick={() => {
                setShowAll(true);
                setCategory("todos");
              }}
            >
              Ver todos
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {(quick.length ? quick : cards.slice(0, 8)).map((card) => (
              <LibraryCard
                key={card.key}
                card={card}
                large
                onActivate={() => onCardActivate(card)}
                onFavorite={() => void toggleFavorite(card)}
              />
            ))}
          </div>
        </section>
      ) : null}

      {!showQuickFirst ? (
        <div className="grid gap-4 lg:grid-cols-[1fr_minmax(280px,360px)]">
          <section className="min-w-0">
            {loading ? (
              <p className="text-sm text-[var(--text-muted)]">Carregando…</p>
            ) : cards.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-[var(--border)] px-4 py-8 text-center text-sm text-[var(--text-muted)]">
                Nenhum procedimento encontrado. Tente outra busca ou crie um
                personalizado.
              </p>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2">
                {cards.map((card) => (
                  <li key={card.key} className="relative">
                    {mode === "onboarding" &&
                    card.source === "template" &&
                    card.procedure_template_id ? (
                      <label className="absolute right-3 top-3 z-10 flex items-center gap-1 text-xs text-[var(--text-muted)]">
                        <input
                          type="checkbox"
                          checked={batchSelected.has(
                            card.procedure_template_id,
                          )}
                          onChange={(e) => {
                            const next = new Set(batchSelected);
                            if (e.target.checked) {
                              next.add(card.procedure_template_id!);
                            } else {
                              next.delete(card.procedure_template_id!);
                            }
                            setBatchSelected(next);
                          }}
                        />
                      </label>
                    ) : null}
                    <LibraryCard
                      card={card}
                      onActivate={() => onCardActivate(card)}
                      onFavorite={() => void toggleFavorite(card)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <aside className="hidden lg:block">
            <PreviewPanel
              preview={preview}
              loading={previewLoading}
              customizing={customizing}
              setCustomizing={setCustomizing}
              customName={customName}
              setCustomName={setCustomName}
              customDuration={customDuration}
              setCustomDuration={setCustomDuration}
              customPrice={customPrice}
              setCustomPrice={setCustomPrice}
              removedMats={removedMats}
              setRemovedMats={setRemovedMats}
              qtyOverrides={qtyOverrides}
              setQtyOverrides={setQtyOverrides}
              matchedCount={matchedCount}
              missingCount={missingCount}
              saving={saving}
              onImport={(c) => void importTemplate(c)}
              onClose={() => setPreview(null)}
            />
          </aside>
        </div>
      ) : null}

      {/* Mobile / tablet bottom sheet */}
      {preview ? (
        <div className="fixed inset-0 z-50 flex items-end bg-black/35 lg:hidden">
          <div className="max-h-[88dvh] w-full overflow-y-auto rounded-t-3xl bg-[var(--surface-elevated)] p-4 shadow-xl animate-rise">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[var(--border)]" />
            <PreviewPanel
              preview={preview}
              loading={previewLoading}
              customizing={customizing}
              setCustomizing={setCustomizing}
              customName={customName}
              setCustomName={setCustomName}
              customDuration={customDuration}
              setCustomDuration={setCustomDuration}
              customPrice={customPrice}
              setCustomPrice={setCustomPrice}
              removedMats={removedMats}
              setRemovedMats={setRemovedMats}
              qtyOverrides={qtyOverrides}
              setQtyOverrides={setQtyOverrides}
              matchedCount={matchedCount}
              missingCount={missingCount}
              saving={saving}
              onImport={(c) => void importTemplate(c)}
              onClose={() => setPreview(null)}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function LibraryCard({
  card,
  large,
  onActivate,
  onFavorite,
}: {
  card: ProcedureLibraryCard;
  large?: boolean;
  onActivate: () => void;
  onFavorite: () => void;
}) {
  return (
    <div
      className={[
        "group relative flex flex-col rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/95 text-left transition-all hover:border-[var(--brand-primary)]/40 hover:shadow-sm",
        large ? "min-h-[132px] p-4" : "p-3.5",
      ].join(" ")}
    >
      <button
        type="button"
        onClick={onActivate}
        className="flex flex-1 flex-col items-start text-left"
      >
        <div className="flex w-full items-start justify-between gap-2 pr-8">
          <p
            className={[
              "font-medium text-[var(--brand-ink)]",
              large ? "text-base" : "text-sm",
            ].join(" ")}
          >
            {card.name}
          </p>
        </div>
        <p className="mt-1 text-xs text-[var(--text-muted)]">{card.category}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[var(--text-subtle)]">
          <Badge tone={card.source === "clinic" ? "success" : "info"}>
            {card.badge_label}
          </Badge>
          <span className="inline-flex items-center gap-1">
            <Package className="size-3" />
            {card.materials_count} materiais
          </span>
          {card.default_duration_minutes ? (
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3" />≈ {card.default_duration_minutes} min
            </span>
          ) : null}
        </div>
        {card.clinic_cost_cents != null ? (
          <p className="mt-2 text-xs text-[var(--text-muted)]">
            Custo atual ≈ {formatBRL(card.clinic_cost_cents)}
          </p>
        ) : card.reference_cost_cents != null ? (
          <p className="mt-2 text-xs text-[var(--text-subtle)]">
            Custo aproximado de referência ≈{" "}
            {formatBRL(card.reference_cost_cents)}
          </p>
        ) : null}
      </button>
      <button
        type="button"
        aria-label={card.favorited ? "Remover favorito" : "Favoritar"}
        onClick={onFavorite}
        className="absolute right-2.5 top-2.5 rounded-lg p-1.5 text-[var(--text-subtle)] hover:bg-[var(--surface-muted)] hover:text-[var(--warning)]"
      >
        <Star
          className="size-4"
          fill={card.favorited ? "currentColor" : "none"}
        />
      </button>
    </div>
  );
}

function PreviewPanel({
  preview,
  loading,
  customizing,
  setCustomizing,
  customName,
  setCustomName,
  customDuration,
  setCustomDuration,
  customPrice,
  setCustomPrice,
  removedMats,
  setRemovedMats,
  qtyOverrides,
  setQtyOverrides,
  matchedCount,
  missingCount,
  saving,
  onImport,
  onClose,
}: {
  preview: Preview | null;
  loading: boolean;
  customizing: boolean;
  setCustomizing: (v: boolean) => void;
  customName: string;
  setCustomName: (v: string) => void;
  customDuration: string;
  setCustomDuration: (v: string) => void;
  customPrice: string;
  setCustomPrice: (v: string) => void;
  removedMats: Set<string>;
  setRemovedMats: (v: Set<string>) => void;
  qtyOverrides: Record<string, string>;
  setQtyOverrides: (v: Record<string, string>) => void;
  matchedCount: number;
  missingCount: number;
  saving: boolean;
  onImport: (customize: boolean) => void;
  onClose: () => void;
}) {
  if (loading) {
    return (
      <div className="sticky top-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] p-4 text-sm text-[var(--text-muted)]">
        Carregando ficha…
      </div>
    );
  }
  if (!preview) {
    return (
      <div className="sticky top-4 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface-elevated)]/70 p-5 text-sm text-[var(--text-muted)]">
        <Sparkles className="mb-2 size-5 text-[var(--brand-primary)]" />
        Selecione um modelo para ver materiais sugeridos e importar para a
        clínica.
      </div>
    );
  }

  const visible = preview.materials.filter(
    (m) => !removedMats.has(m.material.id),
  );

  return (
    <div className="sticky top-4 space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <Badge tone="info">Modelo Sorria</Badge>
          <h2 className="mt-2 font-[family-name:var(--font-display)] text-xl text-[var(--brand-ink)]">
            {preview.template.name}
          </h2>
          {preview.template.default_duration_minutes ? (
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              ≈ {preview.template.default_duration_minutes} min
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-[var(--text-subtle)] hover:bg-[var(--surface-muted)]"
        >
          <X className="size-4" />
        </button>
      </div>

      <p className="rounded-xl bg-[var(--info-soft)] px-3 py-2 text-xs text-[var(--info)]">
        Estimativa inicial para controle de estoque. Valores são editáveis e{" "}
        <strong>não são protocolo clínico</strong>.
      </p>

      <div>
        <h3 className="text-sm font-medium text-[var(--brand-ink)]">
          Materiais sugeridos
        </h3>
        <p className="mt-0.5 text-xs text-[var(--text-muted)]">
          {matchedCount} já no estoque · {missingCount} a adicionar
        </p>
        <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto">
          {visible.map((m) => (
            <li
              key={m.material.id}
              className="rounded-xl bg-[var(--surface-muted)]/50 px-3 py-2 text-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-[var(--text)]">
                    {m.match.inventory_item_name ?? m.material.name}
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">
                    {m.match.status === "matched" ? "✓ no estoque" : "+ novo"}
                    {" · "}
                    {m.link.clinically_variable
                      ? "Quantidade a confirmar no atendimento"
                      : qtyLabel(m)}
                    {" · "}
                    {CONSUMPTION_MODE_LABELS[m.link.consumption_mode]}
                    {m.link.optional ? " · opcional" : ""}
                  </p>
                </div>
                {customizing ? (
                  <button
                    type="button"
                    className="text-xs text-[var(--danger)]"
                    onClick={() => {
                      const next = new Set(removedMats);
                      next.add(m.material.id);
                      setRemovedMats(next);
                    }}
                  >
                    Remover
                  </button>
                ) : null}
              </div>
              {customizing && !m.link.clinically_variable ? (
                <Input
                  className="mt-2 h-9"
                  value={
                    qtyOverrides[m.material.id] ??
                    (m.link.suggested_quantity != null
                      ? String(m.link.suggested_quantity)
                      : "")
                  }
                  onChange={(e) =>
                    setQtyOverrides({
                      ...qtyOverrides,
                      [m.material.id]: e.target.value,
                    })
                  }
                  placeholder="Quantidade"
                />
              ) : null}
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-xl border border-[var(--border)] px-3 py-2 text-xs text-[var(--text-muted)]">
        <p className="font-medium text-[var(--text)]">Estimativa atual</p>
        {preview.reference_cost_cents != null ? (
          <p className="mt-1">
            Materiais com custo conhecido:{" "}
            {formatBRL(preview.reference_cost_cents)}
          </p>
        ) : (
          <p className="mt-1">Custo não calculado</p>
        )}
        {preview.materials_without_cost > 0 ? (
          <p>
            {preview.materials_without_cost} materiais ainda sem custo
          </p>
        ) : null}
      </div>

      {customizing ? (
        <div className="space-y-2">
          <div className="space-y-1.5">
            <Label>Nome na clínica</Label>
            <Input
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label>Duração</Label>
              <Input
                type="number"
                value={customDuration}
                onChange={(e) => setCustomDuration(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Preço (R$)</Label>
              <Input
                value={customPrice}
                onChange={(e) => setCustomPrice(e.target.value)}
              />
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        {!customizing ? (
          <>
            <Button
              type="button"
              loading={saving}
              onClick={() => onImport(false)}
            >
              Usar modelo
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setCustomizing(true)}
            >
              Personalizar antes de adicionar
            </Button>
          </>
        ) : (
          <>
            <Button
              type="button"
              loading={saving}
              onClick={() => onImport(true)}
            >
              Salvar na clínica
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setCustomizing(false)}
            >
              Voltar
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
