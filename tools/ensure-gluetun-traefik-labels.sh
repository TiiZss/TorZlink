#!/bin/sh
# Ensure Traefik Host(torzlink.lan) labels exist on the Gluetun container.
# Required when TORZLINK_NETWORK_MODE=vpn (shared netns — Traefik cannot label torzlink-vpn).
#
# Uses router name torzlink-vpn with priority=1 so it coexists with the direct-mode
# router (torzlink, priority=100) without stealing traffic while both are present.
#
# Usage (on NAS):
#   tools/ensure-gluetun-traefik-labels.sh              # check only (exit 1 if missing)
#   tools/ensure-gluetun-traefik-labels.sh --apply       # patch compose + recreate gluetun
#
# Env:
#   GLUETUN_CONTAINER_NAME   default: gluetun
#   GLUETUN_COMPOSE_FILE     default: from container label, else /volume2/Docker_Configs/0-nas/docker-compose.yml
set -eu

APPLY=0
if [ "${1:-}" = "--apply" ]; then
  APPLY=1
  shift
fi

g="${GLUETUN_CONTAINER_NAME:-gluetun}"

die() { echo "error: $*" >&2; exit 1; }
info() { echo "→ $*" >&2; }
ok() { echo "OK: $*"; }

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "missing command: $1"
}

need_cmd docker

docker inspect -f '{{.State.Running}}' "${g}" 2>/dev/null | grep -qx true \
  || die "gluetun container '${g}' is not running"

label() {
  docker inspect -f "{{index .Config.Labels \"$1\"}}" "${g}" 2>/dev/null || true
}

RULE_KEY='traefik.http.routers.torzlink-vpn.rule'
PORT_KEY='traefik.http.services.torzlink-vpn-service.loadbalancer.server.port'
# Legacy name from earlier docs (same Host rule, shared service name with direct)
LEGACY_RULE_KEY='traefik.http.routers.torzlink.rule'
EXPECTED_RULE='Host(`torzlink.lan`)'
EXPECTED_PORT='8787'

have_rule="$(label "${RULE_KEY}")"
have_port="$(label "${PORT_KEY}")"
legacy_rule="$(label "${LEGACY_RULE_KEY}")"

if { [ "${have_rule}" = "${EXPECTED_RULE}" ] && [ "${have_port}" = "${EXPECTED_PORT}" ]; } \
  || { [ "${legacy_rule}" = "${EXPECTED_RULE}" ] && [ "$(label 'traefik.http.services.torzlink-service.loadbalancer.server.port')" = "${EXPECTED_PORT}" ]; }; then
  ok "gluetun already has TorZlink Traefik labels (Host(torzlink.lan) → 8787)"
  exit 0
fi

info "missing TorZlink Traefik labels on '${g}' (vpn-rule='${have_rule}' port='${have_port}' legacy-rule='${legacy_rule}')"

if [ "${APPLY}" -ne 1 ]; then
  die "run with --apply to patch compose and recreate gluetun (brief VPN blip for qbittorrent)"
fi

COMPOSE_FILE="${GLUETUN_COMPOSE_FILE:-}"
if [ -z "${COMPOSE_FILE}" ]; then
  COMPOSE_FILE="$(label 'com.docker.compose.project.config_files')"
fi
if [ -z "${COMPOSE_FILE}" ] || [ "${COMPOSE_FILE}" = "<no value>" ]; then
  COMPOSE_FILE="/volume2/Docker_Configs/0-nas/docker-compose.yml"
fi
[ -f "${COMPOSE_FILE}" ] || die "compose file not found: ${COMPOSE_FILE}"

WORKDIR="$(dirname "${COMPOSE_FILE}")"
SERVICE="$(label 'com.docker.compose.service')"
[ -n "${SERVICE}" ] && [ "${SERVICE}" != "<no value>" ] || SERVICE=gluetun

MARKER='traefik.http.routers.torzlink-vpn.rule'
LEGACY_MARKER='traefik.http.routers.torzlink.rule'
if grep -Fq "${MARKER}" "${COMPOSE_FILE}" || grep -Fq "${LEGACY_MARKER}" "${COMPOSE_FILE}"; then
  info "compose already mentions torzlink Traefik labels — recreating '${SERVICE}' to pick them up"
else
  # Insert after qbittorrent loadbalancer port (same pattern as existing VPN apps).
  tmp="$(mktemp)"
  awk -v port_line='traefik.http.services.qbittorrent-service.loadbalancer.server.port' '
    BEGIN { inserted=0 }
    {
      print
      if (!inserted && index($0, port_line) > 0) {
        print "      - \"traefik.http.routers.torzlink-vpn.entrypoints=web\""
        print "      - \"traefik.http.routers.torzlink-vpn.rule=Host(`torzlink.lan`)\""
        print "      - \"traefik.http.routers.torzlink-vpn.priority=1\""
        print "      - \"traefik.http.routers.torzlink-vpn.service=torzlink-vpn-service\""
        print "      - \"traefik.http.services.torzlink-vpn-service.loadbalancer.server.port=8787\""
        inserted=1
      }
    }
    END {
      if (!inserted) exit 2
    }
  ' "${COMPOSE_FILE}" >"${tmp}" || {
    rm -f "${tmp}"
    die "could not find qbittorrent Traefik port label in ${COMPOSE_FILE} to insert after — edit manually (see packaging/docker/traefik-gluetun-torzlink.labels.md)"
  }
  bak="${COMPOSE_FILE}.bak.torzlink.$(date +%Y%m%d%H%M%S)"
  cp -a "${COMPOSE_FILE}" "${bak}"
  info "backup: ${bak}"
  cat "${tmp}" >"${COMPOSE_FILE}"
  rm -f "${tmp}"
  info "patched ${COMPOSE_FILE}"
fi

if ! docker compose version >/dev/null 2>&1; then
  die "docker compose not found (need Compose v2)"
fi

info "recreating ${SERVICE} (and dependents) in ${WORKDIR}"
(
  cd "${WORKDIR}"
  docker compose -f "${COMPOSE_FILE}" up -d --force-recreate "${SERVICE}"
  # qbittorrent uses network_mode:container:gluetun — recreate so it reattaches
  if docker compose -f "${COMPOSE_FILE}" config --services 2>/dev/null | grep -qx qbittorrent; then
    docker compose -f "${COMPOSE_FILE}" up -d --force-recreate qbittorrent || true
  fi
)

i=0
while [ "${i}" -lt 45 ]; do
  have_rule="$(label "${RULE_KEY}")"
  have_port="$(label "${PORT_KEY}")"
  legacy_rule="$(label "${LEGACY_RULE_KEY}")"
  if { [ "${have_rule}" = "${EXPECTED_RULE}" ] && [ "${have_port}" = "${EXPECTED_PORT}" ]; } \
    || { [ "${legacy_rule}" = "${EXPECTED_RULE}" ] && [ "$(label 'traefik.http.services.torzlink-service.loadbalancer.server.port')" = "${EXPECTED_PORT}" ]; }; then
    ok "TorZlink Traefik labels active on '${g}'"
    exit 0
  fi
  i=$((i + 1))
  sleep 1
done

die "labels still missing after recreate — check ${COMPOSE_FILE} and Traefik Docker provider"
