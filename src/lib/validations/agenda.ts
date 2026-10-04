import { z } from "zod";

export const createAppointmentSchema = z
  .object({
    patient_id: z.string().min(1, "Selecione um paciente"),
    professional_id: z.string().min(1, "Selecione um profissional"),
    start_at: z.string().min(1, "Informe o início"),
    end_at: z.string().min(1, "Informe o fim"),
    reason: z.string().trim().max(120).optional().default(""),
    notes: z.string().trim().max(500).optional().default(""),
    estimated_value: z.union([z.number(), z.nan()]).optional().nullable(),
    clinic_id: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    if (new Date(value.end_at) <= new Date(value.start_at)) {
      ctx.addIssue({
        code: "custom",
        path: ["end_at"],
        message: "O fim deve ser depois do início",
      });
    }
    const minutes =
      (+new Date(value.end_at) - +new Date(value.start_at)) / 60_000;
    if (minutes < 10 || minutes > 240) {
      ctx.addIssue({
        code: "custom",
        path: ["end_at"],
        message: "Duração deve ser entre 10 e 240 minutos",
      });
    }
  });

export type CreateAppointmentValues = z.input<typeof createAppointmentSchema>;

export const rescheduleAppointmentSchema = z
  .object({
    start_at: z.string().min(1),
    end_at: z.string().min(1),
    professional_id: z.string().min(1),
  })
  .superRefine((value, ctx) => {
    if (new Date(value.end_at) <= new Date(value.start_at)) {
      ctx.addIssue({
        code: "custom",
        path: ["end_at"],
        message: "O fim deve ser depois do início",
      });
    }
  });

export const cancelAppointmentSchema = z.object({
  cancellation_reason: z.string().trim().max(300).optional().default(""),
});

export const changeAppointmentStatusSchema = z.object({
  status: z.enum([
    "scheduled",
    "confirmed",
    "arrived",
    "in_progress",
    "completed",
    "no_show",
    "cancelled",
  ]),
  reason: z.string().trim().max(300).optional().default(""),
});

export const proposeAppointmentSchema = z
  .object({
    proposed_start_at: z.string().min(1),
    proposed_end_at: z.string().min(1),
    proposed_professional_id: z.string().min(1),
  })
  .superRefine((value, ctx) => {
    if (
      new Date(value.proposed_end_at) <= new Date(value.proposed_start_at)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["proposed_end_at"],
        message: "O fim deve ser depois do início",
      });
    }
  });

export const rejectAppointmentRequestSchema = z.object({
  rejection_reason: z.string().trim().max(300).optional().default(""),
});

export const createAppointmentRequestSchema = z.object({
  patient_id: z.string().min(1),
  requested_date: z.string().optional().default(""),
  preferred_period: z.enum(["morning", "afternoon", "evening"]),
  reason: z.string().min(1),
  custom_reason: z.string().optional().default(""),
  notes: z.string().optional().default(""),
});
