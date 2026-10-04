import { z } from "zod";
import { isValidFdiTooth } from "@/lib/clinical/teeth";

export const createTreatmentPlanSchema = z.object({
  patient_id: z.string().min(1),
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().max(2000).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  valid_until: z.string().optional().nullable(),
  discount_type: z.enum(["percent", "fixed"]).optional().nullable(),
  discount_percent: z.number().min(0).max(100).optional().nullable(),
  discount_value_reais: z.number().min(0).optional().nullable(),
});

export const updateTreatmentPlanSchema = createTreatmentPlanSchema
  .omit({ patient_id: true })
  .extend({
    id: z.string().min(1),
    expected_updated_at: z.string().optional(),
  });

export const treatmentItemSchema = z
  .object({
    treatment_plan_id: z.string().min(1),
    procedure_name: z.string().trim().min(1).max(160),
    description: z.string().trim().max(1000).optional().nullable(),
    tooth_numbers: z.array(z.number().int()).max(32).optional().default([]),
    quantity: z.number().int().positive().default(1),
    unit_price_reais: z.number().min(0),
    source_odontogram_entry_id: z.string().optional().nullable(),
    source_clinical_entry_id: z.string().optional().nullable(),
    expected_updated_at: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    for (const t of value.tooth_numbers) {
      if (!isValidFdiTooth(t)) {
        ctx.addIssue({
          code: "custom",
          path: ["tooth_numbers"],
          message: `Dente FDI inválido: ${t}`,
        });
      }
    }
  });

export const rejectTreatmentPlanSchema = z.object({
  id: z.string().min(1),
  rejection_reason: z.string().trim().max(500).optional().default(""),
});
