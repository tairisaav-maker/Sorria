import { z } from "zod";

export const addPlannedProcedureSchema = z.object({
  appointment_id: z.string().min(1),
  procedure_id: z.string().min(1),
  procedure_variant_id: z.string().optional().nullable(),
  tooth_number: z.number().int().optional().nullable(),
  region: z.string().trim().max(80).optional().nullable(),
  quantity: z.number().positive().optional().default(1),
  notes: z.string().trim().max(500).optional().nullable(),
});

export const updatePlannedProcedureSchema = z.object({
  id: z.string().min(1),
  procedure_id: z.string().min(1).optional(),
  procedure_variant_id: z.string().optional().nullable(),
  tooth_number: z.number().int().optional().nullable(),
  region: z.string().trim().max(80).optional().nullable(),
  quantity: z.number().positive().optional(),
  notes: z.string().trim().max(500).optional().nullable(),
});

export const removePlannedProcedureSchema = z.object({
  id: z.string().min(1),
});

export const convertPlannedProceduresSchema = z.object({
  appointment_id: z.string().min(1),
});

export const forecastNeedsSchema = z.object({
  start_date: z.string().min(1),
  end_date: z.string().min(1),
  professional_id: z.string().optional().nullable(),
});
