# Stops the field-guide static server started by start-server.ps1 or the Startup launcher.

$procs = Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
  Where-Object { $_.CommandLine -like '*vibecoded-games-lookup*serve.mjs*' }
if (-not $procs) { "Server is not running."; return }
foreach ($p in $procs) {
  Stop-Process -Id $p.ProcessId -Force -Confirm:$false
  "Stopped pid $($p.ProcessId)"
}
