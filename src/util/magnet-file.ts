import { existsSync } from "node:fs";
import path from "node:path";
import { cleanText, sanitizeFilename } from "./format";

/** Path for a named `.magnet` sidecar in the downloads folder. */
export function magnetFilePath(downloadDir: string, name: string, infoHash?: string): string {
  const label = sanitizeFilename(cleanText(name));
  const hash = infoHash?.replace(/[^a-f0-9]/gi, "").slice(0, 8).toLowerCase();
  const base = path.join(downloadDir, `${label}.magnet`);
  if (!existsSync(base)) return base;
  if (hash) {
    const tagged = path.join(downloadDir, `${label} [${hash}].magnet`);
    if (!existsSync(tagged)) return tagged;
    const stamp = Date.now().toString(36);
    return path.join(downloadDir, `${label} [${hash}-${stamp}].magnet`);
  }
  const stamp = Date.now().toString(36);
  return path.join(downloadDir, `${label} [${stamp}].magnet`);
}
