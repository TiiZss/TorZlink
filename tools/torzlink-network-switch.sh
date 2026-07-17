#!/bin/sh
# Apply TorZlink network mode (direct|vpn) by recreating the compose profile.
# Invoked from the container via TORZLINK_NETWORK_SWITCH_CMD (detached).
# POSIX sh — Alpine runtime has no bash.
#
# Usage:
#   torzlink-network-switch.sh direct|vpn           # hand-off to sibling (safe from inside torzlink)
#   torzlink-network-switch.sh --apply direct|vpn   # actually down/rm/up (run in sibling)
set -eu

APPLY=0
if [ "${1:-}" = "--apply" ]; then
  APPLY=1
  shift
fi

mode="${1:-}"
case "${mode}" in
  direct|vpn) ;;
  *)
    echo "usage: $(basename "$0") [--apply] direct|vpn" >&2
    exit 1
    ;;
esac

if [ -n "${TORZLINK_DEPLOY_DIR:-}" ]; then
  DEPLOY_DIR="${TORZLINK_DEPLOY_DIR}"
elif [ -f "./.env" ] && [ -f "./docker-compose.nas.yml" ]; then
  DEPLOY_DIR="$(pwd)"
else
  DEPLOY_DIR="/deploy"
fi

ENV_FILE="${TORZLINK_DEPLOY_ENV_HOST:-${DEPLOY_DIR}/.env}"
COMPOSE_FILE="${TORZLINK_COMPOSE_FILE:-${DEPLOY_DIR}/docker-compose.nas.yml}"

die() { echo "error: $*" >&2; exit 1; }
info() { echo "→ $*" >&2; }

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "missing command: $1"
}

need_cmd docker
[ -f "${ENV_FILE}" ] || die "missing ${ENV_FILE}"
[ -f "${COMPOSE_FILE}" ] || die "missing ${COMPOSE_FILE}"

if ! docker compose version >/dev/null 2>&1; then
  die "docker compose not found (need Compose v2)"
fi

COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-torzlink}"
export COMPOSE_PROJECT_NAME

# Capture previous mode before patching (for rollback if compose up fails).
# Prefer TORZLINK_PREV_NETWORK_MODE from the serve process: it patches .env
# before spawning us, so reading the file alone would see the *target* mode.
prev_mode="${TORZLINK_PREV_NETWORK_MODE:-}"
case "${prev_mode}" in
  direct|vpn) ;;
  *)
    prev_mode="$(grep -E '^[[:space:]]*TORZLINK_NETWORK_MODE=' "${ENV_FILE}" 2>/dev/null | tail -1 | cut -d= -f2- | tr -d '\r' || true)"
    case "${prev_mode}" in direct|vpn) ;; *) prev_mode=direct ;; esac
    ;;
esac

# Patch .env (idempotent with server-side TORZLINK_DEPLOY_ENV_FILE patch)
env_owner="$(stat -c '%u:%g' "${ENV_FILE}" 2>/dev/null || echo "1000:10")"
if grep -qE '^[[:space:]]*TORZLINK_NETWORK_MODE=' "${ENV_FILE}"; then
  tmp="$(mktemp)"
  sed -E "s/^[[:space:]]*TORZLINK_NETWORK_MODE=.*/TORZLINK_NETWORK_MODE=${mode}/" "${ENV_FILE}" >"${tmp}"
  cat "${tmp}" >"${ENV_FILE}"
  rm -f "${tmp}"
else
  printf '\nTORZLINK_NETWORK_MODE=%s\n' "${mode}" >>"${ENV_FILE}"
fi
chmod 600 "${ENV_FILE}" 2>/dev/null || true
# Sibling may run as root — restore prior ownership (not PUID/PGID of media mounts).
if [ "$(id -u)" = "0" ]; then
  chown "${env_owner}" "${ENV_FILE}" 2>/dev/null || true
fi

set -a
# shellcheck disable=SC1090
. "${ENV_FILE}"
set +a

