# Probe writable NAS paths (uses project .env; does not print secrets)
$ErrorActionPreference = "Stop"
$repo = Split-Path (Split-Path $PSScriptRoot -Parent) -ErrorAction SilentlyContinue
if (-not $repo) { $repo = Resolve-Path (Join-Path $PSScriptRoot "..") }
# when run as tools/probe-nas.ps1:
$repo = Resolve-Path (Join-Path $PSScriptRoot "..")
$envfile = Join-Path $repo ".env"

function Read-DotEnvValue([string]$Path, [string]$Key) {
  foreach ($line in Get-Content $Path) {
    if ($line -match "^\s*#") { continue }
    if ($line -match "^\s*$Key=(.*)$") {
      return $Matches[1].Trim().Trim('"').Trim("'")
    }
  }
  return $null
}

$user = Read-DotEnvValue $envfile "NAS_USER"
$hostName = Read-DotEnvValue $envfile "NAS_HOST"
$pw = Read-DotEnvValue $envfile "NAS_PASSWORD"
$hk = Read-DotEnvValue $envfile "NAS_SSH_HOSTKEY"
if (-not $hk) { $hk = "SHA256:hSaoxpgiKbS84xk9OkJQ/f6Z2/j6tmnVk8o0TwWb3l0" }
$plink = "${env:ProgramFiles}\PuTTY\plink.exe"
$remote = "$user@$hostName"
$cmd = @'
set -e
echo USER=$(id -un) UID=$(id -u) GROUPS=$(id -Gn)
echo HOME=$HOME
ls -ld /volume2 /volume2/Docker_Configs /volume1 /volume1/data 2>&1 || true
for d in /volume2/Docker_Configs/torzlink-deploy /volume2/Docker_Configs/torzlink "$HOME/torzlink-deploy"; do
  if mkdir -p "$d" 2>/dev/null; then echo WRITABLE:$d; else echo DENIED:$d; fi
done
for d in /volume1/data/media/torzlink; do
  if mkdir -p "$d" 2>/dev/null; then echo WRITABLE:$d; else echo DENIED:$d; fi
done
'@

$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = $plink
$psi.Arguments = "-ssh -batch -hostkey `"$hk`" -pw `"$pw`" $remote $cmd"
$psi.UseShellExecute = $false
$psi.RedirectStandardOutput = $true
$psi.RedirectStandardError = $true
$p = [Diagnostics.Process]::Start($psi)
$out = $p.StandardOutput.ReadToEnd()
$err = $p.StandardError.ReadToEnd()
$p.WaitForExit()
Write-Host $out
if ($err) { Write-Host $err }
exit $p.ExitCode
