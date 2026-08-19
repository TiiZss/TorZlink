# Next session — TorZlink backlog & plan

Session wrap-up **2026-08-19**: **v1.8.1** released, smoked, NAS deployed.

## Gates (all green)

| Gate | Estado |
| --- | --- |
| CI / Release | **DONE** — [Release](https://github.com/TiiZss/TorZlink/actions/runs/32237661145) |
| Smoke GHCR | **DONE** — `tools/smoke-serve.ps1` |
| Deploy NAS | **DONE** — `torzlink:v1.8.1`, `http://torzlink.lan/health` |

## Sync snapshot

| Surface | Value |
| --- | --- |
| `main` / tag | `v1.8.1` @ `c561fd4` |
| GHCR | `ghcr.io/tiizss/torzlink:v1.8.1` |
| NAS | `TORZLINK_IMAGE=torzlink:v1.8.1` |

## P3 — next product/ops (optional)

| ID | Item |
| --- | --- |
| P3-1 | Sidecar VPN switch sin socket en proceso BT |
| P3-2 | Selective upstream sync `baairon/torlink` |
| P3-3 | Authelia / full Traefik auth recipe |
| P3-4 | Pin GitHub Actions that still warn on Node 20 → Node 24 |
| P3-5 | Web UI feature parity (categories / history / seeding polish) |

## Notes from this release

- First Release attempt failed Trivy CRITICAL on base-image `npm`→`tar` (CVE-2026-59873). Fixed by stripping unused `npm`/`npx` from runtime Dockerfile; retagged `v1.8.1` (release had not published GHCR).
