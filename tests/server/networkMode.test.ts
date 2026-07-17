import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import {
  getNetworkStatus,
  parseNetworkMode,
  setNetworkMode,
} from "../../src/server/networkMode";

vi.mock("node:child_process", () => ({
  spawn: vi.fn(() => {
    const child = {
      on: vi.fn(),
      unref: vi.fn(),
      exitCode: null as number | null,
    };
    return child;
  }),
}));

describe("networkMode", () => {
  let stateDir: string;

  beforeEach(async () => {
    stateDir = await mkdtemp(path.join(tmpdir(), "torzlink-net-"));
    process.env.TORZLINK_STATE_DIR = stateDir;
    delete process.env.TORZLINK_NETWORK_MODE;
    delete process.env.TORZLINK_DEPLOY_ENV_FILE;
    delete process.env.TORZLINK_NETWORK_SWITCH_CMD;
    vi.mocked(spawn).mockClear();
  });

  afterEach(async () => {
    delete process.env.TORZLINK_STATE_DIR;
    delete process.env.TORZLINK_NETWORK_MODE;
    delete process.env.TORZLINK_DEPLOY_ENV_FILE;
    delete process.env.TORZLINK_NETWORK_SWITCH_CMD;
    await rm(stateDir, { recursive: true, force: true });
  });

  it("parses mode aliases", () => {
    expect(parseNetworkMode("vpn")).toBe("vpn");
    expect(parseNetworkMode("lan")).toBe("direct");
    expect(parseNetworkMode("nope")).toBeNull();
  });

  it("persists desired mode and reports not switchable without SWITCH_CMD", async () => {
    const status = await setNetworkMode("vpn");
    expect(status.desired).toBe("vpn");
    expect(status.switchable).toBe(false);
    expect(status.pending).toBe(false);
    expect(status.applied).toBe(false);
    expect(status.hint).toMatch(/SWITCH_CMD|redeploy|deploy-nas/i);
    expect(spawn).not.toHaveBeenCalled();

    const again = await getNetworkStatus();
    expect(again.desired).toBe("vpn");
    expect(again.switchable).toBe(false);
  });

  it("patches deploy env file when configured", async () => {
    const envPath = path.join(stateDir, "deploy.env");
    await writeFile(envPath, "TORZLINK_NETWORK_MODE=direct\nFOO=bar\n", "utf8");
    process.env.TORZLINK_DEPLOY_ENV_FILE = envPath;

    const status = await setNetworkMode("vpn");
    expect(status.envPatched).toBe(true);
    const text = await readFile(envPath, "utf8");
    expect(text).toMatch(/^TORZLINK_NETWORK_MODE=vpn$/m);
    expect(text).toMatch(/^FOO=bar$/m);
  });

  it("starts SWITCH_CMD detached and marks pending", async () => {
    process.env.TORZLINK_NETWORK_SWITCH_CMD = "sh /opt/torzlink/torzlink-network-switch.sh";
    process.env.TORZLINK_NETWORK_MODE = "direct";

    const status = await setNetworkMode("vpn");
    expect(status.switchable).toBe(true);
    expect(status.pending).toBe(true);
    expect(status.applied).toBe(false);
    expect(status.hint).toMatch(/Recreando/i);
    expect(spawn).toHaveBeenCalledWith(
      "sh",
      ["/opt/torzlink/torzlink-network-switch.sh", "vpn"],
      expect.objectContaining({
        detached: true,
        shell: false,
        stdio: "ignore",
        env: expect.objectContaining({ TORZLINK_PREV_NETWORK_MODE: "direct" }),
      }),
    );
    const child = vi.mocked(spawn).mock.results[0]?.value as { unref: ReturnType<typeof vi.fn> };
    expect(child.unref).toHaveBeenCalled();

    const get = await getNetworkStatus();
    expect(get.pending).toBe(false);
    expect(get.applied).toBe(false);
  }, 10_000);

  it("reports applied when desired matches runtime", async () => {
    process.env.TORZLINK_NETWORK_MODE = "vpn";
    await setNetworkMode("vpn");
    const status = await getNetworkStatus();
    expect(status.applied).toBe(true);
    expect(status.pending).toBe(false);
  });
});
