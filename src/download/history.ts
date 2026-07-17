import { promises as fs, mkdirSync, writeFileSync, renameSync } from "node:fs";
import path from "node:path";
import { historyFile } from "../config/paths";
import { isDirInsideJailSync } from "../config/downloadJail";
import { sanitizeDownloadInput } from "../sources/magnet";
import { serializeWrites, writeJsonAtomic } from "../util/atomic";
import type { SourceId } from "../sources/types";

export const HISTORY_CAP = 500;

export interface HistoryItem {
  id: string;
  name: string;
  source?: SourceId;
  sizeBytes: number;
  magnet: string;
  dir: string;
  completedAt: number;
}

const write = serializeWrites();

export function saveHistory(items: HistoryItem[]): Promise<void> {
  return write(() => writeJsonAtomic(historyFile(), items.slice(0, HISTORY_CAP)));
}

export function saveHistorySync(items: HistoryItem[]): void {
  try {
    const file = historyFile();
    mkdirSync(path.dirname(file), { recursive: true });
    const tmp = `${file}.sync.tmp`;
    writeFileSync(tmp, JSON.stringify(items.slice(0, HISTORY_CAP), null, 2), "utf8");
    renameSync(tmp, file);
  } catch {}
}

function isHistoryItem(v: unknown): v is HistoryItem {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  return typeof r.id === "string" && typeof r.name === "string" && typeof r.magnet === "string";
}

function sanitizeHistoryItem(raw: HistoryItem): HistoryItem | null {
  const safe = sanitizeDownloadInput({
    id: raw.id,
    name: raw.name,
    magnet: raw.magnet,
    source: raw.source,
    sizeBytes: raw.sizeBytes,
  });
  if (!safe) return null;
  if (typeof raw.dir === "string" && raw.dir && !isDirInsideJailSync(raw.dir)) {
    return null;
  }
  return {
    ...raw,
    id: safe.id,
    name: safe.name,
    magnet: safe.magnet,
  };
}

export async function loadHistory(): Promise<HistoryItem[]> {
  let raw: string;
  try {
    raw = await fs.readFile(historyFile(), "utf8");
  } catch {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(isHistoryItem)
      .map(sanitizeHistoryItem)
      .filter((x): x is HistoryItem => x !== null)
      .slice(0, HISTORY_CAP);
  } catch {
    return [];
  }
}
