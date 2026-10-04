import { beforeEach, describe, expect, it } from "vitest";
import { can } from "@/lib/authz/can";
import {
  CLINIC_A_ID,
  CLINIC_B_ID,
  DENTIST_A_ID,
  OWNER_A_ID,
  OWNER_B_ID,
  SECRETARY_A_ID,
  getAuthzStore,
  resetAuthzStore,
  setDemoSession,
} from "@/lib/demo/authz-store";
import { getAgendaStore, resetAgendaStore } from "@/lib/demo/agenda-store";
import {
  getInventoryStore,
  resetInventoryStore,
} from "@/lib/demo/inventory-store";
import {
  getPerformedStore,
  resetPerformedStore,
} from "@/lib/demo/performed-procedures-store";
import { resetPurchaseListsStore } from "@/lib/demo/purchase-lists-store";
import { resetPlannedProceduresStore } from "@/lib/demo/planned-procedures-store";
import {
  calculateRecommendedPackages,
  calculateReplenishmentQuantity,
  calculateEstimatedPurchaseCostCents,
  surplusAfterPurchase,
  purchasedQuantityFromPackages,
  historicalDeviationPercent,
} from "@/lib/inventory/replenishment";
import { addPlannedProcedureToAppointment } from "@/services/appointment-planned-procedures";
import {
  calculateReplenishmentNeeds,
} from "@/services/inventory/replenishment";
import {
  cancelPurchaseList,
  createPurchaseFromPurchaseList,
  createPurchaseList,
  getPurchaseList,
  updatePurchaseListItem,
} from "@/services/inventory/purchase-lists";

const ownerA = { userId: OWNER_A_ID, clinicId: CLINIC_A_ID };
const secretaryA = { userId: SECRETARY_A_ID, clinicId: CLINIC_A_ID };
const dentistA = { userId: DENTIST_A_ID, clinicId: CLINIC_A_ID };
const ownerB = { userId: OWNER_B_ID, clinicId: CLINIC_B_ID };

beforeEach(() => {
  resetAuthzStore();
  resetInventoryStore();
  resetPerformedStore();
  resetPurchaseListsStore();
  resetAgendaStore();
  resetPlannedProceduresStore();
  setDemoSession(OWNER_A_ID, CLINIC_A_ID);
});

describe("Subfase 7 — fórmulas de embalagem", () => {
  it("reposição zero quando estoque cobre necessidade+mínimo", () => {
    expect(
      calculateReplenishmentQuantity({
        forecastQuantity: 10,
        minimumQuantity: 5,
        currentQuantity: 20,
      }),
    ).toBe(0);
  });

  it("reposição 7 com estoque 8, previsão 10, mínimo 5", () => {
    expect(
      calculateReplenishmentQuantity({
        forecastQuantity: 10,
        minimumQuantity: 5,
        currentQuantity: 8,
      }),
    ).toBe(7);
  });

  it("7 un / caixa 10 → 1 caixa; 11 → 2 caixas", () => {
    expect(calculateRecommendedPackages(7, 10)).toBe(1);
    expect(calculateRecommendedPackages(11, 10)).toBe(2);
  });

  it("resina 5,1 g / seringa 4 g → 2 seringas, 8 g, excedente 2,9", () => {
    const packs = calculateRecommendedPackages(5.1, 4)!;
    expect(packs).toBe(2);
    const bought = purchasedQuantityFromPackages(packs, 4);
    expect(bought).toBe(8);
    expect(surplusAfterPurchase(bought, 5.1)).toBeCloseTo(2.9);
  });

  it("custo estimado 2 × R$ 90 = R$ 180; ausente → null", () => {
    expect(calculateEstimatedPurchaseCostCents(2, 9000)).toBe(18000);
    expect(calculateEstimatedPurchaseCostCents(2, null)).toBeNull();
  });

  it("desvio histórico +30%", () => {
    expect(historicalDeviationPercent(0.39, 0.3)).toBe(30);
  });
});

