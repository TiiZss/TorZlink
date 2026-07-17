# Smoke-test TorZlink `serve` (health, auth, API JSON, magnet add+cancel).
# Usage (PowerShell, repo root or any cwd):
#   .\tools\smoke-serve.ps1
#   .\tools\smoke-serve.ps1 -Image ghcr.io/tiizss/torzlink:v1.8.0
#   .\tools\smoke-serve.ps1 -Image torzlink:v1.8.0 -Port 8788
#
# Notes:
# - List shape is { items: [...] } (not .downloads).
# - Cancel is POST /api/downloads/:id/cancel (not DELETE).
# - Do not probe /api/events with Invoke-WebRequest (SSE hangs until killed).

[CmdletBinding()]
param(
  [string]$Image = "",
  [int]$Port = 8788,
  [string]$Token = "smoke-token",
  [string]$ContainerName = "torzlink-smoke",
  [switch]$SkipPull
)

$ErrorActionPreference = "Stop"

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
if (-not $Image) {
  $pkg = Get-Content (Join-Path $RepoRoot "package.json") -Raw | ConvertFrom-Json
  $Image = "ghcr.io/tiizss/torzlink:v$($pkg.version)"
}

function Fail([string]$msg) {
  Write-Host "FAIL: $msg" -ForegroundColor Red
  exit 1
}

function Ok([string]$msg) { Write-Host "OK: $msg" -ForegroundColor Green }

$dl = Join-Path $env:TEMP ("torzlink-smoke-dl-" + $Port)
$data = Join-Path $env:TEMP ("torzlink-smoke-data-" + $Port)
New-Item -ItemType Directory -Force -Path $dl, $data | Out-Null
docker rm -f $ContainerName 2>$null | Out-Null

if (-not $SkipPull -and $Image -match "/") {
  Write-Host "-> docker pull $Image"
  docker pull $Image
  if ($LASTEXITCODE -ne 0) { Fail "docker pull failed" }
}

Write-Host "-> docker run $Image serve on :$Port"
docker run -d --name $ContainerName `
  -p "${Port}:8787" `
  -v "${data}:/data" `
  -v "${dl}:/downloads" `
  -e TORZLINK_SKIP_UPDATE=1 `
  -e TORZLINK_DISABLE_NAT=1 `
  -e "TORZLINK_SERVE_TOKEN=$Token" `
  $Image `
  serve --host 0.0.0.0 --port 8787 | Out-Null
if ($LASTEXITCODE -ne 0) { Fail "docker run failed" }

try {
  $base = "http://127.0.0.1:$Port"
  $health = $null
  for ($i = 0; $i -lt 40; $i++) {
    try {
      $health = Invoke-WebRequest -Uri "$base/health" -UseBasicParsing -TimeoutSec 2
      if ($health.StatusCode -eq 200) { break }
    } catch {
      Start-Sleep -Milliseconds 500
    }
  }
  if (-not $health -or $health.StatusCode -ne 200) {
    docker logs $ContainerName 2>&1 | Select-Object -Last 40 | Out-Host
    Fail "/health never became ready"
  }
  Ok "/health $($health.Content)"

  $ver = docker run --rm $Image --version 2>&1
  Ok "version $ver"

  $auth = @{ Authorization = "Bearer $Token" }

  try {
    Invoke-WebRequest -Uri "$base/api/config" -UseBasicParsing -TimeoutSec 10 | Out-Null
    Fail "expected 401 without Bearer on /api/config"
  } catch {
    $code = [int]$_.Exception.Response.StatusCode
    if ($code -ne 401) { Fail "unauth /api/config got $code (want 401)" }
  }
  Ok "unauth /api/config → 401"

  foreach ($path in @("/api/auth", "/api/config", "/api/network", "/api/downloads", "/api/history", "/api/seeds")) {
    $r = Invoke-WebRequest -Uri "$base$path" -Headers $auth -UseBasicParsing -TimeoutSec 15
    $ct = "$($r.Headers['Content-Type'])"
    if ($r.StatusCode -ne 200 -or $ct -notlike "*json*") {
      Fail "$path status=$($r.StatusCode) ct=$ct"
    }
  }
  Ok "API JSON endpoints"

  $magnet = "magnet:?xt=urn:btih:08ada5a7a6183aae1e09d831df6748d566095a10&dn=Sintel&tr=udp%3A%2F%2Fexplodie.org%3A6969&tr=udp%3A%2F%2Ftracker.opentrackr.org%3A1337"
  $body = (@{ input = $magnet } | ConvertTo-Json -Compress)
  $post = Invoke-WebRequest -Uri "$base/api/downloads" -Method POST -Headers $auth `
    -ContentType "application/json" -Body $body -UseBasicParsing -TimeoutSec 20
  if ($post.StatusCode -ne 201) { Fail "POST /api/downloads → $($post.StatusCode)" }
  $id = ($post.Content | ConvertFrom-Json).id
  if (-not $id) { Fail "POST missing id: $($post.Content)" }
  Ok "POST download id=$id"

  $seen = $false
  $status = ""
  for ($i = 0; $i -lt 25; $i++) {
    Start-Sleep -Milliseconds 800
    $list = Invoke-WebRequest -Uri "$base/api/downloads" -Headers $auth -UseBasicParsing -TimeoutSec 10
    $items = @(($list.Content | ConvertFrom-Json).items)
    $item = $items | Where-Object { $_.id -eq $id } | Select-Object -First 1
    if ($item) {
      $seen = $true
      $status = [string]$item.status
      Write-Host "   poll[$i] status=$status peers=$($item.peers)"
      break
    }
  }
  if (-not $seen) { Fail "download $id never appeared in { items: [...] }" }
  Ok "queue status=$status"

  $cancel = Invoke-WebRequest -Uri "$base/api/downloads/$id/cancel" -Method POST -Headers $auth `
    -ContentType "application/json" -Body "{}" -UseBasicParsing -TimeoutSec 15
  if ($cancel.StatusCode -ne 200) { Fail "cancel → $($cancel.StatusCode)" }
  $after = Invoke-WebRequest -Uri "$base/api/downloads" -Headers $auth -UseBasicParsing -TimeoutSec 10
  $left = @(($after.Content | ConvertFrom-Json).items) | Where-Object { $_.id -eq $id }
  if ($left) { Fail "download still in queue after cancel" }
  Ok "cancel cleared queue"

  Write-Host ""
  Write-Host "SMOKE PASS ($Image)" -ForegroundColor Green
  exit 0
} finally {
  docker rm -f $ContainerName 2>$null | Out-Null
}
