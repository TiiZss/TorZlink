# Next session — TorZlink backlog & plan

Session wrap-up **2026-07-17 (noche)**: PR [#2](https://github.com/TiiZss/TorZlink/pull/2). Traefik labels Gluetun OK. Plan enriquecido. **Hecho:** P0-A…D (jail/switch), **P0-1** copy TUI sanitize, **P0-2** scrapers rebuild magnet, **P0-4** Traefik auth docs.

## Gates (antes de merge / tag)

| Gate | Estado | Acción |
| --- | --- | --- |
| CI branch | Re-check tras push P0 | — |
| `security-review` Medium | Mitigado (P0-A) | Re-review opcional post-push |
| `bugbot` High/Medium | Mitigado (P0-B/C/D) | Re-review opcional post-push |
| Merge PR #2 | Pendiente HITL | Confirmación usuario |
| Release tag | No aún | `pre-release` + reviews |

## Product invariant — Web ≡ TUI

**La web (`torzlink serve`) debe ser un clon funcional de la TUI.** Mismo alcance; solo cambia el shell (HTML vs Ink).

### Paridad TUI → Web

| # | Capacidad TUI | Estado web | Notas |
| --- | --- | --- | --- |
| 1 | Búsqueda multi-fuente + resultados | OK | `GET /api/search` |
| 2 | Añadir a cola (magnet / infohash / resultado) | OK | `dir` / `?dir=` + jail |
| 3 | Cola: pause / resume / cancel + progreso | Parcial | ETA OK; open folder N/A remoto |
| 4 | Historial / recently downloaded | OK | History tab |
| 5 | Seeding | OK | Seeding tab |
| 6 | Copiar magnet / `.magnet` | OK | API sanitiza; **TUI copy aún no** → P0-1 |
| 7 | Pegar magnet | Parcial | Input OK; clipboard host ≠ browser |
| 8 | Abrir `.torrent` | OK | |
| 9–12 | Config / categorías / sort | OK | |
| 13 | Help contextual | Parcial | Falta panel ayuda web → P1-5 |
| 14 | Splash / branding | Parcial | |
| 15 | Telegram start/complete/error | Parcial | Copy OK; resto vía runtime |
| 16 | Red direct ↔ vpn | OK | Tras P0-B debe ser fiable en fallos |

## Ops invariant — VPN ON/OFF

**Implementado en NAS** + labels Traefik en Gluetun (`torzlink-vpn` priority=1 vs `torzlink` priority=100).

- Phase 2 (opcional): sidecar sin socket en el proceso BitTorrent
- Receta Traefik basicAuth + Bearer east-west → P0-4

---

## Recommended order (ejecutar en este orden)

### P0 — merge blockers / seguridad (esta sesión o inmediata)

| ID | Item | Por qué | Enfoque | Archivos | Skill |
| --- | --- | --- | --- | --- | --- |
| P0-A | Path jail con `realpath` | ~~Bypass symlink~~ | **DONE** `ensureDownloadDirUnderRoot` + test symlink | `httpServer.ts`, `http.test.ts` | `security-appsec-engineer` |
| P0-B | Switch: preflight antes de patch + rollback | ~~`.env` desync~~ | **DONE** `patch_env_mode` / `die_restore` | `torzlink-network-switch.sh` | `engineering-devops-automator` |
| P0-C | Crear `downloadDir` por defecto en API | ~~sin mkdir~~ | **DONE** (via ensure) | `httpServer.ts` | `engineering-backend-architect` |
| P0-D | `startSwitchCmd` wait-for-exit | ~~false OK @250ms~~ | **DONE** exit/2s grace | `networkMode.ts` | `engineering-backend-architect` |
| P0-1 | Sanitizar copy-magnet en TUI | ~~raw clipboard~~ | **DONE** `sanitizeDownloadInput` en `copyMagnet` | `App.tsx`, `regression.test.ts` | `security-senior-secops` |
| P0-2 | Anti-corrupción scrapers | ~~magnets crudos~~ | **DONE** sanitize en x1337/rss/eztv/subsplease | `src/sources/*`, `rss.test.ts` | `security-appsec-engineer` |
| P0-3 | `TORZLINK_DOWNLOAD_ROOT` jail global | Jail solo si env download dir | Root opcional + realpath en config | `httpServer.ts`, `config/`, `.env.example` | `security-architect` |
| P0-4 | Docs Traefik auth + token | ~~Traefik ≠ auth~~ | **DONE** README + labels.md | `README.md`, `traefik-gluetun-*.md` | `security-architect` |

### P1 — producto / HTTP / CI

| ID | Item | Notas | Skill |
| --- | --- | --- | --- |
| P1-5 | Ayuda corta Web UI | Panel `?` (no keymap Ink) | `engineering-frontend-developer` |
| P1-6 | SSE/WebSocket progreso | Sustituir poll 1 s | `engineering-backend-architect` |
| P1-7 | Rate limit `/api/*` | Token bucket IP+Bearer | `security-senior-secops` |
| P1-8 | Sanitize magnets al restaurar queue/history | Persistencia hostil | `security-appsec-engineer` |
| P1-9 | Smoke TUI Docker interactivo (Windows) | Checklist + opcional script | `engineering-sre` |
| P1-10 | Docs Windows Docker volumes | `%cd%`, WSL2, Desktop bind-mount, PATH | `engineering-devops-automator` |
| P1-11 | Trivy/gitleaks en `release.yml` antes de push GHCR | Paridad con CI | `engineering-devops-automator` |
| P1-12 | Pin `softprops/action-gh-release` por SHA | Supply chain | `engineering-devops-automator` |

### P2 — calidad / privacidad

| ID | Item | Notas | Skill |
| --- | --- | --- | --- |
| P2-13 | Zod schema `config.json` | No hay Zod hoy; parse laxo | `engineering-backend-architect` |
| P2-14 | `TORZLINK_LOG` estructurado + redaction | Bearer/magnets/tokens | `engineering-sre` |
| P2-15 | `seedOnComplete` configurable (default off opcional) | Privacy ADR | `engineering-software-architect` |
| P2-16 | Results TUI: no magnet crudo | Solo hash / canónico | `engineering-frontend-developer` |
| P2-17 | EZTV: validar hash vs `magnet_url` | Rebuild preferente | `security-appsec-engineer` |
| P2-18 | Review launchers + `env_file` compose | `docs/follow-ups-launchers.md` | `engineering-code-reviewer` |

### P3 — arquitectura / deuda (no bloquear)

| ID | Item | Notas |
| --- | --- | --- |
| P3-1 | Sidecar VPN switch sin socket en proceso BT | Reduce blast radius ADR-001 |
| P3-2 | Selective upstream sync `baairon/torlink` | Maintenance |
| P3-3 | Authelia / basicAuth Traefik middleware snippet | Ops recipe |

---

## Agent topology (esta sesión)

```text
Orchestrator
  ├─ security-review  → findings → plan P0-A
  ├─ bugbot           → findings → plan P0-B/C/D
  ├─ explore          → backlog P0-1…P2-18
  └─ implement        → P0-A…D primero (merge readiness)
        ├─ devops     (switch script)
        ├─ backend    (jail, networkMode)
        └─ git        (commit + push PR #2)
```

**HITL:** merge de PR #2 y cualquier tag de release requieren confirmación explícita del usuario.

## Reference — v1.7.1

- NAS: `TORZLINK_DOWNLOADS_HOST` → `/downloads`; `user: PUID:PGID`
- Traefik: `torzlink.lan` → direct priority 100 / vpn via Gluetun priority 1
- POST `/api/downloads` → **409** if already queued
- Skills: [docs/agent-workflow.md](agent-workflow.md)
