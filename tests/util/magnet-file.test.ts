import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { magnetFilePath } from "../../src/util/magnet-file";

describe("magnetFilePath", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "torzlink-magnet-"));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("sanitizes torrent name and uses .magnet extension", () => {
    const p = magnetFilePath(tmpDir, "Bad: Name * Torrent?", "a1b2c3d4e5f6");
    expect(p).toBe(path.join(tmpDir, "Bad Name Torrent.magnet"));
  });

  it("magnetAttachmentFilename returns basename with hash suffix when provided", async () => {
    const { magnetAttachmentFilename } = await import("../../src/util/magnet-file");
    expect(magnetAttachmentFilename("My Game", "a1b2c3d4")).toBe("My Game [a1b2c3d4].magnet");
    expect(magnetAttachmentFilename("Plain")).toBe("Plain.magnet");
  });

  it("adds infoHash suffix on collision", async () => {
    const name = "Duplicate Title";
    const first = magnetFilePath(tmpDir, name);
    await fs.writeFile(first, "magnet:1", "utf8");
    const second = magnetFilePath(tmpDir, name, "deadbeef01");
    expect(second).toBe(path.join(tmpDir, "Duplicate Title [deadbeef].magnet"));
  });
});
