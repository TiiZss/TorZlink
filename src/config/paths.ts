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

const paths = activePaths();
const dataDir = paths.data;
const configDir = paths.config;

export const defaultDownloadDir =
  envVar("TORZLINK_DOWNLOAD_DIR", "TORLINK_DOWNLOAD_DIR") ||
  path.join(os.homedir(), "Downloads", APP_NAME);

export const configFile = path.join(configDir, "config.json");
export const queueFile = path.join(dataDir, "queue.json");
export const historyFile = path.join(dataDir, "history.json");
export const seedsFile = path.join(dataDir, "seeds.json");
export const torrentsDir = path.join(dataDir, "torrents");
