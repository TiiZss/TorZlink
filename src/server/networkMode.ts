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

function switchCmdConfigured(): boolean {
  return Boolean(process.env.TORZLINK_NETWORK_SWITCH_CMD?.trim());
}

/**
 * Start the host/container switch helper without waiting for recreate.
 * Waiting would kill the HTTP response when this process is the one being replaced.
 */
function startSwitchCmd(mode: NetworkMode): { ok: boolean; detail?: string } {
  const cmd = process.env.TORZLINK_NETWORK_SWITCH_CMD?.trim();
  if (!cmd) return { ok: false };

  try {
    const child = spawn(cmd, [mode], {
      shell: true,
      env: process.env,
      detached: true,
      stdio: "ignore",
    });
    child.on("error", () => {
      /* spawn failures after detach are best-effort; UI polls runtime */
    });
    child.unref();
    return { ok: true };
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : String(err) };
  }
}

export type NetworkStatus = {
  runtime: NetworkMode;
  desired: NetworkMode;
  applied: boolean;
  switchable: boolean;
  pending: boolean;
  envPatched: boolean;
  hint?: string;
};

export async function getNetworkStatus(): Promise<NetworkStatus> {
  const runtime = runtimeNetworkMode();
  const desired = (await readDesiredMode()) ?? runtime;
  const switchable = switchCmdConfigured();
  const applied = desired === runtime;
  let hint: string | undefined;
  if (!applied && switchable) {
    hint = "Cambio pendiente — el contenedor se está recreando o hace falta reintentar el switch.";
  } else if (!applied && !switchable) {
    hint =
      "Preferencia guardada. Cablea TORZLINK_NETWORK_SWITCH_CMD (compose NAS) o ejecuta deploy-nas.sh switch.";
  }
  return {
    runtime,
    desired,
    applied,
    switchable,
    pending: !applied && switchable,
    envPatched: false,
    hint,
  };
}

export async function setNetworkMode(mode: NetworkMode): Promise<NetworkStatus> {
  await writeDesiredMode(mode);

  const envFile = process.env.TORZLINK_DEPLOY_ENV_FILE?.trim();
  const envPatched = envFile ? await patchEnvFile(envFile, mode) : false;

  const switched = startSwitchCmd(mode);
  const runtime = runtimeNetworkMode();
  const switchable = switchCmdConfigured();
  const applied = mode === runtime;

  let hint: string | undefined;
  if (switched.ok) {
    hint =
      "Recreando contenedor en modo " +
      mode +
      "… la página se reconectará en unos segundos (las descargas activas se interrumpen).";
  } else if (switched.detail) {
    hint = `Switch falló al arrancar: ${switched.detail}`;
  } else if (envPatched) {
    hint =
      "Modo guardado en .env del NAS. Sin TORZLINK_NETWORK_SWITCH_CMD: ejecuta deploy-nas.sh switch " +
      mode +
      ".";
  } else if (!applied) {
    hint =
      "Preferencia guardada. Para aplicar: TORZLINK_NETWORK_MODE=" +
      mode +
      " y redeploy, o cablea TORZLINK_NETWORK_SWITCH_CMD.";
  }

  return {
    runtime,
    desired: mode,
    applied,
    switchable,
    pending: switched.ok && !applied,
    envPatched,
    hint,
  };
}
