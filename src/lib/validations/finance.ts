import { z } from "zod";

export const paymentMethodSchema = z.enum([
  "pix",
  "cash",
  "debit_card",
  "credit_card",
  "bank_transfer",
  "other",
]);

export const expenseCategorySchema = z.enum([
  "material",
  "laboratorio",
  "aluguel",
  "energia",
  "internet",
  "servicos",
  "marketing",
  "manutencao",
  "impostos",
  "outros",
]);

export const financialTransactionSchema = z.object({
  type: z.enum(["income", "expense"]),
  description: z.string().trim().min(2).max(200),
  patient_id: z.string().optional().nullable(),
  treatment_plan_id: z.string().optional().nullable(),
  appointment_id: z.string().optional().nullable(),
  category: expenseCategorySchema.optional().nullable(),
  gross_amount_reais: z.number().min(0),
  discount_amount_reais: z.number().min(0).optional().default(0),
  due_date: z.string().optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
  installments_count: z.number().int().min(1).max(48).optional().default(1),
  custom_installments: z
    .array(
      z.object({
        amount_reais: z.number().min(0),
        due_date: z.string().min(8),
      }),
    )
    .optional(),
});

export const expenseSchema = financialTransactionSchema.extend({
  type: z.literal("expense"),
  category: expenseCategorySchema,
});

export const installmentPlanSchema = z.object({
  treatment_plan_id: z.string().min(1),
  description: z.string().trim().min(2).max(200).optional(),
  discount_amount_reais: z.number().min(0).optional().default(0),
  installments_count: z.number().int().min(1).max(48).optional(),
  first_due_date: z.string().optional(),
  custom_installments: z
    .array(
      z.object({
        amount_reais: z.number().min(0),
        due_date: z.string().min(8),
      }),
    )
    .optional(),
  notes: z.string().trim().max(1000).optional().nullable(),
});

export const paymentSchema = z.object({
  installment_id: z.string().min(1),
  amount_reais: z.number().positive(),
  paid_at: z.string().min(8),
  payment_method: paymentMethodSchema,
  notes: z.string().trim().max(500).optional().nullable(),
  client_request_id: z.string().min(8).max(80).optional(),
});

export const paymentReversalSchema = z.object({
  payment_id: z.string().min(1),
  reversal_reason: z.string().trim().min(2).max(500),
});

export const financialFilterSchema = z.object({
  period: z
    .enum(["7d", "30d", "month", "6m", "year", "custom"])
    .optional()
    .default("month"),
  from: z.string().optional(),
  to: z.string().optional(),
  type: z.enum(["income", "expense", "all"]).optional().default("all"),
  status: z
    .enum(["all", "pending", "partially_paid", "paid", "overdue", "cancelled"])
    .optional()
    .default("all"),
  method: paymentMethodSchema.or(z.literal("all")).optional().default("all"),
  patient_id: z.string().optional().nullable(),
  category: expenseCategorySchema.or(z.literal("all")).optional().default("all"),
  q: z.string().optional().default(""),
});
