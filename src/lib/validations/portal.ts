import { z } from "zod";

export const portalRequestSchema = z.object({
  reason: z.enum([
    "Avaliação",
    "Limpeza",
    "Retorno",
    "Dor/Urgência",
    "Continuação de tratamento",
    "Outro",
  ]),
  custom_reason: z.string().trim().max(200).optional().nullable(),
  requested_date: z.string().optional().nullable(),
  preferred_period: z.enum(["morning", "afternoon", "evening"]),
  notes: z.string().trim().max(1000).optional().nullable(),
});

export const portalChangeRequestSchema = z.object({
  appointment_id: z.string().min(1),
  change_kind: z.enum(["other_day", "other_period", "talk_to_clinic"]),
  requested_date: z.string().optional().nullable(),
  preferred_period: z.enum(["morning", "afternoon", "evening"]).optional(),
  notes: z.string().trim().max(1000).optional().nullable(),
});

export const portalCancelRequestSchema = z.object({
  appointment_id: z.string().min(1),
  notes: z.string().trim().max(1000).optional().nullable(),
});

export const portalProfileUpdateSchema = z.object({
  preferred_name: z.string().trim().max(80).optional().nullable(),
  phone: z.string().trim().max(40).optional().nullable(),
  email: z.string().trim().email().optional().nullable().or(z.literal("")),
  postal_code: z.string().trim().max(20).optional().nullable(),
  street: z.string().trim().max(120).optional().nullable(),
  number: z.string().trim().max(20).optional().nullable(),
  complement: z.string().trim().max(80).optional().nullable(),
  neighborhood: z.string().trim().max(80).optional().nullable(),
  city: z.string().trim().max(80).optional().nullable(),
  state: z.string().trim().max(2).optional().nullable(),
});

export const portalAlternativeSchema = z.object({
  request_id: z.string().min(1),
  requested_date: z.string().optional().nullable(),
  preferred_period: z.enum(["morning", "afternoon", "evening"]),
  notes: z.string().trim().max(1000).optional().nullable(),
});
