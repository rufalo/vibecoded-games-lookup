# Makes the field-guide server start automatically when you log in to Windows, by writing a
# tiny hidden-window launcher into your Startup folder (no admin rights needed).
#
#   powershell -File scripts\install-autostart.ps1              # install / refresh
#   powershell -File scripts\install-autostart.ps1 -Uninstall   # remove
#
# The Tailscale side needs no autostart: `tailscale serve --bg` settings persist across reboots.

param([switch]$Uninstall)

$ErrorActionPreference = 'Stop'
$startup = [Environment]::GetFolderPath('Startup')
$launcher = Join-Path $startup 'vibecoded-games-lookup-server.vbs'

if ($Uninstall) {
  if (Test-Path $launcher) { Remove-Item $launcher -Confirm:$false; "Removed $launcher" }
  else { "Nothing to remove ($launcher not found)." }
  return
}

$node = (Get-Command node -ErrorAction Stop).Source
$serve = (Resolve-Path (Join-Path $PSScriptRoot 'serve.mjs')).Path

$vbs = @"
' Starts the Vibe-Coded Games field-guide server (http://127.0.0.1:8210/) with no window.
' Installed by $($PSScriptRoot)\install-autostart.ps1. Remove with: install-autostart.ps1 -Uninstall
CreateObject("WScript.Shell").Run """$node"" ""$serve""", 0, False
"@

Set-Content -Path $launcher -Value $vbs -Encoding ASCII
"Installed $launcher"
