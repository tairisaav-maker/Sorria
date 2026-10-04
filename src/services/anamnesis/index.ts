import { assertPermission } from "@/lib/authz/guards";
import type { AuthzContext } from "@/lib/authz/can";
import {
  ANAMNESIS_TEMPLATE_VERSION,
} from "@/lib/clinical/anamnesis-template";
import {
  getClinicalStore,
  writeClinicalAudit,
} from "@/lib/demo/clinical-store";
import { getPatientRecord } from "@/lib/demo/patients-store";
import { anamnesisAnswersSchema } from "@/lib/validations/clinical";
import type { Anamnesis, AnamnesisAnswer } from "@/types/clinical";

function assertPatient(ctx: AuthzContext, patientId: string) {
  const patient = getPatientRecord(patientId);
  if (!patient || patient.clinic_id !== ctx.clinicId) {
    throw new Error("PATIENT_NOT_FOUND");
  }
  return patient;
}

export function getAnamnesis(ctx: AuthzContext, patientId: string) {
  assertPermission(ctx, "anamnesis.view");
  assertPatient(ctx, patientId);
  const store = getClinicalStore();
  const anamnesis =
    store.anamneses.find(
      (a) => a.clinic_id === ctx.clinicId && a.patient_id === patientId,
    ) ?? null;
  if (!anamnesis) return { anamnesis: null, answers: [] as AnamnesisAnswer[] };
  const answers = store.answers.filter((a) => a.anamnesis_id === anamnesis.id);
  return { anamnesis, answers };
}

function upsertAnswers(
  anamnesis: Anamnesis,
  raw: Record<string, { value_bool?: boolean | null; value_text?: string | null }>,
) {
  const parsed = anamnesisAnswersSchema.safeParse(raw);
  if (!parsed.success) throw new Error("Dados inválidos");
  const store = getClinicalStore();
  const now = new Date().toISOString();
  for (const [key, value] of Object.entries(parsed.data)) {
    const existing = store.answers.findIndex(
      (a) => a.anamnesis_id === anamnesis.id && a.question_key === key,
    );
    const row: AnamnesisAnswer = {
      id: existing >= 0 ? store.answers[existing]!.id : crypto.randomUUID(),
      anamnesis_id: anamnesis.id,
      clinic_id: anamnesis.clinic_id,
      question_key: key,
      value_bool: value.value_bool ?? null,
      value_text: value.value_text?.trim() || null,
      created_at: existing >= 0 ? store.answers[existing]!.created_at : now,
      updated_at: now,
    };
    if (existing >= 0) store.answers[existing] = row;
    else store.answers.push(row);
  }
}

export function saveAnamnesisDraft(
  ctx: AuthzContext,
  patientId: string,
  answers: Record<string, { value_bool?: boolean | null; value_text?: string | null }>,
) {
  assertPermission(ctx, "anamnesis.create");
  assertPatient(ctx, patientId);
  const store = getClinicalStore();
  let anamnesis = store.anamneses.find(
    (a) => a.clinic_id === ctx.clinicId && a.patient_id === patientId,
  );
  const now = new Date().toISOString();
  if (!anamnesis) {
    anamnesis = {
      id: crypto.randomUUID(),
      clinic_id: ctx.clinicId,
      patient_id: patientId,
      template_version: ANAMNESIS_TEMPLATE_VERSION,
      status: "draft",
      answered_by: ctx.userId,
      answered_at: null,
      reviewed_by: null,
      reviewed_at: null,
      created_by: ctx.userId,
      created_at: now,
      updated_at: now,
    };
    store.anamneses.unshift(anamnesis);
    writeClinicalAudit(ctx.clinicId, ctx.userId, "anamnesis.created", "anamnesis", anamnesis.id);
  } else if (anamnesis.status === "reviewed") {
    // alterações após revisão: volta para submitted e registra audit
    anamnesis.status = "submitted";
    anamnesis.reviewed_by = null;
    anamnesis.reviewed_at = null;
  } else if (anamnesis.status !== "draft" && anamnesis.status !== "submitted") {
    throw new Error("Não é possível editar esta anamnese");
  }

  upsertAnswers(anamnesis, answers);
  anamnesis.answered_by = ctx.userId;
  anamnesis.updated_at = now;
  writeClinicalAudit(ctx.clinicId, ctx.userId, "anamnesis.updated", "anamnesis", anamnesis.id, {
    status: anamnesis.status,
  });
  return getAnamnesis(ctx, patientId);
}

export function submitAnamnesis(ctx: AuthzContext, patientId: string) {
  assertPermission(ctx, "anamnesis.update");
  const { anamnesis } = getAnamnesis(ctx, patientId);
  if (!anamnesis) throw new Error("ANAMNESIS_NOT_FOUND");
  if (anamnesis.status !== "draft" && anamnesis.status !== "submitted") {
    throw new Error("Transição de anamnese inválida");
  }
  const now = new Date().toISOString();
  anamnesis.status = "submitted";
  anamnesis.answered_by = ctx.userId;
  anamnesis.answered_at = now;
  anamnesis.updated_at = now;
  writeClinicalAudit(ctx.clinicId, ctx.userId, "anamnesis.submitted", "anamnesis", anamnesis.id);
  return getAnamnesis(ctx, patientId);
}

export function reviewAnamnesis(ctx: AuthzContext, patientId: string) {
  assertPermission(ctx, "anamnesis.update");
  const { anamnesis } = getAnamnesis(ctx, patientId);
  if (!anamnesis) throw new Error("ANAMNESIS_NOT_FOUND");
  if (anamnesis.status !== "submitted" && anamnesis.status !== "reviewed") {
    throw new Error("Transição de anamnese inválida");
  }
  const now = new Date().toISOString();
  anamnesis.status = "reviewed";
  anamnesis.reviewed_by = ctx.userId;
  anamnesis.reviewed_at = now;
  anamnesis.updated_at = now;
  writeClinicalAudit(ctx.clinicId, ctx.userId, "anamnesis.reviewed", "anamnesis", anamnesis.id);
  return getAnamnesis(ctx, patientId);
}
