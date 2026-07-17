import path from "node:path";
import { envVar } from "./env-vars";

/**
 * Canonical download jail root, if configured.
 * - `TORZLINK_DOWNLOAD_DIR` — fixed download dir (also locks config PATCH)
 * - `TORZLINK_DOWNLOAD_ROOT` — allow any dir under this root (config + per-item)
 */
export function downloadJailRoot(): string | null {
  const locked = envVar("TORZLINK_DOWNLOAD_DIR", "TORLINK_DOWNLOAD_DIR");
  if (locked) return path.resolve(locked);
  const root = envVar("TORZLINK_DOWNLOAD_ROOT");
  if (root) return path.resolve(root);
  return null;
}

export function downloadDirLockedByEnv(): boolean {
  return Boolean(envVar("TORZLINK_DOWNLOAD_DIR", "TORLINK_DOWNLOAD_DIR"));
}

export function pathUnderJail(candidate: string, root: string): boolean {
  const resolved = path.resolve(candidate);
  const base = path.resolve(root);
  return resolved === base || resolved.startsWith(base + path.sep);
}
