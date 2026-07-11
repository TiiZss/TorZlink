# Agent workflow — skills, reviews, and release gates

How Cursor agents should run **TorZlink** sessions: which skills/subagents to invoke, when to loop on CI, and mandatory checks before tags.

**Local rule mirror:** `.cursor/rules/workflow-session-orchestration.mdc` (`alwaysApply: true`). `.cursor/` is gitignored — install from versioned templates:

```sh
bash tools/install-cursor-rules.sh
```

Templates live in [docs/cursor-rules/](cursor-rules/).

## 1. Skill routing (proactive)

When the user request matches a row below, **read the skill file first** (`.agents/skills/<name>/SKILL.md` or `.cursor/rules/<name>.mdc`) and apply it before improvising.

| User intent / task area | Read skill | Optional subagent / tool |
| --- | --- | --- |
| Security hardening, secrets, `.env`, auth | `security-senior-secops`, `security-appsec-engineer` | `security-review` before merge/tag |
| Threat model, trust boundaries, ADR | `security-architect` | — |
| Docker, CI/CD, `release.yml`, compose | `engineering-devops-automator` | `docker build` locally |
| Release reliability, smoke tests, ops | `engineering-sre` | `tools/pre-release-check.sh` |
| API / Telegram / external HTTP | `testing-api-tester` | extend Vitest integration tests |
| UI / Ink / TUI | `engineering-frontend-developer` | — |
| Backend / download queue / config | `engineering-backend-architect` | — |
| Architecture / P2 design | `engineering-software-architect` | — |
| Code review before PR | `engineering-code-reviewer` | `bugbot` (`review-bugbot` skill) |
| Git tags, releases, branching | `engineering-git-workflow-master` | — |
| Large multi-topic diff | `split-to-prs` skill | separate PRs per concern |
| Open PR not merge-ready | `babysit` skill | triage comments + fix CI loop |

**Rule:** If a skill applies, say which one you are following (one line) and execute its checklist — do not skip because the task “looks small”.

## 2. Subagent reviews (mandatory gates)

| Gate | When | How |
| --- | --- | --- |
| **Security review** | After security-related changes; **before** any release tag | `review-security` skill → `security-review` subagent, `Diff: branch changes` |
| **Bugbot** | Before release tag; after CI/Docker/workflow edits | `review-bugbot` skill → `bugbot` subagent |
| **CI investigator** | A GitHub Actions job fails | `ci-investigator` subagent on the failed run |

Fix **Critical/High** findings from reviews before tagging. Document accepted risks in ADR or CHANGELOG.

## 3. Release gate (before `git tag`)

Run locally (or `npm run pre-release`):

```sh
npm run pre-release
```

Equivalent manual steps:

1. `npm test && npm run typecheck && npm run build`
2. `bash tools/pre-release-check.sh` — Docker context, SBOM file, lockfile alignment
3. `review-security` + `review-bugbot` on branch changes (agent-driven)
4. Bump `package.json`, `src/constants/version.ts`, `CHANGELOG.md`
5. `git tag vX.Y.Z && git push origin main && git push origin vX.Y.Z`

### Docker / lockfile invariant

If `Dockerfile` uses `npm ci` and `COPY package-lock.json`:

- `package-lock.json` must **not** be listed in `.dockerignore`
- Root `package-lock.json` version must match `package.json`

### SBOM invariant

`npm sbom` has **no** `-o` flag. Write the file with shell redirect:

```sh
npm sbom --omit=dev --sbom-format=cyclonedx --sbom-type=library > sbom.cdx.json
```

## 4. Post-push: monitor Release workflow

After pushing a **version tag**, monitor until green:

```sh
gh run list --repo TiiZss/TorZlink --workflow release.yml --limit 1
gh run watch <run-id> --repo TiiZss/TorZlink --exit-status
```

**Loop (optional):** use Cursor `/loop` skill — e.g. `/loop 30s check Release workflow for latest tag on TiiZss/TorZlink` — so the agent retries diagnosis if the job fails.

On failure: run `ci-investigator`, fix, move tag only if release never succeeded (delete remote tag → fix → re-tag).

## 5. Session types — default sequences

### Security session (P0/P1/P2)

1. Read `security-senior-secops` + `security-architect`
2. Implement + `tests/security/` regressions
3. `security-review` subagent
4. Update ADR/README if trust model changes
5. If releasing → §3 Release gate

### Release / version session

1. Read `engineering-devops-automator` + `engineering-sre`
2. `npm run pre-release`
3. `review-bugbot` + `security-review`
4. Tag + push + §4 monitor
5. Update `docs/next-session.md` + README project board

### Docker / CI session

1. Read `engineering-devops-automator`
2. Change workflow/Dockerfile → verify `.dockerignore` vs `COPY` lines
3. Local `docker build -f packaging/docker/Dockerfile .`
4. `review-bugbot` on workflow diff

### Integration session (Telegram, etc.)

1. Read `testing-api-tester`
2. Vitest tests under `tests/integrations/`
3. Never log tokens; keep `.env.example` placeholders commented

## 6. Detecting “this could use a skill”

Trigger skill routing (§1) when the user mentions or implies:

- *release, tag, v1.x, publicar, subir a GitHub, cerrar sesión*
- *seguridad, hardening, audit, secrets, sanitiz*
- *Docker, compose, workflow, CI, pipeline*
- *Telegram, API, notify, integración*
- *review, PR, merge, CI rojo*
- *smoke, SRE, observabilidad*

When detected: name the skill, follow its checklist, then implement.

## 7. References

- [docs/next-session.md](next-session.md) — product backlog
- [docs/follow-ups-launchers.md](follow-ups-launchers.md) — launcher sync
- [docs/adr/001-trust-model.md](adr/001-trust-model.md) — trust boundaries
- [CONTRIBUTING.md](../CONTRIBUTING.md) — human contributor bar
