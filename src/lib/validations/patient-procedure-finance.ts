import { z } from "zod";
import { PERFORMED_FINANCIAL_STATUSES } from "@/types/patient-procedure-finance";

export const setChargedAmountSchema = z.object({
  id: z.string().min(1),
  charged_amount_reais: z.number().min(0),
  charge_note: z.string().trim().max(500).optional().nullable(),
  financial_status: z
    .enum(PERFORMED_FINANCIAL_STATUSES)
    .optional(),
});

export const markNoChargeSchema = z.object({
  id: z.string().min(1),
  reason: z.string().trim().min(2).max(500),
});

export const createChargeFromProcedureSchema = z.object({
  performed_procedure_id: z.string().min(1),
  charged_amount_reais: z.number().min(0).optional(),
  due_date: z.string().optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
});

export const linkToTransactionSchema = z.object({
  performed_procedure_id: z.string().min(1),
  financial_transaction_id: z.string().min(1),
  amount_allocated_reais: z.number().min(0),
});

export const allocateTransactionSchema = z.object({
  financial_transaction_id: z.string().min(1),
  allocations: z
    .array(
      z.object({
        performed_procedure_id: z.string().min(1),
        amount_allocated_reais: z.number().min(0),
      }),
    )
    .min(1),
});

export const linkTreatmentItemSchema = z.object({
  performed_procedure_id: z.string().min(1),
  treatment_item_id: z.string().min(1),
});

export const linkClinicalEntrySchema = z.object({
  clinical_entry_id: z.string().min(1),
  performed_procedure_id: z.string().min(1),
});
