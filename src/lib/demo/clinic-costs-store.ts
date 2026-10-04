import { CLINIC_A_ID, OWNER_A_ID, appendAudit } from "@/lib/demo/authz-store";
import type {
  ClinicCostSettings,
  ClinicHourlyCostSnapshot,
  RecurringExpenseTemplate,
} from "@/types/clinic-costs";

export type ClinicCostsStore = {
  settings: ClinicCostSettings[];
  templates: RecurringExpenseTemplate[];
  hourlySnapshots: ClinicHourlyCostSnapshot[];
};

declare global {
  var __sorriaClinicCostsStoreV1: ClinicCostsStore | undefined;
}

function stamp(h = 0) {
  return new Date(Date.now() - h * 3600_000).toISOString();
}

function seed(): ClinicCostsStore {
  const month = new Date().toISOString().slice(0, 7);
  return {
    settings: [
      {
        id: "ccs-a-1",
        clinic_id: CLINIC_A_ID,
        calculation_mode: "manual_productive_hours",
        monthly_productive_hours: 120,
        planned_utilization_percent: 80,
        include_owner_compensation: true,
        created_at: stamp(100),
        updated_at: stamp(100),
      },
    ],
    templates: [
      {
        id: "ret-a-rent",
        clinic_id: CLINIC_A_ID,
        name: "Aluguel",
        category: "aluguel",
        amount_cents: 300000,
        cost_behavior: "fixed",
        recurrence: "monthly",
        allocation_eligible: true,
        active: true,
        start_date: `${month}-01`,
        end_date: null,
        created_by: OWNER_A_ID,
        created_at: stamp(90),
        updated_at: stamp(90),
      },
      {
        id: "ret-a-energy",
        clinic_id: CLINIC_A_ID,
        name: "Energia",
        category: "energia",
        amount_cents: 80000,
        cost_behavior: "fixed",
        recurrence: "monthly",
        allocation_eligible: true,
        active: true,
        start_date: `${month}-01`,
        end_date: null,
        created_by: OWNER_A_ID,
        created_at: stamp(90),
        updated_at: stamp(90),
      },
      {
        id: "ret-a-software",
        clinic_id: CLINIC_A_ID,
        name: "Software",
        category: "software",
        amount_cents: 30000,
        cost_behavior: "fixed",
        recurrence: "monthly",
        allocation_eligible: true,
        active: true,
        start_date: `${month}-01`,
        end_date: null,
        created_by: OWNER_A_ID,
        created_at: stamp(90),
        updated_at: stamp(90),
      },
      {
        id: "ret-a-staff",
        clinic_id: CLINIC_A_ID,
        name: "Auxiliar",
        category: "pessoas",
        amount_cents: 200000,
        cost_behavior: "fixed",
        recurrence: "monthly",
        allocation_eligible: true,
        active: true,
        start_date: `${month}-01`,
        end_date: null,
        created_by: OWNER_A_ID,
        created_at: stamp(90),
        updated_at: stamp(90),
      },
      {
        id: "ret-a-accountant",
        clinic_id: CLINIC_A_ID,
        name: "Contador",
        category: "contador",
        amount_cents: 50000,
        cost_behavior: "fixed",
        recurrence: "monthly",
        allocation_eligible: true,
        active: true,
        start_date: `${month}-01`,
        end_date: null,
        created_by: OWNER_A_ID,
        created_at: stamp(90),
        updated_at: stamp(90),
      },
      {
        id: "ret-a-prolabore",
        clinic_id: CLINIC_A_ID,
        name: "Pró-labore (teste)",
        category: "pessoas",
        amount_cents: 540000,
        cost_behavior: "fixed",
        recurrence: "monthly",
        allocation_eligible: true,
        active: true,
        start_date: `${month}-01`,
        end_date: null,
        created_by: OWNER_A_ID,
        created_at: stamp(90),
        updated_at: stamp(90),
      },
    ],
    hourlySnapshots: [],
  };
}

export function getClinicCostsStore(): ClinicCostsStore {
  if (!globalThis.__sorriaClinicCostsStoreV1) {
    globalThis.__sorriaClinicCostsStoreV1 = seed();
  }
  return globalThis.__sorriaClinicCostsStoreV1;
}

export function resetClinicCostsStore() {
  globalThis.__sorriaClinicCostsStoreV1 = seed();
}

export function writeClinicCostAudit(entry: {
  clinic_id: string;
  actor_user_id: string;
  action: string;
  target_type: string;
  target_id: string;
  metadata?: Record<string, unknown>;
}) {
  appendAudit({
    clinic_id: entry.clinic_id,
    actor_user_id: entry.actor_user_id,
    action: entry.action,
    target_type: entry.target_type,
    target_id: entry.target_id,
    metadata: entry.metadata ?? {},
  });
}
