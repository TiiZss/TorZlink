# Next session — TorZlink backlog & plan

Session wrap-up **2026-07-17**: PR [#2](https://github.com/TiiZss/TorZlink/pull/2) **MERGED**; release **v1.8.0** in flight / shipped.

## Gates

| Gate | Estado |
| --- | --- |
| CI / merge | **DONE** |
| P0–P2 backlog | **DONE** |
| Release **v1.8.0** | Tag + `release.yml` watch |
| Deploy NAS | `deploy-from-dev` / `deploy-nas.sh` with new image tag |

## P3 — next product/ops (optional)

| ID | Item |
| --- | --- |
| P3-1 | Sidecar VPN switch sin socket en proceso BT |
| P3-2 | Selective upstream sync `baairon/torlink` |
| P3-3 | Authelia / full Traefik auth recipe |

## Reference — v1.8.0

- Jail: `TORZLINK_DOWNLOAD_DIR` (lock) o `TORZLINK_DOWNLOAD_ROOT`
- VPN: `ensure-gluetun-traefik-labels.sh` + switch sibling
- Skills: [docs/agent-workflow.md](agent-workflow.md)
