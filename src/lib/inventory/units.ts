import { reaisToCents } from "@/lib/money";
import type { InventoryUnit } from "@/types/inventory";

/**
 * Converte custo de 1 unidade de compra → custo por unidade de consumo (centavos).
 *
 * Ex.: caixa R$ 40 com 100 un → 40 cents/un
 * Ex.: seringa R$ 90 com 4 g → 2250 cents/g
 */
export function purchaseCostToConsumptionUnitCents(input: {
  purchaseTotalReais: number;
  purchaseQuantity: number;
  unitsPerPurchaseUnit: number;
}): number {
  const { purchaseTotalReais, purchaseQuantity, unitsPerPurchaseUnit } = input;
  if (purchaseQuantity <= 0 || unitsPerPurchaseUnit <= 0) {
    throw new Error("Conversão de unidade inválida");
  }
  const totalCents = reaisToCents(purchaseTotalReais);
  const consumptionUnits = purchaseQuantity * unitsPerPurchaseUnit;
  return Math.round(totalCents / consumptionUnits);
}

/** Custo de uma quantidade de consumo (centavos), arredondado. */
export function consumptionCostCents(
  quantity: number,
  averageUnitCostCents: number,
): number {
  if (quantity < 0 || averageUnitCostCents < 0) return 0;
  return Math.round(quantity * averageUnitCostCents);
}

/**
 * Quantidade prevista conforme consumption_mode.
 * quantity = número de performed procedure units (ex.: 3 restaurações).
 * procedureCount no mesmo appointment para per_appointment (sempre 1 máscara).
 */
export function plannedQuantityForMode(input: {
  standardQuantity: number;
  mode: "per_appointment" | "per_procedure" | "per_unit" | "manual";
  procedureQuantity: number;
  /** Para per_appointment: se já contabilizado neste atendimento, retorna 0 */
  alreadyCountedInAppointment?: boolean;
}): number {
  const {
    standardQuantity,
    mode,
    procedureQuantity,
    alreadyCountedInAppointment,
  } = input;
  if (mode === "manual") return standardQuantity;
  if (mode === "per_appointment") {
    return alreadyCountedInAppointment ? 0 : standardQuantity;
  }
  if (mode === "per_procedure") {
    return standardQuantity; // uma linha de performed_procedure
  }
  // per_unit
  return standardQuantity * Math.max(1, procedureQuantity);
}

export function assertCompatibleUnits(
  purchaseUnit: InventoryUnit,
  consumptionUnit: InventoryUnit,
  unitsPerPurchaseUnit: number,
) {
  if (unitsPerPurchaseUnit <= 0) {
    throw new Error("units_per_purchase_unit deve ser > 0");
  }
  if (purchaseUnit === consumptionUnit && unitsPerPurchaseUnit !== 1) {
    throw new Error(
      "Quando compra e consumo usam a mesma unidade, a conversão deve ser 1",
    );
  }
}

/** Custo médio ponderado em centavos/unidade de consumo. */
export function weightedAverageUnitCostCents(input: {
  currentQty: number;
  currentAvgCents: number;
  incomingQty: number;
  incomingUnitCostCents: number;
}): number {
  const { currentQty, currentAvgCents, incomingQty, incomingUnitCostCents } =
    input;
  if (incomingQty < 0) throw new Error("Quantidade de entrada inválida");
  const totalQty = currentQty + incomingQty;
  if (totalQty <= 0) return incomingUnitCostCents;
  return Math.round(
    (currentQty * currentAvgCents + incomingQty * incomingUnitCostCents) /
      totalQty,
  );
}