describe("Subfase 7 — necessidade e cobertura", () => {
  it("cobertura da Agenda 60% com 10 consultas e 6 com procedimento", () => {
    const agenda = getAgendaStore();
    // Isola o cenário: só as 10 consultas deste teste
    agenda.appointments = agenda.appointments.filter(
      (a) => a.clinic_id !== CLINIC_A_ID,
    );
    const start = new Date();
    start.setHours(10, 0, 0, 0);
    for (let i = 0; i < 10; i++) {
      const at = new Date(start);
      at.setDate(at.getDate() + 1);
      at.setHours(9 + i, 0, 0, 0);
      agenda.appointments.push({
        id: `appt-rep-${i}`,
        clinic_id: CLINIC_A_ID,
        patient_id: "p-a-001",
        professional_id: DENTIST_A_ID,
        appointment_request_id: null,
        start_at: at.toISOString(),
        end_at: new Date(+at + 3600_000).toISOString(),
        reason: "Retorno",
        status: "scheduled",
        estimated_value: null,
        notes: null,
        created_by: OWNER_A_ID,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        cancelled_at: null,
        cancelled_by: null,
        cancellation_reason: null,
      });
    }
    for (let i = 0; i < 6; i++) {
      addPlannedProcedureToAppointment(ownerA, {
        appointment_id: `appt-rep-${i}`,
        procedure_id: "proc-a-restoration",
        quantity: 1,
      });
    }
    const summary = calculateReplenishmentNeeds(ownerA, { horizon: "7d" });
    expect(summary.appointments_eligible).toBeGreaterThanOrEqual(10);
    expect(summary.agenda_coverage_percent).toBe(60);
    expect(summary.warnings.some((w) => w.includes("60%"))).toBe(true);
  });

  it("histórico acima do previsto gera alerta sem alterar compra oficial", () => {
    const store = getPerformedStore();
    for (let i = 0; i < 5; i++) {
      store.procedureConsumptions.push({
        id: `pc-hist-${i}`,
        clinic_id: CLINIC_A_ID,
        performed_procedure_id: `pp-hist-${i}`,
        patient_id: "p-a-001",
        appointment_id: null,
        inventory_item_id: "inv-a-resin",
        item_name_snapshot: "Resina A2",
        actual_inventory_item_id: null,
        actual_item_name_snapshot: null,
        consumption_unit: "g",
        consumption_mode: "per_procedure",
        planned_quantity: 0.3,
        actual_quantity: 0.39,
        unit_cost_snapshot_cents: 2250,
        planned_cost_cents: Math.round(0.3 * 2250),
        actual_cost_cents: Math.round(0.39 * 2250),
        is_extra: false,
        status: "confirmed",
        confirmed_at: new Date().toISOString(),
        confirmed_by: OWNER_A_ID,
        inventory_movement_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }
    // força necessidade
    const resin = getInventoryStore().inventoryItems.find(
      (i) => i.id === "inv-a-resin",
    )!;
    resin.current_quantity = 4.2;
    resin.minimum_quantity = 2;

    const agenda = getAgendaStore();
    const at = new Date();
    at.setDate(at.getDate() + 2);
    agenda.appointments.push({
      id: "appt-hist-1",
      clinic_id: CLINIC_A_ID,
      patient_id: "p-a-001",
      professional_id: DENTIST_A_ID,
      appointment_request_id: null,
      start_at: at.toISOString(),
      end_at: new Date(+at + 3600_000).toISOString(),
      reason: "Restauração",
      status: "scheduled",
      estimated_value: null,
      notes: null,
      created_by: OWNER_A_ID,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      cancelled_at: null,
      cancelled_by: null,
      cancellation_reason: null,
    });
    addPlannedProcedureToAppointment(ownerA, {
      appointment_id: "appt-hist-1",
      procedure_id: "proc-a-restoration",
      tooth_number: 16,
      quantity: 1,
    });

    const summary = calculateReplenishmentNeeds(ownerA, { horizon: "7d" });
    const row = summary.items.find((i) => i.inventory_item_id === "inv-a-resin");
    expect(row).toBeTruthy();
    expect(row!.historical.reliable).toBe(true);
    expect(row!.historical.deviation_percent).toBe(30);
    expect(
      row!.warnings.some((w) => w.includes("acima do previsto")),
    ).toBe(true);
    // recomendação oficial ainda pela ficha (não pelo histórico)
    expect(row!.recommended_replenishment_quantity).toBe(
      calculateReplenishmentQuantity({
        forecastQuantity: row!.forecast_quantity,
        minimumQuantity: row!.minimum_quantity,
        currentQuantity: row!.effective_quantity,
      }),
    );
  });
});

describe("Subfase 7 — lista de compras", () => {
  it("criar lista não altera estoque", () => {
    const before = getInventoryStore().inventoryItems.find(
      (i) => i.id === "inv-a-gloves",
    )!.current_quantity;
    const gloves = getInventoryStore().inventoryItems.find(
      (i) => i.id === "inv-a-gloves",
    )!;
    gloves.current_quantity = 10;
    gloves.minimum_quantity = 50;

    const created = createPurchaseList(ownerA, {
      horizon: "7d",
      item_ids: ["inv-a-gloves"],
      package_overrides: { "inv-a-gloves": 1 },
    });
    expect(created.items.length).toBe(1);
    expect(
      getInventoryStore().inventoryItems.find((i) => i.id === "inv-a-gloves")!
        .current_quantity,
    ).toBe(10);
    expect(before).toBeGreaterThan(0);
    expect(
      getAuthzStore().auditLogs.some((a) => a.action === "purchase_list.created"),
    ).toBe(true);
  });

  it("compra a partir da lista atualiza estoque e vincula", () => {
    const gloves = getInventoryStore().inventoryItems.find(
      (i) => i.id === "inv-a-gloves",
    )!;
    gloves.current_quantity = 10;
    gloves.minimum_quantity = 50;
    const created = createPurchaseList(ownerA, {
      horizon: "7d",
      item_ids: ["inv-a-gloves"],
      package_overrides: { "inv-a-gloves": 2 },
    });
    const itemId = created.items[0]!.id;
    const before = gloves.current_quantity;

    const result = createPurchaseFromPurchaseList(ownerA, {
      purchase_list_id: created.list.id,
      purchase_date: new Date().toISOString().slice(0, 10),
      lines: [
        {
          purchase_list_item_id: itemId,
          purchase_quantity: 2,
          total_cost_reais: 80,
        },
      ],
    });

    expect(result.purchase.id).toBeTruthy();
    const after = getInventoryStore().inventoryItems.find(
      (i) => i.id === "inv-a-gloves",
    )!.current_quantity;
    expect(after).toBe(before + 200); // 2 caixas × 100
    const linked = getPurchaseList(ownerA, created.list.id).items[0]!;
    expect(linked.status).toBe("purchased");
    expect(linked.inventory_purchase_item_id).toBeTruthy();
    expect(result.list.status).toBe("completed");
    expect(
      getAuthzStore().auditLogs.some(
        (a) => a.action === "purchase_list.converted_to_purchase",
      ),
    ).toBe(true);
  });

  it("compra diferente da sugestão: lista 3, compra 2", () => {
    const gloves = getInventoryStore().inventoryItems.find(
      (i) => i.id === "inv-a-gloves",
    )!;
    gloves.current_quantity = 10;
    const created = createPurchaseList(ownerA, {
      horizon: "7d",
      item_ids: ["inv-a-gloves"],
      package_overrides: { "inv-a-gloves": 3 },
    });
    const before = gloves.current_quantity;
    createPurchaseFromPurchaseList(ownerA, {
      purchase_list_id: created.list.id,
      purchase_date: new Date().toISOString().slice(0, 10),
      lines: [
        {
          purchase_list_item_id: created.items[0]!.id,
          purchase_quantity: 2,
          total_cost_reais: 80,
        },
      ],
    });
    expect(
      getInventoryStore().inventoryItems.find((i) => i.id === "inv-a-gloves")!
        .current_quantity,
    ).toBe(before + 200);
  });

  it("compra parcial → partially_purchased", () => {
    const store = getInventoryStore();
    for (const id of [
      "inv-a-gloves",
      "inv-a-mask",
      "inv-a-needle",
      "inv-a-resin",
      "inv-a-anesthetic",
    ]) {
      const item = store.inventoryItems.find((i) => i.id === id)!;
      item.current_quantity = 1;
      item.minimum_quantity = 100;
    }
    const created = createPurchaseList(ownerA, {
      horizon: "7d",
      item_ids: [
        "inv-a-gloves",
        "inv-a-mask",
        "inv-a-needle",
        "inv-a-resin",
        "inv-a-anesthetic",
      ],
    });
    expect(created.items.length).toBe(5);
    const three = created.items.slice(0, 3);
    createPurchaseFromPurchaseList(ownerA, {
      purchase_list_id: created.list.id,
      purchase_date: new Date().toISOString().slice(0, 10),
      lines: three.map((i) => ({
        purchase_list_item_id: i.id,
        purchase_quantity: Math.max(1, i.selected_purchase_packages),
        total_cost_reais: 50,
      })),
    });
    const after = getPurchaseList(ownerA, created.list.id);
    expect(after.list.status).toBe("partially_purchased");
  });

  it("cancelar lista", () => {
    const gloves = getInventoryStore().inventoryItems.find(
      (i) => i.id === "inv-a-gloves",
    )!;
    gloves.current_quantity = 1;
    gloves.minimum_quantity = 50;
    const created = createPurchaseList(ownerA, {
      horizon: "7d",
      item_ids: ["inv-a-gloves"],
    });
    cancelPurchaseList(ownerA, created.list.id);
    expect(getPurchaseList(ownerA, created.list.id).list.status).toBe(
      "cancelled",
    );
  });

  it("atualizar quantidade selecionada na lista", () => {
    const gloves = getInventoryStore().inventoryItems.find(
      (i) => i.id === "inv-a-gloves",
    )!;
    gloves.current_quantity = 1;
    gloves.minimum_quantity = 50;
    const created = createPurchaseList(ownerA, {
      horizon: "7d",
      item_ids: ["inv-a-gloves"],
    });
    const updated = updatePurchaseListItem(ownerA, {
      purchase_list_item_id: created.items[0]!.id,
      selected_purchase_packages: 5,
    });
    expect(updated.selected_purchase_packages).toBe(5);
  });
});

describe("Subfase 7 — segurança", () => {
  it("cross-clinic: item B não entra na lista A", () => {
    expect(() =>
      createPurchaseList(ownerA, {
        horizon: "7d",
        item_ids: ["inv-b-resin"],
        package_overrides: { "inv-b-resin": 1 },
      }),
    ).toThrow();
  });

  it("Clinic B não vê necessidade da A", () => {
    const gloves = getInventoryStore().inventoryItems.find(
      (i) => i.id === "inv-a-gloves",
    )!;
    gloves.current_quantity = 1;
    gloves.minimum_quantity = 50;
    const a = calculateReplenishmentNeeds(ownerA, { horizon: "7d" });
    expect(a.items.some((i) => i.inventory_item_id === "inv-a-gloves")).toBe(
      true,
    );
    setDemoSession(OWNER_B_ID, CLINIC_B_ID);
    const b = calculateReplenishmentNeeds(ownerB, { horizon: "7d" });
    expect(b.items.some((i) => i.inventory_item_id === "inv-a-gloves")).toBe(
      false,
    );
  });

  it("sem permissão de custo: quantidades sim, preços não", () => {
    expect(can(dentistA, "inventory.replenishment_view").allowed).toBe(true);
    expect(can(dentistA, "inventory.cost_view").allowed).toBe(false);
    setDemoSession(DENTIST_A_ID, CLINIC_A_ID);
    const gloves = getInventoryStore().inventoryItems.find(
      (i) => i.id === "inv-a-gloves",
    )!;
    gloves.current_quantity = 1;
    gloves.minimum_quantity = 50;
    const summary = calculateReplenishmentNeeds(dentistA, { horizon: "7d" });
    const row = summary.items.find((i) => i.inventory_item_id === "inv-a-gloves");
    expect(row?.recommended_packages).toBeGreaterThan(0);
    expect(row?.estimated_total_cost_cents).toBeNull();
    expect(summary.estimated_list_total_cents).toBeNull();
  });

  it("secretária pode criar lista", () => {
    expect(can(secretaryA, "inventory.purchase_list_create").allowed).toBe(
      true,
    );
  });
});
