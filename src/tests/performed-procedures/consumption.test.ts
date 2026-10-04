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
import { resetPerformedStore } from "@/lib/demo/performed-procedures-store";
import { getPerformedStore } from "@/lib/demo/performed-procedures-store";
import { getFinanceStore, resetFinanceStore } from "@/lib/demo/finance-store";
import { getTreatmentsStore, resetTreatmentsStore } from "@/lib/demo/treatments-store";
import {
  createInventoryItem,
  getInventoryItem,
  registerInitialStock,
} from "@/services/inventory";
import {
  createPerformedProcedure,
  getPatientDirectCostSummary,
  getPerformedProcedure,
  shouldOfferFinanceCharge,
  completePerformedProcedure,
} from "@/services/performed-procedures";
import { calculateGrossResult } from "@/services/performed-procedures/costs";
import {
  addExtraConsumedMaterial,
  confirmProcedureConsumption,
  correctProcedureConsumption,
  updateActualConsumption,
} from "@/services/procedure-consumption";

beforeEach(() => {
  resetAuthzStore();
  resetInventoryStore();
  resetPerformedStore();
  resetFinanceStore();
  resetTreatmentsStore();
  setDemoSession(OWNER_A_ID, CLINIC_A_ID);
});

const ownerA = { userId: OWNER_A_ID, clinicId: CLINIC_A_ID };
const dentistA = { userId: DENTIST_A_ID, clinicId: CLINIC_A_ID };

describe("um procedimento — Mariana restauração 16", () => {
  it("previsto 0,35 g → real 0,40 g baixa 0,40 g e custo snapshot", () => {
    const beforeResin = getInventoryItem(ownerA, "inv-a-resin").current_quantity;
    const created = createPerformedProcedure(ownerA, {
      patient_id: "p-a-001",
      appointment_id: "appt-a-1",
      procedure_id: "proc-a-restoration",
      tooth_number: 16,
      quantity: 1,
      charged_amount_reais: 350,
    });
    const ppId = created.procedure.id;
    const resinLine = created.consumptions.find(
      (c) => c.item_name_snapshot === "Resina A2",
    )!;
    expect(resinLine.planned_quantity).toBeCloseTo(0.35);
    expect(resinLine.unit_cost_snapshot_cents).toBe(2250);

    updateActualConsumption(ownerA, {
      performed_procedure_id: ppId,
      lines: created.consumptions.map((c) => ({
        id: c.id,
        actual_quantity:
          c.item_name_snapshot === "Resina A2" ? 0.4 : c.planned_quantity,
      })),
    });

    confirmProcedureConsumption(ownerA, {
      performed_procedure_id: ppId,
      confirm_insufficient_stock: true,
    });

    const after = getPerformedProcedure(ownerA, ppId);
    expect(after.procedure.consumption_confirmed).toBe(true);
    const resinAfter = after.consumptions.find(
      (c) => c.item_name_snapshot === "Resina A2",
    )!;
    expect(resinAfter.actual_quantity).toBeCloseTo(0.4);
    expect(resinAfter.actual_cost_cents).toBe(Math.round(0.4 * 2250));

    const stock = getInventoryItem(ownerA, "inv-a-resin").current_quantity;
    expect(stock).toBeCloseTo(beforeResin - 0.4);

    expect(after.procedure.patient_id).toBe("p-a-001");
    expect(after.procedure.charged_amount_cents).toBe(35000);
    expect(after.procedure.standard_price_snapshot_cents).toBe(35000);
  });
});

describe("dois procedimentos no mesmo paciente", () => {
  it("duas restaurações → 0,70 g resina exclusiva", () => {
    const before = getInventoryItem(ownerA, "inv-a-resin").current_quantity;
    const a = createPerformedProcedure(ownerA, {
      patient_id: "p-a-001",
      appointment_id: "appt-a-1",
      procedure_id: "proc-a-restoration",
      tooth_number: 16,
    });
    const b = createPerformedProcedure(ownerA, {
      patient_id: "p-a-001",
      appointment_id: "appt-a-1",
      procedure_id: "proc-a-restoration",
      tooth_number: 26,
    });
    confirmProcedureConsumption(ownerA, {
      performed_procedure_id: a.procedure.id,
      confirm_insufficient_stock: true,
    });
    confirmProcedureConsumption(ownerA, {
      performed_procedure_id: b.procedure.id,
      confirm_insufficient_stock: true,
    });
    const after = getInventoryItem(ownerA, "inv-a-resin").current_quantity;
    expect(after).toBeCloseTo(before - 0.7);
  });
});

