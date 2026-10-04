import { getAssistantStore } from "@/lib/demo/assistant-store";

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 30;

export function checkAssistantRateLimit(userId: string, clinicId: string): boolean {
  const key = `${clinicId}:${userId}`;
  const store = getAssistantStore();
  const now = Date.now();
  const bucket = (store.rateBuckets[key] ?? []).filter((t) => now - t < WINDOW_MS);
  if (bucket.length >= MAX_PER_WINDOW) {
    store.rateBuckets[key] = bucket;
    return false;
  }
  bucket.push(now);
  store.rateBuckets[key] = bucket;
  return true;
}