if [ "${APPLY}" -eq 0 ]; then
  # Hand off to a sibling so `docker rm -f torzlink` does not kill the apply steps.
  # Volume mounts are always HOST paths — never pass the in-container /deploy mount.
  host_deploy="${TORZLINK_DEPLOY_HOST_PATH:-}"
  [ -n "${host_deploy}" ] || die "TORZLINK_DEPLOY_HOST_PATH is required for VPN switch handoff"

  img="${TORZLINK_IMAGE:-}"
  if [ -z "${img}" ]; then
    img="$(docker inspect -f '{{.Config.Image}}' torzlink 2>/dev/null || true)"
  fi
  [ -n "${img}" ] || die "TORZLINK_IMAGE unset and could not inspect running torzlink"

  info "scheduling network switch to ${mode} via sibling (${img})"
  docker rm -f torzlink-netswitch 2>/dev/null || true
  # --user root: reliable docker.sock access; --rm cleans up after apply
  docker run -d --rm --user root \
    --name "torzlink-netswitch" \
    -v /var/run/docker.sock:/var/run/docker.sock \
    -v "${host_deploy}:/deploy" \
    -e TORZLINK_DEPLOY_DIR=/deploy \
    -e TORZLINK_DEPLOY_HOST_PATH="${host_deploy}" \
    -e TORZLINK_PREV_NETWORK_MODE="${prev_mode}" \
    -e TORZLINK_COMPOSE_FILE=/deploy/docker-compose.nas.yml \
    -e COMPOSE_PROJECT_NAME=torzlink \
    -e TORZLINK_IMAGE="${img}" \
    --entrypoint sh \
    "${img}" \
    /deploy/torzlink-network-switch.sh --apply "${mode}" >/dev/null
  exit 0
fi

# --- --apply path (sibling container) ---
sleep "${TORZLINK_NETWORK_SWITCH_DELAY:-2}"

if [ "${mode}" = "direct" ]; then
  [ -n "${PROXY_NET_NAME:-}" ] || die "PROXY_NET_NAME is required for direct mode"
fi
if [ "${mode}" = "vpn" ]; then
  g="${GLUETUN_CONTAINER_NAME:-gluetun}"
  docker inspect -f '{{.State.Running}}' "${g}" 2>/dev/null | grep -qx true \
    || die "gluetun container '${g}' is not running"
  ensure="${DEPLOY_DIR}/ensure-gluetun-traefik-labels.sh"
  if [ -f "${ensure}" ]; then
    info "ensuring TorZlink Traefik labels on ${g}"
    sh "${ensure}" --apply \
      || die "TorZlink Traefik labels missing on gluetun — see traefik-gluetun-torzlink.labels.md"
  else
    info "hint: ${ensure} not found — paste Traefik labels onto gluetun for vpn UI"
  fi
fi

compose() {
  docker compose --env-file "${ENV_FILE}" --profile "${mode}" -f "${COMPOSE_FILE}" "$@"
}

info "applying TorZlink profile=${mode} (project=${COMPOSE_PROJECT_NAME})"

if [ "${mode}" = "direct" ]; then
  docker compose --env-file "${ENV_FILE}" --profile vpn -f "${COMPOSE_FILE}" down 2>/dev/null || true
else
  docker compose --env-file "${ENV_FILE}" --profile direct -f "${COMPOSE_FILE}" down 2>/dev/null || true
fi
docker rm -f torzlink 2>/dev/null || true

if ! compose up -d; then
  info "compose up failed for ${mode} — attempting restore to ${prev_mode}"
  if grep -qE '^[[:space:]]*TORZLINK_NETWORK_MODE=' "${ENV_FILE}"; then
    tmp="$(mktemp)"
    sed -E "s/^[[:space:]]*TORZLINK_NETWORK_MODE=.*/TORZLINK_NETWORK_MODE=${prev_mode}/" "${ENV_FILE}" >"${tmp}"
    cat "${tmp}" >"${ENV_FILE}"
    rm -f "${tmp}"
  fi
  chmod 600 "${ENV_FILE}" 2>/dev/null || true
  if [ "$(id -u)" = "0" ]; then
    chown "${env_owner}" "${ENV_FILE}" 2>/dev/null || true
  fi
  docker compose --env-file "${ENV_FILE}" --profile "${prev_mode}" -f "${COMPOSE_FILE}" up -d \
    || die "compose up failed for ${mode} and restore to ${prev_mode} also failed"
  die "compose up failed for ${mode}; restored profile ${prev_mode}"
fi
info "TorZlink up (profile=${mode})"
