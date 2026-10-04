import { CLINIC_A_ID, CLINIC_B_ID } from "@/lib/demo/authz-store";
import type {
  BillingEvent,
  ClinicInvitation,
  ClinicSubscription,
  EntitlementKey,
  PlanEntitlement,
  SubscriptionPlan,
} from "@/types/saas-billing";

export type BillingStore = {
  plans: SubscriptionPlan[];
  entitlements: PlanEntitlement[];
  subscriptions: ClinicSubscription[];
  events: BillingEvent[];
  invitations: ClinicInvitation[];
  /** contas demo criadas via signup SaaS */
  accounts: Array<{
    user_id: string;
    email: string;
    password_hash: string;
    full_name: string;
    email_verified: boolean;
    created_at: string;
  }>;
};

declare global {
  var __sorriaBillingStoreV1: BillingStore | undefined;
}

const STARTER_ID = "11111111-1111-1111-1111-111111111001";
const PRO_ID = "11111111-1111-1111-1111-111111111002";

function stamp() {
  return new Date().toISOString();
}

function seedPlans(): { plans: SubscriptionPlan[]; entitlements: PlanEntitlement[] } {
  const now = stamp();
  const plans: SubscriptionPlan[] = [
    {
      id: STARTER_ID,
      code: "starter",
      name: "Starter",
      description:
        "Núcleo operacional (placeholder interno — preço não comercial final)",
      billing_interval: "month",
      price_amount_cents: 0,
      currency: "BRL",
      active: true,
      trial_days: 14,
      max_professionals: 2,
      max_staff_users: 3,
      storage_limit_bytes: 1_073_741_824,
      sort_order: 1,
      created_at: now,
      updated_at: now,
    },
    {
      id: PRO_ID,
      code: "pro",
      name: "Pro",
      description:
        "Relatórios avançados, reposição e precificação (placeholder interno)",
      billing_interval: "month",
      price_amount_cents: 0,
      currency: "BRL",
      active: true,
      trial_days: 14,
      max_professionals: 5,
      max_staff_users: 10,
      storage_limit_bytes: 5_368_709_120,
      sort_order: 2,
      created_at: now,
      updated_at: now,
    },
  ];

  const starterKeys: EntitlementKey[] = [
    "inventory",
    "procedure_costing",
    "exports",
  ];
  const proKeys: EntitlementKey[] = [
    "inventory",
    "procedure_costing",
    "operational_costing",
    "advanced_reports",
    "exports",
    "replenishment",
    "pricing_analysis",
  ];

  const entitlements: PlanEntitlement[] = [
    ...starterKeys.map((k) => ({
      id: `pe-starter-${k}`,
      plan_id: STARTER_ID,
      entitlement_key: k,
      enabled: true,
    })),
    ...proKeys.map((k) => ({
      id: `pe-pro-${k}`,
      plan_id: PRO_ID,
      entitlement_key: k,
      enabled: true,
    })),
  ];

  return { plans, entitlements };
}

function seedSubscriptions(): ClinicSubscription[] {
  const now = stamp();
  const periodEnd = new Date();
  periodEnd.setDate(periodEnd.getDate() + 30);
  return [
    {
      id: "sub-a-pro",
      clinic_id: CLINIC_A_ID,
      plan_id: PRO_ID,
      status: "active",
      trial_started_at: null,
      trial_ends_at: null,
      current_period_start: now,
      current_period_end: periodEnd.toISOString(),
      cancel_at_period_end: false,
      billing_provider: "demo",
      provider_customer_id: "cus_demo_a",
      provider_subscription_id: "sub_demo_a",
      created_at: now,
      updated_at: now,
    },
    {
      id: "sub-b-starter",
      clinic_id: CLINIC_B_ID,
      plan_id: STARTER_ID,
      status: "active",
      trial_started_at: null,
      trial_ends_at: null,
      current_period_start: now,
      current_period_end: periodEnd.toISOString(),
      cancel_at_period_end: false,
      billing_provider: "demo",
      provider_customer_id: "cus_demo_b",
      provider_subscription_id: "sub_demo_b",
      created_at: now,
      updated_at: now,
    },
  ];
}

function empty(): BillingStore {
  const { plans, entitlements } = seedPlans();
  return {
    plans,
    entitlements,
    subscriptions: seedSubscriptions(),
    events: [],
    invitations: [],
    accounts: [],
  };
}

export function getBillingStore(): BillingStore {
  if (!globalThis.__sorriaBillingStoreV1) {
    globalThis.__sorriaBillingStoreV1 = empty();
  }
  return globalThis.__sorriaBillingStoreV1;
}

export function resetBillingStore() {
  globalThis.__sorriaBillingStoreV1 = empty();
}

export { STARTER_ID, PRO_ID };
