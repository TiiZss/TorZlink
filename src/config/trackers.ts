const VALID_SCHEME = /^(udp|https?|wss?):\/\//i;

/** Hostnames of widely used public trackers (includes defaults from buildMagnet). */
const KNOWN_TRACKER_HOSTS = new Set([
  "tracker.opentrackr.org",
  "open.demonii.com",
  "tracker.openbittorrent.com",
  "tracker.torrent.eu.org",
  "exodus.desync.com",
  "open.stealth.si",
  "tracker.dler.org",
  "tracker.tiny-vps.com",
  "tracker.moeking.me",
  "tracker1.bt.moack.co.kr",
  "explodie.org",
  "tracker.theoks.net",
  "retracker.lanta.me",
]);

export function trackerHostname(url: string): string | null {
  try {
    const normalized = url.trim().replace(/^udp:/i, "http:");
    return new URL(normalized).hostname.toLowerCase() || null;
  } catch {
    return null;
  }
}

export function isKnownTrackerHost(host: string): boolean {
  return KNOWN_TRACKER_HOSTS.has(host.toLowerCase());
}

export function unknownTrackerHosts(trackers: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const url of trackers) {
    const host = trackerHostname(url);
    if (!host || isKnownTrackerHost(host) || seen.has(host)) continue;
    seen.add(host);
    out.push(host);
  }
  return out;
}

export function parseTrackers(input: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of input.split(/[\s,]+/)) {
    const url = raw.trim();
    if (!url || !VALID_SCHEME.test(url)) continue;
    if (seen.has(url)) continue;
    seen.add(url);
    out.push(url);
  }
  return out;
}

export function formatTrackers(trackers: string[]): string {
  return trackers.join(", ");
}
