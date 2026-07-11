#!/usr/bin/env bash
# Pre-release gate — see docs/agent-workflow.md
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

fail() { echo "pre-release FAIL: $1" >&2; exit 1; }
ok() { echo "pre-release OK: $1"; }

json_version() {
  grep -m1 '"version"' "$1" | sed -E 's/.*"version": "([^"]+)".*/\1/'
}

# Lockfile version matches package.json
PKG_VER="$(json_version package.json)"
LOCK_VER="$(json_version package-lock.json)"
[[ -n "$PKG_VER" && -n "$LOCK_VER" ]] || fail "could not read version from package.json / package-lock.json"
[[ "$PKG_VER" == "$LOCK_VER" ]] || fail "package.json ($PKG_VER) != package-lock.json ($LOCK_VER)"

# package-lock.json not excluded from Docker context
if [[ -f .dockerignore ]] && grep -qE '^package-lock\.json$' .dockerignore; then
  fail ".dockerignore excludes package-lock.json but Dockerfile uses npm ci"
fi

# Dockerfile expects lockfile when using npm ci
if grep -q 'npm ci' packaging/docker/Dockerfile && ! grep -q 'package-lock.json' packaging/docker/Dockerfile; then
  fail "Dockerfile runs npm ci but does not COPY package-lock.json"
fi

# SBOM writes to file (release.yml pattern)
if [[ -f .github/workflows/release.yml ]]; then
  if grep -q 'npm sbom' .github/workflows/release.yml && ! grep -qE 'sbom.*>' .github/workflows/release.yml; then
    fail "release.yml runs npm sbom without shell redirect to sbom.cdx.json"
  fi
fi

# Tests + build (npm on PATH when invoked via `npm run pre-release`)
command -v npm >/dev/null 2>&1 || fail "npm not in PATH — run via: npm run pre-release"
npm test
npm run typecheck
npm run build

# SBOM artifact
SBOM_TMP="$(mktemp)"
npm sbom --omit=dev --sbom-format=cyclonedx --sbom-type=library > "$SBOM_TMP"
[[ -s "$SBOM_TMP" ]] || fail "npm sbom produced empty output"
head -c 1 "$SBOM_TMP" | grep -q '{' || fail "npm sbom output does not look like JSON"
rm -f "$SBOM_TMP"
ok "SBOM generation"

# Docker image builds
if command -v docker >/dev/null 2>&1; then
  docker build -f packaging/docker/Dockerfile -t torzlink:pre-release-check . >/dev/null
  ok "docker build"
else
  echo "pre-release SKIP: docker not in PATH (install Docker Desktop to verify image build)"
fi

ok "all gates passed ($PKG_VER)"
