import { describe, expect, it } from "vitest";
import { redactLogText } from "../../src/util/log";

describe("redactLogText", () => {
  it("redacts bearer, magnets, and env-style secrets", () => {
    const hash = "a".repeat(40);
    const s = redactLogText(
      `Authorization: Bearer secret-token magnet:?xt=urn:btih:${hash}&dn=x TORZLINK_SERVE_TOKEN=abc`,
    );
    expect(s).toContain("Bearer ***");
    expect(s).toContain("magnet:?***");
    expect(s).toContain("TORZLINK_SERVE_TOKEN=***");
    expect(s).not.toContain("secret-token");
    expect(s).not.toContain(hash);
  });
});
