/** Simple fixed-window rate limit (per key). Returns false when over limit. */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export type RateLimitOptions = {
  max?: number;
  windowMs?: number;
  now?: () => number;
};

export function checkRateLimit(
  key: string,
  { max = 120, windowMs = 60_000, now = Date.now }: RateLimitOptions = {},
): boolean {
  const t = now();
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
