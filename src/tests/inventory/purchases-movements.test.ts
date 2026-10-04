import { beforeEach, describe, expect, it } from "vitest";
import { can } from "@/lib/authz/can";
import {
  CLINIC_A_ID,
  CLINIC_B_ID,
  DENTIST_A_ID,
  OWNER_A_ID,
  SECRETARY_A_ID,
  resetAuthzStore,
  setDemoSession,
} from "@/lib/demo/authz-store";
import { resetInventoryStore } from "@/lib/demo/inventory-store";
import { purchaseCostToConsumptionUnitCents } from "@/lib/inventory/units";
import {
  adjustInventory,
  calculateInventoryValue,
  cancelInventoryPurchase,
  canViewInventoryCosts,
  createInventoryItem,
  createInventoryPurchase,
  getInventoryItem,
  getInventoryMovements,
  registerCorrection,
  registerInitialStock,
  registerLoss,
} from "@/services/inventory";
import { calculateProcedureStandardCost } from "@/services/procedures";

beforeEach(() => {
  resetAuthzStore();
  resetInventoryStore();
  setDemoSession(OWNER_A_ID, CLINIC_A_ID);
});

const ownerA = { userId: OWNER_A_ID, clinicId: CLINIC_A_ID };
const dentistA = { userId: DENTIST_A_ID, clinicId: CLINIC_A_ID };

describe("compra simples — luvas", () => {
  it("2 caixas × 100 / R$ 80 → +200 un · R$ 0,40/un", () => {
    const item = createInventoryItem(ownerA, {
      name: "Luva teste",
      purchase_unit: "caixa",
      consumption_unit: "un",
      units_per_purchase_unit: 100,
    });
    expect(item.current_quantity).toBe(0);

    createInventoryPurchase(ownerA, {
      purchase_date: "2026-10-04",
      items: [
        {
          inventory_item_id: item.id,
          purchase_quantity: 2,
          units_per_purchase_unit: 100,
          total_cost_reais: 80,
        },
      ],
    });

    const updated = getInventoryItem(ownerA, item.id);
    expect(updated.current_quantity).toBe(200);
    expect(updated.average_unit_cost_cents).toBe(40);

    const movs = getInventoryMovements(ownerA, {
      inventoryItemId: item.id,
      movementType: "purchase",
    });
    expect(movs[0].quantity_delta).toBe(200);
  });
});

describe("compra resina", () => {
  it("2 seringas × 4 g / R$ 180 → +8 g · R$ 22,50/g", () => {
    const item = createInventoryItem(ownerA, {
      name: "Resina teste",
      purchase_unit: "seringa",
      consumption_unit: "g",
      units_per_purchase_unit: 4,
    });
    createInventoryPurchase(ownerA, {
      purchase_date: "2026-10-04",
      items: [
        {
          inventory_item_id: item.id,
          purchase_quantity: 2,
          units_per_purchase_unit: 4,
          total_cost_reais: 180,
        },
      ],
    });
    const updated = getInventoryItem(ownerA, item.id);
    expect(updated.current_quantity).toBe(8);
    expect(updated.average_unit_cost_cents).toBe(2250);
    expect(purchaseCostToConsumptionUnitCents({
      purchaseTotalReais: 90,
      purchaseQuantity: 1,
      unitsPerPurchaseUnit: 4,
    })).toBe(2250);
  });
});

describe("custo médio ponderado", () => {
  it("10×R$5 + 10×R$7 → 20 × R$6", () => {
    const item = createInventoryItem(ownerA, {
      name: "Item médio",
      purchase_unit: "un",
      consumption_unit: "un",
      units_per_purchase_unit: 1,
    });
    registerInitialStock(ownerA, {
      inventory_item_id: item.id,
      quantity: 10,
      unit_cost_reais: 5,
    });
    createInventoryPurchase(ownerA, {
      purchase_date: "2026-10-04",
      items: [
        {
          inventory_item_id: item.id,
          purchase_quantity: 10,
          units_per_purchase_unit: 1,
          total_cost_reais: 70,
        },
      ],
    });
    const mid = getInventoryItem(ownerA, item.id);
    expect(mid.current_quantity).toBe(20);
    expect(mid.average_unit_cost_cents).toBe(600);

    createInventoryPurchase(ownerA, {
      purchase_date: "2026-10-05",
      items: [
        {
          inventory_item_id: item.id,
          purchase_quantity: 10,
          units_per_purchase_unit: 1,
          total_cost_reais: 90,
        },
      ],
    });
    const end = getInventoryItem(ownerA, item.id);
    expect(end.current_quantity).toBe(30);
    expect(end.average_unit_cost_cents).toBe(700);
  });
});

