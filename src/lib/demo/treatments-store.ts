import {
  CLINIC_A_ID,
  CLINIC_B_ID,
  OWNER_A_ID,
  DENTIST_A_ID,
  DENTIST_B_ID,
  appendAudit,
} from "@/lib/demo/authz-store";
import type {
  TreatmentItem,
  TreatmentPlan,
  TreatmentPlanVersion,
} from "@/types/treatment";

type Store = {
  plans: TreatmentPlan[];
  items: TreatmentItem[];
  versions: TreatmentPlanVersion[];
};

declare global {
  var __sorriaTreatmentsStoreV5: Store | undefined;
}

function stamp(h = 0) {
  return new Date(Date.now() - h * 3600_000).toISOString();
}

function seed(): Store {
  const draft: TreatmentPlan = {
    id: "tp-a-draft",
    clinic_id: CLINIC_A_ID,
    patient_id: "p-a-003",
    title: "Plano rascunho — avaliação",
    description: "Em elaboração",
    notes: "Nota interna: confirmar orçamento amanhã",
    status: "draft",
    version_number: 1,
    subtotal_cents: 35000,
    discount_type: null,
    discount_value_cents: null,
    discount_percent: null,
    total_cents: 35000,
    valid_until: null,
    created_by: OWNER_A_ID,
    presented_by: null,
    presented_at: null,
    accepted_at: null,
    accepted_version: null,
    rejected_at: null,
    rejection_reason: null,
    created_at: stamp(5),
    updated_at: stamp(5),
    archived_at: null,
  };

  const presented: TreatmentPlan = {
    id: "tp-a-presented",
    clinic_id: CLINIC_A_ID,
    patient_id: "p-a-004",
    title: "Plano apresentado — restaurações",
    description: null,
    notes: null,
    status: "presented",
    version_number: 1,
    subtotal_cents: 80000,
    discount_type: "percent",
    discount_value_cents: null,
    discount_percent: 10,
    total_cents: 72000,
    valid_until: new Date(Date.now() + 20 * 86400_000).toISOString().slice(0, 10),
    created_by: OWNER_A_ID,
    presented_by: OWNER_A_ID,
    presented_at: stamp(10),
    accepted_at: null,
    accepted_version: null,
    rejected_at: null,
    rejection_reason: null,
    created_at: stamp(24),
    updated_at: stamp(10),
    archived_at: null,
  };

  const inProgress: TreatmentPlan = {
    id: "tp-a-progress",
    clinic_id: CLINIC_A_ID,
    patient_id: "p-a-001",
    title: "Plano de tratamento — Outubro 2026",
    description: "Tratamento restaurador",
    notes: "Priorizar 16",
    status: "in_progress",
    version_number: 1,
    subtotal_cents: 200000,
    discount_type: "fixed",
    discount_value_cents: 20000,
    discount_percent: null,
    total_cents: 180000,
    valid_until: null,
    created_by: OWNER_A_ID,
    presented_by: OWNER_A_ID,
    presented_at: stamp(100),
    accepted_at: stamp(90),
    accepted_version: 1,
    rejected_at: null,
    rejection_reason: null,
    created_at: stamp(120),
    updated_at: stamp(20),
    archived_at: null,
  };

  const accepted: TreatmentPlan = {
    id: "tp-a-accepted",
    clinic_id: CLINIC_A_ID,
    patient_id: "p-a-002",
    title: "Plano aceito — endodontia",
    description: "Aguardando início",
    notes: "Nota interna: agendar canal",
    status: "accepted",
    version_number: 1,
    subtotal_cents: 95000,
    discount_type: null,
    discount_value_cents: null,
    discount_percent: null,
    total_cents: 95000,
    valid_until: new Date(Date.now() + 40 * 86400_000).toISOString().slice(0, 10),
    created_by: DENTIST_A_ID,
    presented_by: DENTIST_A_ID,
    presented_at: stamp(48),
    accepted_at: stamp(40),
    accepted_version: 1,
    rejected_at: null,
    rejection_reason: null,
    created_at: stamp(60),
    updated_at: stamp(40),
    archived_at: null,
  };

  const completed: TreatmentPlan = {
    id: "tp-a-done",
    clinic_id: CLINIC_A_ID,
    patient_id: "p-a-008",
    title: "Profilaxia — concluído",
    description: null,
    notes: null,
    status: "completed",
    version_number: 1,
    subtotal_cents: 18000,
    discount_type: null,
    discount_value_cents: null,
    discount_percent: null,
    total_cents: 18000,
    valid_until: null,
    created_by: DENTIST_A_ID,
    presented_by: DENTIST_A_ID,
    presented_at: stamp(200),
    accepted_at: stamp(190),
    accepted_version: 1,
    rejected_at: null,
    rejection_reason: null,
    created_at: stamp(220),
    updated_at: stamp(150),
    archived_at: null,
  };

  const rejected: TreatmentPlan = {
    id: "tp-a-rejected",
    clinic_id: CLINIC_A_ID,
    patient_id: "p-a-006",
    title: "Clareamento — recusado",
    description: null,
    notes: null,
    status: "rejected",
    version_number: 1,
    subtotal_cents: 120000,
    discount_type: null,
    discount_value_cents: null,
    discount_percent: null,
    total_cents: 120000,
    valid_until: null,
    created_by: OWNER_A_ID,
    presented_by: OWNER_A_ID,
    presented_at: stamp(80),
    accepted_at: null,
    accepted_version: null,
    rejected_at: stamp(70),
    rejection_reason: "Questão financeira",
    created_at: stamp(90),
    updated_at: stamp(70),
    archived_at: null,
  };

  const clinicB: TreatmentPlan = {
    id: "tp-b-1",
    clinic_id: CLINIC_B_ID,
    patient_id: "p-b-001",
    title: "Plano Clinic B",
    description: null,
    notes: null,
    status: "presented",
    version_number: 1,
    subtotal_cents: 50000,
    discount_type: null,
    discount_value_cents: null,
    discount_percent: null,
    total_cents: 50000,
    valid_until: null,
    created_by: DENTIST_B_ID,
    presented_by: DENTIST_B_ID,
    presented_at: stamp(8),
    accepted_at: null,
    accepted_version: null,
    rejected_at: null,
    rejection_reason: null,
    created_at: stamp(12),
    updated_at: stamp(8),
    archived_at: null,
  };

  const items: TreatmentItem[] = [
    item(draft.id, "p-a-003", "Avaliação", [], 1, 15000, 0, "planned"),
    item(draft.id, "p-a-003", "Profilaxia", [], 1, 20000, 1, "planned"),
    item(presented.id, "p-a-004", "Restauração", [16], 1, 40000, 0, "planned"),
    item(presented.id, "p-a-004", "Restauração", [26], 1, 40000, 1, "planned"),
    item(accepted.id, "p-a-002", "Tratamento endodôntico", [21], 1, 75000, 0, "accepted"),
    item(accepted.id, "p-a-002", "Coroa", [21], 1, 20000, 1, "accepted"),
    item(inProgress.id, "p-a-001", "Restauração", [16], 1, 45000, 0, "completed"),
    item(inProgress.id, "p-a-001", "Restauração", [26], 1, 45000, 1, "in_progress"),
    item(inProgress.id, "p-a-001", "Profilaxia", [], 1, 20000, 2, "accepted"),
    item(inProgress.id, "p-a-001", "Clareamento", [11, 12, 21, 22], 1, 90000, 3, "planned"),
    item(completed.id, "p-a-008", "Profilaxia", [], 1, 18000, 0, "completed"),
    item(rejected.id, "p-a-006", "Clareamento", [11, 21], 1, 120000, 0, "planned"),
    item(clinicB.id, "p-b-001", "Avaliação", [], 1, 50000, 0, "planned"),
  ];

  // Vincular origem odontograma no item 16 do plano em andamento
  items[6]!.source_odontogram_entry_id = "odo-p-a-001-16";

  const versions: TreatmentPlanVersion[] = [
    {
      id: "tpv-presented-1",
      treatment_plan_id: presented.id,
      clinic_id: CLINIC_A_ID,
      version_number: 1,
      snapshot_json: snapshotPlan(presented, items.filter((i) => i.treatment_plan_id === presented.id)),
      presented_by: OWNER_A_ID,
      presented_at: presented.presented_at,
      change_reason: null,
      created_at: presented.presented_at!,
    },
    {
      id: "tpv-accepted-1",
      treatment_plan_id: accepted.id,
      clinic_id: CLINIC_A_ID,
      version_number: 1,
      snapshot_json: snapshotPlan(accepted, items.filter((i) => i.treatment_plan_id === accepted.id)),
      presented_by: DENTIST_A_ID,
      presented_at: accepted.presented_at,
      change_reason: null,
      created_at: accepted.presented_at!,
    },
    {
      id: "tpv-progress-1",
      treatment_plan_id: inProgress.id,
      clinic_id: CLINIC_A_ID,
      version_number: 1,
      snapshot_json: snapshotPlan(inProgress, items.filter((i) => i.treatment_plan_id === inProgress.id)),
      presented_by: OWNER_A_ID,
      presented_at: inProgress.presented_at,
      change_reason: null,
      created_at: inProgress.presented_at!,
    },
  ];

  return {
    plans: [inProgress, accepted, presented, draft, completed, rejected, clinicB],
    items,
    versions,
  };
}

