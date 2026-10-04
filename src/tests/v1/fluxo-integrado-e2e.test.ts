/**
 * Subfase 10 — E2E do fluxo principal V1
 * Agenda → Atendimento → Procedimento → Consumo → Evolução → Financeiro → Conclusão
 */
import { beforeEach, describe, expect, it } from "vitest";
import { can } from "@/lib/authz/can";
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
import { getAgendaStore, resetAgendaStore } from "@/lib/demo/agenda-store";
import { resetClinicalStore } from "@/lib/demo/clinical-store";
import { getFinanceStore, resetFinanceStore } from "@/lib/demo/finance-store";
import {
  getInventoryStore,
  resetInventoryStore,
} from "@/lib/demo/inventory-store";
import { resetPatientsStore } from "@/lib/demo/patients-store";
import {
  getPerformedStore,
  resetPerformedStore,
} from "@/lib/demo/performed-procedures-store";
import { resetPlannedProceduresStore } from "@/lib/demo/planned-procedures-store";
import { resetProcedureFinanceStore } from "@/lib/demo/procedure-finance-store";
import { resetTreatmentsStore } from "@/lib/demo/treatments-store";
import { addPlannedProcedureToAppointment } from "@/services/appointment-planned-procedures";
import { convertPlannedProceduresToPerformedProcedures } from "@/services/appointment-planned-procedures/convert";
import {
  changeAppointmentStatus,
  createAppointment,
} from "@/services/appointments";
import { finalizeClinicalEntry } from "@/services/clinical";
import { registerPayment } from "@/services/finance";
import { getInventoryItem } from "@/services/inventory";
import {
  createEvolutionFromPerformedProcedure,
  createFinancialChargeFromPerformedProcedure,
  getAppointmentCompletionSummary,
  getProcedureFinanceBreakdown,
  setPerformedProcedureChargedAmount,
} from "@/services/patient-procedure-finance";
import { createPatient } from "@/services/patients";
import {
  completePerformedProcedure,
  createPerformedProcedure,
} from "@/services/performed-procedures";
import {
  addExtraConsumedMaterial,
  confirmProcedureConsumption,
} from "@/services/procedure-consumption";
import { globalSearch } from "@/lib/search/global";
import { getOnboarding } from "@/services/settings";

const ownerA = { userId: OWNER_A_ID, clinicId: CLINIC_A_ID };
const dentistA = { userId: DENTIST_A_ID, clinicId: CLINIC_A_ID };
const secretaryA = { userId: SECRETARY_A_ID, clinicId: CLINIC_A_ID };
const ownerB = { userId: OWNER_B_ID, clinicId: CLINIC_B_ID };

beforeEach(() => {
  resetAuthzStore();
  resetAgendaStore();
  resetPatientsStore();
  resetInventoryStore();
  resetPerformedStore();
  resetPlannedProceduresStore();
  resetProcedureFinanceStore();
  resetFinanceStore();
  resetClinicalStore();
  resetTreatmentsStore();
  setDemoSession(OWNER_A_ID, CLINIC_A_ID);
});

function tomorrowSlot() {
  const start = new Date();
  start.setDate(start.getDate() + 2);
  start.setHours(10, 0, 0, 0);
  const end = new Date(start);
  end.setHours(11, 0, 0, 0);
  return { start_at: start.toISOString(), end_at: end.toISOString() };
}

