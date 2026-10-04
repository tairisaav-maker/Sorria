import { z } from "zod";
import { CONSUMPTION_MODES } from "@/types/inventory";

export const createPerformedProcedureSchema = z.object({
  patient_id: z.string().min(1),
  appointment_id: z.string().optional().nullable(),
  procedure_id: z.string().min(1),
  treatment_item_id: z.string().optional().nullable(),
  professional_id: z.string().optional(),
  tooth_number: z.number().int().optional().nullable(),
  region: z.string().trim().max(80).optional().nullable(),
  quantity: z.number().positive().optional().default(1),
  charged_amount_reais: z.number().min(0).optional().nullable(),
  charged_zero_reason: z.string().trim().max(500).optional().nullable(),
});

export const updatePerformedProcedureSchema = z.object({
  id: z.string().min(1),
  tooth_number: z.number().int().optional().nullable(),
  region: z.string().trim().max(80).optional().nullable(),
  quantity: z.number().positive().optional(),
  charged_amount_reais: z.number().min(0).optional().nullable(),
  charged_zero_reason: z.string().trim().max(500).optional().nullable(),
});

export const updateActualConsumptionSchema = z.object({
  performed_procedure_id: z.string().min(1),
  lines: z.array(
    z.object({
      id: z.string().min(1),
      actual_quantity: z.number().min(0),
      actual_inventory_item_id: z.string().optional().nullable(),
    }),
  ),
  appointment_lines: z
    .array(
      z.object({
        id: z.string().min(1),
        actual_quantity: z.number().min(0),
        actual_inventory_item_id: z.string().optional().nullable(),
      }),
    )
    .optional()
    .default([]),
});

export const addExtraMaterialSchema = z.object({
  performed_procedure_id: z.string().min(1),
  inventory_item_id: z.string().min(1),
  quantity: z.number().positive(),
  consumption_mode: z.enum(CONSUMPTION_MODES).optional().default("manual"),
});

export const confirmConsumptionSchema = z.object({
  performed_procedure_id: z.string().min(1),
  confirm_insufficient_stock: z.boolean().optional().default(false),
});

export const correctConsumptionSchema = z.object({
  performed_procedure_id: z.string().min(1),
  lines: z.array(
    z.object({
      id: z.string().min(1),
      actual_quantity: z.number().min(0),
      actual_inventory_item_id: z.string().optional().nullable(),
    }),
  ),
  reason: z.string().trim().min(2).max(500),
});

export const cancelPerformedProcedureSchema = z.object({
  id: z.string().min(1),
  reason: z.string().trim().max(500).optional().nullable(),
});
