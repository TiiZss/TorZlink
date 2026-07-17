import { describe, expect, it, afterEach } from "vitest";
import { mkdtemp, mkdir, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { isDirInsideJailSync } from "../../src/config/downloadJail";

describe("isDirInsideJailSync", () => {
  let root: string;

  afterEach(async () => {
    delete process.env.TORZLINK_DOWNLOAD_DIR;
    delete process.env.TORZLINK_DOWNLOAD_ROOT;
    if (root) await rm(root, { recursive: true, force: true }).catch(() => {});
  });

  it("allows any dir when no jail is configured", async () => {
    root = await mkdtemp(path.join(tmpdir(), "jail-"));
    expect(isDirInsideJailSync(path.join(root, "anywhere"))).toBe(true);
  });

  it("rejects dirs outside TORZLINK_DOWNLOAD_ROOT", async () => {
    root = await mkdtemp(path.join(tmpdir(), "jail-"));
    const jail = path.join(root, "ok");
    await mkdir(jail, { recursive: true });
    process.env.TORZLINK_DOWNLOAD_ROOT = jail;
    expect(isDirInsideJailSync(path.join(jail, "sub"))).toBe(true);
    expect(isDirInsideJailSync(path.join(root, "evil"))).toBe(false);
  });

  it("rejects symlink escape when possible", async () => {
    root = await mkdtemp(path.join(tmpdir(), "jail-"));
    const jail = path.join(root, "ok");
    const outside = path.join(root, "outside");
    await mkdir(jail, { recursive: true });
    await mkdir(outside, { recursive: true });
    const link = path.join(jail, "escape");
    try {
      await symlink(outside, link, "dir");
    } catch {
      return;
    }
    process.env.TORZLINK_DOWNLOAD_ROOT = jail;
    expect(isDirInsideJailSync(link)).toBe(false);
  });
});