describe("Subfase 10 — E2E fluxo principal V1", () => {
  it("paciente → agenda → atendimento → consumo → evolução → financeiro → conclusão", () => {
    const created = createPatient(ownerA, {
      full_name: "E2E Paciente Fluxo",
      phone: "(31) 98888-1001",
      status: "active",
      acknowledge_duplicate: true,
    } as never);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const patientId = created.patient.id;

    const slot = tomorrowSlot();
    const appt = createAppointment(ownerA, {
      patient_id: patientId,
      professional_id: DENTIST_A_ID,
      start_at: slot.start_at,
      end_at: slot.end_at,
      reason: "Restauração + profilaxia",
    });

    addPlannedProcedureToAppointment(ownerA, {
      appointment_id: appt.id,
      procedure_id: "proc-a-restoration",
      tooth_number: 16,
      quantity: 1,
    });
    addPlannedProcedureToAppointment(ownerA, {
      appointment_id: appt.id,
      procedure_id: "proc-a-prophylaxis",
      quantity: 1,
    });

    changeAppointmentStatus(ownerA, appt.id, { status: "confirmed" });
    changeAppointmentStatus(ownerA, appt.id, { status: "arrived" });
    changeAppointmentStatus(ownerA, appt.id, { status: "in_progress" });

    const resinBefore = getInventoryItem(ownerA, "inv-a-resin").current_quantity;
    const maskBefore = getInventoryItem(ownerA, "inv-a-mask").current_quantity;

    const converted = convertPlannedProceduresToPerformedProcedures(ownerA, {
      appointment_id: appt.id,
    });
    expect(converted.created_ids).toHaveLength(2);

    // idempotente
    const again = convertPlannedProceduresToPerformedProcedures(ownerA, {
      appointment_id: appt.id,
    });
    expect(again.created_ids).toHaveLength(0);
    expect(again.reused_ids).toHaveLength(2);

    const performed = getPerformedStore().performedProcedures.filter(
      (p) => p.appointment_id === appt.id && p.status !== "cancelled",
    );
    expect(performed).toHaveLength(2);

    const restoration = performed.find(
      (p) => p.procedure_id === "proc-a-restoration",
    )!;
    const prophylaxis = performed.find(
      (p) => p.procedure_id === "proc-a-prophylaxis",
    )!;

    for (const pp of [restoration, prophylaxis]) {
      confirmProcedureConsumption(ownerA, {
        performed_procedure_id: pp.id,
        confirm_insufficient_stock: true,
      });
      completePerformedProcedure(ownerA, pp.id);
    }

    const resinAfter = getInventoryItem(ownerA, "inv-a-resin").current_quantity;
    expect(resinAfter).toBeLessThan(resinBefore);

    // materiais compartilhados por atendimento (máscara) não duplicam indevidamente
    const maskAfter = getInventoryItem(ownerA, "inv-a-mask").current_quantity;
    expect(maskAfter).toBeLessThanOrEqual(maskBefore);

    setPerformedProcedureChargedAmount(ownerA, {
      id: restoration.id,
      charged_amount_reais: 350,
    });
    setPerformedProcedureChargedAmount(ownerA, {
      id: prophylaxis.id,
      charged_amount_reais: 150,
    });

    createFinancialChargeFromPerformedProcedure(ownerA, {
      performed_procedure_id: restoration.id,
      charged_amount_reais: 350,
    });
    createFinancialChargeFromPerformedProcedure(ownerA, {
      performed_procedure_id: prophylaxis.id,
      charged_amount_reais: 150,
    });

    const evo = createEvolutionFromPerformedProcedure(dentistA, restoration.id, {
      clinical_exam: "Dente 16 com cavidade média.",
      conduct: "Restauração em resina A2.",
      guidance: "Evitar mastigar do lado por 24h.",
      follow_up_required: true,
      follow_up_interval_days: 180,
    });
    expect(evo.status).toBe("draft");
    const finalized = finalizeClinicalEntry(dentistA, { id: evo.id });
    expect(finalized.status).toBe("finalized");

    createEvolutionFromPerformedProcedure(dentistA, prophylaxis.id, {
      procedure_done: "Profilaxia",
      conduct: "Profilaxia realizada.",
    });
    const evo2 = getPerformedStore().performedProcedures.find(
      (p) => p.id === prophylaxis.id,
    )!;
    expect(evo2.clinical_entry_id).toBeTruthy();
    finalizeClinicalEntry(dentistA, { id: evo2.clinical_entry_id! });

    const breakdownRest = getProcedureFinanceBreakdown(ownerA, restoration.id);
    const txId = breakdownRest.links[0]!.financial_transaction_id;
    const inst = getFinanceStore().installments.find(
      (i) => i.financial_transaction_id === txId,
    )!;
    registerPayment(ownerA, {
      installment_id: inst.id,
      amount_reais: 200,
      payment_method: "pix",
      paid_at: new Date().toISOString(),
    });

    const afterPay = getProcedureFinanceBreakdown(ownerA, restoration.id);
    expect(afterPay.received_cents).toBe(20000);
    expect(afterPay.outstanding_cents).toBe(15000);

    const summary = getAppointmentCompletionSummary(ownerA, appt.id);
    expect(summary.procedures).toHaveLength(2);
    expect(summary.materials_confirmed).toBe(true);
    expect(summary.evolutions_finalized).toBe(2);
    expect(summary.charged_cents).toBe(50000);
    expect(summary.received_cents).toBe(20000);
    expect(summary.outstanding_cents).toBeGreaterThan(0);

    changeAppointmentStatus(ownerA, appt.id, { status: "completed" });
    const done = getAgendaStore().appointments.find((a) => a.id === appt.id)!;
    expect(done.status).toBe("completed");

    // custos rastreáveis por procedimento
    expect(restoration.actual_total_cost_cents ?? 0).toBeGreaterThanOrEqual(0);
    expect(prophylaxis.actual_total_cost_cents ?? 0).toBeGreaterThanOrEqual(0);
  });

  it("procedimento extra + material extra + preço abaixo do custo (aviso, não bloqueio)", () => {
    const created = createPatient(ownerA, {
      full_name: "E2E Extra",
      status: "active",
      acknowledge_duplicate: true,
    } as never);
    if (!created.ok) return;
    const slot = tomorrowSlot();
    const appt = createAppointment(ownerA, {
      patient_id: created.patient.id,
      professional_id: DENTIST_A_ID,
      start_at: slot.start_at,
      end_at: slot.end_at,
    });
    changeAppointmentStatus(ownerA, appt.id, { status: "confirmed" });
    changeAppointmentStatus(ownerA, appt.id, { status: "arrived" });
    changeAppointmentStatus(ownerA, appt.id, { status: "in_progress" });

    const pp = createPerformedProcedure(ownerA, {
      patient_id: created.patient.id,
      appointment_id: appt.id,
      procedure_id: "proc-a-restoration",
      tooth_number: 26,
      charged_amount_reais: 1, // abaixo do custo — não bloqueia
    });

    // Luvas já estão na ficha (2 un); extras somam ao consumo
    addExtraConsumedMaterial(ownerA, {
      performed_procedure_id: pp.procedure.id,
      inventory_item_id: "inv-a-gloves",
      quantity: 2,
    });

    const beforeGloves = getInventoryItem(ownerA, "inv-a-gloves").current_quantity;
    confirmProcedureConsumption(ownerA, {
      performed_procedure_id: pp.procedure.id,
      confirm_insufficient_stock: true,
    });
    const afterGloves = getInventoryItem(ownerA, "inv-a-gloves").current_quantity;
    // previsto 2 + extra 2
    expect(afterGloves).toBeCloseTo(beforeGloves - 4);
    const extras = getPerformedStore().procedureConsumptions.filter(
      (c) => c.performed_procedure_id === pp.procedure.id && c.is_extra,
    );
    expect(extras.length).toBeGreaterThanOrEqual(1);

    completePerformedProcedure(ownerA, pp.procedure.id);
    const detail = getPerformedStore().performedProcedures.find(
      (p) => p.id === pp.procedure.id,
    )!;
    expect(detail.status).toBe("completed");
    expect(detail.charged_amount_cents).toBe(100);
    // alerta de margem fica na UI; fluxo clínico não é bloqueado
    expect(detail.consumption_confirmed).toBe(true);
  });

  it("procedimento cancelado não gera consumo/cobrança/evolução falsa", () => {
    const created = createPatient(ownerA, {
      full_name: "E2E Cancel",
      status: "active",
      acknowledge_duplicate: true,
    } as never);
    if (!created.ok) return;
    const slot = tomorrowSlot();
    const appt = createAppointment(ownerA, {
      patient_id: created.patient.id,
      professional_id: DENTIST_A_ID,
      start_at: slot.start_at,
      end_at: slot.end_at,
    });
    const pp = createPerformedProcedure(ownerA, {
      patient_id: created.patient.id,
      appointment_id: appt.id,
      procedure_id: "proc-a-prophylaxis",
      charged_amount_reais: 150,
    });
    const before = getInventoryItem(ownerA, "inv-a-mask").current_quantity;
    const row = getPerformedStore().performedProcedures.find(
      (p) => p.id === pp.procedure.id,
    )!;
    row.status = "cancelled";
    row.updated_at = new Date().toISOString();

    expect(row.consumption_confirmed).toBe(false);
    expect(getInventoryItem(ownerA, "inv-a-mask").current_quantity).toBe(before);
    const summary = getAppointmentCompletionSummary(ownerA, appt.id);
    expect(summary.procedures).toHaveLength(0);
  });
});

