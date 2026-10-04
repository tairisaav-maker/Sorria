/** Rate limit in-memory para login e recuperação (demo/server). */

type Bucket = number[];

const buckets = new Map<string, Bucket>();

export function checkRateLimit(input: {
  key: string;
  limit: number;
  windowMs: number;
}): boolean {
  const now = Date.now();
  const prev = (buckets.get(input.key) ?? []).filter(
    (t) => now - t < input.windowMs,
  );
  if (prev.length >= input.limit) {
    buckets.set(input.key, prev);
    return false;
  }
  prev.push(now);
  buckets.set(input.key, prev);
  return true;
}

export function resetRateLimitBuckets() {
  buckets.clear();
}

/** Login: 10 tentativas / 15 min por IP+email. */
export function checkLoginRateLimit(ip: string, email: string) {
  return checkRateLimit({
    key: `login:${ip}:${email.toLowerCase()}`,
    limit: 10,
    windowMs: 15 * 60_000,
  });
}
