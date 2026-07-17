# Smoke — TorZlink in Docker (Windows host)

Manual + scripted checklist for the primary Windows + Docker Desktop machine.

## Automated serve smoke (preferred)

After a release (or before NAS deploy), smoke the **published** image:

```powershell
.\tools\smoke-serve.ps1
# pin explicitly:
.\tools\smoke-serve.ps1 -Image ghcr.io/tiizss/torzlink:v1.8.0
# already pulled / local tag:
.\tools\smoke-serve.ps1 -Image torzlink:v1.8.0 -SkipPull
```

Covers: `/health`, unauth 401, API JSON, Sintel magnet → `{ items }` → `POST …/cancel`.

See also [agent-workflow.md](agent-workflow.md) §5b / §7.

## Manual one-liner (legacy)

```powershell
docker build -f packaging/docker/Dockerfile -t torzlink:dev .
docker run --rm -p 8788:8787 -e TORZLINK_SERVE_TOKEN=smoke -e TORZLINK_SKIP_UPDATE=1 `
  torzlink:dev serve --host 0.0.0.0 --port 8787
# Prefer smoke-serve.ps1 instead of hand-rolled POST/cancel
```

## Interactive TUI

1. From repo root (PowerShell):

   ```powershell
   npm run docker:run
   # or: .\torzlink.ps1 -Docker
   ```

2. Confirm Ink UI draws (search prompt visible).
3. Search a short query (e.g. `sintel`); open a result with `d`.
4. Confirm progress ticks; `c` cancel if you do not want a full download.
5. Quit (`q` / Ctrl+C). Container should disappear (`--rm`).

## Volumes

- Host `.\downloads` (or compose bind) should receive files while downloading.
- If empty: check Docker Desktop file sharing for the drive, and that the bind path uses `${PWD}` / `%cd%` not a stale absolute path.

## NAS after deploy

- Health via Traefik: `http://torzlink.lan/health`
- Confirm `docker ps` image tag matches the release (`torzlink:vX.Y.Z`)
