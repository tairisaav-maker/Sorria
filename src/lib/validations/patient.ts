import { z } from "zod";
import {
  isReasonablePhone,
  isValidCpf,
  normalizeCpf,
  normalizeEmail,
  normalizePhone,
} from "@/lib/patients/normalize";

export const patientFormSchema = z.object({
  full_name: z.string().trim().min(2, "Informe o nome completo").max(160),
  preferred_name: z.string().optional().default(""),
  birth_date: z.string().optional().default(""),
  cpf: z.string().optional().default(""),
  phone: z.string().optional().default(""),
  secondary_phone: z.string().optional().default(""),
  email: z.string().optional().default(""),
  postal_code: z.string().optional().default(""),
  street: z.string().optional().default(""),
  number: z.string().optional().default(""),
  complement: z.string().optional().default(""),
  neighborhood: z.string().optional().default(""),
  city: z.string().optional().default(""),
  state: z.string().optional().default(""),
  guardian_name: z.string().optional().default(""),
  guardian_phone: z.string().optional().default(""),
  guardian_relationship: z.string().optional().default(""),
  emergency_contact_name: z.string().optional().default(""),
  emergency_contact_phone: z.string().optional().default(""),
  emergency_contact_relationship: z.string().optional().default(""),
  referral_source: z.string().optional().default(""),
  administrative_notes: z.string().optional().default(""),
  status: z.enum(["active", "inactive", "archived"]).default("active"),
  acknowledge_duplicate: z.boolean().default(false),
}).superRefine((value, ctx) => {
  if (value.cpf?.trim() && !isValidCpf(value.cpf)) {
    ctx.addIssue({
      code: "custom",
      path: ["cpf"],
      message: "Confira o CPF informado.",
    });
  }
  if (value.email?.trim()) {
    const parsed = z.string().email().safeParse(value.email.trim());
    if (!parsed.success) {
      ctx.addIssue({
        code: "custom",
        path: ["email"],
        message: "Digite um e-mail válido.",
      });
    }
  }
  if (value.phone?.trim() && !isReasonablePhone(value.phone)) {
    ctx.addIssue({
      code: "custom",
      path: ["phone"],
      message: "Confira o telefone informado.",
    });
  }
  if (
    value.secondary_phone?.trim() &&
    !isReasonablePhone(value.secondary_phone)
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["secondary_phone"],
      message: "Confira o telefone secundário.",
    });
  }
});

export type PatientFormValues = z.infer<typeof patientFormSchema>;

export const createPatientSchema = patientFormSchema;
export const updatePatientSchema = patientFormSchema;

export function emptyToUndefined(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function toNormalizedFields(values: PatientFormValues) {
  return {
    cpf_normalized: normalizeCpf(values.cpf),
    phone_normalized: normalizePhone(values.phone),
    secondary_phone_normalized: normalizePhone(values.secondary_phone),
    email_normalized: normalizeEmail(values.email),
  };
}
