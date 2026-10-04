import {
  CLINIC_A_ID,
  CLINIC_B_ID,
  OWNER_A_ID,
  DENTIST_B_ID,
  appendAudit,
} from "@/lib/demo/authz-store";
import type {
  InventoryItem,
  InventoryLot,
  InventoryMovement,
  InventoryPurchase,
  InventoryPurchaseItem,
  Procedure,
  ProcedureMaterial,
} from "@/types/inventory";

export type InventoryStore = {
  procedures: Procedure[];
  inventoryItems: InventoryItem[];
  procedureMaterials: ProcedureMaterial[];
  purchases: InventoryPurchase[];
  purchaseItems: InventoryPurchaseItem[];
  movements: InventoryMovement[];
  lots: InventoryLot[];
  /** Serializa atualizações por item (concorrência demo). */
  itemLocks: Map<string, number>;
};

declare global {
  var __sorriaInventoryStoreV2: InventoryStore | undefined;
}

function stamp(h = 0) {
  return new Date(Date.now() - h * 3600_000).toISOString();
}

function seed(): InventoryStore {
  const gloves: InventoryItem = {
    id: "inv-a-gloves",
    clinic_id: CLINIC_A_ID,
    name: "Luva",
    category: "EPI",
    purchase_unit: "caixa",
    consumption_unit: "un",
    units_per_purchase_unit: 100,
    current_quantity: 200,
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
    source_material_template_id: "mt-luva",
  };

  const mask: InventoryItem = {
    id: "inv-a-mask",
    clinic_id: CLINIC_A_ID,
    name: "Máscara",
    category: "EPI",
    purchase_unit: "caixa",
    consumption_unit: "un",
    units_per_purchase_unit: 50,
    current_quantity: 100,
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
    source_material_template_id: "mt-mascara",
  };

  const resin: InventoryItem = {
    id: "inv-a-resin",
    clinic_id: CLINIC_A_ID,
    name: "Resina A2",
    category: "Restaurador",
    purchase_unit: "seringa",
    consumption_unit: "g",
    units_per_purchase_unit: 4,
    current_quantity: 20,
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
    source_material_template_id: "mt-resina",
  };

  const anesthetic: InventoryItem = {
    id: "inv-a-anesthetic",
    clinic_id: CLINIC_A_ID,
    name: "Anestésico",
    category: "Anestesia",
    purchase_unit: "caixa",
    consumption_unit: "tubete",
    units_per_purchase_unit: 50,
    current_quantity: 50,
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
    source_material_template_id: "mt-anestesioco",
  };

  const needle: InventoryItem = {
    id: "inv-a-needle",
    clinic_id: CLINIC_A_ID,
    name: "Agulha",
    category: "Descartável",
    purchase_unit: "caixa",
    consumption_unit: "un",
    units_per_purchase_unit: 100,
    current_quantity: 50,
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
    source_material_template_id: "mt-agulha-curta",
  };

  const acid: InventoryItem = {
    id: "inv-a-acid",
    clinic_id: CLINIC_A_ID,
    name: "Ácido fosfórico",
    category: "Restaurador",
    purchase_unit: "seringa",
    consumption_unit: "ml",
    units_per_purchase_unit: 3,
    current_quantity: 15,
    minimum_quantity: 3,
    average_unit_cost_cents: 800,
    last_purchase_cost_cents: 800,
    supplier_name: null,
    tracks_lot: false,
    tracks_expiration: true,
    active: true,
    created_by: OWNER_A_ID,
    created_at: stamp(35),
    updated_at: stamp(35),
    archived_at: null,
    source_material_template_id: "mt-acido",
  };

  const adhesive: InventoryItem = {
    id: "inv-a-adhesive",
    clinic_id: CLINIC_A_ID,
    name: "Adesivo",
    category: "Restaurador",
    purchase_unit: "frasco",
    consumption_unit: "ml",
    units_per_purchase_unit: 5,
    current_quantity: 10,
    minimum_quantity: 2,
    average_unit_cost_cents: 1200,
    last_purchase_cost_cents: 1200,
    supplier_name: null,
    tracks_lot: false,
    tracks_expiration: true,
    active: true,
    created_by: OWNER_A_ID,
    created_at: stamp(35),
    updated_at: stamp(35),
    archived_at: null,
    source_material_template_id: "mt-adesivo",
  };

  const gauze: InventoryItem = {
    id: "inv-a-gauze",
    clinic_id: CLINIC_A_ID,
    name: "Gaze",
    category: "Descartável",
    purchase_unit: "pacote",
    consumption_unit: "un",
    units_per_purchase_unit: 100,
    current_quantity: 200,
    minimum_quantity: 40,
    average_unit_cost_cents: 15,
    last_purchase_cost_cents: 15,
    supplier_name: null,
    tracks_lot: false,
    tracks_expiration: false,
    active: true,
    created_by: OWNER_A_ID,
    created_at: stamp(34),
    updated_at: stamp(34),
    archived_at: null,
    source_material_template_id: "mt-gaze",
  };

  const microbrush: InventoryItem = {
    id: "inv-a-microbrush",
    clinic_id: CLINIC_A_ID,
    name: "Microbrush",
    category: "Descartável",
    purchase_unit: "pacote",
    consumption_unit: "un",
    units_per_purchase_unit: 100,
    current_quantity: 100,
    minimum_quantity: 20,
    average_unit_cost_cents: 20,
    last_purchase_cost_cents: 20,
    supplier_name: null,
    tracks_lot: false,
    tracks_expiration: false,
    active: true,
    created_by: OWNER_A_ID,
    created_at: stamp(34),
    updated_at: stamp(34),
    archived_at: null,
    source_material_template_id: "mt-microbrush",
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
    source_material_template_id: null,
  };

  const restoration: Procedure = {
    id: "proc-a-restoration",
    clinic_id: CLINIC_A_ID,
    name: "Restauração média",
    description: "Restauração direta em resina composta — média (ficha de teste V1)",
    category: "Restaurador",
    default_duration_minutes: 45,
    default_price_cents: 35000,
    active: true,
    created_by: OWNER_A_ID,
    created_at: stamp(30),
    updated_at: stamp(30),
    archived_at: null,
    source_template_id: "pt-rest-media",
    source_template_version: 1,
    favorited: true,
    use_count: 12,
    last_used_at: stamp(2),
  };

  const restorationSmall: Procedure = {
    id: "proc-a-rest-small",
    clinic_id: CLINIC_A_ID,
    name: "Restauração pequena",
    description: "Restauração direta pequena",
    category: "Restaurador",
    default_duration_minutes: 30,
    default_price_cents: 25000,
    active: true,
    created_by: OWNER_A_ID,
    created_at: stamp(30),
    updated_at: stamp(30),
    archived_at: null,
    source_template_id: null,
    source_template_version: null,
    favorited: false,
    use_count: 0,
    last_used_at: null,
  };

  const restorationLarge: Procedure = {
    id: "proc-a-rest-large",
    clinic_id: CLINIC_A_ID,
    name: "Restauração extensa",
    description: "Restauração direta extensa",
    category: "Restaurador",
    default_duration_minutes: 60,
    default_price_cents: 45000,
    active: true,
    created_by: OWNER_A_ID,
    created_at: stamp(30),
    updated_at: stamp(30),
    archived_at: null,
    source_template_id: null,
    source_template_version: null,
    favorited: false,
    use_count: 0,
    last_used_at: null,
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
    source_template_id: "pt-profilaxia",
    source_template_version: 1,
    favorited: true,
    use_count: 8,
    last_used_at: stamp(5),
  };

  const whiteningA: Procedure = {
    id: "proc-a-whitening",
    clinic_id: CLINIC_A_ID,
    name: "Clareamento",
    description: "Clareamento consultório (fictício)",
    category: "Estética",
    default_duration_minutes: 60,
    default_price_cents: 80000,
    active: true,
    created_by: OWNER_A_ID,
    created_at: stamp(27),
    updated_at: stamp(27),
    archived_at: null,
    source_template_id: null,
    source_template_version: null,
    favorited: false,
    use_count: 0,
    last_used_at: null,
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
    source_template_id: null,
    source_template_version: null,
    favorited: false,
    use_count: 0,
    last_used_at: null,
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
    source_template_id: null,
    source_template_version: null,
    favorited: false,
    use_count: 0,
    last_used_at: null,
  };

  const materials: ProcedureMaterial[] = [
    {
      id: "pm-a-rest-gloves",
      clinic_id: CLINIC_A_ID,
      procedure_id: restoration.id,
      inventory_item_id: gloves.id,
      standard_quantity: 2,
      consumption_unit: "un",
      consumption_mode: "per_appointment",
      optional: false,
      notes: "EPI compartilhado no atendimento",
      clinically_variable: false,
      source_material_template_id: null,
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
      clinically_variable: false,
      source_material_template_id: null,
      created_at: stamp(29),
      updated_at: stamp(29),
    },
    {
      id: "pm-a-rest-resin",
      clinic_id: CLINIC_A_ID,
      procedure_id: restoration.id,
      inventory_item_id: resin.id,
      standard_quantity: 0.35,
      consumption_unit: "g",
      consumption_mode: "per_unit",
      optional: false,
      notes: null,
      clinically_variable: false,
      source_material_template_id: null,
      created_at: stamp(29),
      updated_at: stamp(29),
    },
    {
      id: "pm-a-rest-acid",
      clinic_id: CLINIC_A_ID,
      procedure_id: restoration.id,
      inventory_item_id: acid.id,
      standard_quantity: 0.2,
      consumption_unit: "ml",
      consumption_mode: "per_procedure",
      optional: false,
      notes: null,
      clinically_variable: false,
      source_material_template_id: null,
      created_at: stamp(29),
      updated_at: stamp(29),
    },
    {
      id: "pm-a-rest-adhesive",
      clinic_id: CLINIC_A_ID,
      procedure_id: restoration.id,
      inventory_item_id: adhesive.id,
      standard_quantity: 0.1,
      consumption_unit: "ml",
      consumption_mode: "per_procedure",
      optional: false,
      notes: null,
      clinically_variable: false,
      source_material_template_id: null,
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
      clinically_variable: true,
      source_material_template_id: null,
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
      clinically_variable: true,
      source_material_template_id: null,
      created_at: stamp(29),
      updated_at: stamp(29),
    },
    {
      id: "pm-a-rest-microbrush",
      clinic_id: CLINIC_A_ID,
      procedure_id: restoration.id,
      inventory_item_id: microbrush.id,
      standard_quantity: 2,
      consumption_unit: "un",
      consumption_mode: "per_procedure",
      optional: false,
      notes: null,
      clinically_variable: false,
      source_material_template_id: null,
      created_at: stamp(29),
      updated_at: stamp(29),
    },
    {
      id: "pm-a-rest-gauze",
      clinic_id: CLINIC_A_ID,
      procedure_id: restoration.id,
      inventory_item_id: gauze.id,
      standard_quantity: 4,
      consumption_unit: "un",
      consumption_mode: "per_procedure",
      optional: false,
      notes: null,
      clinically_variable: false,
      source_material_template_id: null,
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
      consumption_mode: "per_appointment",
      optional: false,
      notes: null,
      clinically_variable: false,
      source_material_template_id: null,
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
      clinically_variable: false,
      source_material_template_id: null,
      created_at: stamp(27),
      updated_at: stamp(27),
    },
    {
      id: "pm-a-small-resin",
      clinic_id: CLINIC_A_ID,
      procedure_id: restorationSmall.id,
      inventory_item_id: resin.id,
      standard_quantity: 0.2,
      consumption_unit: "g",
      consumption_mode: "per_unit",
      optional: false,
      notes: null,
      clinically_variable: false,
      source_material_template_id: null,
      created_at: stamp(29),
      updated_at: stamp(29),
    },
    {
      id: "pm-a-large-resin",
      clinic_id: CLINIC_A_ID,
      procedure_id: restorationLarge.id,
      inventory_item_id: resin.id,
      standard_quantity: 0.5,
      consumption_unit: "g",
      consumption_mode: "per_unit",
      optional: false,
      notes: null,
      clinically_variable: false,
      source_material_template_id: null,
      created_at: stamp(29),
      updated_at: stamp(29),
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
      clinically_variable: false,
      source_material_template_id: null,
      created_at: stamp(17),
      updated_at: stamp(17),
    },
  ];

  // Histórico inicial (estoque pré-existente = initial_balance)
  const movements: InventoryMovement[] = [
    {
      id: "mov-a-gloves-init",
      clinic_id: CLINIC_A_ID,
      inventory_item_id: gloves.id,
      movement_type: "initial_balance",
      quantity_delta: 200,
      unit_cost_snapshot_cents: 40,
      resulting_quantity: 200,
      reference_type: null,
      reference_id: null,
      reason: "Carga inicial teste V1",
      created_by: OWNER_A_ID,
      created_at: stamp(48),
    },
    {
      id: "mov-a-resin-init",
      clinic_id: CLINIC_A_ID,
      inventory_item_id: resin.id,
      movement_type: "initial_balance",
      quantity_delta: 20,
      unit_cost_snapshot_cents: 2250,
      resulting_quantity: 20,
      reference_type: null,
      reference_id: null,
      reason: "Carga inicial teste V1",
      created_by: OWNER_A_ID,
      created_at: stamp(40),
    },
  ];

  const lots: InventoryLot[] = [
    {
      id: "lot-a-resin-1",
      clinic_id: CLINIC_A_ID,
      inventory_item_id: resin.id,
      lot_number: "RES-A2-2026",
      expiration_date: new Date(Date.now() + 25 * 86400_000)
        .toISOString()
        .slice(0, 10),
      quantity_received: 20,
      quantity_remaining: 20,
      unit_cost_cents: 2250,
      source_purchase_item_id: null,
      created_at: stamp(40),
    },
  ];

  return {
    procedures: [
      restoration,
      restorationSmall,
      restorationLarge,
      prophylaxis,
      whiteningA,
      evaluation,
      procB,
    ],
    inventoryItems: [
      gloves,
      mask,
      resin,
      anesthetic,
      needle,
      acid,
      adhesive,
      gauze,
      microbrush,
      resinB,
    ],
    procedureMaterials: materials,
    purchases: [],
    purchaseItems: [],
    movements,
    lots,
    itemLocks: new Map(),
  };
}

export function getInventoryStore(): InventoryStore {
  if (!globalThis.__sorriaInventoryStoreV2) {
    globalThis.__sorriaInventoryStoreV2 = seed();
  }
  return globalThis.__sorriaInventoryStoreV2;
}

export function resetInventoryStore() {
  globalThis.__sorriaInventoryStoreV2 = seed();
}

/** Lock síncrono por item — evita corrida em atualizações de saldo/custo. */
export function withItemLock<T>(itemId: string, fn: () => T): T {
  const store = getInventoryStore();
  const depth = store.itemLocks.get(itemId) ?? 0;
  store.itemLocks.set(itemId, depth + 1);
  try {
    return fn();
  } finally {
    const next = (store.itemLocks.get(itemId) ?? 1) - 1;
    if (next <= 0) store.itemLocks.delete(itemId);
    else store.itemLocks.set(itemId, next);
  }
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
