import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { EventEmitter } from "node:events";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

const spawn = vi.fn();

vi.mock("node:child_process", () => ({ spawn }));

describe("writeClipboard on Linux with custom download dir", () => {
  const originalPlatform = process.platform;
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "torzlink-clip-linux-"));
    process.env.TORZLINK_DOWNLOAD_DIR = path.join(tmpDir, "downloads");
    await fs.mkdir(process.env.TORZLINK_DOWNLOAD_DIR, { recursive: true });
    Object.defineProperty(process, "platform", { value: "linux" });
    vi.resetModules();
    spawn.mockReset();
    spawn.mockImplementation((cmd: string) => {
      const proc = new EventEmitter() as EventEmitter & {
        stdin: { end: () => void };
        stdout: EventEmitter;
        kill: () => void;
      };
      proc.stdout = new EventEmitter();
      proc.kill = vi.fn();
      proc.stdin = {
        end: vi.fn(() => {
          queueMicrotask(() => {
            if (cmd === "xclip") proc.emit("exit", 0);
            else proc.emit("exit", 1);
          });
        }),
      };
      return proc;
    });
  });

  afterEach(async () => {
    Object.defineProperty(process, "platform", { value: originalPlatform });
    delete process.env.TORZLINK_DOWNLOAD_DIR;
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("uses native clipboard when download dir env is set but not in Docker", async () => {
    const { writeClipboard } = await import("../../src/util/clipboard");
    const magnet = "magnet:?xt=urn:btih:abc";
    await expect(writeClipboard(magnet, { name: "Test", infoHash: "abc" })).resolves.toBe(true);
    expect(spawn).toHaveBeenCalledWith("xclip", ["-selection", "clipboard"], { windowsHide: true });
    const magnetFiles = await fs.readdir(process.env.TORZLINK_DOWNLOAD_DIR!);
    expect(magnetFiles.filter((f) => f.endsWith(".magnet"))).toHaveLength(0);
  });
});
