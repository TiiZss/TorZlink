import { promises as fs } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import { envVar } from "../config/env-vars";
import envPaths from "env-paths";

export type NetworkMode = "direct" | "vpn";

/** Resolve at call time so tests can override TORZLINK_STATE_DIR. */
function modeFilePath(): string {
  const override = envVar("TORZLINK_STATE_DIR", "TORLINK_STATE_DIR");
  const configDir = override
    ? path.join(override, "config")
    : envPaths("torzlink", { suffix: "" }).config;
  return path.join(configDir, "network-mode.json");
}

export function parseNetworkMode(raw: unknown): NetworkMode | null {
  if (raw === "direct" || raw === "vpn") return raw;
  if (typeof raw === "string") {
    const t = raw.trim().toLowerCase();
    if (t === "direct" || t === "red" || t === "lan") return "direct";
    if (t === "vpn") return "vpn";
  }
  return null;
}

export function runtimeNetworkMode(): NetworkMode {
  return parseNetworkMode(process.env.TORZLINK_NETWORK_MODE) ?? "direct";
}

async function readDesiredMode(): Promise<NetworkMode | null> {
  try {
    const raw = JSON.parse(await fs.readFile(modeFilePath(), "utf8")) as { mode?: unknown };
    return parseNetworkMode(raw.mode);
  } catch {
    return null;
  }
}

async function writeDesiredMode(mode: NetworkMode): Promise<void> {
  const file = modeFilePath();
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, `${JSON.stringify({ mode }, null, 2)}\n`, "utf8");
}

async function patchEnvFile(file: string, mode: NetworkMode): Promise<boolean> {
  try {
    const text = await fs.readFile(file, "utf8");
    const lines = text.split(/\r?\n/);
    let found = false;
    const out = lines.map((line) => {
      if (/^\s*TORZLINK_NETWORK_MODE=/.test(line)) {
        found = true;
        return `TORZLINK_NETWORK_MODE=${mode}`;
      }
      return line;
    });
    if (!found) out.push(`TORZLINK_NETWORK_MODE=${mode}`);
    const joined = out.join("\n");
    let end = joined.length;
    while (end > 0 && joined[end - 1] === "\n") end--;
    const body = `${joined.slice(0, end)}\n`;
    await fs.writeFile(file, body, "utf8");
    return true;
  } catch {
    return false;
  }
}

function runSwitchCmd(mode: NetworkMode): Promise<{ ok: boolean; detail?: string }> {
  const cmd = process.env.TORZLINK_NETWORK_SWITCH_CMD?.trim();
  if (!cmd) return Promise.resolve({ ok: false });

  return new Promise((resolve) => {
    const child = spawn(cmd, [mode], { shell: true, env: process.env });
    let stderr = "";
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", (err) => resolve({ ok: false, detail: err.message }));
    child.on("close", (code) => {
      if (code === 0) resolve({ ok: true });
      else resolve({ ok: false, detail: stderr.trim() || `exit ${code ?? "?"}` });
    });
  });
}

export type NetworkStatus = {
  runtime: NetworkMode;
  desired: NetworkMode;
  applied: boolean;
  switchable: boolean;
  envPatched: boolean;
  hint?: string;
};

export async function getNetworkStatus(): Promise<NetworkStatus> {
  const runtime = runtimeNetworkMode();
  const desired = (await readDesiredMode()) ?? runtime;
  const switchable = Boolean(process.env.TORZLINK_NETWORK_SWITCH_CMD?.trim());
  return {
    runtime,
    desired,
    applied: desired === runtime,
    switchable,
    envPatched: false,
  };
}

export async function setNetworkMode(mode: NetworkMode): Promise<NetworkStatus> {
  await writeDesiredMode(mode);

  const envFile = process.env.TORZLINK_DEPLOY_ENV_FILE?.trim();
  const envPatched = envFile ? await patchEnvFile(envFile, mode) : false;

  const switched = await runSwitchCmd(mode);
  const runtime = runtimeNetworkMode();
  const switchable = Boolean(process.env.TORZLINK_NETWORK_SWITCH_CMD?.trim());

  let hint: string | undefined;
  if (switched.ok) {
    hint = "Switch ejecutado. Si el contenedor se recrea, recarga en unos segundos.";
  } else if (switched.detail) {
    hint = `Switch falló: ${switched.detail}`;
  } else if (envPatched) {
    hint = "Modo guardado en .env del NAS. Ejecuta deploy-nas.sh up (o redeploy) para aplicar.";
  } else if (mode !== runtime) {
    hint =
      "Preferencia guardada. Para aplicar: TORZLINK_NETWORK_MODE=" +
      mode +
      " y redeploy (deploy-from-dev / deploy-nas.sh up).";
  }

  return {
    runtime,
    desired: mode,
    applied: switched.ok || mode === runtime,
    switchable,
    envPatched,
    hint,
  };
}
