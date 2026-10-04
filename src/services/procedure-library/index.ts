import { can, type AuthzContext } from "@/lib/authz/can";
import { assertPermission } from "@/lib/authz/guards";
import { getInventoryStore, writeInventoryAudit } from "@/lib/demo/inventory-store";
import {
  ensureProcedureLibrarySeeded,
  getProcedureLibraryStore,
} from "@/lib/demo/procedure-library-store";
import { reaisToCents } from "@/lib/money";
import {
  importTemplateSchema,
  importTemplatesBatchSchema,
  quickCreateMaterialSchema,
  toggleFavoriteSchema,
} from "@/lib/validations/procedure-library";
import type { InventoryItem } from "@/types/inventory";
import type {
  ImportTemplateResult,
  MaterialLibraryCard,
  MaterialMatchSuggestion,
  MaterialTemplate,
  ProcedureLibraryCard,
  ProcedureTemplate,
  ProcedureTemplateCategory,
  ProcedureTemplatePreview,
} from "@/types/procedure-library";
import {
  MATERIAL_TEMPLATE_CATEGORY_LABELS,
  PROCEDURE_TEMPLATE_CATEGORIES,
  PROCEDURE_TEMPLATE_CATEGORY_LABELS,
} from "@/types/procedure-library";
import { createInventoryItem } from "@/services/inventory";
import {
  addProcedureMaterial,
  calculateProcedureStandardCost,
  createProcedure,
} from "@/services/procedures";

function now() {
  return new Date().toISOString();
}

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokenize(text: string): string[] {
  return normalize(text).split(/\s+/).filter(Boolean);
}

function fuzzyScore(query: string, haystack: string): number {
  const q = normalize(query);
  const h = normalize(haystack);
  if (!q) return 1;
  if (h.includes(q)) return 100 - Math.min(40, h.length - q.length);
  const qTokens = tokenize(q);
  const hTokens = new Set(tokenize(h));
  let hits = 0;
  for (const t of qTokens) {
    if (hTokens.has(t)) hits += 2;
    else if ([...hTokens].some((ht) => ht.startsWith(t) || t.startsWith(ht))) {
      hits += 1;
    }
  }
  return hits;
}

function referenceUnitCostCents(mat: MaterialTemplate): number | null {
  if (
    mat.reference_purchase_price_cents == null ||
    !mat.suggested_units_per_purchase_unit ||
    mat.suggested_units_per_purchase_unit <= 0
  ) {
    return null;
  }
  return Math.round(
    mat.reference_purchase_price_cents / mat.suggested_units_per_purchase_unit,
  );
}

function isReferenceStale(date: string | null): boolean {
  if (!date) return false;
  const then = new Date(date).getTime();
  if (!Number.isFinite(then)) return false;
  const days = (Date.now() - then) / 86400_000;
  return days > 180;
}

function mapClinicCategory(
  category: string | null,
): ProcedureTemplateCategory | "clinic" {
  if (!category) return "clinic";
  const n = normalize(category);
  if (n.includes("prevent") || n.includes("consulta") || n.includes("avalia")) {
    return "avaliacao_prevencao";
  }
  if (n.includes("restaura") || n.includes("dentist")) return "dentistica";
  if (n.includes("period")) return "periodontia";
  if (n.includes("endo")) return "endodontia";
  if (n.includes("cirurg") || n.includes("exodont") || n.includes("extrac")) {
    return "cirurgia";
  }
  if (n.includes("clare") || n.includes("estetic")) return "clareamento";
  if (n.includes("protes") || n.includes("proté")) return "protese";
  if (n.includes("implant")) return "implantodontia";
  if (n.includes("infanti") || n.includes("pedo") || n.includes("crianc")) {
    return "odontopediatria";
  }
  if (n.includes("orto")) return "ortodontia";
  return "clinic";
}