describe("estoque inicial e ajuste", () => {
  it("initial_balance 50 × R$2", () => {
    const item = createInventoryItem(ownerA, {
      name: "Gaze init",
      purchase_unit: "un",
      consumption_unit: "un",
      units_per_purchase_unit: 1,
    });
    registerInitialStock(ownerA, {
      inventory_item_id: item.id,
      quantity: 50,
      unit_cost_reais: 2,
    });
    const updated = getInventoryItem(ownerA, item.id);
    expect(updated.current_quantity).toBe(50);
    expect(updated.average_unit_cost_cents).toBe(200);
    const movs = getInventoryMovements(ownerA, {
      inventoryItemId: item.id,
      movementType: "initial_balance",
    });
    expect(movs).toHaveLength(1);
  });

  it("ajuste 50 → 47 gera -3", () => {
    const item = createInventoryItem(ownerA, {
      name: "Ajuste",
      purchase_unit: "un",
      consumption_unit: "un",
      units_per_purchase_unit: 1,
    });
    registerInitialStock(ownerA, {
      inventory_item_id: item.id,
      quantity: 50,
      unit_cost_reais: 1,
    });
    const { movement } = adjustInventory(ownerA, {
      inventory_item_id: item.id,
      counted_quantity: 47,
      reason: "contagem_fisica",
    });
    expect(movement.quantity_delta).toBe(-3);
    expect(getInventoryItem(ownerA, item.id).current_quantity).toBe(47);
  });
});

describe("correção e cancelamento", () => {
  it("mantém histórico +100 e correção -20", () => {
    const item = createInventoryItem(ownerA, {
      name: "Corr",
      purchase_unit: "un",
      consumption_unit: "un",
      units_per_purchase_unit: 1,
    });
    registerInitialStock(ownerA, {
      inventory_item_id: item.id,
      quantity: 100,
      unit_cost_reais: 1,
    });
    registerCorrection(ownerA, {
      inventory_item_id: item.id,
      quantity_delta: -20,
      reason: "Entrada incorreta",
    });
    expect(getInventoryItem(ownerA, item.id).current_quantity).toBe(80);
    const movs = getInventoryMovements(ownerA, { inventoryItemId: item.id });
    expect(movs.some((m) => m.quantity_delta === 100)).toBe(true);
    expect(movs.some((m) => m.quantity_delta === -20)).toBe(true);
  });

  it("cancelar compra gera movimento compensatório", () => {
    const item = createInventoryItem(ownerA, {
      name: "Cancel",
      purchase_unit: "un",
      consumption_unit: "un",
      units_per_purchase_unit: 1,
    });
    const { purchase } = createInventoryPurchase(ownerA, {
      purchase_date: "2026-10-04",
      items: [
        {
          inventory_item_id: item.id,
          purchase_quantity: 100,
          units_per_purchase_unit: 1,
          total_cost_reais: 100,
        },
      ],
    });
    expect(getInventoryItem(ownerA, item.id).current_quantity).toBe(100);
    cancelInventoryPurchase(ownerA, {
      id: purchase.id,
      cancellation_reason: "Registro duplicado",
    });
    expect(getInventoryItem(ownerA, item.id).current_quantity).toBe(0);
    expect(purchase.cancelled_at).toBeTruthy();
    const movs = getInventoryMovements(ownerA, { inventoryItemId: item.id });
    expect(movs.some((m) => m.movement_type === "purchase")).toBe(true);
    expect(movs.some((m) => m.movement_type === "correction")).toBe(true);
  });
});

describe("perda", () => {
  it("registra saída negativa", () => {
    const item = createInventoryItem(ownerA, {
      name: "Perda",
      purchase_unit: "tubete",
      consumption_unit: "tubete",
      units_per_purchase_unit: 1,
    });
    registerInitialStock(ownerA, {
      inventory_item_id: item.id,
      quantity: 10,
      unit_cost_reais: 3,
    });
    registerLoss(ownerA, {
      inventory_item_id: item.id,
      quantity: 5,
      notes: "Tubetes danificados",
    });
    expect(getInventoryItem(ownerA, item.id).current_quantity).toBe(5);
  });
});

