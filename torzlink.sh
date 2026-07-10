#!/usr/bin/env bash
# Keep in sync with torzlink.ps1 — see docs/follow-ups-launchers.md
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

mode=""

case "${1:-}" in
  --native|-n|1) mode=native ;;
  --docker|-d|2) mode=docker ;;
esac

show_menu() {
  echo "TorZlink — launcher"
  echo "  1) Native (Node.js, local development)"
  echo "  2) Docker (interactive container)"
  echo "  q) Exit"
}

resolve_mode_from_menu() {
  while true; do
    show_menu
    read -r -p "Choose [1/2/q]: " pick
    case "$pick" in
      1) mode=native; break ;;
      2) mode=docker; break ;;
      q|Q) exit 0 ;;
      *)
        echo "Invalid option. Use 1, 2, or q." >&2
        ;;
    esac
  done
}

if [[ -z "$mode" ]]; then
  if [[ -t 0 ]]; then
    resolve_mode_from_menu
  else
    echo "No TTY. Use --native or --docker." >&2
    exit 1
  fi
fi

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "$2" >&2
    exit 1
  fi
}

run_native() {
  require_command node "Node.js not found. Install Node 22+ (see README)."
  require_command npm "npm not found. Install Node 22+ (see README)."
  npm run launch
}

ensure_docker_env_file() {
  local env_path="$ROOT/.env"
  if [[ -f "$env_path" ]]; then
    return 0
  fi

  echo ""
  echo ".env not found (optional — only needed for Telegram notifications)."
  echo "Docker Compose requires the file to exist."

  if [[ -t 0 ]]; then
    read -r -p "Create empty .env and continue? [Y/n]: " answer
    case "$answer" in
      n|N)
        echo "Docker launch cancelled. Copy .env.example to .env or create an empty .env file." >&2
        exit 1
        ;;
    esac
  else
    echo "Creating empty .env (non-interactive mode)." >&2
  fi

  : >"$env_path"
  echo "Created empty .env at $env_path"
  if [[ -f "$ROOT/.env.example" ]]; then
    echo "Tip: copy settings from .env.example if you want Telegram notifications."
  fi
  echo ""
}

run_docker() {
  require_command docker "Docker not found. Install Docker Desktop or Docker Engine (see README)."
  if ! docker compose version >/dev/null 2>&1; then
    echo "docker compose not found. Install Docker Compose v2 (see README)." >&2
    exit 1
  fi
  ensure_docker_env_file
  docker compose -f packaging/docker/docker-compose.yml build --quiet torzlink
  docker compose -f packaging/docker/docker-compose.yml run --rm -it torzlink
}

if [[ "$mode" == docker ]]; then
  run_docker
else
  run_native
fi
