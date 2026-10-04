import {
  CLINIC_A_ID,
  CLINIC_B_ID,
  OWNER_A_ID,
  DENTIST_A_ID,
  DENTIST_B_ID,
  appendAudit,
} from "@/lib/demo/authz-store";
import type {
  Anamnesis,
  AnamnesisAnswer,
  ClinicalAttachment,
  ClinicalEntry,
  ClinicalEntryVersion,
  OdontogramEntry,
} from "@/types/clinical";

type Store = {
  anamneses: Anamnesis[];
  answers: AnamnesisAnswer[];
  entries: ClinicalEntry[];
  versions: ClinicalEntryVersion[];
  odontogram: OdontogramEntry[];
  attachments: ClinicalAttachment[];
};

declare global {
  var __sorriaClinicalStoreV4: Store | undefined;
}

function stamp(hoursAgo = 0) {
  return new Date(Date.now() - hoursAgo * 3600_000).toISOString();
}

function seed(): Store {
  const anamnesisA: Anamnesis = {
    id: "anam-a-1",
    clinic_id: CLINIC_A_ID,
    patient_id: "p-a-001",
    template_version: 1,
    status: "reviewed",
    answered_by: OWNER_A_ID,
    answered_at: stamp(72),
    reviewed_by: OWNER_A_ID,
    reviewed_at: stamp(70),
    created_by: OWNER_A_ID,
    created_at: stamp(80),
    updated_at: stamp(70),
  };

  const answers: AnamnesisAnswer[] = [
    ans(anamnesisA, "has_allergy", true, null),
    ans(anamnesisA, "allergy_detail", null, "Dipirona (fictício)"),
    ans(anamnesisA, "uses_medication", true, null),
    ans(anamnesisA, "medication_list", null, "Losartana 50mg (fictício)"),
    ans(anamnesisA, "has_hypertension", true, null),
    ans(anamnesisA, "has_diabetes", false, null),
    ans(anamnesisA, "is_pregnant", false, null),
    ans(anamnesisA, "smokes", false, null),
    ans(anamnesisA, "anesthesia_reaction", false, null),
  ];

  const finalized: ClinicalEntry = {
    id: "ce-a-1",
    clinic_id: CLINIC_A_ID,
    patient_id: "p-a-001",
    appointment_id: "appt-a-5",
    professional_id: OWNER_A_ID,
    status: "finalized",
    chief_complaint: "Sensibilidade no dente 16",
    clinical_exam: "Cárie oclusal em 16. Mucosa íntegra.",
    procedure_done: "Restauração provisória",
    conduct: "Orientação de higiene e retorno",
    guidance: "Evitar mastigar do lado direito por 24h",
    next_step: "Retorno em 15 dias",
    related_teeth: [16],
    follow_up_required: true,
    follow_up_interval_days: 15,
    version_number: 2,
    signed_at: stamp(48),
    created_by: OWNER_A_ID,
    created_at: stamp(50),
    updated_at: stamp(40),
  };

  const draft: ClinicalEntry = {
    id: "ce-a-2",
    clinic_id: CLINIC_A_ID,
    patient_id: "p-a-004",
    appointment_id: "appt-a-3",
    professional_id: OWNER_A_ID,
    status: "draft",
    chief_complaint: "Retorno de avaliação",
    clinical_exam: "Em preenchimento…",
    procedure_done: null,
    conduct: null,
    guidance: null,
    next_step: null,
    related_teeth: [],
    follow_up_required: false,
    follow_up_interval_days: null,
    version_number: 1,
    signed_at: null,
    created_by: OWNER_A_ID,
    created_at: stamp(2),
    updated_at: stamp(1),
  };

  const pendingReturn: ClinicalEntry = {
    id: "ce-a-3",
    clinic_id: CLINIC_A_ID,
    patient_id: "p-a-002",
    appointment_id: null,
    professional_id: DENTIST_A_ID,
    status: "finalized",
    chief_complaint: "Limpeza e avaliação",
    clinical_exam: "Gengiva saudável",
    procedure_done: "Profilaxia",
    conduct: "Retorno para reavaliação",
    guidance: "Manter escovação 3x/dia",
    next_step: "Retorno em 30 dias",
    related_teeth: [],
    follow_up_required: true,
    follow_up_interval_days: 30,
    version_number: 1,
    signed_at: stamp(120),
    created_by: DENTIST_A_ID,
    created_at: stamp(122),
    updated_at: stamp(120),
  };

  const versions: ClinicalEntryVersion[] = [
    {
      id: "cev-a-1-1",
      clinical_entry_id: finalized.id,
      clinic_id: CLINIC_A_ID,
      version_number: 1,
      snapshot_json: snapshotOf({ ...finalized, version_number: 1, procedure_done: "Restauração provisória" }),
      changed_by: OWNER_A_ID,
      change_reason: null,
      created_at: stamp(48),
    },
    {
      id: "cev-a-1-2",
      clinical_entry_id: finalized.id,
      clinic_id: CLINIC_A_ID,
      version_number: 2,
      snapshot_json: snapshotOf(finalized),
      changed_by: OWNER_A_ID,
      change_reason: "Complemento da orientação pós-procedimento (demo)",
      created_at: stamp(40),
    },
    {
      id: "cev-a-3-1",
      clinical_entry_id: pendingReturn.id,
      clinic_id: CLINIC_A_ID,
      version_number: 1,
      snapshot_json: snapshotOf(pendingReturn),
      changed_by: DENTIST_A_ID,
      change_reason: null,
      created_at: stamp(120),
    },
  ];

  const odontogram: OdontogramEntry[] = [
    tooth("p-a-001", 16, "caries", "Restauração", "Oclusal"),
    tooth("p-a-001", 26, "restoration", null, null),
    tooth("p-a-001", 36, "healthy", null, null),
    tooth("p-a-001", 46, "missing", null, "Extraído há anos (fictício)"),
    tooth("p-a-002", 11, "healthy", null, null),
    tooth("p-b-001", 21, "caries", "Restauração", "Clinic B"),
  ];

  const attachments: ClinicalAttachment[] = [
    {
      id: "att-a-1",
      clinic_id: CLINIC_A_ID,
      patient_id: "p-a-001",
      clinical_entry_id: finalized.id,
      type: "clinical_photo",
      storage_path: `clinic/${CLINIC_A_ID}/patient/p-a-001/clinical/att-a-1.jpg`,
      file_name: "foto-16-demo.jpg",
      mime_type: "image/jpeg",
      file_size: 120_000,
      description: "Foto oclusal dente 16 (fictícia)",
      patient_visible: false,
      uploaded_by: OWNER_A_ID,
      created_at: stamp(47),
      demo_content_base64: null,
    },
    {
      id: "att-b-1",
      clinic_id: CLINIC_B_ID,
      patient_id: "p-b-001",
      clinical_entry_id: null,
      type: "radiograph",
      storage_path: `clinic/${CLINIC_B_ID}/patient/p-b-001/clinical/att-b-1.jpg`,
      file_name: "rx-clinic-b.jpg",
      mime_type: "image/jpeg",
      file_size: 90_000,
      description: "RX Clinic B",
      patient_visible: false,
      uploaded_by: DENTIST_B_ID,
      created_at: stamp(10),
      demo_content_base64: null,
    },
  ];

  return {
    anamneses: [anamnesisA],
    answers,
    entries: [finalized, draft, pendingReturn],
    versions,
    odontogram,
    attachments,
  };
}

