# Next session — TorZlink backlog & plan

Session wrap-up **2026-07-17 (noche II)**: PR [#2](https://github.com/TiiZss/TorZlink/pull/2). Backlog P0–P2 **implementado** en la rama (salvo P3 arquitectura / HITL merge).

## Gates

| Gate | Estado |
| --- | --- |
| CI | Re-check tras push masivo |
| P0 security/switch/jail/scrapers | **DONE** |
| P1 product/HTTP/CI/docs | **DONE** (SSE sin Bearer → poll fallback) |
| P2 quality | **DONE** (Zod, log, seedOnComplete, Results, launchers env_file) |
| Merge PR #2 | **HITL** — confirmación usuario |
| Release tag | Tras merge + `pre-release` + reviews |

## Product invariant — Web ≡ TUI

Sin cambios de alcance; ayuda web + `seedOnComplete` + SSE/poll cierran gaps de UX.

## Ops — VPN / Traefik

Labels Gluetun + docs Traefik≠Bearer OK. Phase 2 sidecar → P3-1.

---

## Recommended order (histórico — casi todo DONE)

### P0 — **DONE**

P0-A…D, P0-1…4 (incl. `TORZLINK_DOWNLOAD_ROOT`).

### P1 — **DONE**

| ID | Notas |
| --- | --- |
| P1-5 | Panel ayuda en `web/index.html` |
| P1-6 | `GET /api/events` SSE; UI usa EventSource sin token, poll con Bearer |
| P1-7 | `src/server/rateLimit.ts` → 429 |
| P1-8 | sanitize en `loadQueue` / `loadHistory` |
| P1-9 | `docs/smoke-docker-windows.md` |
| P1-10 | README Windows Docker |
| P1-11 | Trivy en `release.yml` antes de push GHCR |
| P1-12 | `softprops/action-gh-release` pineado por SHA |

### P2 — **DONE**

| ID | Notas |
| --- | --- |
| P2-13 | Zod schema `config.json` (+ `seedOnComplete`) |
| P2-14 | `TORZLINK_LOG` + `redactLogText` |
| P2-15 | `seedOnComplete` config/API/UI (default true) |
| P2-16 | Results TUI: magnet canónico corto |
| P2-17 | EZTV rebuild (hecho con P0-2) |
| P2-18 | compose `env_file.required: false` + follow-ups |

### P3 — pendiente (no bloquea merge)

| ID | Item |
| --- | --- |
| P3-1 | Sidecar VPN switch sin socket en proceso BT |
| P3-2 | Selective upstream sync `baairon/torlink` |
| P3-3 | Authelia snippet completo (basicAuth ya esbozado en labels.md) |

---

**HITL:** merge de PR #2 y tags de release requieren confirmación explícita.

## Reference — v1.7.1+

- Jail: `TORZLINK_DOWNLOAD_DIR` (lock) o `TORZLINK_DOWNLOAD_ROOT` (prefijo)
- Release: scan Trivy Critical antes de `docker push`
- Skills: [docs/agent-workflow.md](agent-workflow.md)
