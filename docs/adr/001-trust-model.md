# ADR-001: Trust model for TorZlink

**Status:** Accepted  
**Date:** 2026-07-11  
**Context:** TorZlink is a local-first terminal torrent finder. It scrapes curated indexers, downloads via WebTorrent, optionally notifies Telegram, and seeds by default. Security work (P0/P1) needs a shared mental model for what we trust and what we do not.

## Decision

### Trust boundaries

| Boundary | Trusted side | Untrusted side | Controls |
| --- | --- | --- | --- |
| User → TorZlink | Local operator | N/A | TTY-only TUI; no remote admin API |
| Indexers → TorZlink | Curated source list only | HTML/RSS/magnet strings | `safeDisplayText`, `sanitizeDownloadInput`, FitGirl-only for games |
| TorZlink → WebTorrent | Sanitized magnets + optional user trackers | Swarm peers, tracker operators | Rebuild magnet from infoHash; warn on unknown tracker hosts |
| TorZlink → filesystem | User-chosen download/state dirs | Scraped filenames | `sanitizeFilename`, path normalization |
| TorZlink → Telegram (optional) | User-owned bot + channel | Telegram API, channel members | `.magnet` attachments on copy/start; no magnet URI on complete/error; secrets in `.env` only |
| TorZlink → network | User intent (search/download/seed) | ISP, trackers, peers | Documented seeding exposure; no VPN built-in |

### Source policy

- **Games:** FitGirl repacks only — only category that routinely ships executables/installers.
- **Video / subtitles:** YTS, TPB, 1337x, EZTV, Nyaa, SubsPlease — treated as media, still untrusted bytes until verified by the user.
- **Scraped magnets:** Never passed verbatim to WebTorrent when a canonical rebuild from `infoHash` is possible.

### Privacy defaults

- **Seeding:** On by default after download (upstream behaviour). User can pause/stop in Seeding tab. Documented in README Privacy section.
- **Telegram:** Opt-in via `.env`. Completion notifications omit magnet URIs; copy/start use `.magnet` file attachments.
- **Custom trackers:** Saved in local `config.json`. Unknown hosts trigger an in-app warning; they receive announce traffic for future adds.

### Supply chain

- `package-lock.json` + `npm ci` for reproducible installs.
- CI: Gitleaks, `npm audit` (critical gate), Trivy (critical gate).
- Known transitive HIGH in `webtorrent`/`ip` tracked; no semver-major downgrade without explicit ADR.

## Consequences

- Easier to reason about new features (headless CLI, new sources, VPN docs) against this table.
- Security tests can assert invariants: no raw scraped magnet at download boundary, no control chars in TUI labels, unknown trackers warned.
- Does **not** remove torrent malware risk or IP exposure from seeding — users remain responsible for content and network privacy.

## References

- [README.md](../README.md) — Privacy, Telegram, upstream diff
- [CHANGELOG.md](../CHANGELOG.md) — Security entries
- OWASP-adjacent: treat all external indexer output as hostile input at the parser boundary
