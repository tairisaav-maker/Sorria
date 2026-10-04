import type { PurchaseList, PurchaseListItem } from "@/types/replenishment";
import { appendAudit } from "@/lib/demo/authz-store";

export type PurchaseListsStore = {
  lists: PurchaseList[];
  items: PurchaseListItem[];
};

declare global {
  var __sorriaPurchaseListsStoreV1: PurchaseListsStore | undefined;
}

function seed(): PurchaseListsStore {
  return { lists: [], items: [] };
}

export function getPurchaseListsStore(): PurchaseListsStore {
  if (!globalThis.__sorriaPurchaseListsStoreV1) {
    globalThis.__sorriaPurchaseListsStoreV1 = seed();
  }
  return globalThis.__sorriaPurchaseListsStoreV1;
}

export function resetPurchaseListsStore() {
  globalThis.__sorriaPurchaseListsStoreV1 = seed();
}

export function writePurchaseListAudit(entry: {
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
