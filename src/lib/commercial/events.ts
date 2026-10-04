/**
 * Analytics comercial / landing — sem PHI, sem conteúdo clínico.
 */

export const COMMERCIAL_EVENT_NAMES = [
  "landing_viewed",
  "cta_clicked",
  "pricing_viewed",
  "lead_submitted",
  "signup_started",
  "signup_completed",
  "how_it_works_viewed",
  "demo_opened",
  "first_procedure_cost_calculated",
  "first_real_procedure_cost_calculated",
  "activation_completed",
  "cancel_feedback_submitted",
] as const;

export type CommercialEventName = (typeof COMMERCIAL_EVENT_NAMES)[number];

export type CommercialEvent = {
  id: string;
  name: CommercialEventName;
  clinic_id: string | null;
  user_id: string | null;
  route: string | null;
  meta: Record<string, string | number | boolean | null>;
  created_at: string;
  app_version: string;
};

const SENSITIVE = [
  "cpf",
  "password",
  "token",
  "secret",
  "chief_complaint",
  "clinical_exam",
  "diagnosis",
  "evolution",
  "notes",
  "patient_name",
  "full_name",
  "phone",
  "whatsapp",
  "email",
];

export function sanitizeCommercialMeta(
  meta?: Record<string, unknown>,
): Record<string, string | number | boolean | null> {
  if (!meta) return {};
  const out: Record<string, string | number | boolean | null> = {};
  for (const [k, v] of Object.entries(meta)) {
    const key = k.toLowerCase();
    if (SENSITIVE.some((s) => key.includes(s))) continue;
    if (v == null) {
      out[k] = null;
      continue;
    }
    if (
      typeof v === "string" ||
      typeof v === "number" ||
      typeof v === "boolean"
    ) {
      if (typeof v === "string" && v.length > 80) {
        out[k] = `${v.slice(0, 40)}…`;
        continue;
      }
      out[k] = v;
    }
  }
  return out;
}

export function isCommercialEventName(
  name: string,
): name is CommercialEventName {
  return (COMMERCIAL_EVENT_NAMES as readonly string[]).includes(name);
}