describe("per_appointment e rateio", () => {
  it("2 restaurações → 1 máscara + luvas per_appointment; rateio compartilhado", () => {
    const beforeMask = getInventoryItem(ownerA, "inv-a-mask").current_quantity;
    const beforeGloves = getInventoryItem(ownerA, "inv-a-gloves").current_quantity;
    const a = createPerformedProcedure(ownerA, {
      patient_id: "p-a-001",
      appointment_id: "appt-a-1",
      procedure_id: "proc-a-restoration",
      tooth_number: 16,
    });
    const b = createPerformedProcedure(ownerA, {
      patient_id: "p-a-001",
      appointment_id: "appt-a-1",
      procedure_id: "proc-a-restoration",
      tooth_number: 26,
    });

    // força custo da máscara compartilhada para R$ 2 (200 cents)
    const shared = getPerformedStore().appointmentConsumptions.find(
      (c) =>
        c.appointment_id === "appt-a-1" &&
        c.inventory_item_id === "inv-a-mask",
    )!;
    shared.unit_cost_snapshot_cents = 200;
    shared.planned_cost_cents = 200;
    shared.actual_cost_cents = 200;

    // luvas: 2 un × 40 = 80 cents (seed) — zera para isolar o rateio da máscara
    const glovesShared = getPerformedStore().appointmentConsumptions.find(
      (c) =>
        c.appointment_id === "appt-a-1" &&
        c.inventory_item_id === "inv-a-gloves",
    )!;
    glovesShared.unit_cost_snapshot_cents = 0;
    glovesShared.planned_cost_cents = 0;
    glovesShared.actual_cost_cents = 0;

    confirmProcedureConsumption(ownerA, {
      performed_procedure_id: a.procedure.id,
      confirm_insufficient_stock: true,
    });
    confirmProcedureConsumption(ownerA, {
      performed_procedure_id: b.procedure.id,
      confirm_insufficient_stock: true,
    });

    const afterMask = getInventoryItem(ownerA, "inv-a-mask").current_quantity;
    expect(afterMask).toBe(beforeMask - 1);
    const afterGloves = getInventoryItem(ownerA, "inv-a-gloves").current_quantity;
    expect(afterGloves).toBe(beforeGloves - 2);

    const detailA = getPerformedProcedure(ownerA, a.procedure.id);
    const detailB = getPerformedProcedure(ownerA, b.procedure.id);
    expect(detailA.procedure.actual_shared_cost_cents).toBe(100);
    expect(detailB.procedure.actual_shared_cost_cents).toBe(100);
  });
});

describe("material extra e substituição", () => {
  it("extra + substituição A2→A1 baixa só o real", () => {
    const a1 = createInventoryItem(ownerA, {
      name: "Resina A1",
      purchase_unit: "seringa",
      consumption_unit: "g",
      units_per_purchase_unit: 4,
    });
    registerInitialStock(ownerA, {
      inventory_item_id: a1.id,
      quantity: 10,
      unit_cost_reais: 20,
    });

    const beforeA2 = getInventoryItem(ownerA, "inv-a-resin").current_quantity;
    const beforeA1 = getInventoryItem(ownerA, a1.id).current_quantity;

    const created = createPerformedProcedure(ownerA, {
      patient_id: "p-a-001",
      appointment_id: "appt-a-1",
      procedure_id: "proc-a-restoration",
      tooth_number: 16,
    });
    const resin = created.consumptions.find(
      (c) => c.item_name_snapshot === "Resina A2",
    )!;

    updateActualConsumption(ownerA, {
      performed_procedure_id: created.procedure.id,
      lines: created.consumptions.map((c) =>
        c.id === resin.id
          ? {
              id: c.id,
              actual_quantity: 0.35,
              actual_inventory_item_id: a1.id,
            }
          : { id: c.id, actual_quantity: c.planned_quantity },
      ),
    });

    addExtraConsumedMaterial(ownerA, {
      performed_procedure_id: created.procedure.id,
      inventory_item_id: "inv-a-anesthetic",
      quantity: 1,
    });

    confirmProcedureConsumption(ownerA, {
      performed_procedure_id: created.procedure.id,
      confirm_insufficient_stock: true,
    });

    expect(getInventoryItem(ownerA, "inv-a-resin").current_quantity).toBe(
      beforeA2,
    );
    expect(getInventoryItem(ownerA, a1.id).current_quantity).toBeCloseTo(
      beforeA1 - 0.35,
    );
  });
});

