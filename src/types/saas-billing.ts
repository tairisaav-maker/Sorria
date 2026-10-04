export const SUBSCRIPTION_STATUSES = [
  "trialing",
  "active",
  "past_due",
  "cancelled",
  "expired",
] as const;

export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export const SUBSCRIPTION_STATUS_LABELS: Record<SubscriptionStatus, string> = {
  trialing: "Período de teste",
  active: "Ativa",
  past_due: "Pagamento pendente",
  cancelled: "Cancelada",
  expired: "Expirada",
};

export const ENTITLEMENT_KEYS = [
  "inventory",
  "procedure_costing",
  "operational_costing",
  "advanced_reports",
  "exports",
  "replenishment",
  "pricing_analysis",
] as const;

export type EntitlementKey = (typeof ENTITLEMENT_KEYS)[number];

export type SubscriptionPlan = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  billing_interval: "month" | "year";
  price_amount_cents: number;
  currency: string;
  active: boolean;
  trial_days: number | null;
  max_professionals: number | null;
  max_staff_users: number | null;
  storage_limit_bytes: number | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type PlanEntitlement = {
  id: string;
  plan_id: string;
  entitlement_key: EntitlementKey;
  enabled: boolean;
};

export type ClinicSubscription = {
  id: string;
  clinic_id: string;
  plan_id: string;
  status: SubscriptionStatus;
  trial_started_at: string | null;
  trial_ends_at: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  billing_provider: string | null;
  provider_customer_id: string | null;
  provider_subscription_id: string | null;
  created_at: string;
  updated_at: string;
};

export type BillingEvent = {
  id: string;
  provider: string;
  provider_event_id: string;
  event_type: string;
  clinic_id: string | null;
  payload_digest: string | null;
  processed_at: string | null;
  status: "received" | "processed" | "ignored" | "failed";
  error_message: string | null;
  created_at: string;
};

export type ClinicInvitation = {
  id: string;
  clinic_id: string;
  email: string;
  role_key: "dentist" | "secretary";
  token_hash: string;
  invited_by: string | null;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
  created_at: string;
};

/** Assinatura permite uso pleno do produto. */
export function isSubscriptionUsable(status: SubscriptionStatus) {
  return status === "trialing" || status === "active";
}

/**
 * Política de modo restrito (assinatura vencida/cancelada/expirada):
 * - login permitido
 * - billing / export essencial / visualização permitidos
 * - criação de novos registros comerciais bloqueada
 * - dados NUNCA apagados automaticamente
 * - acesso emergencial a informação clínica existente permanece (leitura)
 */
export function isSubscriptionRestricted(status: SubscriptionStatus) {
  return (
    status === "past_due" ||
    status === "cancelled" ||
    status === "expired"
  );
}
