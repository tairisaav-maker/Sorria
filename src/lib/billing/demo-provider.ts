import type { BillingProvider } from "@/lib/billing/provider";

/**
 * Provider demo — simula checkout/portal sem SDK externo.
 * Ativação de plano NÃO ocorre pelo redirect; ocorre via handleWebhook idempotente.
 */
export function createDemoBillingProvider(): BillingProvider {
  return {
    name: "demo",
    async createCustomer(input) {
      return { customerId: `cus_demo_${input.clinicId.slice(0, 8)}` };
    },
    async createCheckout(input) {
      const sessionId = `cs_demo_${crypto.randomUUID()}`;
      const url = `${input.successUrl}${input.successUrl.includes("?") ? "&" : "?"}session=${sessionId}&plan=${encodeURIComponent(input.planCode)}`;
      return { checkoutUrl: url, sessionId };
    },
    async createSubscription(input) {
      return { subscriptionId: `sub_demo_${input.customerId}` };
    },
    async cancelSubscription() {
      return { ok: true as const };
    },
    async createBillingPortalSession(input) {
      return {
        portalUrl: `${input.returnUrl}${input.returnUrl.includes("?") ? "&" : "?"}portal=1`,
      };
    },
    async verifyAndParseWebhook(input) {
      // Demo: exige header x-sorria-billing-secret = DEMO_BILLING_WEBHOOK_SECRET ou "demo-secret"
      const expected =
        process.env.DEMO_BILLING_WEBHOOK_SECRET ?? "demo-secret";
      if (input.signature !== expected) return null;
      try {
        const body = JSON.parse(input.rawBody) as {
          id?: string;
          type?: string;
          clinic_id?: string;
          subscription_id?: string;
          plan_code?: string;
          status?: string;
        };
        if (!body.id || !body.type) return null;
        return {
          providerEventId: body.id,
          eventType: body.type,
          clinicId: body.clinic_id ?? null,
          subscriptionId: body.subscription_id ?? null,
          planCode: body.plan_code ?? null,
          status: body.status ?? null,
        };
      } catch {
        return null;
      }
    },
  };
}

let cached: BillingProvider | null = null;

export function getBillingProvider(): BillingProvider {
  if (!cached) cached = createDemoBillingProvider();
  return cached;
}
