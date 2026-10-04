import { beforeEach, describe, expect, it } from "vitest";
import {
  CLINIC_A_ID,
  OWNER_A_ID,
  resetAuthzStore,
  setDemoSession,
} from "@/lib/demo/authz-store";
import { resetInventoryStore, getInventoryStore } from "@/lib/demo/inventory-store";
import { resetProcedureLibraryStore } from "@/lib/demo/procedure-library-store";
import {
  getProcedureTemplatePreview,
  importProcedureTemplate,
  importProcedureTemplatesBatch,
  listMaterialLibrary,
  listProcedureLibrary,
  matchMaterialTemplate,
  quickCreateMaterial,
  toggleLibraryFavorite,
} from "@/services/procedure-library";
import { getProcedureLibraryStore } from "@/lib/demo/procedure-library-store";
import { updateProcedureMaterial } from "@/services/procedures";

beforeEach(() => {
  resetAuthzStore();
  resetInventoryStore();
  resetProcedureLibraryStore();
  setDemoSession(OWNER_A_ID, CLINIC_A_ID);
});

const ownerA = { userId: OWNER_A_ID, clinicId: CLINIC_A_ID };

describe("biblioteca — busca e navegação", () => {
  it("busca 'restauração' retorna templates relevantes", () => {
    const { cards } = listProcedureLibrary(ownerA, { query: "restauração" });
    expect(cards.length).toBeGreaterThan(0);
    expect(
      cards.some((c) => c.name.toLowerCase().includes("restaura")),
    ).toBe(true);
  });

  it("favoritar Profilaxia template ou clinic aparece em Favoritos", () => {
    toggleLibraryFavorite(ownerA, {
      procedure_id: "proc-a-prophylaxis",
      favorited: true,
    });
    const { cards } = listProcedureLibrary(ownerA, { category: "favoritos" });
    expect(cards.some((c) => c.name === "Profilaxia")).toBe(true);
    expect(cards[0]?.favorited).toBe(true);
  });

  it("mais usados prioriza Restauração média pelo use_count", () => {
    const { cards } = listProcedureLibrary(ownerA, { category: "mais_usados" });
    expect(cards[0]?.name).toBe("Restauração média");
    expect(cards[0]?.use_count).toBeGreaterThan(0);
  });

  it("atendimento expõe quick cards com favoritos/mais usados", () => {
    const { quick } = listProcedureLibrary(ownerA, { mode: "attendance" });
    expect(quick.length).toBeGreaterThan(0);
    expect(quick.length).toBeLessThanOrEqual(8);
  });
});