function item(
  planId: string,
  patientId: string,
  name: string,
  teeth: number[],
  qty: number,
  unit: number,
  order: number,
  status: TreatmentItem["status"],
): TreatmentItem {
  return {
    id: crypto.randomUUID(),
    clinic_id: patientId.startsWith("p-b") ? CLINIC_B_ID : CLINIC_A_ID,
    treatment_plan_id: planId,
    patient_id: patientId,
    procedure_name: name,
    description: null,
    tooth_numbers: teeth,
    quantity: qty,
    unit_price_cents: unit,
    total_price_cents: qty * unit,
    status,
    sort_order: order,
    source_odontogram_entry_id: null,
    source_clinical_entry_id: null,
    created_by: OWNER_A_ID,
    created_at: stamp(30),
    updated_at: stamp(20),
  };
}

export function snapshotPlan(plan: TreatmentPlan, items: TreatmentItem[]) {
  return {
    title: plan.title,
    description: plan.description,
    version_number: plan.version_number,
    subtotal_cents: plan.subtotal_cents,
    discount_type: plan.discount_type,
    discount_percent: plan.discount_percent,
    discount_value_cents: plan.discount_value_cents,
    total_cents: plan.total_cents,
    valid_until: plan.valid_until,
    items: items.map((i) => ({
      id: i.id,
      procedure_name: i.procedure_name,
      description: i.description,
      tooth_numbers: i.tooth_numbers,
      quantity: i.quantity,
      unit_price_cents: i.unit_price_cents,
      total_price_cents: i.total_price_cents,
      sort_order: i.sort_order,
    })),
  };
}

export function getTreatmentsStore() {
  if (!globalThis.__sorriaTreatmentsStoreV5) {
    globalThis.__sorriaTreatmentsStoreV5 = seed();
  }
  return globalThis.__sorriaTreatmentsStoreV5;
}

export function resetTreatmentsStore() {
  globalThis.__sorriaTreatmentsStoreV5 = seed();
}

export function writeTreatmentAudit(
  clinicId: string,
  actorUserId: string,
  action: string,
  targetType: string,
  targetId: string,
  metadata: Record<string, unknown> = {},
) {
  appendAudit({
    clinic_id: clinicId,
    actor_user_id: actorUserId,
    action,
    target_type: targetType,
    target_id: targetId,
    metadata,
  });
}
