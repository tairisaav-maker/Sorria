import { z } from "zod";
import { CONSUMPTION_MODES, INVENTORY_UNITS } from "@/types/inventory";

export const importMaterialDecisionSchema = z.object({
  material_template_id: z.string().min(1),
  inventory_item_id: z.string().optional().nullable(),
  create_new: z.boolean().optional(),
  custom_name: z.string().trim().min(2).max(160).optional().nullable(),
  skip: z.boolean().optional(),
  suggested_quantity: z.number().min(0).optional().nullable(),
  consumption_mode: z.enum(CONSUMPTION_MODES).optional(),
  optional: z.boolean().optional(),
  clinically_variable: z.boolean().optional(),
});

export const importTemplateSchema = z.object({
  procedure_template_id: z.string().min(1),
  name: z.string().trim().min(2).max(160).optional().nullable(),
  default_duration_minutes: z.number().int().positive().optional().nullable(),
  default_price_reais: z.number().min(0).optional().nullable(),
  materials: z.array(importMaterialDecisionSchema).optional(),
  create_missing_materials: z.boolean().optional().default(true),
});

export const importTemplatesBatchSchema = z.object({
  procedure_template_ids: z.array(z.string().min(1)).min(1).max(40),
  create_missing_materials: z.boolean().optional().default(true),
});

export const toggleFavoriteSchema = z.object({
  procedure_id: z.string().optional().nullable(),
  procedure_template_id: z.string().optional().nullable(),
  favorited: z.boolean(),
});

export const quickCreateMaterialSchema = z.object({
  name: z.string().trim().min(2).max(160),
  consumption_unit: z.enum(INVENTORY_UNITS),
  purchase_unit: z.enum(INVENTORY_UNITS).optional(),
  units_per_purchase_unit: z.number().positive().optional().default(1),
  average_unit_cost_reais: z.number().min(0).optional().nullable(),
  category: z.string().trim().max(80).optional().nullable(),
  material_template_id: z.string().optional().nullable(),
});
