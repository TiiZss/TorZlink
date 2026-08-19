# Next session — TorZlink backlog & plan

Session wrap-up **2026-08-19**: **v1.8.1** web library form layout; align GitHub + GHCR + NAS.

## Gates

| Gate | Estado |
| --- | --- |
| CI / merge | in flight with release |
| Release **v1.8.1** | tagging |
| Smoke GHCR | pending |
| Deploy NAS | pending (`torzlink:v1.8.1`) |

## P3 — next product/ops (optional)

| ID | Item |
| --- | --- |
| P3-1 | Sidecar VPN switch sin socket en proceso BT |
| P3-2 | Selective upstream sync `baairon/torlink` |
| P3-3 | Authelia / full Traefik auth recipe |
| P3-4 | Pin GitHub Actions that still warn on Node 20 → Node 24 |
| P3-5 | Web UI feature parity (categories / history / seeding polish) |

## Reference

- Skills / gates: [agent-workflow.md](agent-workflow.md)
- Smoke: `.\tools\smoke-serve.ps1`
- Deploy: GHCR retag + `deploy-from-dev.ps1 -SkipBuild`
