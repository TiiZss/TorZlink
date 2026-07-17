# Next session — TorZlink backlog & plan

Session wrap-up **2026-07-17** (closed): PR [#2](https://github.com/TiiZss/TorZlink/pull/2) merged; **v1.8.0** released + smoke + NAS deploy.

## Gates (all green)

| Gate | Estado |
| --- | --- |
| CI / merge | **DONE** |
| P0–P2 backlog | **DONE** |
| Release **v1.8.0** | **DONE** — [release](https://github.com/TiiZss/TorZlink/releases/tag/v1.8.0) + [workflow](https://github.com/TiiZss/TorZlink/actions/runs/29612570968) |
| Local smoke GHCR | **DONE** — `tools/smoke-serve.ps1` |
| Deploy NAS | **DONE** — `torzlink:v1.8.0`, `http://torzlink.lan/health` OK |

## Sync snapshot (end of day)

| Surface | Value |
| --- | --- |
| `main` / tag | `v1.8.0` @ `c3feed1` |
| `package.json` / `version.ts` | `1.8.0` |
| GHCR | `ghcr.io/tiizss/torzlink:v1.8.0` |
| NAS | `TORZLINK_IMAGE=torzlink:v1.8.0`, mode `direct` |

## P3 — next product/ops (optional)

| ID | Item |
| --- | --- |
| P3-1 | Sidecar VPN switch sin socket en proceso BT |
| P3-2 | Selective upstream sync `baairon/torlink` |
| P3-3 | Authelia / full Traefik auth recipe |
| P3-4 | Pin GitHub Actions that still warn on Node 20 → Node 24 |
| P3-5 | Web UI feature parity (categories / history / seeding polish) |

## Retrospective — what to do better next time

Captured in [agent-workflow.md](agent-workflow.md) §5–§8:

1. **Smoke serve** — use `tools/smoke-serve.ps1` (API `{ items }`, cancel via `POST …/cancel`; never SSE with `Invoke-WebRequest`).
2. **Post-release deploy** — `docker pull` + `docker tag … torzlink:vX.Y.Z` + `deploy-from-dev.ps1 -SkipBuild` (exact release digest, faster than rebuild).
3. **Reviews on clean `main`** — if `Diff: branch changes` is empty after merge, review the release commit range / last PR, not a no-op.
4. **NAS health** — Traefik path `http://torzlink.lan/health`; do not assume host `127.0.0.1:8787` publishes the port.
5. **Session close** — update this file + README kanban + confirm CI/release/NAS alignment before stopping.

## Reference — v1.8.0

- Jail: `TORZLINK_DOWNLOAD_DIR` (lock) o `TORZLINK_DOWNLOAD_ROOT`
- VPN: `ensure-gluetun-traefik-labels.sh` + switch sibling
- Skills / gates: [agent-workflow.md](agent-workflow.md)
