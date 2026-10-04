import { appendAudit } from "@/lib/demo/authz-store";
import type {
  AppointmentConsumption,
  PerformedProcedure,
  ProcedureConsumption,
} from "@/types/performed-procedure";

type Store = {
  performedProcedures: PerformedProcedure[];
  procedureConsumptions: ProcedureConsumption[];
  appointmentConsumptions: AppointmentConsumption[];
  /** Idempotência / concorrência por performed_procedure */
  confirmLocks: Map<string, number>;
};

declare global {
  var __sorriaPerformedStoreV1: Store | undefined;
}

function seed(): Store {
  return {
    performedProcedures: [],
    procedureConsumptions: [],
    appointmentConsumptions: [],
    confirmLocks: new Map(),
  };
}

export function getPerformedStore(): Store {
  if (!globalThis.__sorriaPerformedStoreV1) {
    globalThis.__sorriaPerformedStoreV1 = seed();
  }
  return globalThis.__sorriaPerformedStoreV1;
}

export function resetPerformedStore() {
  globalThis.__sorriaPerformedStoreV1 = seed();
}

export function withConfirmLock<T>(key: string, fn: () => T): T {
  const store = getPerformedStore();
  const depth = store.confirmLocks.get(key) ?? 0;
  store.confirmLocks.set(key, depth + 1);
  try {
    return fn();
  } finally {
    const next = (store.confirmLocks.get(key) ?? 1) - 1;
    if (next <= 0) store.confirmLocks.delete(key);
    else store.confirmLocks.set(key, next);
  }
}

export function writePerformedAudit(input: {
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
