import {
  CLINIC_A_ID,
  CLINIC_B_ID,
  OWNER_A_ID,
  DENTIST_B_ID,
  appendAudit,
} from "@/lib/demo/authz-store";
import type {
  InventoryItem,
  Procedure,
  ProcedureMaterial,
} from "@/types/inventory";

type Store = {
  procedures: Procedure[];
  inventoryItems: InventoryItem[];
  procedureMaterials: ProcedureMaterial[];
};

declare global {
  var __sorriaInventoryStoreV1: Store | undefined;
}

function stamp(h = 0) {
  return new Date(Date.now() - h * 3600_000).toISOString();
}

function seed(): Store {
  const gloves: InventoryItem = {
    id: "inv-a-gloves",
    clinic_id: CLINIC_A_ID,
    name: "Luva de procedimento",
    category: "EPI",
    purchase_unit: "caixa",
    consumption_unit: "un",
    units_per_purchase_unit: 100,
    current_quantity: 240,
    minimum_quantity: 50,
    average_unit_cost_cents: 40, // R$ 0,40 — caixa R$ 40 / 100
    last_purchase_cost_cents: 40,
    supplier_name: "Dental Supply",
    tracks_lot: false,
    tracks_expiration: false,
    active: true,
    created_by: OWNER_A_ID,
    created_at: stamp(48),
    updated_at: stamp(48),
    archived_at: null,
  };

  const mask: InventoryItem = {
    id: "inv-a-mask",
    clinic_id: CLINIC_A_ID,
    name: "Máscara cirúrgica",
    category: "EPI",
    purchase_unit: "caixa",
    consumption_unit: "un",
    units_per_purchase_unit: 50,
    current_quantity: 80,
    minimum_quantity: 20,
    average_unit_cost_cents: 30,
    last_purchase_cost_cents: 30,
    supplier_name: null,
    tracks_lot: false,
    tracks_expiration: false,
    active: true,
    created_by: OWNER_A_ID,
    created_at: stamp(48),
    updated_at: stamp(48),
    archived_at: null,
  };

  const resin: InventoryItem = {
    id: "inv-a-resin",
    clinic_id: CLINIC_A_ID,
    name: "Resina A2",
    category: "Restaurador",
    purchase_unit: "seringa",
    consumption_unit: "g",
    units_per_purchase_unit: 4,
    current_quantity: 12.5,
    minimum_quantity: 4,
    average_unit_cost_cents: 2250, // R$ 22,50/g — seringa R$ 90 / 4 g
    last_purchase_cost_cents: 2250,
    supplier_name: "3M Dental",
    tracks_lot: true,
    tracks_expiration: true,
    active: true,
    created_by: OWNER_A_ID,
    created_at: stamp(40),
    updated_at: stamp(40),
    archived_at: null,
  };

  const anesthetic: InventoryItem = {
    id: "inv-a-anesthetic",
    clinic_id: CLINIC_A_ID,
    name: "Anestésico",
    category: "Anestesia",
    purchase_unit: "caixa",
    consumption_unit: "tubete",
    units_per_purchase_unit: 50,
    current_quantity: 45,
    minimum_quantity: 15,
    average_unit_cost_cents: 320,
    last_purchase_cost_cents: 320,
    supplier_name: null,
    tracks_lot: true,
    tracks_expiration: true,
    active: true,
    created_by: OWNER_A_ID,
    created_at: stamp(36),
    updated_at: stamp(36),
    archived_at: null,
  };

  const needle: InventoryItem = {
    id: "inv-a-needle",
    clinic_id: CLINIC_A_ID,
    name: "Agulha gengival",
    category: "Descartável",
    purchase_unit: "caixa",
    consumption_unit: "un",
    units_per_purchase_unit: 100,
    current_quantity: 90,
    minimum_quantity: 20,
    average_unit_cost_cents: 25,
    last_purchase_cost_cents: 25,
    supplier_name: null,
    tracks_lot: false,
    tracks_expiration: false,
    active: true,
    created_by: OWNER_A_ID,
    created_at: stamp(36),
    updated_at: stamp(36),
    archived_at: null,
  };

  // Clinic B — isolado
  const resinB: InventoryItem = {
    id: "inv-b-resin",
    clinic_id: CLINIC_B_ID,
    name: "Resina B1 (Clinic B)",
    category: "Restaurador",
    purchase_unit: "seringa",
    consumption_unit: "g",
    units_per_purchase_unit: 4,
    current_quantity: 8,
    minimum_quantity: 2,
    average_unit_cost_cents: 2000,
    last_purchase_cost_cents: 2000,
    supplier_name: null,
    tracks_lot: false,
    tracks_expiration: false,
    active: true,
    created_by: DENTIST_B_ID,
    created_at: stamp(20),
    updated_at: stamp(20),
    archived_at: null,
  };

  const restoration: Procedure = {
    id: "proc-a-restoration",
    clinic_id: CLINIC_A_ID,
    name: "Restauração em resina",
    description: "Restauração direta em resina composta",
    category: "Restaurador",
    default_duration_minutes: 45,
    default_price_cents: 35000,
    active: true,
    created_by: OWNER_A_ID,
    created_at: stamp(30),
    updated_at: stamp(30),
    archived_at: null,
  };

  const prophylaxis: Procedure = {
    id: "proc-a-prophylaxis",
    clinic_id: CLINIC_A_ID,
    name: "Profilaxia",
    description: "Limpeza e profilaxia",
    category: "Preventivo",
    default_duration_minutes: 30,
    default_price_cents: 18000,
    active: true,
    created_by: OWNER_A_ID,
    created_at: stamp(28),
    updated_at: stamp(28),
    archived_at: null,
  };

  const evaluation: Procedure = {
    id: "proc-a-eval",
    clinic_id: CLINIC_A_ID,
    name: "Avaliação",
    description: null,
    category: "Consulta",
    default_duration_minutes: 20,
    default_price_cents: 10000,
    active: true,
    created_by: OWNER_A_ID,
    created_at: stamp(26),
    updated_at: stamp(26),
    archived_at: null,
  };

  const procB: Procedure = {
    id: "proc-b-whitening",
    clinic_id: CLINIC_B_ID,
    name: "Clareamento (Clinic B)",
    description: null,
    category: "Estética",
    default_duration_minutes: 60,
    default_price_cents: 80000,
    active: true,
    created_by: DENTIST_B_ID,
    created_at: stamp(18),
    updated_at: stamp(18),
    archived_at: null,
  };

  const materials: ProcedureMaterial[] = [
    {
      id: "pm-a-rest-gloves",
      clinic_id: CLINIC_A_ID,
      procedure_id: restoration.id,
      inventory_item_id: gloves.id,
      standard_quantity: 2,
      consumption_unit: "un",
      consumption_mode: "per_procedure",
      optional: false,
      notes: null,
      created_at: stamp(29),
      updated_at: stamp(29),
    },
    {
      id: "pm-a-rest-mask",
      clinic_id: CLINIC_A_ID,
      procedure_id: restoration.id,
      inventory_item_id: mask.id,
      standard_quantity: 1,
      consumption_unit: "un",
      consumption_mode: "per_appointment",
      optional: false,
      notes: "EPI compartilhado no atendimento",
      created_at: stamp(29),
      updated_at: stamp(29),
    },
    {
      id: "pm-a-rest-resin",
      clinic_id: CLINIC_A_ID,
      procedure_id: restoration.id,
      inventory_item_id: resin.id,
      standard_quantity: 0.3,
      consumption_unit: "g",
      consumption_mode: "per_unit",
      optional: false,
      notes: null,
      created_at: stamp(29),
      updated_at: stamp(29),
    },
    {
      id: "pm-a-rest-anest",
      clinic_id: CLINIC_A_ID,
      procedure_id: restoration.id,
      inventory_item_id: anesthetic.id,
      standard_quantity: 1,
      consumption_unit: "tubete",
      consumption_mode: "per_procedure",
      optional: false,
      notes: null,
      created_at: stamp(29),
      updated_at: stamp(29),
    },
    {
      id: "pm-a-rest-needle",
      clinic_id: CLINIC_A_ID,
      procedure_id: restoration.id,
      inventory_item_id: needle.id,
      standard_quantity: 1,
      consumption_unit: "un",
      consumption_mode: "per_procedure",
      optional: false,
      notes: null,
      created_at: stamp(29),
      updated_at: stamp(29),
    },
    {
      id: "pm-a-proph-gloves",
      clinic_id: CLINIC_A_ID,
      procedure_id: prophylaxis.id,
      inventory_item_id: gloves.id,
      standard_quantity: 2,
      consumption_unit: "un",
      consumption_mode: "per_procedure",
      optional: false,
      notes: null,
      created_at: stamp(27),
      updated_at: stamp(27),
    },
    {
      id: "pm-a-proph-mask",
      clinic_id: CLINIC_A_ID,
      procedure_id: prophylaxis.id,
      inventory_item_id: mask.id,
      standard_quantity: 1,
      consumption_unit: "un",
      consumption_mode: "per_appointment",
      optional: false,
      notes: null,
      created_at: stamp(27),
      updated_at: stamp(27),
    },
    {
      id: "pm-b-whitening-resin",
      clinic_id: CLINIC_B_ID,
      procedure_id: procB.id,
      inventory_item_id: resinB.id,
      standard_quantity: 0.5,
      consumption_unit: "g",
      consumption_mode: "per_procedure",
      optional: false,
      notes: null,
      created_at: stamp(17),
      updated_at: stamp(17),
    },
  ];

  return {
    procedures: [restoration, prophylaxis, evaluation, procB],
    inventoryItems: [gloves, mask, resin, anesthetic, needle, resinB],
    procedureMaterials: materials,
  };
}

export function getInventoryStore(): Store {
  if (!globalThis.__sorriaInventoryStoreV1) {
    globalThis.__sorriaInventoryStoreV1 = seed();
  }
  return globalThis.__sorriaInventoryStoreV1;
}

export function resetInventoryStore() {
  globalThis.__sorriaInventoryStoreV1 = seed();
}

export function writeInventoryAudit(input: {
  clinic_id: string;
  actor_user_id: string;
  action: string;
  target_type: string;
  target_id: string;
  metadata?: Record<string, unknown>;
}) {
  appendAudit({
    clinic_id: input.clinic_id,
    actor_user_id: input.actor_user_id,
    action: input.action,
    target_type: input.target_type,
    target_id: input.target_id,
    metadata: input.metadata ?? {},
  });
}
