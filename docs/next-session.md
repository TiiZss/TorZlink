# Next session — TorZlink backlog

Session closed **2026-07-11** with **v1.6.0** published ([release](https://github.com/TiiZss/TorZlink/releases/tag/v1.6.0)).

Security hardening **P0 + P1** is complete. Pick from this list when resuming work.

## Recommended order

| Priority | Area | Item | Notes |
| --- | --- | --- | --- |
| 1 | QA | Manual TUI download smoke test in Docker (Windows host) | Validate end-to-end on the primary dev machine |
| 2 | Docs | Windows-specific Docker volume docs | `%cd%`, WSL2, Desktop bind-mount quirks |
| 3 | Quality P2 | Zod schema for `config.json` | `downloadDir`, `trackers[]` validation at load |
| 4 | Quality P2 | Scraper anti-corruption layer | Rebuild magnet from infoHash; no raw HTML passthrough |
| 5 | Product | Optional headless magnet-add CLI mode | Scripted downloads without Ink |

## Also on the board

- **P2:** `TORZLINK_DOWNLOAD_ROOT` path jail, structured logging `TORZLINK_LOG`, no-seed-by-default
- **Maintenance:** Selective upstream sync from `baairon/torlink`
- **Launchers:** [docs/follow-ups-launchers.md](follow-ups-launchers.md) — code review PR hygiene

## Reference — v1.6.0 shipped

- CI security: Gitleaks, `npm audit` (critical), Trivy fs/image
- `package-lock.json` + `npm ci` in CI, release, Docker
- Magnet sanitization at download boundary; `safeDisplayText()` in TUI
- Launcher `.env` placeholder warnings; custom tracker host warnings
- ADR-001 trust model; security regression tests; CycloneDX SBOM on release
- Release pipeline fix: `package-lock.json` in Docker context; SBOM written via stdout redirect

## Skills to invoke

See [docs/agent-workflow.md](agent-workflow.md) for the full routing table, review gates, and release checklist.

| Task | Skill |
| --- | --- |
| P2 config / scrapers | `engineering-software-architect`, `security-appsec-engineer` |
| Headless CLI | `engineering-backend-architect` |
| Docker docs / smoke | `engineering-devops-automator`, `engineering-sre` |
| Launcher follow-ups | `engineering-code-reviewer`, `security-senior-secops` |
