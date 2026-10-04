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
import {
  getInventoryStore,
  resetInventoryStore,
} from "@/lib/demo/inventory-store";
import { resetPerformedStore } from "@/lib/demo/performed-procedures-store";
import { resetPlannedProceduresStore } from "@/lib/demo/planned-procedures-store";
import {
  addPlannedProcedureToAppointment,
  convertPlannedProceduresToPerformedProcedures,
  getAppointmentPlannedProcedures,
  removePlannedProcedure,
} from "@/services/appointment-planned-procedures";
import {
  calculateAppointmentMaterialForecast,
  forecastMaterialNeeds,
  getPatientUpcomingMaterialNeeds,
} from "@/services/inventory/forecast";
import { createPerformedProcedure } from "@/services/performed-procedures";
import { getInventoryItem } from "@/services/inventory";

beforeEach(() => {
  resetAuthzStore();
  resetInventoryStore();
  resetPerformedStore();
  resetPlannedProceduresStore();
  resetAgendaStore();
  setDemoSession(OWNER_A_ID, CLINIC_A_ID);
});

const ownerA = { userId: OWNER_A_ID, clinicId: CLINIC_A_ID };
const secretaryA = { userId: SECRETARY_A_ID, clinicId: CLINIC_A_ID };
const dentistA = { userId: DENTIST_A_ID, clinicId: CLINIC_A_ID };

function periodCovering(appointmentIds: string[]) {
  const appts = getAgendaStore().appointments.filter((a) =>
    appointmentIds.includes(a.id),
  );
  const starts = appts.map((a) => +new Date(a.start_at));
  const start = new Date(Math.min(...starts));
  start.setHours(0, 0, 0, 0);
  const end = new Date(Math.max(...starts));
  end.setHours(23, 59, 59, 999);
  return { start_date: start.toISOString(), end_date: end.toISOString() };
}

describe("um paciente — Mariana restauração", () => {
  it("forecast Mariana = 0,30 g resina", () => {
    addPlannedProcedureToAppointment(ownerA, {
      appointment_id: "appt-a-1",
      procedure_id: "proc-a-restoration",
      tooth_number: 16,
      quantity: 1,
    });
    const forecast = calculateAppointmentMaterialForecast(ownerA, "appt-a-1");
    const resin = forecast.materials.find((m) => m.item_name === "Resina A2")!;
    expect(resin.forecast_quantity).toBeCloseTo(0.3);
    expect(forecast.planned_procedures_count).toBe(1);
  });
});

describe("dois pacientes", () => {
  it("soma fichas: 0,30 + 0,60 = 0,90 g", () => {
    // appt-a-1 paciente p-a-001; appt-a-2 paciente p-a-003
    addPlannedProcedureToAppointment(ownerA, {
      appointment_id: "appt-a-1",
      procedure_id: "proc-a-restoration",
      quantity: 1,
    });
    addPlannedProcedureToAppointment(ownerA, {
      appointment_id: "appt-a-2",
      procedure_id: "proc-a-restoration",
      quantity: 2,
    });
    const range = periodCovering(["appt-a-1", "appt-a-2"]);
    const summary = forecastMaterialNeeds(ownerA, range);
    const resin = summary.materials.find((m) => m.item_name === "Resina A2")!;
    expect(resin.forecast_quantity).toBeCloseTo(0.9);
  });
});

describe("per_appointment", () => {
  it("3 procedimentos no mesmo appointment → 1 máscara", () => {
    addPlannedProcedureToAppointment(ownerA, {
      appointment_id: "appt-a-1",
      procedure_id: "proc-a-restoration",
      tooth_number: 16,
    });
    addPlannedProcedureToAppointment(ownerA, {
      appointment_id: "appt-a-1",
      procedure_id: "proc-a-restoration",
      tooth_number: 26,
    });
    addPlannedProcedureToAppointment(ownerA, {
      appointment_id: "appt-a-1",
      procedure_id: "proc-a-prophylaxis",
    });
    const forecast = calculateAppointmentMaterialForecast(ownerA, "appt-a-1");
    const mask = forecast.materials.find(
      (m) => m.item_name === "Máscara cirúrgica",
    )!;
    expect(mask.forecast_quantity).toBe(1);
  });

  it("2 appointments → 2 máscaras", () => {
    addPlannedProcedureToAppointment(ownerA, {
      appointment_id: "appt-a-1",
      procedure_id: "proc-a-restoration",
    });
    addPlannedProcedureToAppointment(ownerA, {
      appointment_id: "appt-a-2",
      procedure_id: "proc-a-restoration",
    });
    const range = periodCovering(["appt-a-1", "appt-a-2"]);
    const summary = forecastMaterialNeeds(ownerA, range);
    const mask = summary.materials.find(
      (m) => m.item_name === "Máscara cirúrgica",
    )!;
    expect(mask.forecast_quantity).toBe(2);
  });
});

