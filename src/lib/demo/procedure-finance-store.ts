import { appendAudit } from "@/lib/demo/authz-store";
import type { PerformedProcedureFinancialLink } from "@/types/patient-procedure-finance";

type Store = {
  links: PerformedProcedureFinancialLink[];
};

declare global {
  var __sorriaProcedureFinanceStoreV1: Store | undefined;
}

function seed(): Store {
  return { links: [] };
}

export function getProcedureFinanceStore(): Store {
  if (!globalThis.__sorriaProcedureFinanceStoreV1) {
    globalThis.__sorriaProcedureFinanceStoreV1 = seed();
  }
  return globalThis.__sorriaProcedureFinanceStoreV1;
}

export function resetProcedureFinanceStore() {
  globalThis.__sorriaProcedureFinanceStoreV1 = seed();
}

export function writeProcedureFinanceAudit(input: {
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