describe("biblioteca — importação e personalização", () => {
  it("importar Restauração média cria procedure clínica e mantém template", () => {
    // Clinic A já tem pt-rest-media — importar pequena
    const beforeTemplates = getProcedureLibraryStore().procedureTemplates.length;
    const result = importProcedureTemplate(ownerA, {
      procedure_template_id: "pt-rest-pequena",
      create_missing_materials: true,
    });
    expect(result.procedure_id).toBeTruthy();
    expect(result.linked_material_count).toBeGreaterThan(5);

    const proc = getInventoryStore().procedures.find(
      (p) => p.id === result.procedure_id,
    )!;
    expect(proc.source_template_id).toBe("pt-rest-pequena");
    expect(proc.clinic_id).toBe(CLINIC_A_ID);

    const afterTemplates = getProcedureLibraryStore().procedureTemplates.length;
    expect(afterTemplates).toBe(beforeTemplates);

    const globalLink = getProcedureLibraryStore().procedureTemplateMaterials.find(
      (l) =>
        l.procedure_template_id === "pt-rest-pequena" &&
        l.material_template_id === "mt-resina",
    )!;
    const clinicMat = getInventoryStore().procedureMaterials.find(
      (m) =>
        m.procedure_id === result.procedure_id &&
        m.source_material_template_id === "mt-resina",
    )!;
    // personalizar quantidade da clínica
    updateProcedureMaterial(ownerA, {
      id: clinicMat.id,
      standard_quantity: 0.99,
    });
    expect(clinicMat.standard_quantity).toBe(0.99);
    expect(globalLink.suggested_quantity).toBe(0.2);
  });

  it("três procedures com Gaze reutilizam 1 inventory item", () => {
    const gauzeBefore = getInventoryStore().inventoryItems.filter(
      (i) =>
        i.clinic_id === CLINIC_A_ID &&
        (i.name === "Gaze" || i.source_material_template_id === "mt-gaze"),
    );
    expect(gauzeBefore.length).toBe(1);

    importProcedureTemplatesBatch(ownerA, {
      procedure_template_ids: [
        "pt-raspagem-supra",
        "pt-exodontia-simples",
        "pt-clareamento-consultorio",
      ],
      create_missing_materials: true,
    });

    const gauzeAfter = getInventoryStore().inventoryItems.filter(
      (i) =>
        i.clinic_id === CLINIC_A_ID &&
        (i.name === "Gaze" || i.source_material_template_id === "mt-gaze"),
    );
    expect(gauzeAfter.length).toBe(1);

    const gazeLinks = getInventoryStore().procedureMaterials.filter(
      (m) =>
        m.clinic_id === CLINIC_A_ID &&
        m.inventory_item_id === gauzeAfter[0]!.id,
    );
    expect(gazeLinks.length).toBeGreaterThanOrEqual(3);
  });

  it("matching confiável de Luva via source_material_template_id", () => {
    const mat = getProcedureLibraryStore().materialTemplates.find(
      (m) => m.id === "mt-luva",
    )!;
    const match = matchMaterialTemplate(ownerA, mat);
    expect(match.status).toBe("matched");
    expect(match.inventory_item_id).toBe("inv-a-gloves");
  });

  it("preview marca anestésico como clinically_variable", () => {
    const preview = getProcedureTemplatePreview(ownerA, "pt-rest-media");
    const anest = preview.materials.find(
      (m) => m.material.id === "mt-anestesioco",
    );
    expect(anest?.link.clinically_variable).toBe(true);
    expect(anest?.link.consumption_mode).toBe("manual");
  });

  it("custo real da clínica prevalece sobre referência no match", () => {
    const mat = getProcedureLibraryStore().materialTemplates.find(
      (m) => m.id === "mt-resina",
    )!;
    // altera referência sem tocar no custo real da clínica
    mat.reference_purchase_price_cents = 40000;
    const match = matchMaterialTemplate(ownerA, mat);
    expect(match.clinic_unit_cost_cents).toBe(2250);
    expect(match.reference_unit_cost_cents).toBe(10000);
    const preview = getProcedureTemplatePreview(ownerA, "pt-rest-pequena");
    const resin = preview.materials.find((m) => m.material.id === "mt-resina");
    // preview usa clinic_unit_cost quando disponível
    expect(resin?.match.clinic_unit_cost_cents).toBe(2250);
    expect(preview.reference_cost_cents).toBeTruthy();
  });

  it("quick create material retorna ao fluxo sem quebrar biblioteca", () => {
    const item = quickCreateMaterial(ownerA, {
      name: "Resina Filtek Z350 A2",
      consumption_unit: "g",
      purchase_unit: "seringa",
      units_per_purchase_unit: 4,
      material_template_id: "mt-resina",
      average_unit_cost_reais: 22.5,
    });
    expect(item.source_material_template_id).toBe("mt-resina");
    expect(item.average_unit_cost_cents).toBe(2250);

    const materials = listMaterialLibrary(ownerA, { query: "filtek" });
    expect(materials.some((m) => m.inventory_item_id === item.id)).toBe(true);
  });

  it("seed idempotente não duplica templates", () => {
    const a = getProcedureLibraryStore().procedureTemplates.length;
    resetProcedureLibraryStore();
    const b = getProcedureLibraryStore().procedureTemplates.length;
    expect(a).toBe(b);
    expect(a).toBeGreaterThan(40);
  });

  it("fuzzy busca microbrush por alias 'aplicador'", () => {
    const items = listMaterialLibrary(ownerA, { query: "aplicador" });
    expect(
      items.some(
        (i) =>
          i.name.toLowerCase().includes("microbrush") ||
          i.material_template_id === "mt-microbrush",
      ),
    ).toBe(true);
  });

  it("biblioteca prioriza Meu procedimento sobre Modelo Sorria para mesmo template", () => {
    const { cards } = listProcedureLibrary(ownerA, { query: "restauração média" });
    const clinic = cards.find((c) => c.source === "clinic");
    const template = cards.find(
      (c) =>
        c.source === "template" && c.procedure_template_id === "pt-rest-media",
    );
    expect(clinic).toBeTruthy();
    expect(template).toBeUndefined();
  });
});
