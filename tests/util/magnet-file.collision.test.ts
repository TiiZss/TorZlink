import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { magnetFilePath } from "../../src/util/magnet-file";

describe("magnetFilePath collision fallback", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "torzlink-magnet-col-"));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("returns a unique path when base and hash-tagged paths already exist", async () => {
    const name = "Duplicate Title";
    const hash = "deadbeef01";
    const base = path.join(tmpDir, "Duplicate Title.magnet");
    const tagged = path.join(tmpDir, "Duplicate Title [deadbeef].magnet");
    await fs.writeFile(base, "magnet:1", "utf8");
    await fs.writeFile(tagged, "magnet:2", "utf8");

    const third = magnetFilePath(tmpDir, name, hash);
    expect(third).not.toBe(tagged);
    expect(third).toMatch(/Duplicate Title \[deadbeef-[a-z0-9]+\]\.magnet$/);
  });
});