describe("cancelamento e sem procedimento", () => {
  it("consulta cancelada não entra", () => {
    addPlannedProcedureToAppointment(ownerA, {
      appointment_id: "appt-a-1",
      procedure_id: "proc-a-restoration",
    });
    const appt = getAgendaStore().appointments.find((a) => a.id === "appt-a-1")!;
    appt.status = "cancelled";
    appt.cancelled_at = new Date().toISOString();
    const range = periodCovering(["appt-a-1"]);
    const summary = forecastMaterialNeeds(ownerA, range);
    expect(
      summary.materials.find((m) => m.item_name === "Resina A2"),
    ).toBeUndefined();
    expect(
      summary.materials.every((m) =>
        m.patient_breakdown.every((b) => b.appointment_id !== "appt-a-1"),
      ),
    ).toBe(true);
  });

  it("sem planned procedure → sem consumo + conta sem definição", () => {
    const range = periodCovering(["appt-a-1"]);
    const summary = forecastMaterialNeeds(ownerA, range);
    expect(summary.appointments_without_procedures).toBeGreaterThanOrEqual(1);
    expect(
      summary.materials.find((m) => m.item_name === "Resina A2"),
    ).toBeUndefined();
  });

  it("procedimento previsto cancelado não entra", () => {
    const row = addPlannedProcedureToAppointment(ownerA, {
      appointment_id: "appt-a-1",
      procedure_id: "proc-a-restoration",
    });
    removePlannedProcedure(ownerA, { id: row.id });
    const forecast = calculateAppointmentMaterialForecast(ownerA, "appt-a-1");
    expect(forecast.planned_procedures_count).toBe(0);
    expect(forecast.definition_status).toBe("undefined");
  });
});

describe("estoque insuficiente e mínimo", () => {
  it("estoque 1 g / necessidade 2 g → insuficiente, projetado -1", () => {
    const item = getInventoryStore().inventoryItems.find(
      (i) => i.id === "inv-a-resin",
    )!;
    item.current_quantity = 1;
    addPlannedProcedureToAppointment(ownerA, {
      appointment_id: "appt-a-1",
      procedure_id: "proc-a-restoration",
      quantity: 1,
    });
    // force need 2g by quantity 2 * 0.3 = 0.6 — adjust stock/need to match spec
    // Spec: stock 1, need 2. Use two restorations qty that sum to ~2: quantity ~6.67
    // Simpler: set standard via two appointments totaling need > stock
    item.current_quantity = 0.2;
    const forecast = calculateAppointmentMaterialForecast(ownerA, "appt-a-1");
    const resin = forecast.materials.find((m) => m.item_name === "Resina A2")!;
    expect(resin.status).toBe("insufficient");
    expect(resin.projected_remaining).toBeCloseTo(0.2 - 0.3);

    // explicit 1 vs 2
    item.current_quantity = 1;
    const invMat = getInventoryStore().procedureMaterials.find(
      (m) => m.id === "pm-a-rest-resin",
    )!;
    invMat.standard_quantity = 2;
    const f2 = calculateAppointmentMaterialForecast(ownerA, "appt-a-1");
    const r2 = f2.materials.find((m) => m.item_name === "Resina A2")!;
    expect(r2.forecast_quantity).toBeCloseTo(2);
    expect(r2.projected_remaining).toBeCloseTo(-1);
    expect(r2.status).toBe("insufficient");
  });

  it("saldo abaixo do mínimo → low_after_forecast", () => {
    const item = getInventoryStore().inventoryItems.find(
      (i) => i.id === "inv-a-resin",
    )!;
    item.current_quantity = 10;
    item.minimum_quantity = 5;
    const invMat = getInventoryStore().procedureMaterials.find(
      (m) => m.id === "pm-a-rest-resin",
    )!;
    invMat.standard_quantity = 6;
    addPlannedProcedureToAppointment(ownerA, {
      appointment_id: "appt-a-1",
      procedure_id: "proc-a-restoration",
      quantity: 1,
    });
    const forecast = calculateAppointmentMaterialForecast(ownerA, "appt-a-1");
    const resin = forecast.materials.find((m) => m.item_name === "Resina A2")!;
    expect(resin.projected_remaining).toBeCloseTo(4);
    expect(resin.status).toBe("low_after_forecast");
  });

  it("previsão não baixa estoque físico", () => {
    const before = getInventoryItem(ownerA, "inv-a-resin").current_quantity;
    addPlannedProcedureToAppointment(ownerA, {
      appointment_id: "appt-a-1",
      procedure_id: "proc-a-restoration",
    });
    forecastMaterialNeeds(ownerA, periodCovering(["appt-a-1"]));
    expect(getInventoryItem(ownerA, "inv-a-resin").current_quantity).toBe(
      before,
    );
  });
});

