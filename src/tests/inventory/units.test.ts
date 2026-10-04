import { describe, expect, it } from "vitest";
import {
  assertCompatibleUnits,
  consumptionCostCents,
  plannedQuantityForMode,
  purchaseCostToConsumptionUnitCents,
  weightedAverageUnitCostCents,
} from "@/lib/inventory/units";

describe("conversão compra → consumo", () => {
  it("caixa R$ 40 / 100 un = R$ 0,40 por un", () => {
    const cents = purchaseCostToConsumptionUnitCents({
      purchaseTotalReais: 40,
      purchaseQuantity: 1,
      unitsPerPurchaseUnit: 100,
    });
    expect(cents).toBe(40); // 0.40 BRL
    expect(consumptionCostCents(1, cents)).toBe(40);
  });

  it("seringa R$ 90 / 4 g = R$ 22,50/g; 0,30 g = R$ 6,75", () => {
    const perGram = purchaseCostToConsumptionUnitCents({
      purchaseTotalReais: 90,
      purchaseQuantity: 1,
      unitsPerPurchaseUnit: 4,
    });
    expect(perGram).toBe(2250);
    expect(consumptionCostCents(0.3, perGram)).toBe(675);
  });
});

describe("consumption modes", () => {
  it("per_unit: 0,30 g × 3 restaurações = 0,90 g", () => {
    expect(
      plannedQuantityForMode({
        standardQuantity: 0.3,
        mode: "per_unit",
        procedureQuantity: 3,
      }),
    ).toBeCloseTo(0.9);
  });

  it("per_appointment: 1 máscara para 3 procedimentos no mesmo atendimento", () => {
    const first = plannedQuantityForMode({
      standardQuantity: 1,
      mode: "per_appointment",
      procedureQuantity: 1,
      alreadyCountedInAppointment: false,
    });
    const second = plannedQuantityForMode({
      standardQuantity: 1,
      mode: "per_appointment",
      procedureQuantity: 1,
      alreadyCountedInAppointment: true,
    });
    const third = plannedQuantityForMode({
      standardQuantity: 1,
      mode: "per_appointment",
      procedureQuantity: 1,
      alreadyCountedInAppointment: true,
    });
    expect(first + second + third).toBe(1);
  });

  it("per_procedure: quantidade padrão por linha", () => {
    expect(
      plannedQuantityForMode({
        standardQuantity: 2,
        mode: "per_procedure",
        procedureQuantity: 3,
      }),
    ).toBe(2);
  });
});

describe("unidades e custo médio", () => {
  it("rejeita conversão 1 quando unidades iguais e fator ≠ 1", () => {
    expect(() => assertCompatibleUnits("un", "un", 100)).toThrow();
  });

  it("custo médio ponderado: 10×5 + 10×7 = 6", () => {
    const avg = weightedAverageUnitCostCents({
      currentQty: 10,
      currentAvgCents: 500,
      incomingQty: 10,
      incomingUnitCostCents: 700,
    });
    expect(avg).toBe(600);
  });
});
