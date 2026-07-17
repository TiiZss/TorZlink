# Traefik labels for TorZlink when TORZLINK_NETWORK_MODE=vpn
#
# Paste these onto the **gluetun** service in your homelab compose (same pattern
# as qBittorrent's Host(`qbittorrent.lan`) → port 8081). TorZlink listens on 8787
# inside the shared network namespace.
#
# Router name is `torzlink-vpn` with priority=1 so it coexists with the direct-mode
# container router (`torzlink`, priority=100). While both are up, Traefik prefers
# the direct backend; when only VPN mode is running, this router serves torzlink.lan.
#
# Or run on the NAS (idempotent):
#   sh tools/ensure-gluetun-traefik-labels.sh --apply

```yaml
labels:
  # …existing qbittorrent / other labels…
  - "traefik.http.routers.torzlink-vpn.entrypoints=web"
  - "traefik.http.routers.torzlink-vpn.rule=Host(`torzlink.lan`)"
  - "traefik.http.routers.torzlink-vpn.priority=1"
  - "traefik.http.routers.torzlink-vpn.service=torzlink-vpn-service"
  - "traefik.http.services.torzlink-vpn-service.loadbalancer.server.port=8787"
```

Also ensure Pi-hole (or your LAN DNS) resolves `torzlink.lan` to Traefik's LAN IP.

## Auth (Traefik ≠ Bearer)

These labels only publish the Host rule. They do **not** replace `TORZLINK_SERVE_TOKEN`:

- **Bearer** — required for `/api/*` (and VPN switch). Set in the TorZlink `.env`; the web UI prompts for it.
- **Traefik middleware** (optional) — add `basicAuth` / Authelia on the router if the LAN is not fully trusted. Example sketch:

```yaml
  - "traefik.http.routers.torzlink-vpn.middlewares=torzlink-auth"
  - "traefik.http.middlewares.torzlink-auth.basicauth.users=admin:$$apr1$$…"
```

Keep Bearer even with Traefik auth: containers on `proxy_net` bypass the edge middleware.