function ans(
  anamnesis: Anamnesis,
  key: string,
  valueBool: boolean | null,
  valueText: string | null,
): AnamnesisAnswer {
  return {
    id: crypto.randomUUID(),
    anamnesis_id: anamnesis.id,
    clinic_id: anamnesis.clinic_id,
    question_key: key,
    value_bool: valueBool,
    value_text: valueText,
    created_at: anamnesis.created_at,
    updated_at: anamnesis.updated_at,
  };
}

function tooth(
  patientId: string,
  number: number,
  condition: OdontogramEntry["condition"],
  planned: string | null,
  notes: string | null,
): OdontogramEntry {
  return {
    id: `odo-${patientId}-${number}`,
    clinic_id: patientId.startsWith("p-b") ? CLINIC_B_ID : CLINIC_A_ID,
    patient_id: patientId,
    tooth_number: number,
    condition,
    planned_procedure: planned,
    notes,
    created_by: OWNER_A_ID,
    created_at: stamp(60),
    updated_at: stamp(20),
  };
}

export function snapshotOf(entry: ClinicalEntry): Record<string, unknown> {
  return {
    chief_complaint: entry.chief_complaint,
    clinical_exam: entry.clinical_exam,
    procedure_done: entry.procedure_done,
    conduct: entry.conduct,
    guidance: entry.guidance,
    next_step: entry.next_step,
    related_teeth: entry.related_teeth,
    follow_up_required: entry.follow_up_required,
    follow_up_interval_days: entry.follow_up_interval_days,
    status: entry.status,
    signed_at: entry.signed_at,
    version_number: entry.version_number,
  };
}

export function getClinicalStore() {
  if (!globalThis.__sorriaClinicalStoreV4) {
    globalThis.__sorriaClinicalStoreV4 = seed();
  }
  return globalThis.__sorriaClinicalStoreV4;
}

export function resetClinicalStore() {
  globalThis.__sorriaClinicalStoreV4 = seed();
}

export function writeClinicalAudit(
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
