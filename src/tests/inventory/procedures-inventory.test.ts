import { beforeEach, describe, expect, it } from "vitest";
import {
  CLINIC_A_ID,
  CLINIC_B_ID,
  DENTIST_A_ID,
  OWNER_A_ID,
  OWNER_B_ID,
  SECRETARY_A_ID,
  resetAuthzStore,
  setDemoSession,
} from "@/lib/demo/authz-store";
import { resetInventoryStore } from "@/lib/demo/inventory-store";
import { can } from "@/lib/authz/can";
import {
  addProcedureMaterial,
  calculateAppointmentPlannedConsumption,
  calculateProcedureStandardConsumption,
  calculateProcedureStandardCost,
  createProcedure,
  getProcedure,
  listProcedures,
} from "@/services/procedures";
import {
  createInventoryItem,
  getInventoryItem,
  listInventoryItems,
} from "@/services/inventory";

beforeEach(() => {
  resetAuthzStore();
  resetInventoryStore();
  setDemoSession(OWNER_A_ID, CLINIC_A_ID);
});

const ownerA = { userId: OWNER_A_ID, clinicId: CLINIC_A_ID };
const ownerB = { userId: OWNER_B_ID, clinicId: CLINIC_B_ID };
const dentistA = { userId: DENTIST_A_ID, clinicId: CLINIC_A_ID };
const secretaryA = { userId: SECRETARY_A_ID, clinicId: CLINIC_A_ID };

describe("procedures CRUD", () => {
  it("lista, cria, edita e arquiva na Clinic A", async () => {
    const before = listProcedures(ownerA);
    expect(before.some((p) => p.name === "Restauração em resina")).toBe(true);

    const created = createProcedure(ownerA, {
      name: "Extração simples",
      category: "Cirurgia",
      default_duration_minutes: 40,
      default_price_reais: 250,
    });
    expect(created.default_price_cents).toBe(25000);
    expect(created.clinic_id).toBe(CLINIC_A_ID);

    const { updateProcedure, archiveProcedure } =
      await import("@/services/procedures");
    const updated = updateProcedure(ownerA, {
      id: created.id,
      name: "Extração simples",
      default_price_reais: 280,
    });
    expect(updated.default_price_cents).toBe(28000);

    const archived = archiveProcedure(ownerA, { id: created.id });
    expect(archived.active).toBe(false);
    expect(listProcedures(ownerA).find((p) => p.id === created.id)).toBe(
      undefined,
    );
  });
});

describe("inventory CRUD + conversão", () => {
  it("cria item com compra caixa → consumo un", () => {
    const item = createInventoryItem(ownerA, {
      name: "Gaze estéril",
      purchase_unit: "caixa",
      consumption_unit: "un",
      units_per_purchase_unit: 100,
      current_quantity: 200,
      average_unit_cost_reais: 0.4,
    });
    expect(item.average_unit_cost_cents).toBe(40);
    expect(listInventoryItems(ownerA).some((i) => i.id === item.id)).toBe(
      true,
    );
  });

  it("custo padrão da restauração inclui resina 0,30 g × R$ 22,50", () => {
    const cost = calculateProcedureStandardCost(
      ownerA,
      "proc-a-restoration",
    );
    const resin = cost.lines.find((l) => l.item_name === "Resina A2");
    expect(resin).toBeTruthy();
    expect(resin!.standard_quantity).toBe(0.3);
    expect(resin!.planned_cost_cents).toBe(675);
    expect(cost.materials_cost_cents).toBeGreaterThan(675);
    expect(cost.default_price_cents).toBe(35000);
    expect(cost.gross_result_cents).toBe(
      35000 - cost.materials_cost_cents,
    );
    expect(cost.margin_percent).not.toBeNull();
  });
});

describe("per_unit e per_appointment no atendimento", () => {
  it("3 restaurações → 0,90 g de resina", () => {
    const lines = calculateProcedureStandardConsumption(
      ownerA,
      "proc-a-restoration",
      3,
    );
    const resin = lines.find((l) => l.item_name === "Resina A2");
    expect(resin!.planned_quantity).toBeCloseTo(0.9);
    expect(resin!.planned_cost_cents).toBe(2025); // 0.9 * 2250
  });

  it("profilaxia + 2 restaurações: 1 máscara (per_appointment)", () => {
    const agg = calculateAppointmentPlannedConsumption(ownerA, [
      { procedureId: "proc-a-prophylaxis", quantity: 1 },
      { procedureId: "proc-a-restoration", quantity: 1 },
      { procedureId: "proc-a-restoration", quantity: 1 },
    ]);
    const mask = agg.find((l) => l.item_name === "Máscara cirúrgica");
    expect(mask).toBeTruthy();
    expect(mask!.planned_quantity).toBe(1);
  });
});

describe("tenant isolation", () => {
  it("Clinic A não lista procedure/inventory/material de Clinic B", () => {
    const procs = listProcedures(ownerA);
    expect(procs.every((p) => p.clinic_id === CLINIC_A_ID)).toBe(true);
    expect(procs.some((p) => p.id === "proc-b-whitening")).toBe(false);

    const items = listInventoryItems(ownerA);
    expect(items.every((i) => i.clinic_id === CLINIC_A_ID)).toBe(true);
    expect(items.some((i) => i.id === "inv-b-resin")).toBe(false);

    expect(() => getProcedure(ownerA, "proc-b-whitening")).toThrow(
      "PROCEDURE_NOT_FOUND",
    );
    expect(() => getInventoryItem(ownerA, "inv-b-resin")).toThrow(
      "INVENTORY_ITEM_NOT_FOUND",
    );
  });

  it("bloqueia procedure A + inventory item B", () => {
    expect(() =>
      addProcedureMaterial(ownerA, {
        procedure_id: "proc-a-restoration",
        inventory_item_id: "inv-b-resin",
        standard_quantity: 1,
        consumption_mode: "per_procedure",
      }),
    ).toThrow();
  });

  it("Owner B acessa Clinic B, não A", () => {
    setDemoSession(OWNER_B_ID, CLINIC_B_ID);
    expect(listProcedures(ownerB).some((p) => p.id === "proc-b-whitening")).toBe(
      true,
    );
    expect(() => getProcedure(ownerB, "proc-a-restoration")).toThrow(
      "PROCEDURE_NOT_FOUND",
    );
  });
});

describe("permissions", () => {
  it("secretary vê procedimentos e estoque; sem custos internos", () => {
    expect(can(secretaryA, "procedures.view").allowed).toBe(true);
    expect(can(secretaryA, "inventory.view").allowed).toBe(true);
    expect(can(secretaryA, "procedure_costs.view").allowed).toBe(false);
    expect(can(secretaryA, "inventory.create").allowed).toBe(true);
  });

  it("dentist confirma consumo e vê custos; sem purchase_create", () => {
    expect(can(dentistA, "procedure_costs.view").allowed).toBe(true);
    expect(can(dentistA, "procedure_consumption.confirm").allowed).toBe(true);
    expect(can(dentistA, "inventory.purchase_create").allowed).toBe(false);
  });
});
