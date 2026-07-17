import { promises as fs } from "node:fs";
import parseTorrent from "parse-torrent";
import { buildMagnet, type ParsedMagnet } from "./magnet";

export async function magnetFromTorrentBytes(
  buf: Uint8Array | Buffer,
): Promise<ParsedMagnet | null> {
  try {
    const parsed = await parseTorrent(buf instanceof Buffer ? new Uint8Array(buf) : buf);
    const infoHash = parsed?.infoHash?.toLowerCase();
    if (!infoHash) return null;
    const name = parsed.name || infoHash;
    return { infoHash, name, magnet: buildMagnet(infoHash, name) };
  } catch {
    return null;
  }
}

export async function magnetFromTorrentFile(path: string): Promise<ParsedMagnet | null> {
  try {
    const buf = await fs.readFile(path);
    return magnetFromTorrentBytes(buf);
  } catch {
    return null;
  }
}
