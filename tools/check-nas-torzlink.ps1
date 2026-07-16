$ErrorActionPreference = "Stop"
$repo = Resolve-Path (Join-Path $PSScriptRoot "..")
$envfile = Join-Path $repo ".env"
function Read-DotEnvValue([string]$Path, [string]$Key) {
  foreach ($line in Get-Content $Path) {
    if ($line -match "^\s*#") { continue }
    if ($line -match "^\s*$Key=(.*)$") { return $Matches[1].Trim().Trim('"').Trim("'") }
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
$cmd = "docker exec torzlink wget -qO- http://127.0.0.1:8787/health; echo; docker ps --filter name=torzlink --format '{{.Names}} {{.Status}}'"
$arg = "-ssh -batch -hostkey `"$hk`" -pw `"$pw`" $remote $cmd"
$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = $plink
$psi.Arguments = $arg
$psi.UseShellExecute = $false
$psi.RedirectStandardOutput = $true
$psi.RedirectStandardError = $true
$p = [Diagnostics.Process]::Start($psi)
$out = $p.StandardOutput.ReadToEnd()
$err = $p.StandardError.ReadToEnd()
$p.WaitForExit(15000) | Out-Null
Write-Host $out
if ($err) { Write-Host $err }
exit $p.ExitCode