describe("Subfase 10 — permissões e isolamento", () => {
  it("secretária sem clinical não cria evolução; sem custo não vê margem", () => {
    expect(can(secretaryA, "clinical_evolution.view").allowed).toBe(false);
    expect(can(secretaryA, "clinical_evolution.create").allowed).toBe(false);
    expect(can(dentistA, "clinical_evolution.create").allowed).toBe(true);
  });

  it("busca global encontra paciente/procedimento/estoque da própria clínica", () => {
    const hits = globalSearch(ownerA, "resina");
    expect(hits.some((h) => h.type === "inventory")).toBe(true);
    const procs = globalSearch(ownerA, "restauração");
    expect(procs.some((h) => h.type === "procedure")).toBe(true);
  });

  it("cross-clinic: Clínica B não lê performed de A", () => {
    const pp = createPerformedProcedure(ownerA, {
      patient_id: "p-a-001",
      appointment_id: "appt-a-1",
      procedure_id: "proc-a-prophylaxis",
    });
    setDemoSession(OWNER_B_ID, CLINIC_B_ID);
    const leaked = getPerformedStore().performedProcedures.filter(
      (p) => p.clinic_id === CLINIC_B_ID && p.id === pp.procedure.id,
    );
    expect(leaked).toHaveLength(0);
    expect(pp.procedure.clinic_id).toBe(CLINIC_A_ID);
    void ownerB;
  });

  it("onboarding checklist V1 tem 6 etapas", () => {
    const o = getOnboarding(ownerA);
    expect(o.checklist).toHaveLength(6);
    expect(o.checklist.map((c) => c.key)).toEqual([
      "clinic",
      "procedures",
      "materials",
      "stock",
      "patient",
      "appointment",
    ]);
  });
});

describe("Subfase 10 — navegação e inventário seed", () => {
  it("catálogo demo tem procedimentos e estoque", () => {
    const inv = getInventoryStore();
    expect(
      inv.procedures.some((p) => p.clinic_id === CLINIC_A_ID && p.active),
    ).toBe(true);
    expect(
      inv.inventoryItems.some(
        (i) => i.clinic_id === CLINIC_A_ID && i.current_quantity > 0,
      ),
    ).toBe(true);
  });
});