describe("tenant e permissões", () => {
  it("Clinic A não compra item da Clinic B", () => {
    expect(() =>
      createInventoryPurchase(ownerA, {
        purchase_date: "2026-10-04",
        items: [
          {
            inventory_item_id: "inv-b-resin",
            purchase_quantity: 1,
            units_per_purchase_unit: 4,
            total_cost_reais: 90,
          },
        ],
      }),
    ).toThrow("INVENTORY_ITEM_NOT_FOUND");
  });

  it("dentist vê quantidade sem inventory.cost_view", () => {
    expect(can(dentistA, "inventory.view").allowed).toBe(true);
    expect(can(dentistA, "inventory.cost_view").allowed).toBe(false);
    expect(canViewInventoryCosts(dentistA)).toBe(false);
    setDemoSession(DENTIST_A_ID, CLINIC_A_ID);
    const gloves = getInventoryItem(dentistA, "inv-a-gloves");
    expect(gloves.current_quantity).toBeGreaterThan(0);
    expect(() => calculateInventoryValue(dentistA)).toThrow(
      "AUTHORIZATION_DENIED",
    );
  });

  it("secretary tem cost_view e purchase_create", () => {
    const sec = { userId: SECRETARY_A_ID, clinicId: CLINIC_A_ID };
    expect(can(sec, "inventory.cost_view").allowed).toBe(true);
    expect(can(sec, "inventory.purchase_create").allowed).toBe(true);
  });
});

describe("concorrência e precisão", () => {
  it("duas compras sequenciais no mesmo item mantêm saldo e médio", () => {
    const item = createInventoryItem(ownerA, {
      name: "Conc",
      purchase_unit: "un",
      consumption_unit: "un",
      units_per_purchase_unit: 1,
    });
    createInventoryPurchase(ownerA, {
      purchase_date: "2026-10-04",
      items: [
        {
          inventory_item_id: item.id,
          purchase_quantity: 10,
          units_per_purchase_unit: 1,
          total_cost_reais: 50,
        },
      ],
    });
    createInventoryPurchase(ownerA, {
      purchase_date: "2026-10-04",
      items: [
        {
          inventory_item_id: item.id,
          purchase_quantity: 10,
          units_per_purchase_unit: 1,
          total_cost_reais: 70,
        },
      ],
    });
    const end = getInventoryItem(ownerA, item.id);
    expect(end.current_quantity).toBe(20);
    expect(end.average_unit_cost_cents).toBe(600);
  });

  it("0,25 g × R$ 22,50/g continua calculável", () => {
    const unit = 2250;
    expect(Math.round(0.25 * unit)).toBe(563); // R$ 5,63
  });
});

describe("custo padrão atual reflete médio novo", () => {
  it("após compra de resina, custo padrão da restauração sobe", () => {
    const before = calculateProcedureStandardCost(
      ownerA,
      "proc-a-restoration",
    );
    const resinLineBefore = before.lines.find(
      (l) => l.item_name === "Resina A2",
    )!;
    expect(resinLineBefore.average_unit_cost_cents).toBe(2250);

    createInventoryPurchase(ownerA, {
      purchase_date: "2026-10-04",
      items: [
        {
          inventory_item_id: "inv-a-resin",
          purchase_quantity: 2,
          units_per_purchase_unit: 4,
          total_cost_reais: 240, // 8g × R$30 = R$30/g = 3000 cents
        },
      ],
    });

    const resin = getInventoryItem(ownerA, "inv-a-resin");
    // (12.5*2250 + 8*3000) / 20.5
    const expected = Math.round((12.5 * 2250 + 8 * 3000) / 20.5);
    expect(resin.average_unit_cost_cents).toBe(expected);

    const after = calculateProcedureStandardCost(
      ownerA,
      "proc-a-restoration",
    );
    const resinLineAfter = after.lines.find(
      (l) => l.item_name === "Resina A2",
    )!;
    expect(resinLineAfter.average_unit_cost_cents).toBe(expected);
    expect(resinLineAfter.planned_cost_cents).toBe(
      Math.round(0.3 * expected),
    );
  });
});

describe("sem alteração silenciosa de saldo no update", () => {
  it("updateInventoryItem não muda quantity/cost", async () => {
    const { updateInventoryItem } = await import("@/services/inventory");
    const before = getInventoryItem(ownerA, "inv-a-gloves");
    updateInventoryItem(ownerA, {
      id: before.id,
      name: before.name,
      purchase_unit: before.purchase_unit,
      consumption_unit: before.consumption_unit,
      units_per_purchase_unit: before.units_per_purchase_unit,
      current_quantity: 9999,
      average_unit_cost_reais: 99,
    });
    const after = getInventoryItem(ownerA, before.id);
    expect(after.current_quantity).toBe(before.current_quantity);
    expect(after.average_unit_cost_cents).toBe(before.average_unit_cost_cents);
  });
});

describe("cross-clinic UUID isolado", () => {
  it("owner A não lista compra/movimento de B", () => {
    const movs = getInventoryMovements(ownerA);
    expect(movs.every((m) => m.clinic_id === CLINIC_A_ID)).toBe(true);
    expect(movs.every((m) => m.clinic_id !== CLINIC_B_ID)).toBe(true);
  });
});
