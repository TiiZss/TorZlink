import { describe, expect, it, beforeEach } from "vitest";
import { checkRateLimit, resetRateLimits } from "../../src/server/rateLimit";

describe("rateLimit", () => {
  beforeEach(() => resetRateLimits());

  it("allows up to max then blocks within the window", () => {
    let now = 1_000_000;
    const opts = { max: 3, windowMs: 60_000, now: () => now };
    expect(checkRateLimit("a", opts)).toBe(true);
    expect(checkRateLimit("a", opts)).toBe(true);
    expect(checkRateLimit("a", opts)).toBe(true);
    expect(checkRateLimit("a", opts)).toBe(false);
    now += 60_001;
    expect(checkRateLimit("a", opts)).toBe(true);
  });

  it("isolates keys", () => {
    const opts = { max: 1, windowMs: 60_000, now: () => 0 };
    expect(checkRateLimit("x", opts)).toBe(true);
    expect(checkRateLimit("y", opts)).toBe(true);
    expect(checkRateLimit("x", opts)).toBe(false);
  });
});
