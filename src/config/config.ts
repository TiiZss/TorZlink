import { promises as fs } from "node:fs";
import { z } from "zod";
import { configFile, defaultDownloadDir } from "./paths";
import { envVar } from "./env-vars";
import { serializeWrites, writeJsonAtomic } from "../util/atomic";
import { log } from "../util/log";

export interface Config {
  downloadDir: string;
  trackers: string[];
  /** When false, finished downloads are not auto-seeded (default true). */
  seedOnComplete: boolean;
}

const ConfigSchema = z.object({
  downloadDir: z.string().min(1).optional(),
  trackers: z.array(z.string().min(1)).optional(),
  seedOnComplete: z.boolean().optional(),
});

export function defaultConfig(): Config {
  return {
    downloadDir: defaultDownloadDir(),
    trackers: [],
    seedOnComplete: true,
  };
}

export async function loadConfig(): Promise<Config> {
  let raw: string;
  try {
    raw = await fs.readFile(configFile(), "utf8");
  } catch {
    return defaultConfig();
  }
  try {
    const json: unknown = JSON.parse(raw);
    const parsed = ConfigSchema.safeParse(json);
    if (!parsed.success) {
      log.warn("config.json failed schema validation; using defaults", {
        issues: parsed.error.issues.map((i) => i.message).join("; "),
      });
      return defaultConfig();
    }
    const data = parsed.data;
    const cfg: Config = {
      downloadDir:
        envVar("TORZLINK_DOWNLOAD_DIR", "TORLINK_DOWNLOAD_DIR") ||
        (data.downloadDir ? data.downloadDir : defaultDownloadDir()),
      trackers: data.trackers ?? [],
      seedOnComplete: data.seedOnComplete ?? true,
    };
    return cfg;
  } catch {
    log.warn("config.json is not valid JSON; using defaults");
    return defaultConfig();
  }
}

const write = serializeWrites();

export function saveConfig(config: Config): Promise<void> {
  return write(() =>
    writeJsonAtomic(configFile(), {
      downloadDir: config.downloadDir,
      trackers: config.trackers,
      seedOnComplete: config.seedOnComplete,
    }),
  );
}