export function matchMaterialTemplate(
  ctx: AuthzContext,
  material: MaterialTemplate,
): MaterialMatchSuggestion {
  const store = getInventoryStore();
  const items = store.inventoryItems.filter(
    (i) => i.clinic_id === ctx.clinicId && i.active && !i.archived_at,
  );

  const byTemplate = items.filter(
    (i) => i.source_material_template_id === material.id,
  );
  if (byTemplate.length === 1) {
    const item = byTemplate[0]!;
    return {
      material_template_id: material.id,
      material_template_name: material.name,
      status: "matched",
      inventory_item_id: item.id,
      inventory_item_name: item.name,
      candidates: [],
      clinically_variable: material.clinically_variable,
      suggested_quantity: null,
      consumption_unit: material.suggested_consumption_unit,
      consumption_mode: "per_procedure",
      optional: false,
      notes: null,
      reference_unit_cost_cents: referenceUnitCostCents(material),
      clinic_unit_cost_cents:
        item.average_unit_cost_cents > 0 ? item.average_unit_cost_cents : null,
    };
  }

  const aliases = [material.name, ...material.aliases].map(normalize);
  const scored = items
    .map((item) => {
      const nameN = normalize(item.name);
      let score = 0;
      for (const a of aliases) {
        if (nameN === a) score = Math.max(score, 100);
        else if (nameN.includes(a) || a.includes(nameN)) {
          score = Math.max(score, 80);
        } else {
          score = Math.max(score, fuzzyScore(a, nameN));
        }
      }
      return { item, score };
    })
    .filter((x) => x.score >= 4)
    .sort((a, b) => b.score - a.score);

  const top = scored.filter((x) => x.score >= 80);
  if (top.length === 1) {
    const item = top[0]!.item;
    return {
      material_template_id: material.id,
      material_template_name: material.name,
      status: "matched",
      inventory_item_id: item.id,
      inventory_item_name: item.name,
      candidates: [],
      clinically_variable: material.clinically_variable,
      suggested_quantity: null,
      consumption_unit: material.suggested_consumption_unit,
      consumption_mode: "per_procedure",
      optional: false,
      notes: null,
      reference_unit_cost_cents: referenceUnitCostCents(material),
      clinic_unit_cost_cents:
        item.average_unit_cost_cents > 0 ? item.average_unit_cost_cents : null,
    };
  }

  if (scored.length > 1 || (top.length === 0 && scored.length === 1)) {
    const candidates = scored.slice(0, 5).map((x) => ({
      id: x.item.id,
      name: x.item.name,
    }));
    const only = scored.length === 1 ? scored[0]!.item : null;
    if (only && scored[0]!.score >= 6) {
      // score baixo demais para união silenciosa
      return {
        material_template_id: material.id,
        material_template_name: material.name,
        status: "ambiguous",
        inventory_item_id: null,
        inventory_item_name: null,
        candidates: [{ id: only.id, name: only.name }],
        clinically_variable: material.clinically_variable,
        suggested_quantity: null,
        consumption_unit: material.suggested_consumption_unit,
        consumption_mode: "per_procedure",
        optional: false,
        notes: null,
        reference_unit_cost_cents: referenceUnitCostCents(material),
        clinic_unit_cost_cents: null,
      };
    }
    return {
      material_template_id: material.id,
      material_template_name: material.name,
      status: scored.length ? "ambiguous" : "missing",
      inventory_item_id: null,
      inventory_item_name: null,
      candidates,
      clinically_variable: material.clinically_variable,
      suggested_quantity: null,
      consumption_unit: material.suggested_consumption_unit,
      consumption_mode: "per_procedure",
      optional: false,
      notes: null,
      reference_unit_cost_cents: referenceUnitCostCents(material),
      clinic_unit_cost_cents: null,
    };
  }

  return {
    material_template_id: material.id,
    material_template_name: material.name,
    status: "missing",
    inventory_item_id: null,
    inventory_item_name: null,
    candidates: [],
    clinically_variable: material.clinically_variable,
    suggested_quantity: null,
    consumption_unit: material.suggested_consumption_unit,
    consumption_mode: "per_procedure",
    optional: false,
    notes: null,
    reference_unit_cost_cents: referenceUnitCostCents(material),
    clinic_unit_cost_cents: null,
  };
}

