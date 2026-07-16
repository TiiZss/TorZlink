#!/usr/bin/env bash
# Apply TorZlink network mode (direct|vpn) by recreating the compose profile.
# Invoked from the container via TORZLINK_NETWORK_SWITCH_CMD (detached).
# Requires: docker CLI + compose v2, Docker socket, deploy dir with .env + compose.
set -euo pipefail

mode="${1:-}"
case "${mode}" in
  direct|vpn) ;;
  *)
    echo "usage: $(basename "$0") direct|vpn" >&2
    exit 1
    ;;
esac

DEPLOY_DIR="${TORZLINK_DEPLOY_DIR:-/deploy}"
ENV_FILE="${TORZLINK_DEPLOY_ENV_HOST:-${DEPLOY_DIR}/.env}"
COMPOSE_FILE="${TORZLINK_COMPOSE_FILE:-${DEPLOY_DIR}/docker-compose.nas.yml}"

die() { echo "error: $*" >&2; exit 1; }
info() { echo "→ $*" >&2; }

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "missing command: $1"
}

need_cmd docker
[[ -f "${ENV_FILE}" ]] || die "missing ${ENV_FILE}"
[[ -f "${COMPOSE_FILE}" ]] || die "missing ${COMPOSE_FILE}"

if ! docker compose version >/dev/null 2>&1; then
  die "docker compose not found (need Compose v2)"
fi

# Let the HTTP handler finish before we recreate this container.
sleep "${TORZLINK_NETWORK_SWITCH_DELAY:-1}"

# Patch .env (idempotent with server-side TORZLINK_DEPLOY_ENV_FILE patch)
if grep -qE '^[[:space:]]*TORZLINK_NETWORK_MODE=' "${ENV_FILE}"; then
  tmp="$(mktemp)"
  sed -E "s/^[[:space:]]*TORZLINK_NETWORK_MODE=.*/TORZLINK_NETWORK_MODE=${mode}/" "${ENV_FILE}" >"${tmp}"
  mv "${tmp}" "${ENV_FILE}"
else
  printf '\nTORZLINK_NETWORK_MODE=%s\n' "${mode}" >>"${ENV_FILE}"
fi

set -a
# shellcheck disable=SC1090
source "${ENV_FILE}"
set +a

if [[ "${mode}" == "direct" ]]; then
  [[ -n "${PROXY_NET_NAME:-}" ]] || die "PROXY_NET_NAME is required for direct mode"
fi
if [[ "${mode}" == "vpn" ]]; then
  g="${GLUETUN_CONTAINER_NAME:-gluetun}"
  docker inspect -f '{{.State.Running}}' "${g}" 2>/dev/null | grep -qx true \
    || die "gluetun container '${g}' is not running"
fi

compose() {
  docker compose --env-file "${ENV_FILE}" --profile "${mode}" -f "${COMPOSE_FILE}" "$@"
}

info "switching TorZlink to profile=${mode}"
if [[ "${mode}" == "direct" ]]; then
  docker compose --env-file "${ENV_FILE}" --profile vpn -f "${COMPOSE_FILE}" down 2>/dev/null || true
else
  docker compose --env-file "${ENV_FILE}" --profile direct -f "${COMPOSE_FILE}" down 2>/dev/null || true
fi

compose up -d
info "TorZlink up (profile=${mode})"
