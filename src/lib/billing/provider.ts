/**
 * Abstração de billing — não acoplar o domínio a um único provedor.
 * Implementações: DemoBillingProvider (atual). Stripe/Pagar.me etc. via adapter futuro.
 */

export type CheckoutInput = {
  clinicId: string;
  planCode: string;
  successUrl: string;
  cancelUrl: string;
  customerEmail: string;
};

export type BillingProvider = {
  name: string;
  createCustomer(input: {
    clinicId: string;
    email: string;
    name: string;
  }): Promise<{ customerId: string }>;
  createCheckout(input: CheckoutInput): Promise<{ checkoutUrl: string; sessionId: string }>;
  createSubscription(input: {
    customerId: string;
    planCode: string;
  }): Promise<{ subscriptionId: string }>;
  cancelSubscription(input: {
    subscriptionId: string;
    atPeriodEnd?: boolean;
  }): Promise<{ ok: true }>;
  createBillingPortalSession(input: {
    customerId: string;
    returnUrl: string;
  }): Promise<{ portalUrl: string }>;
  /**
   * Verifica assinatura do webhook e retorna evento normalizado.
   * Retorna null se assinatura inválida.
   */
  verifyAndParseWebhook(input: {
    rawBody: string;
    signature: string | null;
  }): Promise<{
    providerEventId: string;
    eventType: string;
    clinicId: string | null;
    subscriptionId: string | null;
    planCode: string | null;
    status: string | null;
  } | null>;
};

export type NormalizedBillingWebhook = NonNullable<
  Awaited<ReturnType<BillingProvider["verifyAndParseWebhook"]>>
>;
