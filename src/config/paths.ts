import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import envPaths from "env-paths";
import { envVar } from "./env-vars";

export const APP_NAME = "torzlink";
const LEGACY_APP_NAME = "torlink";

function legacyPaths() {
  return envPaths(LEGACY_APP_NAME, { suffix: "" });
}

function activePaths() {
  const override = envVar("TORZLINK_STATE_DIR", "TORLINK_STATE_DIR");
  const modern = envPaths(APP_NAME, { suffix: "" });
  if (override) {
    return {
      data: path.join(override, "data"),
      config: path.join(override, "config"),
    };
  }
  if (!existsSync(modern.data) && existsSync(legacyPaths().data)) {
    return legacyPaths();
  }
  return modern;
}

/** Resolve at call time so tests can override TORZLINK_STATE_DIR / DOWNLOAD_DIR. */
export function defaultDownloadDir(): string {
  return (
    envVar("TORZLINK_DOWNLOAD_DIR", "TORLINK_DOWNLOAD_DIR") ||
    path.join(os.homedir(), "Downloads", APP_NAME)
  );
}

export function configFile(): string {
  return path.join(activePaths().config, "config.json");
}

export function queueFile(): string {
  return path.join(activePaths().data, "queue.json");
}

export function historyFile(): string {
  return path.join(activePaths().data, "history.json");
}

export function seedsFile(): string {
  return path.join(activePaths().data, "seeds.json");
}

export function torrentsDir(): string {
  return path.join(activePaths().data, "torrents");
}
