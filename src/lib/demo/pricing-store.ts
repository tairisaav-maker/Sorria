import { appendAudit } from "@/lib/demo/authz-store";
import type { ProcedurePriceHistory } from "@/types/pricing";

type Store = {
  priceHistory: ProcedurePriceHistory[];
};

declare global {
  var __sorriaPricingStoreV1: Store | undefined;
}

function seed(): Store {
  return { priceHistory: [] };
}

export function getPricingStore(): Store {
  if (!globalThis.__sorriaPricingStoreV1) {
    globalThis.__sorriaPricingStoreV1 = seed();
  }
  return globalThis.__sorriaPricingStoreV1;
}

export function resetPricingStore() {
  globalThis.__sorriaPricingStoreV1 = seed();
}

export function writePricingAudit(entry: {
  clinic_id: string;
  actor_user_id: string;
  action: string;
  target_type: string;
  target_id: string;
  metadata?: Record<string, unknown>;
}) {
  appendAudit({
    clinic_id: entry.clinic_id,
    actor_user_id: entry.actor_user_id,
    action: entry.action,
    target_type: entry.target_type,
    target_id: entry.target_id,
    metadata: entry.metadata ?? {},
  });
}