describe("correção e idempotência", () => {
  it("confirma 0,50 g depois corrige para 0,40 g", () => {
    const before = getInventoryItem(ownerA, "inv-a-resin").current_quantity;
    const created = createPerformedProcedure(ownerA, {
      patient_id: "p-a-001",
      appointment_id: "appt-a-1",
      procedure_id: "proc-a-restoration",
    });
    const resin = created.consumptions.find(
      (c) => c.item_name_snapshot === "Resina A2",
    )!;
    updateActualConsumption(ownerA, {
      performed_procedure_id: created.procedure.id,
      lines: created.consumptions.map((c) => ({
        id: c.id,
        actual_quantity:
          c.id === resin.id ? 0.5 : c.planned_quantity,
      })),
    });
    confirmProcedureConsumption(ownerA, {
      performed_procedure_id: created.procedure.id,
      confirm_insufficient_stock: true,
    });
    expect(getInventoryItem(ownerA, "inv-a-resin").current_quantity).toBeCloseTo(
      before - 0.5,
    );

    correctProcedureConsumption(ownerA, {
      performed_procedure_id: created.procedure.id,
      reason: "Quantidade errada",
      lines: [{ id: resin.id, actual_quantity: 0.4 }],
    });
    expect(getInventoryItem(ownerA, "inv-a-resin").current_quantity).toBeCloseTo(
      before - 0.4,
    );
  });

  it("duplo clique confirma uma única baixa", () => {
    const before = getInventoryItem(ownerA, "inv-a-resin").current_quantity;
    const created = createPerformedProcedure(ownerA, {
      patient_id: "p-a-001",
      appointment_id: "appt-a-1",
      procedure_id: "proc-a-restoration",
    });
    confirmProcedureConsumption(ownerA, {
      performed_procedure_id: created.procedure.id,
      confirm_insufficient_stock: true,
    });
    confirmProcedureConsumption(ownerA, {
      performed_procedure_id: created.procedure.id,
      confirm_insufficient_stock: true,
    });
    expect(getInventoryItem(ownerA, "inv-a-resin").current_quantity).toBeCloseTo(
      before - 0.35,
    );
  });
});

describe("custo histórico e preço do paciente", () => {
  it("snapshot de custo não muda com médio futuro", () => {
    const created = createPerformedProcedure(ownerA, {
      patient_id: "p-a-001",
      appointment_id: "appt-a-1",
      procedure_id: "proc-a-restoration",
      charged_amount_reais: 300,
    });
    expect(created.procedure.standard_price_snapshot_cents).toBe(35000);
    expect(created.procedure.charged_amount_cents).toBe(30000);

    const resin = created.consumptions.find(
      (c) => c.item_name_snapshot === "Resina A2",
    )!;
    const snap = resin.unit_cost_snapshot_cents;
    confirmProcedureConsumption(ownerA, {
      performed_procedure_id: created.procedure.id,
      confirm_insufficient_stock: true,
    });

    // muda custo médio do estoque
    getInventoryItem(ownerA, "inv-a-resin").average_unit_cost_cents = 3000;
    const after = getPerformedProcedure(ownerA, created.procedure.id);
    const resinAfter = after.consumptions.find(
      (c) => c.item_name_snapshot === "Resina A2",
    )!;
    expect(resinAfter.unit_cost_snapshot_cents).toBe(snap);
  });

  it("resultado bruto e margem; charged 0 sem %", () => {
    const created = createPerformedProcedure(ownerA, {
      patient_id: "p-a-001",
      appointment_id: "appt-a-1",
      procedure_id: "proc-a-restoration",
      charged_amount_reais: 300,
    });
    confirmProcedureConsumption(ownerA, {
      performed_procedure_id: created.procedure.id,
      confirm_insufficient_stock: true,
    });
    const g = calculateGrossResult(30000, 5000);
    expect(g.gross_result_cents).toBe(25000);
    expect(g.gross_margin_percent).toBe(83.33);

    const zero = calculateGrossResult(0, 5000);
    expect(zero.gross_result_cents).toBe(-5000);
    expect(zero.gross_margin_percent).toBeNull();
  });
});

