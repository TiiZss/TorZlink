# Smoke — TorZlink TUI in Docker (Windows host)

Manual checklist for the primary Windows + Docker Desktop machine.

## Automated (no TTY)

Already covered in CI / local:

```powershell
docker build -f packaging/docker/Dockerfile -t torzlink:dev .
docker run --rm -p 8788:8787 -e TORZLINK_SERVE_TOKEN=smoke -e TORZLINK_SKIP_UPDATE=1 `
  torzlink:dev serve --host 0.0.0.0 --port 8787
# POST /api/downloads with a magnet → 201, then cancel
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
