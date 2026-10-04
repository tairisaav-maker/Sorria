import { assertPermission } from "@/lib/authz/guards";
import type { AuthzContext } from "@/lib/authz/can";
import {
  getClinicalStore,
  writeClinicalAudit,
} from "@/lib/demo/clinical-store";
import { getPatientRecord } from "@/lib/demo/patients-store";
import {
  ALLOWED_CLINICAL_MIME,
  MAX_CLINICAL_FILE_BYTES,
  clinicalAttachmentSchema,
} from "@/lib/validations/clinical";
import type { ClinicalAttachment } from "@/types/clinical";

function assertPatient(ctx: AuthzContext, patientId: string) {
  const patient = getPatientRecord(patientId);
  if (!patient || patient.clinic_id !== ctx.clinicId) {
    throw new Error("PATIENT_NOT_FOUND");
  }
}

export function listClinicalAttachments(ctx: AuthzContext, patientId: string) {
  assertPermission(ctx, "clinical_files.view");
  assertPatient(ctx, patientId);
  return getClinicalStore()
    .attachments
    .filter((a) => a.clinic_id === ctx.clinicId && a.patient_id === patientId)
    .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
    .map(publicMeta);
}

function publicMeta(a: ClinicalAttachment) {
  const rest = { ...a };
  delete rest.demo_content_base64;
  return rest;
}

export function uploadClinicalAttachment(
  ctx: AuthzContext,
  raw: Record<string, unknown>,
) {
  assertPermission(ctx, "clinical_files.upload");
  const parsed = clinicalAttachmentSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Dados inválidos");
  }
  assertPatient(ctx, parsed.data.patient_id);

  if (!ALLOWED_CLINICAL_MIME.has(parsed.data.mime_type)) {
    throw new Error("MIME_NOT_ALLOWED");
  }
  if (
    typeof parsed.data.file_size === "number" &&
    parsed.data.file_size > MAX_CLINICAL_FILE_BYTES
  ) {
    throw new Error("FILE_TOO_LARGE");
  }

  const id = crypto.randomUUID();
  const storagePath = `clinic/${ctx.clinicId}/patient/${parsed.data.patient_id}/clinical/${id}-${parsed.data.file_name}`;
  const attachment: ClinicalAttachment = {
    id,
    clinic_id: ctx.clinicId,
    patient_id: parsed.data.patient_id,
    clinical_entry_id: parsed.data.clinical_entry_id ?? null,
    type: parsed.data.type,
    storage_path: storagePath,
    file_name: parsed.data.file_name,
    mime_type: parsed.data.mime_type,
    file_size: parsed.data.file_size ?? null,
    description: parsed.data.description || null,
    patient_visible: parsed.data.patient_visible ?? false,
    uploaded_by: ctx.userId,
    created_at: new Date().toISOString(),
    demo_content_base64: parsed.data.content_base64 ?? null,
  };

  getClinicalStore().attachments.unshift(attachment);
  writeClinicalAudit(
    ctx.clinicId,
    ctx.userId,
    "clinical_attachment.uploaded",
    "attachment",
    attachment.id,
    { type: attachment.type },
  );
  return publicMeta(attachment);
}

/**
 * Acesso autorizado: retorna signed URL temporária (demo: data URL / token).
 * Nunca URL pública permanente.
 */
export function getClinicalAttachmentAccess(
  ctx: AuthzContext,
  attachmentId: string,
  purpose: "view" | "download" = "view",
) {
  assertPermission(ctx, "clinical_files.view");
  const attachment = getClinicalStore().attachments.find(
    (a) => a.id === attachmentId,
  );
  if (!attachment || attachment.clinic_id !== ctx.clinicId) {
    throw new Error("ATTACHMENT_NOT_FOUND");
  }

  // Validar path tenant
  if (!attachment.storage_path.startsWith(`clinic/${ctx.clinicId}/`)) {
    throw new Error("ATTACHMENT_NOT_FOUND");
  }

  writeClinicalAudit(
    ctx.clinicId,
    ctx.userId,
    purpose === "download"
      ? "clinical_attachment.downloaded"
      : "clinical_attachment.viewed",
    "attachment",
    attachment.id,
    {},
  );

  const expiresAt = new Date(Date.now() + 5 * 60_000).toISOString();
  const signedUrl = attachment.demo_content_base64
    ? `data:${attachment.mime_type};base64,${attachment.demo_content_base64}`
    : `/api/demo/clinical/attachments?id=${attachment.id}&access=1&exp=${encodeURIComponent(expiresAt)}`;

  return {
    attachment: publicMeta(attachment),
    signedUrl,
    expiresAt,
  };
}

/** Tentativa cross-clinic por path — sempre negada. */
export function tryAccessByStoragePath(ctx: AuthzContext, storagePath: string) {
  assertPermission(ctx, "clinical_files.view");
  const attachment = getClinicalStore().attachments.find(
    (a) => a.storage_path === storagePath,
  );
  if (!attachment || attachment.clinic_id !== ctx.clinicId) {
    throw new Error("ATTACHMENT_NOT_FOUND");
  }
  return getClinicalAttachmentAccess(ctx, attachment.id);
}
