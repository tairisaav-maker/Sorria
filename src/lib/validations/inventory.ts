import { z } from "zod";
import { CONSUMPTION_MODES, INVENTORY_UNITS } from "@/types/inventory";

export const createProcedureSchema = z.object({
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().max(2000).optional().nullable(),
  category: z.string().trim().max(80).optional().nullable(),
  default_duration_minutes: z.number().int().positive().optional().nullable(),
  default_price_reais: z.number().min(0).optional().nullable(),
});

export const updateProcedureSchema = createProcedureSchema.extend({
  id: z.string().min(1),
  active: z.boolean().optional(),
});

export const archiveProcedureSchema = z.object({
  id: z.string().min(1),
});

export const createInventoryItemSchema = z.object({
  name: z.string().trim().min(2).max(160),
  category: z.string().trim().max(80).optional().nullable(),
  purchase_unit: z.enum(INVENTORY_UNITS),
  consumption_unit: z.enum(INVENTORY_UNITS),
  units_per_purchase_unit: z.number().positive(),
  current_quantity: z.number().min(0).optional().default(0),
  minimum_quantity: z.number().min(0).optional().nullable(),
  /** Custo médio por unidade de consumo em reais (ex.: 0.40) */
  average_unit_cost_reais: z.number().min(0).optional().default(0),
  supplier_name: z.string().trim().max(160).optional().nullable(),
  tracks_lot: z.boolean().optional().default(false),
  tracks_expiration: z.boolean().optional().default(false),
});

export const updateInventoryItemSchema = createInventoryItemSchema.extend({
  id: z.string().min(1),
  active: z.boolean().optional(),
});

export const procedureMaterialSchema = z.object({
  procedure_id: z.string().min(1),
  inventory_item_id: z.string().min(1),
  standard_quantity: z.number().min(0),
  consumption_mode: z.enum(CONSUMPTION_MODES),
  optional: z.boolean().optional().default(false),
  notes: z.string().trim().max(500).optional().nullable(),
});

export const updateProcedureMaterialSchema = z.object({
  id: z.string().min(1),
  standard_quantity: z.number().min(0).optional(),
  consumption_mode: z.enum(CONSUMPTION_MODES).optional(),
  optional: z.boolean().optional(),
  notes: z.string().trim().max(500).optional().nullable(),
});

export const removeProcedureMaterialSchema = z.object({
  id: z.string().min(1),
});
