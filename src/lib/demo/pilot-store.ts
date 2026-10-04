import type { PilotEvent } from "@/lib/pilot/events";

export type PilotFeedbackKind = "bug" | "friction" | "suggestion";
export type PilotFeedbackImpact = "none" | "some" | "much";
export type PilotFeedbackPriority = "P0" | "P1" | "P2" | "P3" | "P4" | null;

export type PilotFeedback = {
  id: string;
  clinic_id: string;
  user_id: string;
  kind: PilotFeedbackKind;
  what_happened: string;
  what_expected: string;
  impact: PilotFeedbackImpact;
  route: string;
  app_version: string;
  priority: PilotFeedbackPriority;
  created_at: string;
};

export type PilotStore = {
  events: PilotEvent[];
  feedback: PilotFeedback[];
};

declare global {
  var __sorriaPilotStoreV1: PilotStore | undefined;
}

function empty(): PilotStore {
  return { events: [], feedback: [] };
}

export function getPilotStore(): PilotStore {
  if (!globalThis.__sorriaPilotStoreV1) {
    globalThis.__sorriaPilotStoreV1 = empty();
  }
  return globalThis.__sorriaPilotStoreV1;
}

export function resetPilotStore() {
  globalThis.__sorriaPilotStoreV1 = empty();
}
