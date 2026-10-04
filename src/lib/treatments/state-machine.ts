import type {
  TreatmentItemStatus,
  TreatmentPlanStatus,
} from "@/types/treatment";

const PLAN: Record<TreatmentPlanStatus, TreatmentPlanStatus[]> = {
  draft: ["presented"],
  presented: ["accepted", "rejected", "draft"],
  accepted: ["in_progress", "completed"],
  in_progress: ["completed"],
  completed: [],
  rejected: [],
};

const ITEM: Record<TreatmentItemStatus, TreatmentItemStatus[]> = {
  planned: ["accepted", "in_progress", "cancelled"],
  accepted: ["in_progress", "cancelled"],
  in_progress: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

export function canTransitionPlan(
  from: TreatmentPlanStatus,
  to: TreatmentPlanStatus,
) {
  return from === to || PLAN[from].includes(to);
}

export function canTransitionItem(
  from: TreatmentItemStatus,
  to: TreatmentItemStatus,
) {
  return from === to || ITEM[from].includes(to);
}

export function assertPlanTransition(
  from: TreatmentPlanStatus,
  to: TreatmentPlanStatus,
) {
  if (!canTransitionPlan(from, to)) {
    throw new Error(`Transição de plano inválida: ${from} → ${to}`);
  }
}

export function assertItemTransition(
  from: TreatmentItemStatus,
  to: TreatmentItemStatus,
) {
  if (!canTransitionItem(from, to)) {
    throw new Error(`Transição de item inválida: ${from} → ${to}`);
  }
}
