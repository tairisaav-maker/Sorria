/**
 * Smoke técnico do piloto — Login/Agenda/Paciente/Procedimento/Estoque/Atendimento/Financeiro
 * (camada de serviços; UI smoke manual no PILOT_RUNBOOK).
 */
import { beforeEach, describe, expect, it } from "vitest";
import {
  CLINIC_A_ID,
  DENTIST_A_ID,
  OWNER_A_ID,
  resetAuthzStore,
  setDemoSession,
} from "@/lib/demo/authz-store";
import { resetAgendaStore } from "@/lib/demo/agenda-store";
import { resetFinanceStore, getFinanceStore } from "@/lib/demo/finance-store";
import { resetInventoryStore } from "@/lib/demo/inventory-store";
import { resetPatientsStore } from "@/lib/demo/patients-store";
import { resetPerformedStore } from "@/lib/demo/performed-procedures-store";
import { resetProcedureFinanceStore } from "@/lib/demo/procedure-finance-store";
import { resetClinicalStore } from "@/lib/demo/clinical-store";
import { createAppointment, changeAppointmentStatus } from "@/services/appointments";
import { createPatient } from "@/services/patients";
import { getInventoryItem, listInventoryItems } from "@/services/inventory";
import { listProcedures } from "@/services/procedures";
import {
  completePerformedProcedure,
  createPerformedProcedure,
} from "@/services/performed-procedures";
import { confirmProcedureConsumption } from "@/services/procedure-consumption";
import { createFinancialChargeFromPerformedProcedure } from "@/services/patient-procedure-finance";
import { registerPayment } from "@/services/finance";
import { APP_VERSION } from "@/lib/version";

const ownerA = { userId: OWNER_A_ID, clinicId: CLINIC_A_ID };

beforeEach(() => {
  resetAuthzStore();
  resetAgendaStore();
  resetPatientsStore();
  resetInventoryStore();
  resetPerformedStore();
  resetProcedureFinanceStore();
  resetFinanceStore();
  resetClinicalStore();
  setDemoSession(OWNER_A_ID, CLINIC_A_ID);
});

describe("piloto — smoke", () => {
  it("versão piloto + catálogo + estoque + atendimento + financeiro", () => {
    expect(APP_VERSION.length).toBeGreaterThan(0);

    const procs = listProcedures(ownerA);
    expect(procs.length).toBeGreaterThan(0);

    const inv = listInventoryItems(ownerA);
    expect(inv.length).toBeGreaterThan(0);
    const resin = getInventoryItem(ownerA, "inv-a-resin");
    expect(resin.current_quantity).toBeGreaterThan(0);

    const patient = createPatient(ownerA, {
      full_name: "Smoke Piloto",
      status: "active",
      acknowledge_duplicate: true,
    } as never);
    expect(patient.ok).toBe(true);
    if (!patient.ok) return;

    const start = new Date();
    start.setDate(start.getDate() + 3);
    start.setHours(14, 0, 0, 0);
    const end = new Date(start);
    end.setHours(15, 0, 0, 0);
    const appt = createAppointment(ownerA, {
      patient_id: patient.patient.id,
      professional_id: DENTIST_A_ID,
      start_at: start.toISOString(),
      end_at: end.toISOString(),
    });
    changeAppointmentStatus(ownerA, appt.id, { status: "confirmed" });
    changeAppointmentStatus(ownerA, appt.id, { status: "arrived" });
    changeAppointmentStatus(ownerA, appt.id, { status: "in_progress" });

    const pp = createPerformedProcedure(ownerA, {
      patient_id: patient.patient.id,
      appointment_id: appt.id,
      procedure_id: "proc-a-prophylaxis",
      charged_amount_reais: 150,
    });
    confirmProcedureConsumption(ownerA, {
      performed_procedure_id: pp.procedure.id,
      confirm_insufficient_stock: true,
    });
    completePerformedProcedure(ownerA, pp.procedure.id);

    const charge = createFinancialChargeFromPerformedProcedure(ownerA, {
      performed_procedure_id: pp.procedure.id,
      charged_amount_reais: 150,
    });
    const txId = charge.transaction.id;
    const inst = getFinanceStore().installments.find(
      (i) => i.financial_transaction_id === txId,
    );
    expect(inst).toBeTruthy();
    registerPayment(ownerA, {
      installment_id: inst!.id,
      amount_reais: 150,
      payment_method: "pix",
      paid_at: new Date().toISOString(),
    });

    changeAppointmentStatus(ownerA, appt.id, { status: "completed" });
  });
});