describe("plano já cobrado e cross-clinic", () => {
  it("treatment_item com plano faturado não oferece cobrança", () => {
    const plan = getTreatmentsStore().plans.find((p) => p.id === "tp-a-progress")!;
    const item = getTreatmentsStore().items.find(
      (i) => i.treatment_plan_id === plan.id,
    )!;
    // cria tx ligada ao plano
    getFinanceStore().transactions.push({
      id: "ft-plan-link",
      clinic_id: CLINIC_A_ID,
      patient_id: plan.patient_id,
      treatment_plan_id: plan.id,
      appointment_id: null,
      type: "income",
      description: "Plano",
      category: null,
      cost_behavior: null,
      recurrence_type: null,
      allocation_eligible: null,
      reference_month: null,
      competence_date: null,
      gross_amount_cents: plan.total_cents,
      discount_amount_cents: 0,
      net_amount_cents: plan.total_cents,
      status: "pending",
      due_date: "2026-10-10",
      notes: null,
      created_by: OWNER_A_ID,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      cancelled_at: null,
      cancelled_by: null,
      cancellation_reason: null,
    });

    const created = createPerformedProcedure(ownerA, {
      patient_id: plan.patient_id,
      appointment_id: "appt-a-1",
      procedure_id: "proc-a-restoration",
      treatment_item_id: item.id,
      charged_amount_reais: 500,
    });
    // patient of tp-a-progress is p-a-001 - appt-a-1 is also p-a-001. Good.
    const offer = shouldOfferFinanceCharge(ownerA, created.procedure.id);
    expect(offer.offer).toBe(false);
    expect(offer.reason).toBe("plan_already_billed");
  });

  it("nega patient/procedure/item de Clinic B", () => {
    expect(() =>
      createPerformedProcedure(ownerA, {
        patient_id: "p-a-001",
        procedure_id: "proc-b-whitening",
      }),
    ).toThrow("PROCEDURE_NOT_FOUND");

    expect(() =>
      createPerformedProcedure(
        { userId: OWNER_A_ID, clinicId: CLINIC_B_ID },
        {
          patient_id: "p-a-001",
          procedure_id: "proc-b-whitening",
        },
      ),
    ).toThrow();
  });
});

describe("permissões de custo", () => {
  it("secretary vê procedimentos sem custos internos", () => {
    expect(can({ userId: SECRETARY_A_ID, clinicId: CLINIC_A_ID }, "performed_procedures.view").allowed).toBe(true);
    expect(can({ userId: SECRETARY_A_ID, clinicId: CLINIC_A_ID }, "procedure_costs.view").allowed).toBe(false);
    expect(can(dentistA, "procedure_consumption.confirm").allowed).toBe(true);
  });
});

describe("custo por paciente", () => {
  it("soma custos de procedimentos concluídos da Mariana", () => {
    const a = createPerformedProcedure(ownerA, {
      patient_id: "p-a-001",
      appointment_id: "appt-a-1",
      procedure_id: "proc-a-prophylaxis",
    });
    confirmProcedureConsumption(ownerA, {
      performed_procedure_id: a.procedure.id,
      confirm_insufficient_stock: true,
    });
    completePerformedProcedure(ownerA, a.procedure.id);

    const summary = getPatientDirectCostSummary(ownerA, "p-a-001");
    expect(summary.procedures_count).toBe(1);
    expect(summary.total_actual_cost_cents).toBeGreaterThan(0);
  });
});
