import { fetchResilient, HttpError, USER_AGENT } from "../util/net";
import { normalizeInfoHash, sanitizeParsedMagnet } from "./magnet";
import type { SearchOptions, Source, TorrentResult } from "./types";

const API = "https://eztvx.to/api/get-torrents";

interface EztvTorrent {
  title?: string;
  filename?: string;
  hash?: string;
  magnet_url?: string;
  seeds?: number;
  peers?: number;
  size_bytes?: string | number;
  date_released_unix?: number;
}
interface EztvResponse {
  torrents?: EztvTorrent[];
}

async function search(query: string, opts: SearchOptions = {}): Promise<TorrentResult[]> {
  if (query.trim()) return [];

  const res = await fetchResilient(`${API}?limit=100&page=1`, {
    headers: { "User-Agent": USER_AGENT },
    signal: opts.signal,
    retries: 1,
  });
  if (!res.ok) throw new HttpError(res.status, `EZTV returned ${res.status}`);

  const json = (await res.json()) as EztvResponse;
  const out: TorrentResult[] = [];
  for (const t of json.torrents ?? []) {
    const hash = normalizeInfoHash(t.hash ?? "");
    const name = t.title || t.filename || hash;
    // Ignore magnet_url — rebuild from hash so scrape trackers cannot smuggle.
    const safe = sanitizeParsedMagnet({ infoHash: hash, name, magnet: "" });
    if (!safe) continue;
    out.push({
      infoHash: safe.infoHash,
      name: safe.name,
      sizeBytes: Number(t.size_bytes ?? 0) || 0,
      seeders: t.seeds ?? 0,
      leechers: t.peers ?? 0,
      source: "eztv",
      magnet: safe.magnet,
      added: t.date_released_unix,
    });
  }
  return out;
}

export const eztv: Source = {
  id: "eztv",
  label: "EZTV",
  group: "TV",
  homepage: "https://eztvx.to",
  reportsHealth: true,
  search,
};
