import { describe, expect, it } from "vitest";
import {
  formatTrackers,
  isKnownTrackerHost,
  parseTrackers,
  trackerHostname,
  unknownTrackerHosts,
} from "../../src/config/trackers";

describe("trackerHostname", () => {
  it("extracts host from udp and https tracker URLs", () => {
    expect(trackerHostname("udp://tracker.opentrackr.org:1337/announce")).toBe(
      "tracker.opentrackr.org",
    );
    expect(trackerHostname("https://tracker.example.com/announce")).toBe("tracker.example.com");
  });

  it("returns null for invalid URLs", () => {
    expect(trackerHostname("not-a-url")).toBeNull();
  });
});

describe("unknownTrackerHosts", () => {
  it("returns empty when all hosts are known", () => {
    expect(unknownTrackerHosts(["udp://tracker.opentrackr.org:1337/announce"])).toEqual([]);
  });

  it("lists unique unknown hosts", () => {
    expect(
      unknownTrackerHosts([
        "udp://evil.tracker:1337/announce",
        "https://evil.tracker/announce",
        "udp://tracker.opentrackr.org:1337/announce",
      ]),
    ).toEqual(["evil.tracker"]);
  });
});

describe("isKnownTrackerHost", () => {
  it("recognizes default buildMagnet trackers", () => {
    expect(isKnownTrackerHost("tracker.opentrackr.org")).toBe(true);
    expect(isKnownTrackerHost("EVIL.EXAMPLE")).toBe(false);
  });
});

describe("parseTrackers", () => {
  it("returns empty for blank input", () => {
    expect(parseTrackers("")).toEqual([]);
    expect(parseTrackers("   \n\t  ")).toEqual([]);
  });

  it("splits on commas, whitespace, and newlines", () => {
    const input =
      "udp://a.example:1337/announce, http://b.example/announce\nhttps://c.example/announce\tudp://d.example:80";
    expect(parseTrackers(input)).toEqual([
      "udp://a.example:1337/announce",
      "http://b.example/announce",
      "https://c.example/announce",
      "udp://d.example:80",
    ]);
  });

  it("dedupes exact duplicates", () => {
    const input = "udp://a.example:1337, udp://a.example:1337 udp://a.example:1337";
    expect(parseTrackers(input)).toEqual(["udp://a.example:1337"]);
  });

  it("keeps only udp, http(s), ws(s) schemes", () => {
    const input =
      "udp://a.example:80 http://b.example ftp://c.example file:///etc/passwd hello ws://d.example wss://e.example";
    expect(parseTrackers(input)).toEqual([
      "udp://a.example:80",
      "http://b.example",
      "ws://d.example",
      "wss://e.example",
    ]);
  });

  it("preserves order", () => {
    const input = "https://z.example, https://a.example, https://m.example";
    expect(parseTrackers(input)).toEqual([
      "https://z.example",
      "https://a.example",
      "https://m.example",
    ]);
  });
});

describe("formatTrackers", () => {
  it("joins with a comma and space", () => {
    expect(formatTrackers(["a", "b", "c"])).toBe("a, b, c");
  });

  it("returns empty string for empty array", () => {
    expect(formatTrackers([])).toBe("");
  });
});
