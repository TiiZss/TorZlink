/** Simple fixed-window rate limit (per key). Returns false when over limit. */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
const MAX_KEYS = 10_000;

export type RateLimitOptions = {
  max?: number;
  windowMs?: number;
  now?: () => number;
};

function evictExpired(now: number): void {
  for (const [k, b] of buckets) {
    if (now >= b.resetAt) buckets.delete(k);
  }
  if (buckets.size <= MAX_KEYS) return;
  // Drop oldest resetAt first when under flood of unique keys.
  const ordered = [...buckets.entries()].sort((a, b) => a[1].resetAt - b[1].resetAt);
  const drop = buckets.size - MAX_KEYS;
  for (let i = 0; i < drop; i++) {
    buckets.delete(ordered[i]![0]);
  }
}

export function checkRateLimit(
  key: string,
  { max = 120, windowMs = 60_000, now = Date.now }: RateLimitOptions = {},
): boolean {
  const t = now();
  if (buckets.size > MAX_KEYS / 2) evictExpired(t);
  let b = buckets.get(key);
  if (!b || t >= b.resetAt) {
    b = { count: 0, resetAt: t + windowMs };
    buckets.set(key, b);
  }
  b.count += 1;
  return b.count <= max;
}

/** Test helper — clear all buckets. */
export function resetRateLimits(): void {
  buckets.clear();
}
