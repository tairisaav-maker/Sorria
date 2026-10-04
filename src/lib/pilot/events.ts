/**
 * Eventos de produto do piloto — sem conteúdo clínico sensível.
 * Não registrar texto de evolução, CPF, diagnósticos ou arquivos.
 */

export const PILOT_EVENT_NAMES = [
  "appointment.opened",
  "appointment.started",
  "performed_procedure.created",
  "procedure_consumption.opened",
  "procedure_consumption.confirmed",
  "clinical_entry.started",
  "clinical_entry.finalized",
  "financial_charge.created",
  "payment.created",
  "appointment.completed",
  "form.cancelled",
  "form.validation_error",
  "inventory.insufficient_warning",
  "procedure.consumption_corrected",
  "payment.error",
  "feedback.submitted",
  "flow.timing",
] as const;

export type PilotEventName = (typeof PILOT_EVENT_NAMES)[number];

export type PilotEvent = {
  id: string;
  name: PilotEventName;
  clinic_id: string;
  user_id: string;
  route: string | null;
  duration_ms: number | null;
  meta: Record<string, string | number | boolean | null>;
  created_at: string;
  app_version: string;
};

const SENSITIVE_META_KEYS = [
  "cpf",
  "email",
  "phone",
  "password",
  "token",
  "secret",
  "chief_complaint",
  "clinical_exam",
  "procedure_done",
  "conduct",
  "guidance",
  "diagnosis",
  "notes",
  "evolution",
  "full_name",
  "patient_name",
  "text",
  "body",
  "content",
];

export function sanitizePilotMeta(
  meta?: Record<string, unknown>,
): Record<string, string | number | boolean | null> {
  if (!meta) return {};
  const out: Record<string, string | number | boolean | null> = {};
  for (const [k, v] of Object.entries(meta)) {
    const key = k.toLowerCase();
    if (SENSITIVE_META_KEYS.some((s) => key.includes(s))) continue;
    if (v == null) {
      out[k] = null;
      continue;
    }
    if (
      typeof v === "string" ||
      typeof v === "number" ||
      typeof v === "boolean"
    ) {
      // evita strings longas que possam carregar PHI acidental
      if (typeof v === "string" && v.length > 80) {
        out[k] = `${v.slice(0, 40)}…`;
        continue;
      }
      out[k] = v;
    }
  }
  return out;
}

export function isPilotEventName(name: string): name is PilotEventName {
  return (PILOT_EVENT_NAMES as readonly string[]).includes(name);
}