type ProcedureLibraryStoreEvent =
  | "procedure_library_opened"
  | "procedure_template_selected"
  | "procedure_template_imported"
  | "custom_procedure_created"
  | "material_quick_created";

function trackAnalytics(
  ctx: AuthzContext,
  event: ProcedureLibraryStoreEvent,
  metadata: Record<string, unknown> = {},
) {
  const store = getProcedureLibraryStore();
  store.analytics.push({
    id: `pla-${crypto.randomUUID()}`,
    clinic_id: ctx.clinicId,
    event,
    metadata,
    created_at: now(),
  });
}

export function openProcedureLibrary(ctx: AuthzContext) {
  assertPermission(ctx, "procedures.view");
  ensureProcedureLibrarySeeded();
  trackAnalytics(ctx, "procedure_library_opened");
}

export function listProcedureLibrary(
  ctx: AuthzContext,
  opts?: {
    query?: string;
    category?: string | null;
    mode?: "catalog" | "attendance" | "onboarding";
    limit?: number;
  },
): {
  cards: ProcedureLibraryCard[];
  categories: Array<{ key: string; label: string }>;
  quick: ProcedureLibraryCard[];
} {
  assertPermission(ctx, "procedures.view");
  ensureProcedureLibrarySeeded();
  const lib = getProcedureLibraryStore();
  const inv = getInventoryStore();
  const canSeeCosts = can(ctx, "procedure_costs.view").allowed;
  const query = opts?.query?.trim() ?? "";
  const category = opts?.category ?? "todos";
  const clinicProcs = inv.procedures.filter(
    (p) => p.clinic_id === ctx.clinicId && p.active && !p.archived_at,
  );

  const clinicCards: ProcedureLibraryCard[] = clinicProcs.map((p) => {
    const mats = inv.procedureMaterials.filter(
      (m) => m.procedure_id === p.id && m.clinic_id === ctx.clinicId,
    );
    let clinicCost: number | null = null;
    let without = 0;
    if (canSeeCosts) {
      const cost = calculateProcedureStandardCost(ctx, p.id);
      clinicCost = cost.materials_cost_cents > 0 ? cost.materials_cost_cents : null;
      without = cost.lines.filter(
        (l) => l.average_unit_cost_cents <= 0 && !l.optional,
      ).length;
    }
    const catKey = mapClinicCategory(p.category);
    return {
      key: `clinic:${p.id}`,
      source: "clinic" as const,
      procedure_id: p.id,
      procedure_template_id: p.source_template_id,
      name: p.name,
      category:
        p.category ??
        (catKey === "clinic"
          ? "Clínica"
          : PROCEDURE_TEMPLATE_CATEGORY_LABELS[catKey]),
      category_key: catKey,
      default_duration_minutes: p.default_duration_minutes,
      materials_count: mats.length,
      clinic_cost_cents: clinicCost,
      reference_cost_cents: null,
      materials_without_cost: without,
      favorited: p.favorited,
      use_count: p.use_count,
      last_used_at: p.last_used_at,
      template_version: p.source_template_version,
      badge_label: "Meu procedimento" as const,
    };
  });

  const importedTemplateIds = new Set(
    clinicProcs
      .map((p) => p.source_template_id)
      .filter((id): id is string => Boolean(id)),
  );

  const prefFavTemplates = new Set(
    lib.preferences
      .filter(
        (p) =>
          p.clinic_id === ctx.clinicId &&
          p.favorited &&
          p.procedure_template_id,
      )
      .map((p) => p.procedure_template_id!),
  );

  const templateCards: ProcedureLibraryCard[] = lib.procedureTemplates
    .filter((t) => t.active && !importedTemplateIds.has(t.id))
    .map((t) => {
      const links = lib.procedureTemplateMaterials.filter(
        (l) => l.procedure_template_id === t.id,
      );
      let refCost = 0;
      let refKnown = 0;
      let refMissing = 0;
      for (const link of links) {
        const mat = lib.materialTemplates.find(
          (m) => m.id === link.material_template_id,
        );
        if (!mat) continue;
        const unit = referenceUnitCostCents(mat);
        if (
          unit != null &&
          link.suggested_quantity != null &&
          link.consumption_mode !== "manual"
        ) {
          refCost += Math.round(unit * link.suggested_quantity);
          refKnown += 1;
        } else if (!link.optional) {
          refMissing += 1;
        }
      }
      return {
        key: `template:${t.id}`,
        source: "template" as const,
        procedure_id: null,
        procedure_template_id: t.id,
        name: t.short_name ?? t.name,
        category: PROCEDURE_TEMPLATE_CATEGORY_LABELS[t.category],
        category_key: t.category,
        default_duration_minutes: t.default_duration_minutes,
        materials_count: links.length,
        clinic_cost_cents: null,
        reference_cost_cents: refKnown > 0 ? refCost : null,
        materials_without_cost: refMissing,
        favorited: prefFavTemplates.has(t.id),
        use_count: 0,
        last_used_at: null,
        template_version: t.template_version,
        badge_label: "Modelo Sorria" as const,
      };
    });

  let cards = [...clinicCards, ...templateCards];

  if (query) {
    cards = cards
      .map((c) => {
        const template = c.procedure_template_id
          ? lib.procedureTemplates.find((t) => t.id === c.procedure_template_id)
          : null;
        const hay = [
          c.name,
          c.category,
          template?.search_terms ?? "",
          template?.name ?? "",
        ].join(" ");
        return { c, score: fuzzyScore(query, hay) };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.c);
  }

  if (category === "favoritos") {
    cards = cards.filter((c) => c.favorited);
  } else if (category === "mais_usados") {
    cards = cards
      .filter((c) => c.source === "clinic" && c.use_count > 0)
      .sort((a, b) => b.use_count - a.use_count);
  } else if (category === "recentes") {
    cards = cards
      .filter((c) => c.source === "clinic" && c.last_used_at)
      .sort((a, b) => (b.last_used_at ?? "").localeCompare(a.last_used_at ?? ""));
  } else if (category && category !== "todos") {
    cards = cards.filter((c) => c.category_key === category);
  } else if (!query) {
    // Ordenação padrão: favoritos → mais usados → A–Z
    cards.sort((a, b) => {
      if (a.favorited !== b.favorited) return a.favorited ? -1 : 1;
      if (a.use_count !== b.use_count) return b.use_count - a.use_count;
      if (a.source !== b.source) return a.source === "clinic" ? -1 : 1;
      return a.name.localeCompare(b.name, "pt-BR");
    });
  }

  const limit = opts?.limit ?? 80;
  cards = cards.slice(0, limit);

  const quick = [...clinicCards]
    .filter((c) => c.favorited || c.use_count > 0)
    .sort((a, b) => {
      if (a.favorited !== b.favorited) return a.favorited ? -1 : 1;
      return b.use_count - a.use_count;
    })
    .slice(0, opts?.mode === "attendance" ? 8 : 6);

  const categories = [
    { key: "todos", label: "Todos" },
    { key: "favoritos", label: "Favoritos" },
    { key: "mais_usados", label: "Mais usados" },
    { key: "recentes", label: "Recentes" },
    ...PROCEDURE_TEMPLATE_CATEGORIES.map((key) => ({
      key,
      label:
        key === "avaliacao_prevencao"
          ? "Prevenção"
          : key === "clareamento"
            ? "Estética"
            : key === "implantodontia"
              ? "Implantes"
              : key === "odontopediatria"
                ? "Infantil"
                : key === "cirurgia"
                  ? "Cirurgia"
                  : PROCEDURE_TEMPLATE_CATEGORY_LABELS[key],
    })),
  ];

  return { cards, categories, quick };
}

export function getProcedureTemplatePreview(
  ctx: AuthzContext,
  templateId: string,
): ProcedureTemplatePreview {
  assertPermission(ctx, "procedures.view");
  ensureProcedureLibrarySeeded();
  const lib = getProcedureLibraryStore();
  const template = lib.procedureTemplates.find((t) => t.id === templateId);
  if (!template || !template.active) throw new Error("TEMPLATE_NOT_FOUND");

  trackAnalytics(ctx, "procedure_template_selected", {
    procedure_template_id: templateId,
  });

  const links = lib.procedureTemplateMaterials
    .filter((l) => l.procedure_template_id === templateId)
    .sort((a, b) => a.sort_order - b.sort_order);

  let reference_cost_cents = 0;
  let materials_with_cost = 0;
  let materials_without_cost = 0;

  const materials = links.map((link) => {
    const material = lib.materialTemplates.find(
      (m) => m.id === link.material_template_id,
    );
    if (!material) throw new Error("MATERIAL_TEMPLATE_NOT_FOUND");
    const match = matchMaterialTemplate(ctx, material);
    match.suggested_quantity = link.suggested_quantity;
    match.consumption_mode = link.consumption_mode;
    match.optional = link.optional;
    match.clinically_variable =
      link.clinically_variable || material.clinically_variable;
    match.notes = link.notes;
    match.consumption_unit = link.consumption_unit;

    const unitCost =
      match.clinic_unit_cost_cents ?? match.reference_unit_cost_cents;
    if (
      unitCost != null &&
      link.suggested_quantity != null &&
      link.consumption_mode !== "manual"
    ) {
      reference_cost_cents += Math.round(unitCost * link.suggested_quantity);
      materials_with_cost += 1;
    } else if (!link.optional) {
      materials_without_cost += 1;
    }

    return { material, link, match };
  });

  const already = getInventoryStore().procedures.find(
    (p) =>
      p.clinic_id === ctx.clinicId &&
      p.source_template_id === templateId &&
      p.active &&
      !p.archived_at,
  );

  return {
    template,
    materials,
    reference_cost_cents: materials_with_cost > 0 ? reference_cost_cents : null,
    materials_with_cost,
    materials_without_cost,
    already_imported_procedure_id: already?.id ?? null,
  };
}

function createItemFromTemplate(
  ctx: AuthzContext,
  material: MaterialTemplate,
  customName?: string | null,
): InventoryItem {
  return createInventoryItem(ctx, {
    name: customName?.trim() || material.name,
    category: MATERIAL_TEMPLATE_CATEGORY_LABELS[material.category],
    purchase_unit: material.suggested_purchase_unit,
    consumption_unit: material.suggested_consumption_unit,
    units_per_purchase_unit: material.suggested_units_per_purchase_unit ?? 1,
    source_material_template_id: material.id,
  });
}

export function importProcedureTemplate(
  ctx: AuthzContext,
  input: unknown,
): ImportTemplateResult {
  assertPermission(ctx, "procedures.create");
  ensureProcedureLibrarySeeded();
  const data = importTemplateSchema.parse(input);
  const lib = getProcedureLibraryStore();
  const template = lib.procedureTemplates.find(
    (t) => t.id === data.procedure_template_id,
  );
  if (!template || !template.active) throw new Error("TEMPLATE_NOT_FOUND");

  const preview = getProcedureTemplatePreview(ctx, template.id);
  const decisions = new Map(
    (data.materials ?? []).map((m) => [m.material_template_id, m]),
  );

  const proc = createProcedure(ctx, {
    name: data.name?.trim() || template.name,
    description:
      template.description ??
      "Importado do modelo Sorria — personalize livremente. Não é protocolo clínico.",
    category: PROCEDURE_TEMPLATE_CATEGORY_LABELS[template.category],
    default_duration_minutes:
      data.default_duration_minutes ?? template.default_duration_minutes,
    default_price_reais: data.default_price_reais ?? null,
  });

  // Marca snapshot do template
  const store = getInventoryStore();
  const stored = store.procedures.find((p) => p.id === proc.id)!;
  stored.source_template_id = template.id;
  stored.source_template_version = template.template_version;

  const created_inventory_item_ids: string[] = [];
  const reused_inventory_item_ids: string[] = [];
  let linked = 0;

  for (const row of preview.materials) {
    const decision = decisions.get(row.material.id);
    if (decision?.skip) continue;

    let inventoryItemId =
      decision?.inventory_item_id ??
      (row.match.status === "matched" ? row.match.inventory_item_id : null);

    if (!inventoryItemId) {
      if (decision?.create_new || data.create_missing_materials) {
        if (!can(ctx, "inventory.create").allowed) {
          // Sem permissão de estoque: pula materiais faltantes
          continue;
        }
        const item = createItemFromTemplate(
          ctx,
          row.material,
          decision?.custom_name,
        );
        inventoryItemId = item.id;
        created_inventory_item_ids.push(item.id);
      } else {
        continue;
      }
    } else {
      reused_inventory_item_ids.push(inventoryItemId);
    }

    const qty =
      decision?.suggested_quantity ??
      row.link.suggested_quantity ??
      (row.link.clinically_variable || row.link.consumption_mode === "manual"
        ? 0
        : 1);
    const mode = decision?.consumption_mode ?? row.link.consumption_mode;
    const optional = decision?.optional ?? row.link.optional;
    const clinically =
      decision?.clinically_variable ??
      row.link.clinically_variable ??
      row.material.clinically_variable;

    try {
      addProcedureMaterial(ctx, {
        procedure_id: proc.id,
        inventory_item_id: inventoryItemId,
        standard_quantity: qty,
        consumption_mode: mode,
        optional,
        clinically_variable: clinically,
        notes:
          row.link.notes ??
          (clinically ? "Quantidade a confirmar no atendimento" : null),
        source_material_template_id: row.material.id,
      });
      linked += 1;
    } catch (e) {
      if (e instanceof Error && e.message === "MATERIAL_ALREADY_LINKED") {
        continue;
      }
      throw e;
    }
  }

  writeInventoryAudit({
    clinic_id: ctx.clinicId,
    actor_user_id: ctx.userId,
    action: "procedure_template.imported",
    target_type: "procedure",
    target_id: proc.id,
    metadata: {
      procedure_template_id: template.id,
      template_version: template.template_version,
      linked,
    },
  });
  trackAnalytics(ctx, "procedure_template_imported", {
    procedure_template_id: template.id,
    procedure_id: proc.id,
  });

  return {
    procedure_id: proc.id,
    created_inventory_item_ids,
    linked_material_count: linked,
    reused_inventory_item_ids: [...new Set(reused_inventory_item_ids)],
  };
}

export function importProcedureTemplatesBatch(
  ctx: AuthzContext,
  input: unknown,
): ImportTemplateResult[] {
  const data = importTemplatesBatchSchema.parse(input);
  return data.procedure_template_ids.map((id) =>
    importProcedureTemplate(ctx, {
      procedure_template_id: id,
      create_missing_materials: data.create_missing_materials,
    }),
  );
}

export function toggleLibraryFavorite(ctx: AuthzContext, input: unknown) {
  assertPermission(ctx, "procedures.update");
  const data = toggleFavoriteSchema.parse(input);
  if (!data.procedure_id && !data.procedure_template_id) {
    throw new Error("FAVORITE_TARGET_REQUIRED");
  }

  if (data.procedure_id) {
    const proc = getInventoryStore().procedures.find(
      (p) => p.id === data.procedure_id && p.clinic_id === ctx.clinicId,
    );
    if (!proc) throw new Error("PROCEDURE_NOT_FOUND");
    proc.favorited = data.favorited;
    proc.updated_at = now();
    return { favorited: proc.favorited, procedure_id: proc.id };
  }

  const lib = getProcedureLibraryStore();
  let pref = lib.preferences.find(
    (p) =>
      p.clinic_id === ctx.clinicId &&
      p.procedure_template_id === data.procedure_template_id,
  );
  if (!pref) {
    pref = {
      id: `clp-${crypto.randomUUID()}`,
      clinic_id: ctx.clinicId,
      procedure_template_id: data.procedure_template_id!,
      procedure_id: null,
      favorited: data.favorited,
      use_count: 0,
      last_used_at: null,
      created_at: now(),
      updated_at: now(),
    };
    lib.preferences.push(pref);
  } else {
    pref.favorited = data.favorited;
    pref.updated_at = now();
  }
  return {
    favorited: pref.favorited,
    procedure_template_id: data.procedure_template_id,
  };
}

export function listMaterialLibrary(
  ctx: AuthzContext,
  opts?: { query?: string; category?: string | null; limit?: number },
): MaterialLibraryCard[] {
  if (
    !can(ctx, "inventory.view").allowed &&
    !can(ctx, "procedures.view").allowed
  ) {
    throw new Error("AUTHORIZATION_DENIED");
  }
  ensureProcedureLibrarySeeded();
  const lib = getProcedureLibraryStore();
  const inv = getInventoryStore();
  const canSeeCosts = can(ctx, "inventory.cost_view").allowed;
  const query = opts?.query?.trim() ?? "";

  const clinicCards: MaterialLibraryCard[] = inv.inventoryItems
    .filter((i) => i.clinic_id === ctx.clinicId && i.active && !i.archived_at)
    .map((i) => ({
      key: `clinic:${i.id}`,
      source: "clinic" as const,
      inventory_item_id: i.id,
      material_template_id: i.source_material_template_id,
      name: i.name,
      category: i.category ?? "Outros",
      consumption_unit: i.consumption_unit,
      current_quantity: i.current_quantity,
      clinic_unit_cost_cents:
        canSeeCosts && i.average_unit_cost_cents > 0
          ? i.average_unit_cost_cents
          : null,
      reference_purchase_price_cents: null,
      clinically_variable: false,
      badge_label: "Meu material" as const,
    }));

  const linkedTemplates = new Set(
    clinicCards
      .map((c) => c.material_template_id)
      .filter((id): id is string => Boolean(id)),
  );

  const templateCards: MaterialLibraryCard[] = lib.materialTemplates
    .filter((m) => m.active && !linkedTemplates.has(m.id))
    .map((m) => ({
      key: `template:${m.id}`,
      source: "template" as const,
      inventory_item_id: null,
      material_template_id: m.id,
      name: m.name,
      category: MATERIAL_TEMPLATE_CATEGORY_LABELS[m.category],
      consumption_unit: m.suggested_consumption_unit,
      current_quantity: null,
      clinic_unit_cost_cents: null,
      reference_purchase_price_cents: m.reference_purchase_price_cents,
      clinically_variable: m.clinically_variable,
      badge_label: "Modelo Sorria" as const,
    }));

  let cards = [...clinicCards, ...templateCards];
  if (opts?.category && opts.category !== "todos") {
    cards = cards.filter((c) => normalize(c.category).includes(normalize(opts.category!)) || c.category === opts.category);
  }
  if (query) {
    cards = cards
      .map((c) => {
        const mat = c.material_template_id
          ? lib.materialTemplates.find((m) => m.id === c.material_template_id)
          : null;
        const hay = [
          c.name,
          c.category,
          mat?.search_terms ?? "",
          ...(mat?.aliases ?? []),
        ].join(" ");
        return { c, score: fuzzyScore(query, hay) };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.c);
  } else {
    cards.sort((a, b) => {
      if (a.source !== b.source) return a.source === "clinic" ? -1 : 1;
      return a.name.localeCompare(b.name, "pt-BR");
    });
  }
  return cards.slice(0, opts?.limit ?? 60);
}

export function quickCreateMaterial(ctx: AuthzContext, input: unknown) {
  assertPermission(ctx, "inventory.create");
  ensureProcedureLibrarySeeded();
  const data = quickCreateMaterialSchema.parse(input);
  const lib = getProcedureLibraryStore();
  let template: MaterialTemplate | undefined;
  if (data.material_template_id) {
    template = lib.materialTemplates.find(
      (m) => m.id === data.material_template_id,
    );
  }

  const item = createInventoryItem(ctx, {
    name: data.name,
    category:
      data.category ??
      (template
        ? MATERIAL_TEMPLATE_CATEGORY_LABELS[template.category]
        : "Outros"),
    purchase_unit:
      data.purchase_unit ??
      template?.suggested_purchase_unit ??
      data.consumption_unit,
    consumption_unit: data.consumption_unit,
    units_per_purchase_unit:
      data.units_per_purchase_unit ??
      template?.suggested_units_per_purchase_unit ??
      1,
    source_material_template_id: template?.id ?? null,
  });

  // Preço opcional não vira compra — só custo médio inicial se informado
  if (data.average_unit_cost_reais != null && data.average_unit_cost_reais > 0) {
    item.average_unit_cost_cents = reaisToCents(data.average_unit_cost_reais);
  }

  trackAnalytics(ctx, "material_quick_created", {
    inventory_item_id: item.id,
    material_template_id: template?.id ?? null,
  });
  return item;
}

export function getOnboardingProcedurePicks(ctx: AuthzContext) {
  assertPermission(ctx, "procedures.view");
  ensureProcedureLibrarySeeded();
  const picks: Array<{
    id: string;
    label: string;
    template_ids: string[];
  }> = [
    { id: "consulta", label: "Consulta", template_ids: ["pt-consulta-inicial"] },
    { id: "profilaxia", label: "Profilaxia", template_ids: ["pt-profilaxia"] },
    {
      id: "restauracao",
      label: "Restauração",
      template_ids: ["pt-rest-pequena", "pt-rest-media", "pt-rest-extensa"],
    },
    {
      id: "clareamento",
      label: "Clareamento",
      template_ids: ["pt-clareamento-consultorio"],
    },
    { id: "endodontia", label: "Endodontia", template_ids: ["pt-endo-uni"] },
    {
      id: "extracao",
      label: "Extração",
      template_ids: ["pt-exodontia-simples"],
    },
    { id: "protese", label: "Prótese", template_ids: ["pt-cimentacao-coroa"] },
    {
      id: "implante",
      label: "Implante",
      template_ids: ["pt-instalacao-implante"],
    },
  ];
  return picks;
}

export function referencePriceLabel(mat: MaterialTemplate): {
  label: string;
  stale: boolean;
  cents: number | null;
} {
  if (mat.reference_purchase_price_cents == null) {
    return { label: "Custo não calculado", stale: false, cents: null };
  }
  const stale = isReferenceStale(mat.reference_price_date);
  return {
    label: stale
      ? "Valor de referência — confirme seu preço de compra."
      : "Preço de referência",
    stale,
    cents: mat.reference_purchase_price_cents,
  };
}

export function listProcedureTemplates(ctx: AuthzContext): ProcedureTemplate[] {
  assertPermission(ctx, "procedures.view");
  ensureProcedureLibrarySeeded();
  return getProcedureLibraryStore()
    .procedureTemplates.filter((t) => t.active)
    .sort((a, b) => a.sort_order - b.sort_order);
}

export function listMaterialTemplates(ctx: AuthzContext): MaterialTemplate[] {
  assertPermission(ctx, "procedures.view");
  ensureProcedureLibrarySeeded();
  return getProcedureLibraryStore()
    .materialTemplates.filter((m) => m.active)
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

export function markCustomProcedureCreated(ctx: AuthzContext, procedureId: string) {
  trackAnalytics(ctx, "custom_procedure_created", { procedure_id: procedureId });
}

export function getLibraryStats(ctx: AuthzContext) {
  assertPermission(ctx, "procedures.view");
  ensureProcedureLibrarySeeded();
  const lib = getProcedureLibraryStore();
  return {
    procedure_templates: lib.procedureTemplates.filter((t) => t.active).length,
    material_templates: lib.materialTemplates.filter((m) => m.active).length,
    categories: PROCEDURE_TEMPLATE_CATEGORIES.length,
  };
}
