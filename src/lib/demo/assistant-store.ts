import type {
  AssistantActionPlan,
  AssistantMessage,
  AssistantThread,
} from "@/types/assistant";

type Store = {
  threads: AssistantThread[];
  messages: AssistantMessage[];
  actions: AssistantActionPlan[];
  /** rate limit: userId -> timestamps */
  rateBuckets: Record<string, number[]>;
};

declare global {
  var __sorriaAssistantStoreV9: Store | undefined;
}

function seed(): Store {
  return { threads: [], messages: [], actions: [], rateBuckets: {} };
}

export function getAssistantStore() {
  if (!globalThis.__sorriaAssistantStoreV9) {
    globalThis.__sorriaAssistantStoreV9 = seed();
  }
  return globalThis.__sorriaAssistantStoreV9;
}

export function resetAssistantStore() {
  globalThis.__sorriaAssistantStoreV9 = seed();
}
