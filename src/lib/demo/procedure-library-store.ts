import {
  buildMaterialTemplates,
  buildProcedureTemplateMaterials,
  buildProcedureTemplates,
} from "@/lib/demo/procedure-library-seed";
import type {
  ClinicLibraryPreference,
  MaterialTemplate,
  ProcedureTemplate,
  ProcedureTemplateMaterial,
} from "@/types/procedure-library";

export type ProcedureLibraryStore = {
  materialTemplates: MaterialTemplate[];
  procedureTemplates: ProcedureTemplate[];
  procedureTemplateMaterials: ProcedureTemplateMaterial[];
  preferences: ClinicLibraryPreference[];
  /** Analytics UX leves (sem dados clínicos) */
  analytics: Array<{
    id: string;
    clinic_id: string;
    event:
      | "procedure_library_opened"
      | "procedure_template_selected"
      | "procedure_template_imported"
      | "custom_procedure_created"
      | "material_quick_created";
    metadata: Record<string, unknown>;
    created_at: string;
  }>;
  seeded: boolean;
};

declare global {
  var __sorriaProcedureLibraryStoreV1: ProcedureLibraryStore | undefined;
}

function seed(): ProcedureLibraryStore {
  return {
    materialTemplates: buildMaterialTemplates(),
    procedureTemplates: buildProcedureTemplates(),
    procedureTemplateMaterials: buildProcedureTemplateMaterials(),
    preferences: [],
    analytics: [],
    seeded: true,
  };
}

/** Seed idempotente — não duplica templates ao reinicializar. */
export function getProcedureLibraryStore(): ProcedureLibraryStore {
  if (!globalThis.__sorriaProcedureLibraryStoreV1) {
    globalThis.__sorriaProcedureLibraryStoreV1 = seed();
  }
  return globalThis.__sorriaProcedureLibraryStoreV1;
}

export function resetProcedureLibraryStore() {
  globalThis.__sorriaProcedureLibraryStoreV1 = seed();
}

/** Reaplica seed sem duplicar IDs (útil se alguém mutar templates em runtime). */
export function ensureProcedureLibrarySeeded() {
  const store = getProcedureLibraryStore();
  if (!store.seeded || store.procedureTemplates.length === 0) {
    globalThis.__sorriaProcedureLibraryStoreV1 = seed();
  }
  return getProcedureLibraryStore();
}
