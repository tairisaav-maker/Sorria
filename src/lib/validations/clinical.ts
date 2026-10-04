import { z } from "zod";
import { isValidFdiTooth } from "@/lib/clinical/teeth";

export const anamnesisAnswersSchema = z.record(
  z.string(),
  z.object({
    value_bool: z.boolean().nullable().optional(),
    value_text: z.string().trim().max(2000).nullable().optional(),
  }),
);

export const clinicalEntryDraftSchema = z.object({
  patient_id: z.string().min(1),
  appointment_id: z.string().nullable().optional(),
  performed_procedure_id: z.string().nullable().optional(),
  chief_complaint: z.string().trim().max(2000).optional().default(""),
  clinical_exam: z.string().trim().max(4000).optional().default(""),
  procedure_done: z.string().trim().max(4000).optional().default(""),
  conduct: z.string().trim().max(4000).optional().default(""),
  guidance: z.string().trim().max(4000).optional().default(""),
  next_step: z.string().trim().max(1000).optional().default(""),
  related_teeth: z.array(z.number().int()).max(32).optional().default([]),
  follow_up_required: z.boolean().optional().default(false),
  follow_up_interval_days: z.number().int().positive().nullable().optional(),
  expected_updated_at: z.string().optional(),
});

export const clinicalEntryFinalizeSchema = z.object({
  id: z.string().min(1),
  expected_updated_at: z.string().optional(),
});

export const clinicalEntryCorrectionSchema = z.object({
  id: z.string().min(1),
  change_reason: z.string().trim().min(3, "Informe o motivo da correção").max(500),
  chief_complaint: z.string().trim().max(2000).optional(),
  clinical_exam: z.string().trim().max(4000).optional(),
  procedure_done: z.string().trim().max(4000).optional(),
  conduct: z.string().trim().max(4000).optional(),
  guidance: z.string().trim().max(4000).optional(),
  next_step: z.string().trim().max(1000).optional(),
  related_teeth: z.array(z.number().int()).max(32).optional(),
  follow_up_required: z.boolean().optional(),
  follow_up_interval_days: z.number().int().positive().nullable().optional(),
  expected_updated_at: z.string().optional(),
});

export const odontogramEntrySchema = z
  .object({
    patient_id: z.string().min(1),
    tooth_number: z.number().int(),
    condition: z.enum([
      "healthy",
      "caries",
      "restoration",
      "missing",
      "implant",
      "crown",
      "endodontics",
      "extraction_indicated",
      "other",
    ]),
    planned_procedure: z.string().trim().max(300).optional().nullable(),
    notes: z.string().trim().max(1000).optional().nullable(),
  })
  .superRefine((value, ctx) => {
    if (!isValidFdiTooth(value.tooth_number)) {
      ctx.addIssue({
        code: "custom",
        path: ["tooth_number"],
        message: "Número de dente FDI inválido",
      });
    }
  });

export const clinicalAttachmentSchema = z.object({
  patient_id: z.string().min(1),
  clinical_entry_id: z.string().nullable().optional(),
  type: z.enum(["clinical_photo", "radiograph", "exam", "pdf", "other"]),
  file_name: z.string().min(1).max(255),
  mime_type: z.string().min(1),
  file_size: z.number().int().nonnegative().optional(),
  description: z.string().trim().max(500).optional().nullable(),
  patient_visible: z.boolean().optional().default(false),
  content_base64: z.string().optional(),
});

export const ALLOWED_CLINICAL_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

export const MAX_CLINICAL_FILE_BYTES = 10 * 1024 * 1024;