describe("conversão planned → performed", () => {
  it("2 planned → 2 performed uma única vez", () => {
    addPlannedProcedureToAppointment(ownerA, {
      appointment_id: "appt-a-1",
      procedure_id: "proc-a-restoration",
      tooth_number: 16,
    });
    addPlannedProcedureToAppointment(ownerA, {
      appointment_id: "appt-a-1",
      procedure_id: "proc-a-prophylaxis",
    });
    const first = convertPlannedProceduresToPerformedProcedures(ownerA, {
      appointment_id: "appt-a-1",
    });
    expect(first.created_ids).toHaveLength(2);
    expect(first.items).toHaveLength(2);

    const second = convertPlannedProceduresToPerformedProcedures(ownerA, {
      appointment_id: "appt-a-1",
    });
    expect(second.created_ids).toHaveLength(0);
    expect(second.reused_ids).toHaveLength(2);
    expect(second.items).toHaveLength(2);
  });

  it("procedimento extra realizado sem alterar planned", () => {
    addPlannedProcedureToAppointment(ownerA, {
      appointment_id: "appt-a-1",
      procedure_id: "proc-a-restoration",
    });
    convertPlannedProceduresToPerformedProcedures(ownerA, {
      appointment_id: "appt-a-1",
    });
    createPerformedProcedure(ownerA, {
      patient_id: "p-a-001",
      appointment_id: "appt-a-1",
      procedure_id: "proc-a-prophylaxis",
    });
    const planned = getAppointmentPlannedProcedures(ownerA, "appt-a-1");
    expect(planned).toHaveLength(1);
  });
});

describe("custos ocultos e permissões", () => {
  it("secretária vê quantidade e não custo estimado", () => {
    addPlannedProcedureToAppointment(secretaryA, {
      appointment_id: "appt-a-1",
      procedure_id: "proc-a-restoration",
    });
    expect(can(secretaryA, "inventory.forecast_view").allowed).toBe(true);
    expect(can(secretaryA, "inventory.forecast_cost_view").allowed).toBe(false);
    const forecast = calculateAppointmentMaterialForecast(
      secretaryA,
      "appt-a-1",
    );
    const resin = forecast.materials.find((m) => m.item_name === "Resina A2")!;
    expect(resin.forecast_quantity).toBeCloseTo(0.3);
    expect(resin.estimated_cost_cents).toBeNull();
    expect(forecast.estimated_total_cost_cents).toBeNull();
  });

  it("dentista/owner com custo vê estimado", () => {
    addPlannedProcedureToAppointment(dentistA, {
      appointment_id: "appt-a-1",
      procedure_id: "proc-a-restoration",
    });
    const forecast = calculateAppointmentMaterialForecast(dentistA, "appt-a-1");
    expect(forecast.estimated_total_cost_cents).not.toBeNull();
    expect(forecast.canViewCosts).toBe(true);
  });
});

describe("cross-clinic", () => {
  it("não permite procedure Clinic B em appointment Clinic A", () => {
    expect(() =>
      addPlannedProcedureToAppointment(ownerA, {
        appointment_id: "appt-a-1",
        procedure_id: "proc-b-whitening",
      }),
    ).toThrow(/PROCEDURE_NOT_FOUND|CROSS_CLINIC/);
  });

  it("forecast Clinic B não vê materiais da Clinic A", () => {
    setDemoSession(OWNER_B_ID, CLINIC_B_ID);
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 30);
    const summary = forecastMaterialNeeds(
      { userId: OWNER_B_ID, clinicId: CLINIC_B_ID },
      { start_date: start.toISOString(), end_date: end.toISOString() },
    );
    expect(
      summary.materials.every((m) => m.item_name !== "Resina A2"),
    ).toBe(true);
  });
});

describe("paciente — próximos materiais", () => {
  it("próximo atendimento da Mariana", () => {
    // appt-a-portal-future is +7 days for p-a-001
    addPlannedProcedureToAppointment(ownerA, {
      appointment_id: "appt-a-portal-future",
      procedure_id: "proc-a-restoration",
      tooth_number: 16,
    });
    addPlannedProcedureToAppointment(ownerA, {
      appointment_id: "appt-a-portal-future",
      procedure_id: "proc-a-prophylaxis",
    });
    const needs = getPatientUpcomingMaterialNeeds(ownerA, "p-a-001");
    expect(needs.appointment?.id).toBeTruthy();
    expect(needs.forecast?.planned_procedures_count).toBeGreaterThanOrEqual(1);
  });
});

describe("vínculo paciente da consulta", () => {
  it("planned procedure usa patient_id da appointment", () => {
    const row = addPlannedProcedureToAppointment(ownerA, {
      appointment_id: "appt-a-1",
      procedure_id: "proc-a-restoration",
    });
    const appt = getAgendaStore().appointments.find((a) => a.id === "appt-a-1")!;
    expect(row.patient_id).toBe(appt.patient_id);
  });
});
