import { appendAudit } from "@/lib/demo/authz-store";
import type { AppointmentPlannedProcedure } from "@/types/forecast";

type Store = {
  planned: AppointmentPlannedProcedure[];
};

declare global {
  var __sorriaPlannedProceduresStoreV1: Store | undefined;
}

function seed(): Store {
  return { planned: [] };
}

export function getPlannedProceduresStore(): Store {
  if (!globalThis.__sorriaPlannedProceduresStoreV1) {
    globalThis.__sorriaPlannedProceduresStoreV1 = seed();
  }
  return globalThis.__sorriaPlannedProceduresStoreV1;
}

export function resetPlannedProceduresStore() {
  globalThis.__sorriaPlannedProceduresStoreV1 = seed();
}

export function writePlannedAudit(input: {
  clinic_id: string;
  actor_user_id: string;
  action: string;
  target_type: string;
  target_id: string;
  metadata?: Record<string, unknown>;
}) {
  appendAudit({
    clinic_id: input.clinic_id,
    actor_user_id: input.actor_user_id,
    action: input.action,
    target_type: input.target_type,
    target_id: input.target_id,
    metadata: input.metadata ?? {},
  });
}
