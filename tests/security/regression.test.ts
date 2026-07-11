import { describe, expect, it } from "vitest";
import { sanitizeDownloadInput, sanitizeMagnetInput } from "../../src/sources/magnet";
import { safeDisplayText } from "../../src/util/format";

describe("security regression: magnet boundary", () => {
  const hash = "abcdef0123456789abcdef0123456789abcdef01";

  it("rejects poisoned magnet with invalid infoHash length", () => {
    expect(
      sanitizeDownloadInput({
        id: "deadbeef",
        name: "Bad",
        magnet: "magnet:?xt=urn:btih:deadbeef",
      }),
    ).toBeNull();
  });

  it("rebuilds magnet and drops smuggled announce params from scraped URI", () => {
    const poisoned =
      `magnet:?xt=urn:btih:${hash}&dn=Evil&tr=udp://evil.tracker:1337/announce` +
      String.fromCharCode(0x1b) +
      "]52;c;payload";
    const safe = sanitizeMagnetInput(poisoned);
    expect(safe?.infoHash).toBe(hash);
    expect(safe?.magnet).toContain(`xt=urn:btih:${hash}`);
    expect(safe?.magnet).not.toContain("evil.tracker");
    expect(safe?.magnet).not.toContain("%1B");
  });

  it("sanitizeDownloadInput uses canonical magnet for queue payload", () => {
    const raw = `magnet:?xt=urn:btih:${hash}&tr=udp://attacker:6969/announce`;
    const out = sanitizeDownloadInput({ id: hash, name: "Title", magnet: raw });
    expect(out?.magnet).not.toContain("attacker");
    expect(out?.magnet).toContain("tracker.opentrackr.org");
  });
});

describe("security regression: terminal injection in labels", () => {
  it("safeDisplayText removes C1 controls used in OSC smuggling", () => {
    const evil = `Movie\u009fTitle\u0080`;
    expect(safeDisplayText(evil)).toBe("MovieTitle");
  });

  it("safeDisplayText removes ESC from scraped names shown in notices", () => {
    const ESC = "\x1b";
    const evil = `Cool${ESC}[31mName`;
    const label = safeDisplayText(evil);
    expect(label).not.toContain(ESC);
    expect(label).toContain("Cool");
  });
});
